'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Triggers the browser's print dialog (→ "Save as PDF") for the report. */
export function PrintButton() {
  return (
    <Button variant="outline" size="sm" onClick={() => window.print()} className="h-9">
      <Printer className="mr-2 h-4 w-4" />
      Imprimir / PDF
    </Button>
  )
}
