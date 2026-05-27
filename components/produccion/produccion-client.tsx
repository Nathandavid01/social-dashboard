'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { ProductionSchedule, ProductionTask, Profile, Client, ContentIdea } from '@/lib/supabase/types'
import { ProductionCalendar } from './production-calendar'
import { AssignmentsView } from './assignments-view'
import { MyListView } from './my-list-view'
import { SpecialRequestModal } from './special-request-modal'
import { ManageSchedulesModal } from './manage-schedules-modal'
import { ReviewQueue } from './review-queue'
import { MasterScheduleView } from './master-schedule-view'
import { GenerateIdeasModal } from '@/components/ideas/generate-ideas-modal'
import { cn } from '@/lib/utils'
import { Plus, Settings, Lightbulb } from 'lucide-react'
import Link from 'next/link'
import { useToast } from '@/lib/hooks/use-toast'

type Tab = 'calendario' | 'asignaciones' | 'mi_lista' | 'revision' | 'master'

interface Props {
  schedules: ProductionSchedule[]
  tasks: ProductionTask[]
  reviewTasks: ProductionTask[]
  myTasks: ProductionTask[]
  profiles: Pick<Profile, 'id' | 'full_name'>[]
  clients: Pick<Client, 'id' | 'name'>[]
  currentWeekStart: string
}

export function ProduccionClient({ schedules, tasks, reviewTasks, myTasks, profiles, clients, currentWeekStart }: Props) {
  const router = useRouter()
  const { toast } = useToast()
  const [tab, setTab] = useState<Tab>('calendario')
  const [showSpecialRequest, setShowSpecialRequest] = useState(false)
  const [showManageSchedules, setShowManageSchedules] = useState(false)
  const [showIdeaGen, setShowIdeaGen] = useState(false)

  const reviewCount = reviewTasks.filter(t => t.status === 'en_revision' || t.status === 'revisiones').length

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'calendario', label: 'Calendario' },
    { id: 'master', label: 'Calendario Master' },
    { id: 'asignaciones', label: 'Asignaciones' },
    {
      id: 'mi_lista',
      label: 'Mi Lista',
      badge: myTasks.filter(t => t.status !== 'publicado').length || undefined,
    },
    {
      id: 'revision',
      label: 'Para Revisar',
      badge: reviewCount || undefined,
    },
  ]

  // Slim format for manage-schedules modal
  const schedulesForModal = schedules.map(s => ({
    id: s.id,
    client_id: s.client_id,
    day_of_week: s.day_of_week,
    content_type: s.content_type,
    assigned_editor_id: s.assigned_editor_id,
    assigned_designer_id: s.assigned_designer_id,
  }))

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Page header */}
      {/* Production status bar */}
      {(() => {
        const allActive = [...tasks, ...reviewTasks]
        const statusCounts = {
          pendiente: allActive.filter(t => t.status === 'pendiente').length,
          en_edicion: allActive.filter(t => t.status === 'en_edicion').length,
          en_revision: allActive.filter(t => t.status === 'en_revision').length,
          revisiones: allActive.filter(t => t.status === 'revisiones').length,
          aprobado: allActive.filter(t => t.status === 'aprobado').length,
          publicado: allActive.filter(t => t.status === 'publicado').length,
        }
        const total = Object.values(statusCounts).reduce((a, b) => a + b, 0)
        if (total === 0) return null
        return (
          <div className="flex items-center gap-1 text-[10px] flex-wrap">
            {([
              { key: 'pendiente', label: 'Pendiente', color: 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400' },
              { key: 'en_edicion', label: 'Edición', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
              { key: 'en_revision', label: 'Revisión', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
              { key: 'revisiones', label: 'Cambios', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400' },
              { key: 'aprobado', label: 'Aprobado', color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' },
              { key: 'publicado', label: 'Publicado', color: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
            ] as const).map(s => {
              const count = statusCounts[s.key as keyof typeof statusCounts]
              if (count === 0) return null
              return (
                <span key={s.key} className={cn('px-2 py-0.5 rounded-full font-medium', s.color)}>
                  {count} {s.label}
                </span>
              )
            })}
          </div>
        )
      })()}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Producción</h1>
          <p className="text-sm text-muted-foreground">
            {schedules.length} publicaciones programadas · {tasks.filter(t => t.status !== 'publicado').length} tareas activas
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowIdeaGen(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
          >
            <Lightbulb className="h-4 w-4" />
            Generar ideas
          </button>
          <button
            onClick={() => setShowManageSchedules(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
          >
            <Settings className="h-4 w-4" />
            Horarios
          </button>
          <button
            onClick={() => setShowSpecialRequest(true)}
            className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Solicitud especial
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            {t.label}
            {t.badge ? (
              <span className="text-[10px] bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 font-bold leading-none">
                {t.badge}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'calendario' && (
        <ProductionCalendar
          schedules={schedules}
          initialTasks={tasks}
          profiles={profiles}
          currentWeekStart={currentWeekStart}
        />
      )}

      {tab === 'master' && (
        <MasterScheduleView />
      )}

      {tab === 'asignaciones' && (
        <AssignmentsView tasks={tasks} profiles={profiles} />
      )}

      {tab === 'mi_lista' && (
        <MyListView tasks={myTasks} />
      )}

      {tab === 'revision' && (
        <ReviewQueue tasks={reviewTasks} />
      )}

      {/* Modals */}
      {showSpecialRequest && (
        <SpecialRequestModal
          clients={clients}
          profiles={profiles}
          onClose={() => setShowSpecialRequest(false)}
          onSuccess={() => router.refresh()}
        />
      )}

      {showManageSchedules && (
        <ManageSchedulesModal
          clients={clients}
          profiles={profiles}
          existingSchedules={schedulesForModal}
          onClose={() => setShowManageSchedules(false)}
        />
      )}

      <GenerateIdeasModal
        open={showIdeaGen}
        onClose={() => setShowIdeaGen(false)}
        clients={clients as Client[]}
        onIdeasGenerated={(ideas) => {
          toast({
            title: `${ideas.length} ideas generadas`,
            description: 'Ver en Ideación para asignarlas a producción',
          })
          router.refresh()
        }}
      />
    </div>
  )
}
