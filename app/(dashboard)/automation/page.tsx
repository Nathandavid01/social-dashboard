import { PageHeader } from '@/components/shared/page-header'
import { AutomationPanel } from '@/components/automation/automation-panel'
import { Card, CardContent } from '@/components/ui/card'
import { CheckCircle, Film, Zap } from 'lucide-react'

export default function AutomationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Automatización"
        description="Video QC aprobado → Caption AI → Metricool"
      />

      {/* Pipeline status */}
      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Film className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Video QC</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="h-3 w-3" /> Aprobados → Cola
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <Zap className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Claude AI</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="h-3 w-3" /> claude-sonnet-4-6
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="text-xs font-medium">Metricool</p>
                <p className="text-xs text-green-500 flex items-center gap-1 mt-0.5">
                  <CheckCircle className="h-3 w-3" /> Borradores automáticos
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <AutomationPanel />
    </div>
  )
}
