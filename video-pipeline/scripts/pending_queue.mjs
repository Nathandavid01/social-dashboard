import { resolveDashboard } from '../dashboard_paths.mjs';
// Read-only: ideas with an uploaded raw and no uploaded edit.
// Credentials stay in the dashboard env. This script prints titles and ids only.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const dashboard = resolveDashboard(resolve(root, '..'));
process.loadEnvFile(resolve(dashboard, '.env.local'));
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error('Falta configuración del dashboard');

async function all(table, query) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${from}-${from + 999}`,
      },
    });
    if (!response.ok) throw Error(`Lectura ${table}: HTTP ${response.status}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) break;
  }
  return rows;
}

const clients = await all('clients', 'select=id,name,edit_mode&status=eq.active');
const ideas = await all('content_ideas', 'select=id,client_id,title,status&status=in.(grabada,producida,asignada)');
const videos = await all('content_idea_videos', 'select=id,idea_id,kind,status,storage_provider,size_bytes&status=eq.uploaded&kind=in.(raw,edited)');
const clientById = new Map(clients.map((client) => [client.id, client]));
const mediaByIdea = new Map();
for (const video of videos) {
  const bucket = mediaByIdea.get(video.idea_id) || { raws: [], edited: 0 };
  if (video.kind === 'raw') {
    bucket.raws.push({
      id: video.id,
      provider: video.storage_provider,
      bytes: video.size_bytes || 0,
    });
  }
  if (video.kind === 'edited') bucket.edited += 1;
  mediaByIdea.set(video.idea_id, bucket);
}

const pending = [];
for (const idea of ideas) {
  if (idea.status === 'descartada' || idea.status === 'publicada') continue;
  const media = mediaByIdea.get(idea.id);
  if (!media || !media.raws.length || media.edited > 0) continue;
  const client = clientById.get(idea.client_id);
  if (!client) continue;
  pending.push({
    client_id: client.id,
    client_name: client.name.trim(),
    edit_mode: client.edit_mode,
    idea_id: idea.id,
    title: idea.title,
    status: idea.status,
    raws: media.raws,
  });
}

console.log(JSON.stringify({ fetched_at: new Date().toISOString(), ideas: pending }));
