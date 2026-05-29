'use client'

import { useState, type ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LayoutGrid, Palette, FileSignature, DollarSign, FolderOpen, CheckSquare, Sparkles, MessageSquareText, ListChecks } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ClientTabKey = 'overview' | 'flujo' | 'brand' | 'contract' | 'billing' | 'assets' | 'tasks' | 'content' | 'captions'

interface Props {
  defaultTab?: ClientTabKey
  overview: ReactNode
  flujo: ReactNode
  brand: ReactNode
  contract: ReactNode
  billing: ReactNode
  assets: ReactNode
  tasks: ReactNode
  content: ReactNode
  captions: ReactNode
}

const TAB_META: { key: ClientTabKey; label: string; icon: typeof LayoutGrid }[] = [
  { key: 'overview', label: 'Resumen',    icon: LayoutGrid },
  { key: 'flujo',    label: 'Flujo',      icon: ListChecks },
  { key: 'brand',    label: 'Marca',      icon: Palette },
  { key: 'contract', label: 'Contrato',   icon: FileSignature },
  { key: 'billing',  label: 'Pagos',      icon: DollarSign },
  { key: 'assets',   label: 'Assets',     icon: FolderOpen },
  { key: 'tasks',    label: 'Tareas',     icon: CheckSquare },
  { key: 'content',  label: 'Contenido',  icon: Sparkles },
  { key: 'captions', label: 'Captions',   icon: MessageSquareText },
]

export function ClientTabs({
  defaultTab = 'overview',
  overview,
  flujo,
  brand,
  contract,
  billing,
  assets,
  tasks,
  content,
  captions,
}: Props) {
  const [tab, setTab] = useState<ClientTabKey>(defaultTab)

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
          {TAB_META.map(({ key, label, icon: Icon }) => (
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

      <TabsContent value="overview" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {overview}
      </TabsContent>
      <TabsContent value="flujo" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {flujo}
      </TabsContent>
      <TabsContent value="brand" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {brand}
      </TabsContent>
      <TabsContent value="contract" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {contract}
      </TabsContent>
      <TabsContent value="billing" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {billing}
      </TabsContent>
      <TabsContent value="assets" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {assets}
      </TabsContent>
      <TabsContent value="tasks" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {tasks}
      </TabsContent>
      <TabsContent value="content" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {content}
      </TabsContent>
      <TabsContent value="captions" className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        {captions}
      </TabsContent>
    </Tabs>
  )
}
