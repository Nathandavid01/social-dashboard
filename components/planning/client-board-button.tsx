'use client'

import { useState } from 'react'
import { LayoutGrid } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { PipelineFlowBoard } from '@/components/clients/profile/pipeline-flow-board'
import { useHasPermission } from '@/components/auth/role-gate'
import type { ContentIdea } from '@/lib/supabase/types'

/**
 * Opens a given client's production flow as a Trello-style board (the same
 * PipelineFlowBoard used in the client's Flujo tab) in a dialog, straight from
 * the Workflow page (/planning). Drag is enabled when the user has planning.move.
 */
export function ClientBoardButton({ clientName, ideas }: { clientName: string; ideas: ContentIdea[] }) {
  const [open, setOpen] = useState(false)
  const canMove = useHasPermission('planning.move')

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 shrink-0 gap-1.5 whitespace-nowrap"
        onClick={() => setOpen(true)}
      >
        <LayoutGrid className="h-3.5 w-3.5" /> Abrir board
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Flujo — {clientName}</DialogTitle>
          </DialogHeader>
          <PipelineFlowBoard ideas={ideas} canMove={canMove} />
        </DialogContent>
      </Dialog>
    </>
  )
}
