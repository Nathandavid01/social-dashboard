'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CaptionFiltersProps {
  filterIndustry: string
  filterPlatform: string
  onIndustryChange: (value: string) => void
  onPlatformChange: (value: string) => void
  industries: string[]
}

const platforms = ['Instagram', 'TikTok', 'Facebook', 'Twitter/X']

export function CaptionFilters({
  filterIndustry,
  filterPlatform,
  onIndustryChange,
  onPlatformChange,
  industries,
}: CaptionFiltersProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <Select value={filterIndustry} onValueChange={onIndustryChange}>
        <SelectTrigger className="h-8 w-full text-xs sm:w-[160px]">
          <SelectValue placeholder="Industria" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas las industrias</SelectItem>
          {industries.map((ind) => (
            <SelectItem key={ind} value={ind}>
              {ind}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filterPlatform} onValueChange={onPlatformChange}>
        <SelectTrigger className="h-8 w-full text-xs sm:w-[140px]">
          <SelectValue placeholder="Plataforma" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todas</SelectItem>
          {platforms.map((p) => (
            <SelectItem key={p} value={p}>
              {p}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
