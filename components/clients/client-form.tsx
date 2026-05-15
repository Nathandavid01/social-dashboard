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
        title: client ? 'Client updated' : 'Client created',
        description: `${values.name} has been ${client ? 'updated' : 'added'} successfully.`,
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
              <FormLabel>Client Name</FormLabel>
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
              <FormLabel>Industry</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Salon, Restaurant, Retail" {...field} />
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
              <FormLabel>Active Platforms</FormLabel>
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
              <FormLabel>Status</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="paused">Paused</SelectItem>
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
              <FormLabel>Assigned Team Member</FormLabel>
              <Select
                onValueChange={(val) => field.onChange(val === 'unassigned' ? null : val)}
                defaultValue={field.value ?? 'unassigned'}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select team member" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
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
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea placeholder="Any important context about this client..." className="resize-none h-24" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Separator />

        {/* ── Caption AI Settings ── */}
        <div>
          <h3 className="text-sm font-semibold mb-1">Caption AI Settings</h3>
          <p className="text-xs text-muted-foreground mb-4">This info is fed to the AI every time you generate a caption for this client.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="caption_language"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Caption Language</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="spanish">Spanish</SelectItem>
                    <SelectItem value="english">English</SelectItem>
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
              <FormLabel>Brand Voice</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Friendly and energetic, speaks directly to women 25-45 in PR" {...field} />
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
              <FormLabel>Default Call to Action</FormLabel>
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
              <FormLabel>Default Hashtags</FormLabel>
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
              <FormLabel>Caption Rules for AI</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="e.g. Never use the word 'cheap'. Always mention Santurce location. Use emojis sparingly."
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
            {isPending ? 'Saving...' : client ? 'Update Client' : 'Create Client'}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancel
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
