import { describe, it, expect } from 'vitest'
import {
  toGrokTools,
  toGrokMessages,
  parseGrokToolCalls,
  type AnthropicToolDef,
} from './tool-adapter'

const TOOL: AnthropicToolDef = {
  name: 'get_clients',
  description: 'Lista los clientes activos',
  input_schema: {
    type: 'object',
    properties: { status: { type: 'string', description: 'active|paused' } },
    required: ['status'],
  },
}

describe('toGrokTools — Anthropic → OpenAI function calling', () => {
  it('envuelve cada herramienta en la forma que espera Grok', () => {
    expect(toGrokTools([TOOL])).toEqual([
      {
        type: 'function',
        function: {
          name: 'get_clients',
          description: 'Lista los clientes activos',
          parameters: TOOL.input_schema,
        },
      },
    ])
  })
  it('input_schema pasa tal cual — es JSON Schema en ambos', () => {
    const [t] = toGrokTools([TOOL])
    expect(t.function.parameters.required).toEqual(['status'])
  })
  it('sin descripción no rompe', () => {
    const [t] = toGrokTools([{ name: 'x', input_schema: { type: 'object', properties: {} } }])
    expect(t.function.description).toBe('')
  })
  it('una lista vacía da una lista vacía', () => {
    expect(toGrokTools([])).toEqual([])
  })
})

describe('toGrokMessages', () => {
  it('un mensaje de texto simple pasa igual', () => {
    expect(toGrokMessages([{ role: 'user', content: 'hola' }])).toEqual([
      { role: 'user', content: 'hola' },
    ])
  })

  it('el system va como primer mensaje, no como campo aparte', () => {
    const out = toGrokMessages([{ role: 'user', content: 'hola' }], 'Eres útil')
    expect(out[0]).toEqual({ role: 'system', content: 'Eres útil' })
    expect(out).toHaveLength(2)
  })

  it('los tool_use del asistente se vuelven tool_calls', () => {
    const out = toGrokMessages([
      {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Voy a buscar' },
          { type: 'tool_use', id: 'tu_1', name: 'get_clients', input: { status: 'active' } },
        ],
      },
    ])
    expect(out[0]).toEqual({
      role: 'assistant',
      content: 'Voy a buscar',
      tool_calls: [
        {
          id: 'tu_1',
          type: 'function',
          function: { name: 'get_clients', arguments: '{"status":"active"}' },
        },
      ],
    })
  })

  it('los tool_result se vuelven mensajes role:tool, uno por cada uno', () => {
    const out = toGrokMessages([
      {
        role: 'user',
        content: [
          { type: 'tool_result', tool_use_id: 'tu_1', content: 'Nora, Gym Titan' },
          { type: 'tool_result', tool_use_id: 'tu_2', content: '3 videos' },
        ],
      },
    ])
    expect(out).toEqual([
      { role: 'tool', tool_call_id: 'tu_1', content: 'Nora, Gym Titan' },
      { role: 'tool', tool_call_id: 'tu_2', content: '3 videos' },
    ])
  })

  it('un asistente sin texto manda content vacío, no undefined', () => {
    const out = toGrokMessages([
      { role: 'assistant', content: [{ type: 'tool_use', id: 't', name: 'n', input: {} }] },
    ])
    expect(out[0].content).toBe('')
  })
})

describe('parseGrokToolCalls', () => {
  const res = (over: object = {}) => ({
    choices: [{ message: { content: 'ok', tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'get_clients', arguments: '{"status":"active"}' } },
    ] }, ...over }],
  })

  it('saca las llamadas con sus argumentos ya parseados', () => {
    expect(parseGrokToolCalls(res())).toEqual([
      { id: 'c1', name: 'get_clients', input: { status: 'active' } },
    ])
  })
  it('sin tool_calls devuelve lista vacía', () => {
    expect(parseGrokToolCalls({ choices: [{ message: { content: 'listo' } }] })).toEqual([])
  })
  it('argumentos rotos no tumban la conversación', () => {
    const bad = { choices: [{ message: { tool_calls: [
      { id: 'c1', type: 'function', function: { name: 'x', arguments: '{roto' } },
    ] } }] }
    expect(parseGrokToolCalls(bad)).toEqual([{ id: 'c1', name: 'x', input: {} }])
  })
  it('una respuesta que no es JSON no rompe', () => {
    expect(parseGrokToolCalls(null)).toEqual([])
    expect(parseGrokToolCalls('<html>error</html>')).toEqual([])
  })
})
