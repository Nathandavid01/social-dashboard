import { describe, it, expect, vi, afterEach } from 'vitest'
import { followDownload } from './follow-download'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('followDownload', () => {
  it('follows the URL in the same tab and leaves no link behind', () => {
    const followed: { href: string; target: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      followed.push({ href: this.href, target: this.target })
    })
    followDownload('https://signed.example/v.mp4?X-Amz-Signature=abc')
    expect(followed).toEqual([{ href: 'https://signed.example/v.mp4?X-Amz-Signature=abc', target: '' }])
    expect(document.querySelectorAll('a')).toHaveLength(0)
  })
})
