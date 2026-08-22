import { describe, it, expect } from 'vitest'
import { videoNameFromIdea } from './video-name-from-idea'

describe('videoNameFromIdea', () => {
  it('el archivo lleva el título de la idea y la extensión original', () => {
    expect(videoNameFromIdea('El primer sandwich del día', 'IMG_8841.MOV')).toBe(
      'El primer sandwich del día.MOV',
    )
  })

  it('sin título de idea se queda el nombre del archivo', () => {
    expect(videoNameFromIdea('  ', 'clip.mp4')).toBe('clip.mp4')
    expect(videoNameFromIdea(null, 'clip.mp4')).toBe('clip.mp4')
  })

  it('limpia caracteres que rompen un nombre de archivo', () => {
    expect(videoNameFromIdea('A/B: "take"?', 'a.mp4')).toBe('AB take.mp4')
  })
})
