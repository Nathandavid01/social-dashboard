#!/usr/bin/env node
/**
 * Aplica `supabase/migrations/*.sql` en orden a una base de datos destino.
 *
 * Por qué existe teniendo `supabase db push`: el repo tiene prefijos repetidos
 * (0025, 0034, 0038 aparecen dos veces) y la CLI usa el prefijo como clave
 * única, así que revienta con "duplicate key ... schema_migrations_pkey" y NO
 * hay forma de levantar un entorno nuevo. Aquí la clave es el nombre completo
 * del archivo, que sí es único, y el orden es el alfabético del directorio —
 * el mismo que ya asumía todo el mundo.
 *
 *   node scripts/apply-migrations.mjs --db-url <url> [--reset]
 *
 * `--reset` arrasa el schema public antes de empezar: solo para staging, y la
 * guarda de check-staging-env impide que la url sea la de producción.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'

const DIR = resolve(process.cwd(), 'supabase/migrations')

function arg(name) {
  const i = process.argv.indexOf(name)
  return i === -1 ? null : process.argv[i + 1]
}

/** Orden de aplicación: alfabético por nombre de archivo. */
export function migrationFiles(dir = DIR) {
  return readdirSync(dir).filter((f) => f.endsWith('.sql')).sort()
}

async function main() {
  const dbUrl = arg('--db-url') ?? process.env.STAGING_DB_URL
  if (!dbUrl) {
    console.error('✖ falta --db-url (o STAGING_DB_URL)')
    process.exit(1)
  }
  const reset = process.argv.includes('--reset')

  const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } })
  await client.connect()

  if (reset) {
    console.log('› reset del schema public')
    await client.query('drop schema if exists public cascade; create schema public;')
    await client.query('grant usage on schema public to anon, authenticated, service_role;')
    await client.query('grant all on schema public to postgres;')
    // Los perfiles se crean por trigger sobre auth.users: sin borrarlo, el
    // trigger apunta a una función que el reset acaba de tumbar.
    await client.query('drop trigger if exists on_auth_user_created on auth.users;')
    await client.query('delete from auth.users;')
  }

  // Recrear `public` borra los privilegios que Supabase concede de fábrica: sin
  // esto el service_role recibe "permission denied for table …" en cada insert
  // y el seed muere. Se re-otorgan siempre (barato e idempotente), no solo tras
  // --reset, porque una migración nueva también crea tablas sin ellos.
  await client.query(`
    grant usage on schema public to anon, authenticated, service_role;
    grant all on all tables    in schema public to anon, authenticated, service_role;
    grant all on all sequences in schema public to anon, authenticated, service_role;
    grant all on all functions in schema public to anon, authenticated, service_role;
    alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
    alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
    alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  `)

  await client.query(`
    create table if not exists public._migrations_aplicadas (
      archivo text primary key,
      aplicada_en timestamptz not null default now()
    );
  `)
  const { rows } = await client.query('select archivo from public._migrations_aplicadas')
  const yaAplicadas = new Set(rows.map((r) => r.archivo))

  let aplicadas = 0
  for (const file of migrationFiles()) {
    if (yaAplicadas.has(file)) continue
    const sql = readFileSync(resolve(DIR, file), 'utf8')
    process.stdout.write(`› ${file} … `)
    try {
      // Cada migración va en su transacción: o entra entera o no entra.
      await client.query('begin')
      await client.query(sql)
      await client.query('insert into public._migrations_aplicadas (archivo) values ($1)', [file])
      await client.query('commit')
      aplicadas++
      console.log('ok')
    } catch (e) {
      await client.query('rollback')
      console.log('FALLÓ')
      console.error(`\n✖ ${file}: ${e.message}\n`)
      await client.end()
      process.exit(1)
    }
  }

  await client.end()
  console.log(`✓ ${aplicadas} migraciones aplicadas (${yaAplicadas.size} ya estaban)`)
}

main().catch((e) => {
  console.error('✖', e.message)
  process.exit(1)
})
