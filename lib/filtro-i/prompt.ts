import {
  formatTranscripcionParaPrompt,
  type SegmentoTranscripcion,
} from '@/lib/integrations/whisperapi-core'

/**
 * El prompt que va a Grok junto con los frames.
 *
 * El texto de las dos tareas y el formato de salida son literales del encargo:
 * `parseFiltroIRespuesta` (grok-vision-core) depende de ese formato exacto, así
 * que cambiar una etiqueta aquí rompe el parser. Los tests de los dos lados son
 * el contrato.
 *
 * Lo añadido al encargo original son los dos bloques de contexto: la
 * transcripción con tiempos y el segundo de cada frame. Sin ellos el modelo
 * solo vería subtítulos sueltos, sin nada con qué compararlos y sin saber a qué
 * momento del video pertenece cada imagen.
 */
export function buildFiltroIPrompt(input: {
  segmentos: SegmentoTranscripcion[]
  momentos: number[]
}): string {
  const momentos = input.momentos
    .map((m) => `${(Math.round(m * 10) / 10).toFixed(1)}s`)
    .join(', ')

  return `Eres un editor experto de contenido en español de Puerto Rico.

CONTEXTO DEL VIDEO

Recibes ${input.momentos.length} frames del video, en orden, tomados en estos segundos:
${momentos}

Esto es lo que se ESCUCHA en el audio, con sus marcas de tiempo:
${formatTranscripcionParaPrompt(input.segmentos)}

Usa el audio para juzgar los subtítulos que ves en pantalla: compara lo que se
escucha en un momento con el subtítulo del frame de ese mismo momento. Un
subtítulo puede estar perfectamente escrito y aun así decir algo distinto de lo
que se dijo — ese es un error de transcripción y hay que reportarlo.

Analiza los frames del video y realiza estas dos tareas:

TAREA 1 - Detección de errores:
Encuentra todos los errores de:
- Ortografía
- Acentuación (tildes)
- Puntuación
- Mayúsculas/minúsculas
- Transcripción (cuando el subtítulo no coincide con lo que se escucha)
- Nombres de marca

Devuelve los errores en esta tabla exacta:

| Texto incorrecto | Corrección | Tipo de error | Momento aproximado |
|------------------|------------|---------------|--------------------|

En "Momento aproximado" pon el segundo del frame donde aparece el error (por
ejemplo "4.8s"). Si no encuentras ningún error, devuelve la tabla sin filas.
No inventes errores para llenarla.

TAREA 2 - Caption Base:
Genera un caption base que sea fiel al contenido real del video.
Este caption debe ser descriptivo y claro, no necesita ser el caption final de marca.
Solo captura el mensaje principal del video de forma natural.

Responde exactamente en este formato:

**Errores encontrados:**
(tabla)

**Caption Base:**
(el caption base)`
}
