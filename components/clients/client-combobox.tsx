'use client'

import { useState, useRef, useEffect } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface Props {
  clients: { id: string; name: string }[]
  value: string
  onChange: (id: string) => void
  placeholder?: string
  id?: string
}

/**
 * Typeable, searchable client picker (combobox). Filters by name as you type;
 * with dozens of clients this beats a long scroll dropdown. No external deps —
 * a filtered list under a text input. `query === null` means "not editing":
 * the input shows the selected client's name and the list is closed.
 */
export function ClientCombobox({ clients, value, onChange, placeholder = 'Buscar cliente…', id }: Props) {
  const selected = clients.find((c) => c.id === value) ?? null
  const [query, setQuery] = useState<string | null>(null)
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const wrapRef = useRef<HTMLDivElement>(null)
  const listId = id ? `${id}-list` : 'client-combobox-list'

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery(null)
      }
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = (query ?? '').trim().toLowerCase()
  const filtered = q ? clients.filter((c) => c.name.toLowerCase().includes(q)) : clients
  const inputValue = query === null ? (selected?.name ?? '') : query

  function pick(c: { id: string; name: string }) {
    onChange(c.id)
    setQuery(null)
    setOpen(false)
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) setOpen(true)
      setHighlight((h) => Math.min(h + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight((h) => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && filtered[highlight]) {
        e.preventDefault()
        pick(filtered[highlight])
      }
    } else if (e.key === 'Escape') {
      setOpen(false)
      setQuery(null)
    }
  }

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={inputValue}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          onFocus={() => {
            setOpen(true)
            setQuery('')
            setHighlight(0)
          }}
          onKeyDown={onKeyDown}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          className="pr-8"
        />
        <ChevronsUpDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
      </div>
      {open && (
        <ul id={listId} role="listbox" className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {filtered.length === 0 ? (
            <li className="px-2 py-2 text-sm text-muted-foreground">Sin resultados</li>
          ) : (
            filtered.map((c, i) => (
              <li key={c.id} role="option" aria-selected={c.id === value}>
                <button
                  type="button"
                  // onMouseDown (not onClick) so the pick registers before the input blurs.
                  onMouseDown={(e) => {
                    e.preventDefault()
                    pick(c)
                  }}
                  onMouseEnter={() => setHighlight(i)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm',
                    i === highlight ? 'bg-accent' : 'hover:bg-accent',
                    c.id === value && 'font-medium',
                  )}
                >
                  <span className="truncate">{c.name}</span>
                  {c.id === value && <Check className="ml-2 h-3.5 w-3.5 shrink-0 text-primary" />}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  )
}
