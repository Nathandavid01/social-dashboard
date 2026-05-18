'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button } from '@/components/ui/button'
import { MessageCircle, X, Send, Loader2, Bot, Trash2, Copy, CheckCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

const STORAGE_KEY = 'nmedia_chat_history'

const SUGGESTIONS = [
  'Dame el perfil de Quantika Global',
  '¿Qué tareas están pendientes?',
  'Genera un caption para Pizzeria San Lazaro sobre una nueva pizza',
  'Lista todos los clientes activos',
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button
      onClick={copy}
      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground p-1 rounded"
      title="Copy"
    >
      {copied ? <CheckCheck className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) setMessages(JSON.parse(stored))
    } catch { /* ignore */ }
  }, [])

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        // Keep only last 40 messages to avoid bloat
        const toStore = messages.slice(-40)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(toStore))
      } catch { /* ignore */ }
    }
  }, [messages])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 150)
  }, [open])

  const clearChat = useCallback(() => {
    setMessages([])
    localStorage.removeItem(STORAGE_KEY)
  }, [])

  const send = useCallback(async (text?: string) => {
    const content = (text ?? input).trim()
    if (!content || loading) return

    const userMsg: Message = { role: 'user', content }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    if (!text) setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages }),
      })

      if (!res.ok || !res.body) throw new Error('Failed')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let assistantText = ''

      setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        assistantText += decoder.decode(value, { stream: true })
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: 'assistant', content: assistantText },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Hubo un error. Intenta de nuevo.' },
      ])
    } finally {
      setLoading(false)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [input, messages, loading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    e.target.style.height = 'auto'
    e.target.style.height = Math.min(e.target.scrollHeight, 96) + 'px'
  }

  return (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 flex flex-col rounded-2xl border border-border bg-background shadow-2xl transition-all duration-300 ease-out',
          'w-[380px] max-w-[calc(100vw-2rem)]',
          open
            ? 'opacity-100 translate-y-0 scale-100 pointer-events-auto'
            : 'opacity-0 translate-y-4 scale-95 pointer-events-none'
        )}
        style={{ height: '560px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border rounded-t-2xl bg-card shrink-0">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary shrink-0">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-none">NMedia AI</p>
            <p className="text-xs text-muted-foreground mt-0.5">48 clientes · operaciones · captions</p>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={clearChat}
                title="Borrar conversación"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0">
          {messages.length === 0 ? (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-xs text-muted-foreground text-center mb-2">Pregúntame sobre tus clientes, tareas, o pide que genere un caption</p>
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="text-left text-xs rounded-xl border border-border px-3 py-2.5 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground leading-snug"
                >
                  {s}
                </button>
              ))}
            </div>
          ) : (
            messages.map((msg, i) => (
              <div
                key={i}
                className={cn('flex group', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                {msg.role === 'assistant' ? (
                  <div className="flex items-start gap-2 max-w-[90%]">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 shrink-0 mt-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <div className="rounded-2xl rounded-tl-sm bg-muted px-3 py-2 text-sm leading-relaxed prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 prose-li:my-0 prose-headings:my-1 prose-pre:my-1 prose-code:text-xs">
                        {msg.content ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.content}
                          </ReactMarkdown>
                        ) : loading && i === messages.length - 1 ? (
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Pensando...</span>
                          </span>
                        ) : null}
                      </div>
                      {msg.content && (
                        <div className="flex justify-end mt-1">
                          <CopyButton text={msg.content} />
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap">
                    {msg.content}
                  </div>
                )}
              </div>
            ))
          )}

          {loading && (messages.length === 0 || messages[messages.length - 1]?.role !== 'assistant') && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 bg-muted rounded-2xl rounded-tl-sm px-3 py-2">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Consultando datos...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-border shrink-0">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 focus-within:border-primary/50 transition-colors">
            <textarea
              ref={inputRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              placeholder="Escribe aquí..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground leading-relaxed"
              style={{ minHeight: '22px', maxHeight: '96px' }}
            />
            <Button
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg mb-0.5"
              onClick={() => send()}
              disabled={!input.trim() || loading}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">Enter · Shift+Enter para nueva línea</p>
        </div>
      </div>

      {/* Floating Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-4 right-4 z-50 h-13 w-13 flex items-center justify-center rounded-full shadow-lg transition-all duration-200 bg-primary text-primary-foreground hover:bg-primary/90',
          'h-12 w-12',
          open && 'rotate-90'
        )}
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
        {!open && messages.length > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-green-500 text-[9px] text-white flex items-center justify-center font-bold">
            {messages.filter(m => m.role === 'assistant').length}
          </span>
        )}
      </button>
    </>
  )
}
