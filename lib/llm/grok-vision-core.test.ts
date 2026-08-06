import { describe, it, expect } from 'vitest'
import {
  buildVisionRequest,
  parseFiltroIRespuesta,
  visionModelId,
  grokVisionConfigError,
  GROK_VISION_MODEL,
} from './grok-vision-core'

/**
 * Grok con imágenes — la mitad pura. Construir la petición multimodal y
 * entender la respuesta con el formato exacto que pidió Nathan.
 *
 * Vive aparte de caption-llm-core.ts a propósito: el flujo de captions que ya
 * funciona no se toca por añadir visión.
 */
describe('buildVisionRequest', () => {
  const base = {
    prompt: 'analiza esto',
    imagenes: ['data:image/jpeg;base64,AAA', 'data:image/jpeg;base64,BBB'],
    apiKey: 'k-1',
    model: 'grok-4.5',
    maxTokens: 4000,
  }
  const bodyOf = (i = base) => JSON.parse(buildVisionRequest(i).body)

  it('autentica y manda JSON', () => {
    const h = buildVisionRequest(base).headers
    expect(h.Authorization).toBe('Bearer k-1')
    expect(h['Content-Type']).toBe('application/json')
  })

  it('usa el modelo que se le pasa', () => {
    expect(bodyOf().model).toBe('grok-4.5')
  })

  /**
   * El texto va PRIMERO y las imágenes después: el modelo tiene que saber qué
   * se le pide antes de mirar 24 fotogramas.
   */
  it('manda el prompt y luego cada imagen como image_url', () => {
    const content = bodyOf().messages[0].content
    expect(content[0]).toEqual({ type: 'text', text: 'analiza esto' })
    expect(content.slice(1)).toEqual([
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAA' } },
      { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,BBB' } },
    ])
  })

  it('sin imágenes sigue siendo una petición válida de solo texto', () => {
    const content = bodyOf({ ...base, imagenes: [] }).messages[0].content
    expect(content).toEqual([{ type: 'text', text: 'analiza esto' }])
  })
})

describe('visionModelId / grokVisionConfigError', () => {
  it('por defecto usa grok-4.5', () => {
    expect(visionModelId({})).toBe(GROK_VISION_MODEL)
    expect(GROK_VISION_MODEL).toBe('grok-4.5')
  })

  it('se puede sobreescribir por entorno sin tocar código', () => {
    expect(visionModelId({ GROK_VISION_MODEL: 'grok-9' })).toBe('grok-9')
    expect(visionModelId({ GROK_VISION_MODEL: '   ' })).toBe(GROK_VISION_MODEL)
  })

  it('reclama la clave de xAI cuando falta', () => {
    expect(grokVisionConfigError({})).toMatch(/XAI_API_KEY/)
    expect(grokVisionConfigError({ XAI_API_KEY: 'x' })).toBeNull()
  })
})

/**
 * El parser del formato que Nathan fijó en el prompt. Si el modelo se sale del
 * formato, se prefiere devolver menos (o nada) antes que inventar filas: una
 * tabla de errores falsos le hace perder el tiempo al editor.
 */
describe('parseFiltroIRespuesta', () => {
  const respuesta = `**Errores encontrados:**

| Texto incorrecto | Corrección | Tipo de error | Momento aproximado |
|------------------|------------|---------------|--------------------|
| vamos playa | vamos pa'llá | Transcripción | 0:04 |
| Neit Media | Nate Media | Nombres de marca | 0:12 |

**Caption Base:**

Un recorrido por la nueva sucursal, con el equipo explicando los servicios.`

  it('saca las filas de la tabla', () => {
    const { errores } = parseFiltroIRespuesta(respuesta)
    expect(errores).toEqual([
      { texto_incorrecto: 'vamos playa', correccion: "vamos pa'llá", tipo: 'Transcripción', momento: '0:04' },
      { texto_incorrecto: 'Neit Media', correccion: 'Nate Media', tipo: 'Nombres de marca', momento: '0:12' },
    ])
  })

  it('saca el caption base sin la etiqueta', () => {
    expect(parseFiltroIRespuesta(respuesta).captionBase).toBe(
      'Un recorrido por la nueva sucursal, con el equipo explicando los servicios.',
    )
  })

  it('descarta la cabecera y la línea de guiones', () => {
    const { errores } = parseFiltroIRespuesta(respuesta)
    expect(errores.some((e) => e.texto_incorrecto === 'Texto incorrecto')).toBe(false)
    expect(errores.some((e) => /^-+$/.test(e.texto_incorrecto))).toBe(false)
  })

  it('un video sin errores da lista vacía y su caption igual', () => {
    const sinErrores = `**Errores encontrados:**

| Texto incorrecto | Corrección | Tipo de error | Momento aproximado |
|------------------|------------|---------------|--------------------|

**Caption Base:**

Todo salió limpio.`
    const out = parseFiltroIRespuesta(sinErrores)
    expect(out.errores).toEqual([])
    expect(out.captionBase).toBe('Todo salió limpio.')
  })

  it('aguanta que el modelo escriba "Ninguno" en vez de una tabla vacía', () => {
    const out = parseFiltroIRespuesta('**Errores encontrados:**\n\nNinguno\n\n**Caption Base:**\n\nUn caption.')
    expect(out.errores).toEqual([])
    expect(out.captionBase).toBe('Un caption.')
  })

  it('un caption multilínea llega entero', () => {
    const out = parseFiltroIRespuesta('**Errores encontrados:**\n\nNinguno\n\n**Caption Base:**\n\nLínea uno.\n\nLínea dos.')
    expect(out.captionBase).toBe('Línea uno.\n\nLínea dos.')
  })

  it('una respuesta vacía o basura no lanza', () => {
    expect(parseFiltroIRespuesta('')).toEqual({ errores: [], captionBase: '' })
    expect(parseFiltroIRespuesta('perdón, no puedo')).toEqual({ errores: [], captionBase: '' })
  })

  // Sin las 4 columnas no se puede saber qué es qué: mejor saltarse la fila.
  it('ignora filas con columnas de menos', () => {
    const out = parseFiltroIRespuesta(
      '**Errores encontrados:**\n\n| a | b |\n| vamos playa | vamos pa\'llá |\n\n**Caption Base:**\n\nx',
    )
    expect(out.errores).toEqual([])
  })
})
