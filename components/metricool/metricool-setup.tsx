'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { saveConfig, type MetricoolConfig } from '@/lib/metricool/client'
import { KeyRound, ExternalLink } from 'lucide-react'

interface MetricoolSetupProps {
  onConnected: () => void
  initialConfig?: MetricoolConfig | null
}

export function MetricoolSetup({ onConnected, initialConfig }: MetricoolSetupProps) {
  const [userToken, setUserToken] = useState(initialConfig?.userToken ?? '')
  const [userId, setUserId] = useState(initialConfig?.userId ?? '')
  const [blogId, setBlogId] = useState(initialConfig?.blogId ?? '')
  const [testing, setTesting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleConnect = async () => {
    if (!userToken || !userId || !blogId) {
      setError('Todos los campos son requeridos')
      return
    }

    setTesting(true)
    setError(null)

    try {
      const url = new URL('https://app.metricool.com/api/admin/simpleProfiles')
      url.searchParams.set('userId', userId)
      url.searchParams.set('blogId', blogId)

      const response = await fetch(url.toString(), {
        headers: { 'X-Mc-Auth': userToken },
      })

      if (!response.ok) {
        throw new Error(`Error ${response.status}: Verifica tus credenciales`)
      }

      saveConfig({ userToken, userId, blogId })
      onConnected()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error de conexion')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <KeyRound className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-xl">Conectar Metricool</CardTitle>
          <CardDescription>
            Ingresa tus credenciales de API para conectar tu cuenta de Metricool
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="userToken">API Token</Label>
            <Input
              id="userToken"
              type="password"
              placeholder="Tu token de API de Metricool"
              value={userToken}
              onChange={(e) => setUserToken(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userId">User ID</Label>
              <Input
                id="userId"
                placeholder="Tu user ID"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="blogId">Blog ID</Label>
              <Input
                id="blogId"
                placeholder="Tu blog/brand ID"
                value={blogId}
                onChange={(e) => setBlogId(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md bg-muted px-4 py-3 text-xs text-muted-foreground">
            Encuentra tus credenciales en Metricool: Account Settings &gt; API.
            Requiere plan Advanced o Custom.
          </div>

          <Button className="w-full" onClick={handleConnect} disabled={testing}>
            {testing ? 'Verificando...' : 'Conectar'}
          </Button>

          <a
            href="https://app.metricool.com/resources/apidocs/index.html"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <ExternalLink className="h-3 w-3" />
            Ver documentacion de API
          </a>
        </CardContent>
      </Card>
    </div>
  )
}
