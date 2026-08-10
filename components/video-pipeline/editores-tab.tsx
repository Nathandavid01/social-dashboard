import { Clapperboard } from 'lucide-react'
import { EditorVideoCard, type EditQueueItem } from './editor-video-card'
import { VideoUploadLog } from './video-upload-log'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { VideoUploadLogItem } from '@/lib/actions/video-upload-log'

export function EditoresTab({ items, uploads = [] }: { items: EditQueueItem[]; uploads?: VideoUploadLogItem[] }) {
  return (
    <Tabs defaultValue="queue" className="space-y-4">
      <TabsList>
        <TabsTrigger value="queue">Por editar{items.length > 0 ? ` (${items.length})` : ''}</TabsTrigger>
        <TabsTrigger value="uploads">Mis subidas{uploads.length > 0 ? ` (${uploads.length})` : ''}</TabsTrigger>
      </TabsList>

      <TabsContent value="queue">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <Clapperboard className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
            <p className="text-sm font-medium text-muted-foreground">Nada por editar 🎉</p>
            <p className="text-xs text-muted-foreground/70">
              Aquí aparecen los videos con material crudo listos para editar (raw subido, sin editado).
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {items.map((item) => <EditorVideoCard key={item.video.id} item={item} />)}
          </div>
        )}
      </TabsContent>

      <TabsContent value="uploads">
        <VideoUploadLog items={uploads} />
      </TabsContent>
    </Tabs>
  )
}
