import { describe, expect, it } from 'vitest'
import { buildWhisperForm, parseWhisperTranscript, whisperApiKey } from './whisper'

describe('whisper helpers', () => {
  it('builds a Spanish transcription request for the video URL', () => {
    const req = buildWhisperForm('https://videos.example/a.mp4')
    expect(req.fields.file).toBe('https://videos.example/a.mp4')
    expect(req.fields.language).toBe('es')
  })

  it('reads the transcript text and ignores empty payloads', () => {
    expect(parseWhisperTranscript({ text: '  Hola gym  ' })).toBe('Hola gym')
    expect(parseWhisperTranscript({ text: '   ' })).toBeNull()
    expect(parseWhisperTranscript({})).toBeNull()
  })

  it('treats a missing API key as not configured', () => {
    expect(whisperApiKey({})).toBeNull()
    expect(whisperApiKey({ WHISPERAPI_API_KEY: '  wai_x  ' })).toBe('wai_x')
  })
})
