'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  value: string | null
  onChange: (next: string | null) => void
  label: string
  disabled?: boolean
}

function isHex6(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v)
}

export function ColorPicker({ value, onChange, label, disabled }: Props) {
  const [text, setText] = useState(value ?? '')
  const safe = isHex6(text) ? text : value ?? '#888888'

  function commit(next: string) {
    setText(next)
    if (!next) onChange(null)
    else if (isHex6(next)) onChange(next.toUpperCase())
  }

  return (
    <div className="space-y-1.5">
      <label className="text-xs text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <label
          className={cn(
            'relative h-9 w-9 shrink-0 cursor-pointer overflow-hidden rounded-md border transition-transform hover:scale-105',
            disabled && 'pointer-events-none opacity-50',
          )}
          style={{ background: safe }}
        >
          <input
            type="color"
            value={safe}
            onChange={(e) => commit(e.target.value)}
            disabled={disabled}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label={`Selector ${label}`}
          />
        </label>
        <Input
          value={text}
          onChange={(e) => {
            const v = e.target.value
            setText(v)
            if (!v) onChange(null)
            else if (isHex6(v)) onChange(v.toUpperCase())
          }}
          onBlur={() => {
            if (text && !isHex6(text)) setText(value ?? '')
          }}
          placeholder="#000000"
          disabled={disabled}
          className="h-9 font-mono text-sm"
          maxLength={7}
        />
      </div>
    </div>
  )
}
