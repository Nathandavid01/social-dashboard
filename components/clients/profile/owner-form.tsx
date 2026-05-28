'use client'

import { useState, useTransition } from 'react'
import { Loader2, Save } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import { updateClientProfile } from '@/lib/actions/client-profile'

interface Props {
  clientId: string
  initial: {
    owner_name: string | null
    owner_email: string | null
    owner_phone: string | null
  }
}

export function OwnerForm({ clientId, initial }: Props) {
  const [form, setForm] = useState(initial)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const dirty =
    form.owner_name !== initial.owner_name ||
    form.owner_email !== initial.owner_email ||
    form.owner_phone !== initial.owner_phone

  function save() {
    startTransition(async () => {
      const res = await updateClientProfile(clientId, form)
      if (res.error) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      } else {
        toast({ title: 'Owner actualizado' })
      }
    })
  }

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="owner_name" className="text-xs">Nombre</Label>
        <Input
          id="owner_name"
          value={form.owner_name ?? ''}
          onChange={(e) => setForm({ ...form, owner_name: e.target.value || null })}
          placeholder="Juan Pérez"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner_email" className="text-xs">Email</Label>
        <Input
          id="owner_email"
          type="email"
          value={form.owner_email ?? ''}
          onChange={(e) => setForm({ ...form, owner_email: e.target.value || null })}
          placeholder="juan@empresa.com"
          className="h-9"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="owner_phone" className="text-xs">Teléfono</Label>
        <Input
          id="owner_phone"
          type="tel"
          value={form.owner_phone ?? ''}
          onChange={(e) => setForm({ ...form, owner_phone: e.target.value || null })}
          placeholder="787-555-0000"
          className="h-9"
        />
      </div>
      <Button
        onClick={save}
        disabled={!dirty || isPending}
        size="sm"
        className="w-full transition-all"
      >
        {isPending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Save className="mr-2 h-3.5 w-3.5" />}
        Guardar
      </Button>
    </div>
  )
}
