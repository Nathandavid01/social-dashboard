#!/usr/bin/env node
/**
 * Siembra el staging con lo mínimo para que los E2E tengan algo que mirar:
 * un usuario supervisor, un cliente y UN video entregado esperando revisión.
 *
 * Idempotente: se puede correr antes de cada suite. Todo lo que crea lleva el
 * marcador E2E en el nombre, así que nunca se confunde con trabajo real — y
 * `check-staging-env` ya garantizó que esto no es producción.
 */
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { parseEnvFile, stagingEnvProblems } from './check-staging-env.mjs'

const E2E_CLIENT_NAME = 'Cliente E2E'
const E2E_CLIENT_B_NAME = 'Cliente E2E Dos'
const E2E_IDEA_TITLE = 'Video E2E en revisión'

function loadEnv() {
  const file = resolve(process.cwd(), '.env.staging')
  if (!existsSync(file)) {
    console.error('✖ No hay .env.staging — ver docs/STAGING.md')
    process.exit(1)
  }
  const env = parseEnvFile(readFileSync(file, 'utf8'))
  const problems = stagingEnvProblems(env)
  if (problems.length) {
    console.error(`✖ .env.staging inválido:\n${problems.map((p) => `  · ${p}`).join('\n')}`)
    process.exit(1)
  }
  return env
}

async function ensureUser(admin, email, password) {
  // createUser falla si ya existe; se busca y se reusa en vez de romper la corrida.
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: 'E2E Supervisor' },
  })
  if (!error) return data.user.id

  const { data: list } = await admin.auth.admin.listUsers({ perPage: 200 })
  const found = list?.users?.find((u) => u.email === email)
  if (!found) throw new Error(`No se pudo crear ni encontrar el usuario E2E: ${error.message}`)
  // La contraseña se reafirma: si alguien la cambió, el login del E2E fallaría.
  await admin.auth.admin.updateUserById(found.id, { password, email_confirm: true })
  return found.id
}

async function main() {
  const env = loadEnv()
  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const userId = await ensureUser(admin, env.E2E_USER_EMAIL, env.E2E_USER_PASSWORD)
  // El rol lo pone el trigger en 'team_member'; /revision pide revision.read.
  // El avatar no es cosmético: sin él, AvatarSetupGate abre un diálogo modal
  // encima de todo al entrar y ningún E2E puede pulsar nada detrás.
  await admin
    .from('profiles')
    .update({
      role: 'supervisor',
      full_name: 'E2E Supervisor',
      avatar_url:
        'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2NCIgaGVpZ2h0PSI2NCI+PHJlY3Qgd2lkdGg9IjY0IiBoZWlnaHQ9IjY0IiBmaWxsPSIjNGE0YTRhIi8+PC9zdmc+',
    })
    .eq('id', userId)

  async function ensureClient(name) {
    const { data: found } = await admin.from('clients').select('id').eq('name', name).maybeSingle()
    if (found?.id) return found.id
    const { data, error } = await admin
      .from('clients')
      .insert({ name, status: 'active', platforms: ['instagram'], created_by: userId })
      .select('id')
      .single()
    if (error) throw new Error(`clients (${name}): ${error.message}`)
    return data.id
  }

  const clientId = await ensureClient(E2E_CLIENT_NAME)
  // Dos clientes agendados para grabar: "Escribir ideas" solo lista esos, y sin
  // dos no se puede probar que cambiar de cliente no arrastra lo tecleado.
  const clientBId = await ensureClient(E2E_CLIENT_B_NAME)

  for (const [cid, titulo] of [[clientId, 'Sesión E2E'], [clientBId, 'Sesión E2E dos']]) {
    const { data: sesion } = await admin
      .from('recording_sessions')
      .select('id')
      .eq('client_id', cid)
      .eq('title', titulo)
      .maybeSingle()
    if (!sesion) {
      const { error } = await admin.from('recording_sessions').insert({
        client_id: cid,
        title: titulo,
        session_date: new Date().toISOString().slice(0, 10),
        status: 'scheduled',
        created_by: userId,
      })
      if (error) throw new Error(`recording_sessions (${titulo}): ${error.message}`)
    }
  }

  // Los borradores son por persona y cliente: si quedan de una corrida anterior,
  // la prueba empieza con texto que ella no escribió.
  await admin.from('idea_drafts').delete().eq('user_id', userId)

  const { data: existingIdea } = await admin
    .from('content_ideas')
    .select('id')
    .eq('client_id', clientId)
    .eq('title', E2E_IDEA_TITLE)
    .maybeSingle()

  let ideaId = existingIdea?.id
  const ideaFields = {
    client_id: clientId,
    content_type: 'R',
    title: E2E_IDEA_TITLE,
    status: 'producida',
    approval_status: 'submitted',
    // Sin fecha → cae en la pestaña "Sin día", que es determinista para el E2E
    // (las pestañas por día dependen de qué día se corra la suite).
    publish_date: null,
    submitted_at: new Date().toISOString(),
    created_by: userId,
  }
  if (ideaId) {
    await admin.from('content_ideas').update(ideaFields).eq('id', ideaId)
  } else {
    const { data, error } = await admin.from('content_ideas').insert(ideaFields).select('id').single()
    if (error) throw new Error(`content_ideas: ${error.message}`)
    ideaId = data.id
  }

  // La tarjeta solo sale en /revision si hay un 'edited' en entregas-r2:
  // es lo que distingue "el editor lo entregó" del pipeline viejo.
  const { data: existingVideo } = await admin
    .from('content_idea_videos')
    .select('id')
    .eq('idea_id', ideaId)
    .eq('kind', 'edited')
    .maybeSingle()

  if (!existingVideo) {
    const { error } = await admin.from('content_idea_videos').insert({
      idea_id: ideaId,
      kind: 'edited',
      name: 'e2e-video.mp4',
      status: 'uploaded',
      storage_provider: 'entregas-r2',
      uploaded_by: userId,
    })
    if (error) throw new Error(`content_idea_videos: ${error.message}`)
  }

  console.log(
    `✓ staging sembrado — usuario ${env.E2E_USER_EMAIL}, clientes "${E2E_CLIENT_NAME}" y "${E2E_CLIENT_B_NAME}" (agendados), idea ${ideaId}`,
  )
}

main().catch((e) => {
  console.error('✖ seed de staging falló:', e.message)
  process.exit(1)
})
