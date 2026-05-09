import { PageHeader } from '@/components/shared/page-header'
import { MetricoolPage } from '@/components/metricool/metricool-page'

export default function MetricoolRoute() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Metricool"
        description="Metricas y datos de tus redes sociales conectadas"
      />
      <MetricoolPage />
    </div>
  )
}
