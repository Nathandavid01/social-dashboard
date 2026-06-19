'use client'

import { useState } from 'react'
import { Link2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { slugifyClientName } from '@/lib/utils/client-slug-core'

/**
 * Copies the client's upload magic link (/subir/<name-slug>) so the team can
 * send it to the client. Falls back to the client id if the name can't be
 * slugged.
 */
export function UploadLinkButton({ clientName, clientId }: { clientName: string; clientId: string }) {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  function copy() {
    const slug = slugifyClientName(clientName) || clientId
    const url = `${window.location.origin}/subir/${slug}`
    const done = () => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
      toast({ title: 'Link de subida copiado', description: url })
    }
    navigator.clipboard?.writeText(url).then(done).catch(() => toast({ title: 'Link de subida', description: url }))
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={copy}>
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Link2 className="mr-1.5 h-3.5 w-3.5" />}
      Link de subida
    </Button>
  )
}
