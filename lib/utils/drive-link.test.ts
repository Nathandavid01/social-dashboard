import { describe, it, expect } from 'vitest'
import { parseDriveFileId, driveViewLink, driveThumbUrl, describeDriveLink } from './drive-link'

const ID = '1A2b3C4d5E6f7G8h9I0jKlMnOpQr'

describe('parseDriveFileId', () => {
  it('reads the /file/d/<id>/ share link', () => {
    expect(parseDriveFileId(`https://drive.google.com/file/d/${ID}/view?usp=sharing`)).toBe(ID)
  })
  it('reads the ?id=<id> forms', () => {
    expect(parseDriveFileId(`https://drive.google.com/open?id=${ID}`)).toBe(ID)
    expect(parseDriveFileId(`https://drive.google.com/uc?id=${ID}&export=download`)).toBe(ID)
  })
  it('accepts a bare file ID', () => {
    expect(parseDriveFileId(ID)).toBe(ID)
  })
  it('tolerates surrounding whitespace from a paste', () => {
    expect(parseDriveFileId(`  https://drive.google.com/file/d/${ID}/view  `)).toBe(ID)
  })
  it('rejects empty, junk and non-Drive links', () => {
    expect(parseDriveFileId('')).toBeNull()
    expect(parseDriveFileId('   ')).toBeNull()
    expect(parseDriveFileId('https://example.com/video.mp4')).toBeNull()
    expect(parseDriveFileId('not a link')).toBeNull()
  })
  it('rejects an implausibly short id', () => {
    expect(parseDriveFileId('abc123')).toBeNull()
    expect(parseDriveFileId('https://drive.google.com/file/d/abc/view')).toBeNull()
  })
})

describe('driveViewLink / driveThumbUrl', () => {
  it('builds the canonical view and thumbnail urls', () => {
    expect(driveViewLink(ID)).toBe(`https://drive.google.com/file/d/${ID}/view`)
    expect(driveThumbUrl(ID)).toBe(`https://drive.google.com/thumbnail?id=${ID}&sz=w400`)
  })
})

describe('describeDriveLink — inline feedback while the editor pastes', () => {
  it('says nothing for an empty box', () => {
    expect(describeDriveLink('')).toEqual({ state: 'empty', message: null })
  })
  it('confirms a valid link', () => {
    expect(describeDriveLink(`https://drive.google.com/file/d/${ID}/view`)).toEqual({
      state: 'valid',
      message: 'Link de Drive válido',
      fileId: ID,
    })
  })
  it('explains an invalid one instead of just failing', () => {
    const r = describeDriveLink('https://example.com/x.mp4')
    expect(r.state).toBe('invalid')
    expect(r.message).toMatch(/drive/i)
  })
})
