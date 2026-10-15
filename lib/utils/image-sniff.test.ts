import { describe, expect, it } from 'vitest'
import { proxyImageType, sniffImageType } from './image-sniff'

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0, 0, 0, 0, 0])

describe('sniffImageType', () => {
  it('recognizes PNG, JPEG, GIF and WEBP by their magic bytes', () => {
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png')
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg')
    expect(sniffImageType(bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61))).toBe('image/gif')
    expect(sniffImageType(new Uint8Array([0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50]))).toBe('image/webp')
  })

  it('returns null for anything else (html, empty)', () => {
    expect(sniffImageType(new TextEncoder().encode('<!doctype html>'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})

describe('proxyImageType', () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)

  it('keeps a declared image/* type', () => {
    expect(proxyImageType('image/jpeg', png)).toBe('image/jpeg')
  })

  it('accepts octet-stream when the bytes really are an image (static.metricool.com logos)', () => {
    expect(proxyImageType('application/octet-stream', png)).toBe('image/png')
    expect(proxyImageType('', png)).toBe('image/png')
  })

  it('rejects octet-stream that is not an image, and any other declared type', () => {
    expect(proxyImageType('application/octet-stream', new TextEncoder().encode('hello world!'))).toBeNull()
    expect(proxyImageType('text/html', png)).toBeNull()
  })
})
