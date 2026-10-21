'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Copy, Eye, EyeOff, KeyRound, Loader2, Pencil, Plus, ShieldAlert, Trash2 } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'
import {
  deleteClientCredential,
  revealClientCredentialPassword,
  saveClientCredential,
} from '@/lib/actions/client-credentials'
import {
  CREDENTIAL_PLATFORMS,
  CREDENTIAL_PLATFORM_LABEL,
  type ClientCredentialSummary,
  type CredentialPlatform,
} from '@/lib/utils/client-credentials-types'

interface Props {
  clientId: string
  initial: ClientCredentialSummary[]
  canEdit: boolean
  keyConfigured: boolean
}

interface Draft {
  id?: string
  platform: CredentialPlatform
  username: string
  password: string
  notes: string
}

const SELECT =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring'

/** Accesos de redes del cliente. La contraseña solo viaja al pulsar Mostrar/Copiar. */
export function AccessTab({ clientId, initial, canEdit, keyConfigured }: Props) {
  const [rows, setRows] = useState(initial)
  const [revealed, setRevealed] = useState<Record<string, string>>({})
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [toDelete, setToDelete] = useState<ClientCredentialSummary | null>(null)
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  async function fetchPassword(id: string): Promise<string | null> {
    if (revealed[id]) return revealed[id]
    setLoadingId(id)
    const res = await revealClientCredentialPassword(id)
    setLoadingId(null)
    if (!res.password) {
      toast({ title: 'No se pudo mostrar', description: res.error, variant: 'destructive' })
      return null
    }
    return res.password
  }

  async function toggleReveal(id: string) {
    if (revealed[id]) {
      setRevealed(({ [id]: _, ...rest }) => rest)
      return
    }
    const pw = await fetchPassword(id)
    if (pw) setRevealed((r) => ({ ...r, [id]: pw }))
  }

  async function copy(text: string | null, what: string) {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: `${what} copiado` })
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'destructive' })
    }
  }

  function save() {
    if (!draft) return
    const current = draft
    startTransition(async () => {
      const res = await saveClientCredential({
        ...(current.id ? { id: current.id } : {}),
        clientId,
        platform: current.platform,
        username: current.username,
        password: current.password,
        notes: current.notes,
      })
      if (!res.ok || !res.id) {
        toast({ title: 'No se guardó', description: res.error, variant: 'destructive' })
        return
      }
      const savedId = res.id
      setRows((prev) => {
        const old = prev.find((r) => r.id === savedId)
        const next: ClientCredentialSummary = {
          id: savedId,
          platform: current.platform,
          username: current.username.trim(),
          notes: current.notes.trim() || null,
          updated_at: new Date().toISOString(),
          has_password: !!current.password || !!old?.has_password,
        }
        return old ? prev.map((r) => (r.id === savedId ? next : r)) : [...prev, next]
      })
      setRevealed(({ [savedId]: _, ...rest }) => rest)
      setDraft(null)
      toast({ title: 'Acceso guardado' })
    })
  }

  function confirmDelete() {
    if (!toDelete) return
    const target = toDelete
    const before = rows
    setRows((prev) => prev.filter((r) => r.id !== target.id))
    setToDelete(null)
    startTransition(async () => {
      const res = await deleteClientCredential(target.id)
      if (!res.ok) {
        setRows(before)
        toast({ title: 'No se borró', description: res.error, variant: 'destructive' })
      }
    })
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-x-3 gap-y-2 pb-3">
        <CardTitle className="flex min-w-0 items-center gap-2 text-base">
          <KeyRound className="h-4 w-4 shrink-0" />
          <span className="truncate">Accesos de redes sociales</span>
        </CardTitle>
        {canEdit && keyConfigured && !draft && (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setDraft({ platform: 'instagram', username: '', password: '', notes: '' })}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" /> Agregar acceso
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {!keyConfigured && (
          <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
            Para guardar contraseñas falta configurar la llave de cifrado CLIENT_CREDENTIALS_KEY en el servidor.
          </p>
        )}

        {rows.length === 0 && !draft && (
          <p className="text-sm text-muted-foreground">Todavía no hay accesos guardados para este cliente.</p>
        )}

        {rows.length > 0 && (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => {
              const label = CREDENTIAL_PLATFORM_LABEL[row.platform]
              const pw = revealed[row.id]
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3 text-sm">
                  <span className="w-32 shrink-0 font-medium">{label}</span>
                  <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="truncate">{row.username}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      aria-label={`Copiar usuario de ${label}`}
                      onClick={() => copy(row.username, 'Usuario')}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    {row.has_password ? (
                      <>
                        <span className="min-w-[7rem] font-mono text-xs">{pw ?? '••••••••'}</span>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={`${pw ? 'Ocultar' : 'Mostrar'} contraseña de ${label}`}
                          disabled={loadingId === row.id}
                          onClick={() => toggleReveal(row.id)}
                        >
                          {loadingId === row.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : pw ? (
                            <EyeOff className="h-3.5 w-3.5" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          aria-label={`Copiar contraseña de ${label}`}
                          onClick={async () => copy(await fetchPassword(row.id), 'Contraseña')}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin contraseña</span>
                    )}
                  </span>
                  {canEdit && (
                    <span className="flex shrink-0 items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={`Editar acceso de ${label}`}
                        disabled={!keyConfigured}
                        onClick={() =>
                          setDraft({ id: row.id, platform: row.platform, username: row.username, password: '', notes: row.notes ?? '' })
                        }
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive"
                        aria-label={`Borrar acceso de ${label}`}
                        onClick={() => setToDelete(row)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  )}
                  {row.notes && <p className="basis-full text-xs text-muted-foreground">{row.notes}</p>}
                </li>
              )
            })}
          </ul>
        )}

        {draft && (
          <div className="space-y-3 rounded-md border bg-muted/30 p-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Red</span>
                <select
                  aria-label="Red"
                  value={draft.platform}
                  onChange={(e) => setDraft({ ...draft, platform: e.target.value as CredentialPlatform })}
                  className={SELECT}
                >
                  {CREDENTIAL_PLATFORMS.map((p) => (
                    <option key={p} value={p}>{CREDENTIAL_PLATFORM_LABEL[p]}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Usuario</span>
                <Input
                  aria-label="Usuario"
                  value={draft.username}
                  autoComplete="off"
                  onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-muted-foreground">Contraseña</span>
                <Input
                  aria-label="Contraseña"
                  type="password"
                  value={draft.password}
                  autoComplete="new-password"
                  placeholder={draft.id ? 'Déjala vacía para no cambiarla' : ''}
                  onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                />
              </label>
            </div>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Nota (opcional)</span>
              <Input
                aria-label="Nota"
                value={draft.notes}
                placeholder="Ej.: el código de verificación llega al celular del dueño"
                onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              />
            </label>
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={isPending}>
                Cancelar
              </Button>
              <Button size="sm" onClick={save} disabled={isPending || !draft.username.trim()}>
                {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                Guardar
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          Las contraseñas se guardan cifradas. Solo owner y supervisor pueden verlas.
        </p>
      </CardContent>

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="¿Borrar este acceso?"
        description={toDelete ? `Se borrará el acceso de ${CREDENTIAL_PLATFORM_LABEL[toDelete.platform]} (${toDelete.username}).` : undefined}
        confirmLabel="Borrar"
        destructive
        onConfirm={confirmDelete}
      />
    </Card>
  )
}
