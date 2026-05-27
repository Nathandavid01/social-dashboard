'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Keyboard } from 'lucide-react'

const SHORTCUTS = [
  { keys: ['⌘', 'N'], label: 'New task' },
  { keys: ['⌘', 'P'], label: 'Search (Command palette)' },
  { keys: ['⌘', 'K'], label: 'Open AI chat' },
  { keys: ['⌘', '/'], label: 'Search (alternate)' },
  { keys: ['Esc'], label: 'Close modal / chat' },
  { keys: ['Enter'], label: 'Send chat message' },
  { keys: ['Shift', 'Enter'], label: 'New line in chat' },
  { keys: ['↑', '↓'], label: 'Navigate search results' },
  { keys: ['⌘', '?'], label: 'This help screen' },
]

export function KeyboardShortcutsHelp() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === '?' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden lg:flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        title="Keyboard shortcuts (⌘?)"
      >
        <Keyboard className="h-4 w-4" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" />
              Keyboard Shortcuts
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1 mt-2">
            {SHORTCUTS.map(({ keys, label }) => (
              <div key={label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <div className="flex items-center gap-1">
                  {keys.map((k) => (
                    <kbd
                      key={k}
                      className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 text-[11px] font-medium bg-muted border border-border rounded text-foreground"
                    >
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">Press ⌘? anytime to reopen</p>
        </DialogContent>
      </Dialog>
    </>
  )
}
