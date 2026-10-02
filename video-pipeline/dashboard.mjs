import { resolveDashboard } from './dashboard_paths.mjs';
// Local, read-only connector. Credentials stay in the dashboard environment.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, statSync, renameSync, createWriteStream, unlinkSync, copyFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { spawnSync } from 'node:child_process';

const root = dirname(fileURLToPath(import.meta.url));
// Originals are large. PIPELINE_MEDIA_ROOT points at the external SSD so a
// download does not fill the internal disk. Catalog JSON stays in this repo.
const mediaRoot = process.env.PIPELINE_MEDIA_ROOT ? resolve(process.env.PIPELINE_MEDIA_ROOT) : root;
const dashboard = resolveDashboard(root);
process.loadEnvFile(resolve(dashboard, '.env.local'));
const require = createRequire(resolve(dashboard, 'package.json'));
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const CLIENTS = {
  nanas: { id: 'db697a50-56af-49b4-a002-1cf75f7e4560', name: "Nana’s Playhouse", slug: 'nanas', catalog: 'catalog.json', mediaDir: 'media' },
  truco: { id: '7dd62e83-acc5-45eb-aba1-237987e9f4ff', name: 'El Truco de Guin', slug: 'truco', catalog: 'truco-catalog.json', mediaDir: 'media/truco' },
};
function parseArgs(argv) {
  const out = { clientKey: process.env.DASHBOARD_CLIENT || 'nanas', localImport: null, ids: [] };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--client') { out.clientKey = argv[i + 1]; i += 1; continue; }
    if (argv[i] === '--import') {
      out.localImport = { id: argv[i + 1], file: argv[i + 2] };
      i += 2;
      continue;
    }
    out.ids.push(argv[i]);
  }
  return out;
}
const args = parseArgs(process.argv.slice(2));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const known = CLIENTS[args.clientKey];
const client = known || (uuid.test(args.clientKey)
  ? { id: args.clientKey, name: args.clientKey, slug: args.clientKey.slice(0, 8), catalog: `${args.clientKey.slice(0, 8)}-catalog.json`, mediaDir: `media/${args.clientKey.slice(0, 8)}` }
  : null);
if (!client) throw Error(`Cliente desconocido: ${args.clientKey}. Usa nanas, truco o un UUID.`);
const clientId = client.id;
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw Error('Falta configuración del dashboard');
async function get(table, query) {
  const response = await fetch(`${url}/rest/v1/${table}?${new URLSearchParams(query)}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  });
  if (!response.ok) throw Error(`Lectura ${table}: HTTP ${response.status}`);
  return response.json();
}
const ideas = await get('content_ideas', {
  select: 'id,client_id,title,hook,visual_brief,status,created_at,videos:content_idea_videos!content_idea_videos_idea_id_fkey(id,name,kind,status,storage_provider,size_bytes,drive_file_id)',
  client_id: `eq.${clientId}`, order: 'created_at.desc',
});
mkdirSync(resolve(root, 'runs'), { recursive: true });
writeFileSync(resolve(root, 'runs', client.catalog), JSON.stringify({ fetched_at: new Date().toISOString(), client_id: clientId, client, ideas }, null, 2));
const localImport = args.localImport;
if (localImport && (!localImport.id || !localImport.file)) throw Error('Uso: --import VIDEO_ID ARCHIVO');
const requested = localImport ? [localImport.id] : args.ids;
if (!requested.length) {
  console.log(JSON.stringify({
    client: { id: client.id, name: client.name, slug: client.slug },
    ideas: ideas.filter(i => i.videos.length).map(i => ({
      id: i.id, title: i.title, status: i.status, hook: i.hook,
      videos: i.videos.map(v => ({ id: v.id, name: v.name, kind: v.kind, status: v.status, provider: v.storage_provider, mb: +(v.size_bytes / 1e6).toFixed(1) })),
    })),
  }, null, 2));
} else {
  const selected = requested.map(id => {
    const idea = ideas.find(i => i.videos.some(v => v.id === id));
    if (!idea) throw Error(`Video ${id} no pertenece a ${client.name}`);
    const video = idea.videos.find(v => v.id === id);
    if (video.status !== 'uploaded') throw Error(`Video ${id} no está completo`);
    if (!['r2', 'entregas-r2'].includes(video.storage_provider)) throw Error('Proveedor no compatible');
    return { idea, video };
  });
  mkdirSync(resolve(mediaRoot, client.mediaDir), { recursive: true });
  for (const { idea, video } of selected) {
    const file = resolve(mediaRoot, client.mediaDir, `${video.id}.mp4`);
    if (localImport) {
      if (statSync(localImport.file).size !== video.size_bytes) throw Error('El archivo local no coincide con el tamaño del dashboard');
      if (resolve(localImport.file) !== file) copyFileSync(localImport.file, file);
    }
    if (!existsSync(file) || statSync(file).size !== video.size_bytes) {
      const prefix = video.storage_provider === 'entregas-r2' ? 'ENTREGAS_R2_' : 'R2_';
      const account = process.env[prefix + 'ACCOUNT_ID'];
      const bucket = process.env[prefix + 'BUCKET'] || (prefix === 'R2_' ? 'nmedia-videos' : '');
      if (!account || !bucket) throw Error('Falta configuración del proveedor. Usa Bajar en el dashboard y luego --import VIDEO_ID ARCHIVO.');
      const s3 = new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId: process.env[prefix + 'ACCESS_KEY_ID'], secretAccessKey: process.env[prefix + 'SECRET_ACCESS_KEY'] } });
      const response = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: video.drive_file_id }));
      const partial = file + '.partial';
      try {
        await pipeline(response.Body, createWriteStream(partial));
        if (statSync(partial).size !== video.size_bytes) throw Error('Descarga incompleta');
        renameSync(partial, file);
      } catch (error) { if (existsSync(partial)) unlinkSync(partial); throw error; }
    }
    const probe = spawnSync('ffprobe', ['-v', 'error', '-show_format', '-show_streams', '-of', 'json', file], { encoding: 'utf8' });
    if (probe.status !== 0) throw Error(`Video ilegible: ${video.id}`);
    const metadata = JSON.parse(probe.stdout);
    if (!metadata.streams.some(s => s.codec_type === 'video')) throw Error('Falta pista de video');
    const hash = createHash('sha256');
    for await (const chunk of createReadStream(file)) hash.update(chunk);
    writeFileSync(file + '.json', JSON.stringify({ video, idea: { id: idea.id, title: idea.title, hook: idea.hook }, sha256: hash.digest('hex'), metadata }, null, 2));
    console.log(JSON.stringify({ file, idea: idea.title, duration: metadata.format.duration, bytes: statSync(file).size }));
  }
}
