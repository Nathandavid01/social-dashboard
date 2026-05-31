'use client'

import { useRef, useState, useTransition } from 'react'
import { Loader2, Pencil } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/lib/hooks/use-toast'

export interface InlineEditProps {
  value: string | null | undefined
  /** Persist the new value. Return `{ error }` to surface a failure (reverts). */
  onSave: (next: string) => Promise<{ error?: string } | void>
  type?: 'text' | 'textarea' | 'date'
  label?: string
  placeholder?: string
  className?: string
  /** Extra classes for the read-mode text. */
  displayClassName?: string
  /** Render the read-mode value monospace (e.g. hashtags). */
  mono?: boolean
}

/**
 * Click-to-edit field. Read mode shows the value (or placeholder) with a pencil
 * affordance; editing saves on blur or Enter (Shift+Enter for newlines in
 * textarea), cancels on Escape. Optimistic: shows the new value immediately and
 * reverts + toasts on error. Reusable across every editable flow.
 */
export function InlineEdit({
  value, onSave, type = 'text', label, placeholder = '—', className, displayClassName, mono,
}: InlineEditProps) {
  const { toast } = useToast()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [shown, setShown] = useState<string>(value ?? '')
  const [isPending, startTransition] = useTransition()

  // Adopt the prop ONLY when it actually changes (external update) — never on
  // every render, so optimistic local edits aren't reverted.
  const lastValueRef = useRef(value ?? '')
  if ((value ?? '') !== lastValueRef.current) {
    lastValueRef.current = value ?? ''
    if (!editing) setShown(value ?? '')
  }

  function begin() {
    setDraft(shown)
    setEditing(true)
  }

  function commit() {
    const next = draft
    setEditing(false)
    if (next === shown) return
    const prev = shown
    setShown(next) // optimistic
    startTransition(async () => {
      const res = await onSave(next)
      if (res && 'error' in res && res.error) {
        setShown(prev)
        toast({ title: 'No se pudo guardar', description: res.error, variant: 'destructive' })
      }
    })
  }

  function cancel() {
    setEditing(false)
    setDraft(shown)
  }

  if (editing) {
    const commonProps = {
      autoFocus: true,
      'aria-label': label,
      value: draft,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value),
      onBlur: commit,
      onKeyDown: (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') { e.preventDefault(); cancel() }
        else if (e.key === 'Enter' && (type !== 'textarea' || !e.shiftKey)) { e.preventDefault(); (e.target as HTMLElement).blur() }
      },
      className: cn('w-full rounded-md border border-input bg-background px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring', className),
    }
    return type === 'textarea'
      ? <textarea rows={3} {...commonProps} />
      : <input type={type === 'date' ? 'date' : 'text'} {...commonProps} />
  }

  const isEmpty = !shown
  return (
    <button
      type="button"
      onClick={begin}
      aria-label={label ? `Editar ${label}` : 'Editar'}
      className={cn(
        'group inline-flex w-full items-start gap-1.5 rounded-md px-2 py-1 text-left transition-colors hover:bg-accent/60',
        className,
      )}
    >
      <span className={cn(
        'min-w-0 flex-1 text-sm',
        mono && 'font-mono text-xs',
        isEmpty && 'italic text-muted-foreground',
        displayClassName,
      )}>
        {isEmpty ? placeholder : shown}
      </span>
      {isPending
        ? <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
        : <Pencil className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground" />}
    </button>
  )
}
