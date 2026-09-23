import { describe, it, expect } from 'vitest'
import { createSlotQueue } from './slot-queue'

function tick() {
  return new Promise((r) => setTimeout(r, 0))
}

function deferred() {
  let resolve!: () => void
  let reject!: (e: Error) => void
  const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej })
  return { promise, resolve, reject }
}

describe('createSlotQueue', () => {
  it('corre hasta `limit` tareas a la vez; el resto espera en orden de llegada', async () => {
    const q = createSlotQueue(2)
    const started: string[] = []
    const gates = { a: deferred(), b: deferred(), c: deferred(), d: deferred() }
    const runs = (Object.keys(gates) as Array<keyof typeof gates>).map((k) =>
      q.run(async () => { started.push(k); await gates[k].promise }),
    )
    await tick()
    expect(started).toEqual(['a', 'b'])
    expect(q.hasFree()).toBe(false)

    gates.a.resolve()
    await tick()
    expect(started).toEqual(['a', 'b', 'c'])
    gates.b.resolve()
    await tick()
    expect(started).toEqual(['a', 'b', 'c', 'd'])
    gates.c.resolve()
    gates.d.resolve()
    await Promise.all(runs)
    expect(q.hasFree()).toBe(true)
  })

  it('hasFree dice si la próxima tarea entra sin esperar', async () => {
    const q = createSlotQueue(1)
    expect(q.hasFree()).toBe(true)
    const gate = deferred()
    const run = q.run(() => gate.promise)
    expect(q.hasFree()).toBe(false)
    gate.resolve()
    await run
    expect(q.hasFree()).toBe(true)
  })

  it('cancelar mientras espera: sale de la fila con AbortError, sin correr la tarea ni ocupar turno', async () => {
    const q = createSlotQueue(1)
    const gate = deferred()
    const first = q.run(() => gate.promise)
    const ctrl = new AbortController()
    let ran = false
    const waiting = q.run(async () => { ran = true }, ctrl.signal)
    ctrl.abort()
    await expect(waiting).rejects.toMatchObject({ name: 'AbortError' })
    gate.resolve()
    await first
    expect(ran).toBe(false)
    expect(q.hasFree()).toBe(true)
  })

  it('una señal ya abortada ni siquiera entra a la fila', async () => {
    const q = createSlotQueue(1)
    const ctrl = new AbortController()
    ctrl.abort()
    await expect(q.run(async () => 'x', ctrl.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(q.hasFree()).toBe(true)
  })

  it('suelta el turno aunque la tarea falle', async () => {
    const q = createSlotQueue(1)
    await expect(q.run(async () => { throw new Error('boom') })).rejects.toThrow('boom')
    expect(q.hasFree()).toBe(true)
    await expect(q.run(async () => 'ok')).resolves.toBe('ok')
  })

  it('con limit 1 las tareas corren de una en una', async () => {
    const q = createSlotQueue(1)
    let running = 0
    let maxRunning = 0
    const task = async () => {
      running++
      maxRunning = Math.max(maxRunning, running)
      await tick()
      running--
    }
    await Promise.all([q.run(task), q.run(task), q.run(task)])
    expect(maxRunning).toBe(1)
  })

  it('una tarea de fondo (low) cede el turno: la normal que llega después entra antes', async () => {
    const q = createSlotQueue(1)
    const gate = deferred()
    const order: string[] = []
    const first = q.run(() => gate.promise)
    const low = q.run(async () => { order.push('carátula curada') }, undefined, { low: true })
    const normal = q.run(async () => { order.push('carátula de la subida') })
    gate.resolve()
    await Promise.all([first, low, normal])
    expect(order).toEqual(['carátula de la subida', 'carátula curada'])
  })

  it('cancelar una tarea de fondo que espera la saca de su fila', async () => {
    const q = createSlotQueue(1)
    const gate = deferred()
    const first = q.run(() => gate.promise)
    const ctrl = new AbortController()
    const low = q.run(async () => 'x', ctrl.signal, { low: true })
    ctrl.abort()
    await expect(low).rejects.toMatchObject({ name: 'AbortError' })
    gate.resolve()
    await first
    expect(q.hasFree()).toBe(true)
  })
})
