import { PageHeader } from '@/components/shared/page-header'
import { ScheduleCalendar } from '@/components/metricool/schedule-calendar'

export default function ScheduleCheckPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Verificacion de Posts"
        description="Calendario de publicaciones — verifica que cada post se publico correctamente"
      />
      <ScheduleCalendar />
    </div>
  )
}
