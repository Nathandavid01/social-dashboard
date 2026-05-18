'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { MessageCircle, X, Send, Loader2, Bot } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export function ChatBubble() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const send = async () => {
    const text = input.trim()
    if (!text || loading) return

    const userMsg: Message = { role: 'user', content: text }
    const newMessages = [...messages, userMsg]
    setMessages(newMessages)
    setInput('')
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
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 w-[360px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl transition-all duration-300',
          open ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-4 pointer-events-none'
        )}
        style={{ height: '520px' }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border rounded-t-2xl bg-card">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
            <Bot className="h-4 w-4 text-primary-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold">NMedia AI</p>
            <p className="text-xs text-muted-foreground">Sabe de todos tus clientes y operaciones</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => setOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col gap-2 pt-2">
              <p className="text-xs text-muted-foreground text-center mb-3">Pregúntame cualquier cosa sobre tu agencia</p>
              {[
                '¿Cuáles clientes tienen hashtags configurados?',
                '¿Qué tareas están pendientes?',
                'Dame el perfil de marca de Quantika Global',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => { setInput(suggestion); setTimeout(() => inputRef.current?.focus(), 50) }}
                  className="text-left text-xs rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                'flex',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm'
                )}
              >
                {msg.content || (loading && i === messages.length - 1 ? (
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-xs">Pensando...</span>
                  </span>
                ) : '')}
              </div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex items-center gap-1.5">
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Pensando...</span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-3 pb-3 pt-2 border-t border-border">
          <div className="flex items-end gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe aquí..."
              rows={1}
              className="flex-1 resize-none bg-transparent text-sm outline-none placeholder:text-muted-foreground max-h-24 leading-relaxed"
              style={{ minHeight: '24px' }}
            />
            <Button
              size="icon"
              className="h-7 w-7 shrink-0 rounded-lg"
              onClick={send}
              disabled={!input.trim() || loading}
            >
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground text-center mt-1.5">Enter para enviar · Shift+Enter para nueva línea</p>
        </div>
      </div>

      {/* Floating Button */}
      <Button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg transition-all duration-200',
          open && 'rotate-0'
        )}
        size="icon"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </Button>
    </>
  )
}
