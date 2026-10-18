'use client'

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Cuerpo de una entrada de «Novedades». Carga diferida desde whats-new.tsx. */
export function WhatsNewMarkdown({ body }: { body: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>,
        ul: ({ children }) => <ul className="mb-4 space-y-2 pl-1">{children}</ul>,
        li: ({ children }) => (
          <li className="flex gap-2 text-sm text-muted-foreground">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
            <span className="min-w-0">{children}</span>
          </li>
        ),
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        a: ({ href, children }) => (
          <a href={href} target="_blank" rel="noreferrer" className="font-medium text-primary underline-offset-2 hover:underline">
            {children}
          </a>
        ),
        h3: ({ children }) => <h3 className="mb-1.5 mt-4 text-sm font-semibold text-primary">{children}</h3>,
        img: ({ src, alt }) =>
          src ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src} alt={alt ?? ''} className="my-3 w-full rounded-xl border border-border" />
          ) : null,
      }}
    >
      {body}
    </ReactMarkdown>
  )
}
