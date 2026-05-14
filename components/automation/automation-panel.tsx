'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, RefreshCw, CheckCircle, XCircle, Clock, Zap } from 'lucide-react'
import { useToast } from '@/lib/hooks/use-toast'

interface QueueTask {
  id: string
  name: string
}

interface ProcessResult {
  success: boolean
  taskId: string
  taskTitle: string
  caption?: string
  metricoolPostId?: string | number
  error?: string
}

export function AutomationPanel() {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<QueueTask[]>([])
  const [loadingTasks, setLoadingTasks] = useState(false)
  const [processing, setProcessing] = useState<string | null>(null)
  const [results, setResults] = useState<ProcessResult[]>([])

  const fetchQueue = async () => {
    setLoadingTasks(true)
    try {
      const res = await fetch('/api/automation/process-queue')
      const data = await res.json()
      setTasks(data.tasks || [])
    } catch {
      toast({ title: 'Error', description: 'Could not load Video Queue tasks', variant: 'destructive' })
    } finally {
      setLoadingTasks(false)
    }
  }

  useEffect(() => { fetchQueue() }, [])

  const processTask = async (taskId: string, taskName: string) => {
    setProcessing(taskId)
    try {
      const res = await fetch('/api/automation/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task_id: taskId }),
      })
      const result: ProcessResult = await res.json()
      setResults((prev) => [result, ...prev.filter((r) => r.taskId !== taskId)])

      if (result.success) {
        toast({ title: 'Caption generado', description: `"${taskName}" → Metricool draft creado` })
      } else {
        toast({ title: 'Error', description: result.error || 'Processing failed', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Error', description: 'Request failed', variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  const processAll = async () => {
    setProcessing('all')
    try {
      const res = await fetch('/api/automation/process-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      const newResults: ProcessResult[] = data.results || []
      setResults((prev) => [...newResults, ...prev])
      const success = newResults.filter((r) => r.success).length
      toast({ title: `Procesados ${success}/${newResults.length}`, description: 'Captions generados y enviados a Metricool' })
    } catch {
      toast({ title: 'Error', description: 'Failed to process queue', variant: 'destructive' })
    } finally {
      setProcessing(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Status Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Video Queue</p>
                <p className="text-2xl font-bold">{tasks.length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Captions generados</p>
                <p className="text-2xl font-bold">{results.filter((r) => r.success).length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Errores</p>
                <p className="text-2xl font-bold">{results.filter((r) => !r.success).length}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Video Queue */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Video Queue — ClickUp</CardTitle>
              <CardDescription>Tareas en Daily Operation → Video Queue</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loadingTasks}>
                <RefreshCw className={`mr-2 h-3.5 w-3.5 ${loadingTasks ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              {tasks.length > 0 && (
                <Button size="sm" onClick={processAll} disabled={!!processing}>
                  {processing === 'all' ? (
                    <RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="mr-2 h-3.5 w-3.5" />
                  )}
                  Process All
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="mx-auto h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No tasks in Video Queue</p>
              <p className="text-xs mt-1 opacity-60">Have your editors create tasks in ClickUp → Daily Operation → Video Queue</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const result = results.find((r) => r.taskId === task.id)
                const isProcessing = processing === task.id
                return (
                  <div key={task.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div className="flex items-center gap-3">
                      {result?.success ? (
                        <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                      ) : result?.error ? (
                        <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <p className="text-sm font-medium">{task.name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {result?.success && (
                        <Badge variant="outline" className="text-green-500 border-green-500/30 bg-green-500/10 text-xs">
                          Done
                        </Badge>
                      )}
                      {!result?.success && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => processTask(task.id, task.name)}
                          disabled={!!processing}
                        >
                          {isProcessing ? (
                            <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                          ) : (
                            <Sparkles className="mr-2 h-3 w-3" />
                          )}
                          {isProcessing ? 'Generating...' : 'Generate'}
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Log */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Results</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {results.map((result, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">{result.taskTitle}</p>
                    <Badge
                      variant="outline"
                      className={result.success
                        ? 'text-green-500 border-green-500/30 bg-green-500/10'
                        : 'text-red-500 border-red-500/30 bg-red-500/10'
                      }
                    >
                      {result.success ? 'Success' : 'Failed'}
                    </Badge>
                  </div>
                  {result.caption && (
                    <p className="text-xs text-muted-foreground line-clamp-3 font-mono whitespace-pre-wrap">
                      {result.caption}
                    </p>
                  )}
                  {result.error && (
                    <p className="text-xs text-red-500">{result.error}</p>
                  )}
                  {result.metricoolPostId && (
                    <p className="text-xs text-muted-foreground">Metricool draft ID: {result.metricoolPostId}</p>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
