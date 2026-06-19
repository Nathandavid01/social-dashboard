import Link from 'next/link'
import {
  Rocket,
  Upload,
  Film,
  Timer,
  Bookmark,
  MousePointerClick,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react'
import type { Recommendation, PlanTone } from '@/lib/utils/action-plan-core'
import { slugifyClientName } from '@/lib/utils/client-slug-core'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  film: Film,
  timer: Timer,
  bookmark: Bookmark,
  'mouse-pointer-click': MousePointerClick,
  'trending-up': TrendingUp,
}

const CHIP: Record<PlanTone, string> = {
  up: 'bg-emerald-100 text-emerald-700',
  time: 'bg-blue-100 text-blue-700',
  save: 'bg-pink-100 text-pink-700',
  traffic: 'bg-amber-100 text-amber-700',
}

export function ActionPlanSection({
  recommendations,
  clientName,
  clientId,
}: {
  recommendations: Recommendation[]
  clientName: string
  clientId: string
}) {
  const slug = slugifyClientName(clientName) || clientId
  return (
    <section className="rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-600">
          <Rocket className="h-[18px] w-[18px]" />
        </span>
        <div>
          <h2 className="text-base font-extrabold tracking-tight text-zinc-900">Tu plan del próximo mes</h2>
          <p className="text-xs text-zinc-500">Recomendaciones basadas en tus números reales — esto es lo que vamos a hacer.</p>
        </div>
      </div>

      <div className="space-y-2.5">
        {recommendations.map((r, i) => {
          const Icon = ICONS[r.icon] ?? TrendingUp
          return (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-white p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-zinc-200 text-zinc-600">
                <Icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-zinc-900">{r.title}</p>
                  <span className={cn('shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold', CHIP[r.tone])}>
                    {r.chip}
                  </span>
                </div>
                <p className="mt-0.5 text-xs leading-snug text-zinc-500">{r.reason}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3.5 print:hidden">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-amber-600">
          <Upload className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-amber-900">Lo que necesitamos de ti</p>
          <p className="text-xs text-amber-700">Súbenos tu material crudo desde el celular y nosotros lo editamos y publicamos.</p>
        </div>
        <Link
          href={`/subir/${slug}`}
          className="shrink-0 rounded-lg bg-amber-500 px-3.5 py-2 text-sm font-bold text-amber-950 hover:bg-amber-400"
        >
          Subir video
        </Link>
      </div>
    </section>
  )
}
