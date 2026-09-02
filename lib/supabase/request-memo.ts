import { cookies } from 'next/headers'

/**
 * Memoización POR REQUEST para lecturas que se repiten dentro de un mismo
 * render/acción (validar la sesión, leer el perfil propio, etc.).
 *
 * El scope es el objeto que devuelve `cookies()`: Next crea uno por request y
 * devuelve siempre el mismo dentro de él, así que sirve de llave sin fugas
 * entre usuarios. Fuera de un request (scripts, tests sin mock) `cookies()`
 * lanza y aquí se ejecuta sin memoizar.
 *
 * Por qué no `cache()` de React: el `react` que resuelve vitest (18.3 estable)
 * no lo exporta, y sin dispatcher tampoco memoiza — el test nunca podría
 * demostrar la garantía. Por qué no `unstable_cache`: es compartido entre
 * usuarios y persistente; aquí todo depende de la sesión.
 */
const scopes = new WeakMap<object, Map<string, Promise<unknown>>>()

async function currentScope(): Promise<object | null> {
  try {
    const store = await cookies()
    return store && typeof store === 'object' ? (store as object) : null
  } catch {
    return null
  }
}

export async function memoPerRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const scope = await currentScope()
  if (!scope) return fn()

  let memo = scopes.get(scope)
  if (!memo) {
    memo = new Map()
    scopes.set(scope, memo)
  }

  const hit = memo.get(key)
  if (hit) return hit as Promise<T>

  const pending = fn()
  memo.set(key, pending)
  // Un rechazo no se memoiza: el siguiente intento vuelve a ejecutar.
  pending.catch(() => {
    if (memo!.get(key) === pending) memo!.delete(key)
  })
  return pending
}

/** Vacía la memo del request actual (tras signOut / signIn / cambios de sesión). */
export async function invalidateRequestMemo(): Promise<void> {
  const scope = await currentScope()
  if (scope) scopes.delete(scope)
}
