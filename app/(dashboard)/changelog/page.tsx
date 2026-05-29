import { readFile } from 'fs/promises'
import path from 'path'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PageHeader } from '@/components/shared/page-header'
import { Card, CardContent } from '@/components/ui/card'

export const dynamic = 'force-dynamic'

export default async function ChangelogPage() {
  let md = ''
  try {
    md = await readFile(path.join(process.cwd(), 'CHANGELOG.md'), 'utf8')
  } catch {
    md = 'No hay changelog disponible todavía.'
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Novedades" description="Actualizaciones del dashboard, por commit." />
      <Card>
        <CardContent className="py-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              h1: ({ children }) => <h1 className="mb-4 text-2xl font-bold tracking-tight">{children}</h1>,
              h2: ({ children }) => (
                <h2 className="mb-3 mt-8 border-b border-border pb-1 text-lg font-semibold first:mt-0">{children}</h2>
              ),
              h3: ({ children }) => <h3 className="mb-1.5 mt-5 text-sm font-semibold text-primary">{children}</h3>,
              p: ({ children }) => <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{children}</p>,
              ul: ({ children }) => <ul className="mb-4 space-y-1.5 pl-1">{children}</ul>,
              li: ({ children }) => (
                <li className="flex gap-2 text-sm text-muted-foreground">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span className="min-w-0">{children}</span>
                </li>
              ),
              strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
              code: ({ children }) => (
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">{children}</code>
              ),
            }}
          >
            {md}
          </ReactMarkdown>
        </CardContent>
      </Card>
    </div>
  )
}
