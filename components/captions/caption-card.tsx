'use client'

import { useState } from 'react'
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Copy, CheckCheck } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import type { CaptionExample } from '@/lib/data/mockup-captions'

const typeLabels: Record<string, string> = {
  promotional: 'Promocional',
  engagement: 'Engagement',
  educational: 'Educativo',
  testimonial: 'Testimonio',
  announcement: 'Anuncio',
}

const platformColors: Record<string, string> = {
  Instagram: 'bg-pink-500/10 text-pink-500 border-pink-500/20',
  TikTok: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/20',
  Facebook: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  'Twitter/X': 'bg-neutral-500/10 text-neutral-400 border-neutral-500/20',
}

export function CaptionCard({ caption }: { caption: CaptionExample }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(caption.caption)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast({
      title: 'Caption copiado',
      description: `Caption de ${caption.client} copiado al portapapeles`,
    })
  }

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold text-sm">{caption.client}</p>
            <p className="text-xs text-muted-foreground">{caption.industry}</p>
          </div>
          <div className="flex gap-1.5">
            <Badge variant="outline" className={platformColors[caption.platform]}>
              {caption.platform}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {typeLabels[caption.type]}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm whitespace-pre-line leading-relaxed">{caption.caption}</p>
      </CardContent>
      <CardFooter className="pt-3 border-t">
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={handleCopy}
        >
          {copied ? (
            <>
              <CheckCheck className="mr-2 h-3.5 w-3.5 text-green-500" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="mr-2 h-3.5 w-3.5" />
              Copiar caption
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}
