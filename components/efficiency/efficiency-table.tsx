'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { Users } from 'lucide-react'
import { StatusBadge } from '@/components/clients/status-badge'
import { ScoreBadge } from './score-badge'
import { cn } from '@/lib/utils'
import type { ClientEfficiencyRow } from '@/lib/actions/efficiency'

type SortKey =
  | 'score'
  | 'name'
  | 'openTasks'
  | 'overdueTasks'
  | 'completedTasks30d'
  | 'postsPublished30d'
  | 'postsScheduledNext7d'
  | 'daysSinceLastPost'

interface Props {
  rows: ClientEfficiencyRow[]
}

export function EfficiencyTable({ rows }: Props) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sortKey, setSortKey] = useState<SortKey>('score')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const filtered = useMemo(() => {
    const list = rows.filter((r) => {
      const matchSearch = r.name.toLowerCase().includes(search.toLowerCase())
      const matchStatus = statusFilter === 'all' || r.status === statusFilter
      return matchSearch && matchStatus
    })
    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      if (typeof av === 'string' && typeof bv === 'string') {
        return av.localeCompare(bv) * dir
      }
      return ((av as number) - (bv as number)) * dir
    })
    return list
  }, [rows, search, statusFilter, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="paused">Paused</SelectItem>
            <SelectItem value="onboarding">Onboarding</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No clients found"
          description="Try adjusting your filters."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <SortHeader label="Score" col="score" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <SortHeader label="Client" col="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                <TableHead className="hidden lg:table-cell">Status</TableHead>
                <SortHeader label="Open" col="openTasks" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden md:table-cell text-right" />
                <SortHeader label="Overdue" col="overdueTasks" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="text-right" />
                <SortHeader label="Done 30d" col="completedTasks30d" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden md:table-cell text-right" />
                <SortHeader label="Posts 30d" col="postsPublished30d" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden md:table-cell text-right" />
                <SortHeader label="Next 7d" col="postsScheduledNext7d" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden lg:table-cell text-right" />
                <SortHeader label="Last Post" col="daysSinceLastPost" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} className="hidden lg:table-cell text-right" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <ScoreBadge score={r.score} />
                  </TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/clients/${r.id}`}
                      className="hover:text-primary transition-colors"
                    >
                      {r.name}
                    </Link>
                    {r.assigneeName && (
                      <div className="text-xs text-muted-foreground">
                        {r.assigneeName}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums">
                    {r.openTasks}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'text-right tabular-nums',
                      r.overdueTasks > 0 && 'text-red-500 font-semibold',
                    )}
                  >
                    {r.overdueTasks}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                    {r.completedTasks30d}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-right tabular-nums text-muted-foreground">
                    {r.postsPublished30d}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right tabular-nums text-muted-foreground">
                    {r.postsScheduledNext7d}
                  </TableCell>
                  <TableCell
                    className={cn(
                      'hidden lg:table-cell text-right tabular-nums text-muted-foreground',
                      r.daysSinceLastPost != null &&
                        r.daysSinceLastPost > 14 &&
                        'text-yellow-500',
                    )}
                  >
                    {r.daysSinceLastPost == null
                      ? '—'
                      : r.daysSinceLastPost === 0
                      ? 'today'
                      : `${r.daysSinceLastPost}d ago`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}

interface SortHeaderProps {
  label: string
  col: SortKey
  sortKey: SortKey
  sortDir: 'asc' | 'desc'
  onClick: (col: SortKey) => void
  className?: string
}

function SortHeader({ label, col, sortKey, sortDir, onClick, className }: SortHeaderProps) {
  const Icon =
    sortKey !== col ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
  const isRight = className?.includes('text-right')
  return (
    <TableHead className={className}>
      <Button
        variant="ghost"
        size="sm"
        className={cn('-ml-2 h-7 px-2 font-medium', isRight && 'ml-0 -mr-2')}
        onClick={() => onClick(col)}
      >
        {label}
        <Icon className="ml-1 h-3 w-3 opacity-60" />
      </Button>
    </TableHead>
  )
}
