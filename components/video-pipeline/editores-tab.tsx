import { Clapperboard } from 'lucide-react'
import { EditorVideoCard, type EditQueueItem } from './editor-video-card'

export function EditoresTab({ items }: { items: EditQueueItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-dashed p-10 text-center">
        <Clapperboard className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
        <p className="text-sm font-medium text-muted-foreground">Nada por editar 🎉</p>
        <p className="text-xs text-muted-foreground/70">
          Aquí aparecen los videos con material crudo listos para editar (raw subido, sin editado).
        </p>
      </div>
    )
  }
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <EditorVideoCard key={item.video.id} item={item} />
      ))}
    </div>
  )
}
