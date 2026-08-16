import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ScrollArea } from './scroll-area'

afterEach(() => cleanup())

describe('ScrollArea', () => {
  // jsdom does not run layout, so we can't assert on computed pixel widths
  // (which is what actually breaks visually: a `display:table` viewport
  // grows to its content and defeats `truncate`/`line-clamp` on children).
  // Instead we assert on the classes we apply to force the Radix-injected
  // inner div to `display:block; width:100%`, which is the mechanism the
  // fix relies on.
  it('forces the Radix-injected viewport child to block/full-width so truncate can constrain it', () => {
    const { container } = render(
      <div style={{ width: 200 }}>
        <ScrollArea className="h-[100px] w-full">
          <p className="truncate">A very long line of text that should be truncated, not overflow</p>
        </ScrollArea>
      </div>,
    )

    const viewport = container.querySelector('[data-radix-scroll-area-viewport]')
    expect(viewport).toBeTruthy()
    // Tailwind arbitrary variant targeting the immediate child div that
    // Radix's ScrollAreaPrimitive.Viewport renders internally with
    // `style="display:table"`. `!` forces `!important` so it beats the
    // inline style.
    expect(viewport?.className).toContain('[&>div]:!block')
    expect(viewport?.className).toContain('[&>div]:!w-full')
  })

  it('keeps truncate on the long-text child so it is available to be constrained', () => {
    const { getByText } = render(
      <div style={{ width: 200 }}>
        <ScrollArea className="h-[100px] w-full">
          <p className="truncate">Cafe Don Rogelio — un nombre bien largo que se corta</p>
        </ScrollArea>
      </div>,
    )
    const p = getByText(/Cafe Don Rogelio/)
    expect(p.className).toContain('truncate')
  })
})
