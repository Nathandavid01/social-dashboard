'use client'

import { useTransition, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'next/navigation'
import { clientSchema, type ClientFormValues } from '@/lib/validations/client.schema'
import { createClient, updateClient } from '@/lib/actions/clients'
import { useToast } from '@/lib/hooks/use-toast'
import type { Client, Profile, SocialPlatform } from '@/lib/supabase/types'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import { RefreshCw } from 'lucide-react'

const PLATFORMS: { value: SocialPlatform; label: string }[] = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'linkedin', label: 'LinkedIn' },
]

interface ClientFormProps {
  client?: Client
  teamMembers: Pick<Profile, 'id' | 'full_name' | 'email'>[]
}

export function ClientForm({ client, teamMembers }: ClientFormProps) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const { toast } = useToast()

  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      name: client?.name ?? '',
      industry: client?.industry ?? '',
      platforms: client?.platforms ?? [],
      status: client?.status ?? 'onboarding',
      assigned_to: client?.assigned_to ?? null,
      notes: client?.notes ?? '',
      brand_voice: client?.brand_voice ?? '',
      caption_language: (client?.caption_language as 'spanish' | 'english' | 'spanglish') ?? 'spanish',
      default_cta: client?.default_cta ?? '',
      default_hashtags: client?.default_hashtags ?? '',
      metricool_blog_id: client?.metricool_blog_id ?? '',
      caption_notes: client?.caption_notes ?? '',
    },
  })

  function onSubmit(values: ClientFormValues) {
    startTransition(async () => {
      const result = client
        ? await updateClient(client.id, values)
        : await createClient(values)

      if (result.error) {
        toast({ title: 'Error', description: result.error, variant: 'destructive' })
        return
      }

      toast({
        title: client ? 'Cliente actualizado' : 'Cliente creado',
        description: `${values.name} ha sido ${client ? 'actualizado' : 'agregado'} exitosamente.`,
      })
      router.push('/clients')
    })
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 max-w-2xl">

        {/* ── Basic Info ── */}
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nombre del Cliente</FormLabel>
              <FormControl>
                <Input placeholder="Brisa Salon" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="industry"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Industria</FormLabel>
              <FormControl>
                <Input placeholder="p.ej. Salón, Restaurante, Retail" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="platforms"
          render={() => (
            <FormItem>
              <FormLabel>Plataformas Activas</FormLabel>
              <div className="flex flex-wrap gap-4 mt-2">
                {PLATFORMS.map((platform) => (
                  <FormField
                    key={platform.value}
                    control={form.control}
                    name="platforms"
                    render={({ field }) => (
                      <FormItem className="flex items-center gap-2">
                        <FormControl>
                          <Checkbox
                            checked={field.value?.includes(platform.value)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                field.onChange([...field.value, platform.value])
                              } else {
                                field.onChange(field.value.filter((v) => v !== platform.value))
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal cursor-pointer">{platform.label}</FormLabel>
                      </FormItem>
                    )}
                  />
                ))}
              </div>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="status"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Estado</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona estado" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="paused">Pausado</SelectItem>
                  <SelectItem value="onboarding">Onboarding</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="assigned_to"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Miembro del Equipo Asignado</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val === 'unassigned' ? null : val)}
                defaultValue={field.value ?? 'unassigned'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona miembro del equipo" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="unassigned">Sin asignar</SelectItem>
                  {teamMembers.map((member) => (
                    <SelectItem key={member.id} value={member.id}>
                      {member.full_name || member.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notas</FormLabel>
              <FormControl>
                <Textarea placeholder="Contexto importante sobre este cliente..." className="resize-none h-24" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* ── Caption AI Settings ── */}
        <div>
          <h3 className="text-sm font-semibold mb-1">Configuración de Caption AI</h3>
          <p className="text-xs text-muted-foreground mb-4">Esta información se envía a la IA cada vez que generas un caption para este cliente.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="caption_language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Idioma del Caption</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="spanish">Español</SelectItem>
                    <SelectItem value="english">Inglés</SelectItem>
                    <SelectItem value="spanglish">Spanglish</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <MetricoolBlogPicker form={form} />
        </div>

        <FormField
          control={form.control}
          name="brand_voice"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Voz de Marca</FormLabel>
              <FormControl>
                <Input placeholder="p.ej. Amigable y energético, habla directamente a mujeres de 25-45 en PR" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="default_cta"
          render={({ field }) => (
            <FormItem>
              <FormLabel>CTA Predeterminado</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Llama al 787-555-0101 o escríbenos por DM" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="default_hashtags"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Hashtags Predeterminados</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="#BrisaSalon #SalonPR #PuertoRico #CabelloSaludable"
                  className="resize-none h-20"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="caption_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Reglas de Caption para IA</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="p.ej. Nunca uses la palabra 'barato'. Siempre menciona la ubicación de Santurce. Usa emojis con moderación."
                  className="resize-none h-24"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Guardando...' : client ? 'Actualizar Cliente' : 'Crear Cliente'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </Form>
  )
}

interface MetricoolBlog {
  id: string
  name: string
  url: string
}

function MetricoolBlogPicker({ form }: { form: ReturnType<typeof useForm<ClientFormValues>> }) {
  const [blogs, setBlogs] = useState<MetricoolBlog[]>([])
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const currentValue = form.watch('metricool_blog_id')

  const fetchBlogs = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/metricool/blogs')
      const data = await res.json()
      if (data.blogs) {
        setBlogs(data.blogs)
        setFetched(true)
      }
    } catch {
      // fall back to manual input
    } finally {
      setLoading(false)
    }
  }

  return (
    <FormField
      control={form.control}
      name="metricool_blog_id"
      render={({ field }) => (
        <FormItem>
          <FormLabel>Metricool Blog ID</FormLabel>
          {fetched && blogs.length > 0 ? (
            <Select onValueChange={field.onChange} value={field.value ?? ''}>
              <FormControl>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                {blogs.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name} <span className="text-muted-foreground ml-1 text-xs">({b.id})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="flex gap-2">
              <FormControl>
                <Input placeholder="e.g. 5062650" {...field} />
              </FormControl>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={fetchBlogs}
                disabled={loading}
                className="shrink-0"
              >
                {loading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : 'Buscar'}
              </Button>
            </div>
          )}
          {currentValue && <p className="text-xs text-muted-foreground mt-1">ID: {currentValue}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
