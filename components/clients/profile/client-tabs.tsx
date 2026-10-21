'use client'

import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LayoutGrid, CalendarClock, Palette, Sparkles, KeyRound, Briefcase } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Perfil simplificado (v5.150): seis pestañas en vez de nueve.
 * Contenido junta tareas, posts y captions; Marca junta el banco de archivos;
 * Cuenta junta contrato y pagos. Accesos solo aparece para quien puede verlos.
 */
export type ClientTabKey = 'overview' | 'schedule' | 'content' | 'brand' | 'access' | 'account'

const LEGACY_TABS: Record<string, ClientTabKey> = {
  contract: 'account',
  billing: 'account',
  assets: 'brand',
  tasks: 'content',
  captions: 'content',
}

/** Traduce `?tab=` (incluye los nombres viejos) a una pestaña actual. */
export function resolveClientTab(tab: string | undefined): ClientTabKey {
  if (!tab) return 'overview'
  if (tab in LEGACY_TABS) return LEGACY_TABS[tab]
  return (TAB_META.some((t) => t.key === tab) ? tab : 'overview') as ClientTabKey
}

interface Props {
  defaultTab?: ClientTabKey
  overview: ReactNode
  schedule: ReactNode
  content: ReactNode
  brand: ReactNode
  /** Sin este slot la pestaña no aparece (sin permiso clients.credentials.read). */
  access?: ReactNode
  account: ReactNode
}

const TAB_META: { key: ClientTabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Resumen',    icon: LayoutGrid },
  { key: 'schedule', label: 'Calendario', icon: CalendarClock },
  { key: 'content',  label: 'Contenido',  icon: Sparkles },
  { key: 'brand',    label: 'Marca',      icon: Palette },
  { key: 'access',   label: 'Accesos',    icon: KeyRound },
  { key: 'account',  label: 'Cuenta',     icon: Briefcase },
]

export function ClientTabs({ defaultTab = 'overview', ...slots }: Props) {
  const visible = TAB_META.filter((t) => slots[t.key] !== undefined)
  const initial = visible.some((t) => t.key === defaultTab) ? defaultTab : 'overview'
  const [tab, setTab] = useState<ClientTabKey>(initial)

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as ClientTabKey)} className="w-full">
      {/* Sticky tab bar on desktop; scroll-x on mobile */}
      <div className="sticky top-0 z-20 -mx-4 mb-4 bg-background/80 px-4 pt-1 pb-2 backdrop-blur supports-[backdrop-filter]:bg-background/60 sm:-mx-6 sm:px-6 md:static md:m-0 md:bg-transparent md:p-0 md:pb-2 md:backdrop-blur-none">
        <TabsList
          className={cn(
            'no-scrollbar flex h-auto w-full justify-start gap-1 overflow-x-auto rounded-lg p-1',
            'md:w-auto md:overflow-visible',
          )}
        >
          {visible.map(({ key, label, icon: Icon }) => (
            <TabsTrigger
              key={key}
              value={key}
              className={cn(
                'group flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium',
                'transition-all duration-200',
                'data-[state=active]:bg-background data-[state=active]:shadow-sm',
                'sm:text-sm',
              )}
            >
              <Icon className="h-3.5 w-3.5 transition-transform group-data-[state=active]:scale-110 sm:h-4 sm:w-4" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {visible.map(({ key }) => (
        <TabsContent key={key} value={key} className="animate-in fade-in slide-in-from-bottom-1 duration-300">
          {slots[key]}
        </TabsContent>
      ))}
    </Tabs>
  )
}
