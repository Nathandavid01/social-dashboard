'use client'

import type { ReactNode } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function ReciboWorkspace({calendar,children}:{calendar:ReactNode;children:ReactNode}) {
  if(!calendar)return <>{children}</>
  return <Tabs defaultValue="calendar" className="space-y-4">
    <TabsList aria-label="Vistas de Recibos">
      <TabsTrigger value="calendar">Calendario</TabsTrigger>
      <TabsTrigger value="received">Contenido recibido</TabsTrigger>
    </TabsList>
    <TabsContent value="calendar" forceMount className="data-[state=inactive]:hidden">{calendar}</TabsContent>
    <TabsContent value="received">{children}</TabsContent>
  </Tabs>
}
