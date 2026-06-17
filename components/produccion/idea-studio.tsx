'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Scissors, Sparkles } from 'lucide-react'
import { IdeaBriefCard } from '@/components/produccion/idea-brief-card'
import { IdeaCaptionEditor } from '@/components/produccion/idea-caption-editor'
import { IdeaVideoPanel } from '@/components/recording/idea-video-panel'
import type { ContentIdea, ContentIdeaVideo } from '@/lib/supabase/types'

/**
 * Client-side idea → caption → recording flow. Caption must be saved from the
 * idea brief before uploads unlock, so recording follows a clear script.
 */
export function IdeaStudio({
  ideaId,
  idea,
  videos,
  publicEnabled,
}: {
  ideaId: string
  idea: Pick<
    ContentIdea,
    'hook' | 'visual_brief' | 'caption_angle' | 'hashtags_suggestion' | 'publish_date' | 'generated_caption' | 'title'
  >
  videos: ContentIdeaVideo[]
  publicEnabled?: boolean
}) {
  const [hook, setHook] = useState(idea.hook ?? '')
  const [visualBrief, setVisualBrief] = useState(idea.visual_brief ?? '')
  const [captionAngle, setCaptionAngle] = useState(idea.caption_angle ?? '')
  const [hashtags, setHashtags] = useState(idea.hashtags_suggestion ?? '')
  const [savedCaption, setSavedCaption] = useState(idea.generated_caption ?? '')

  useEffect(() => {
    setHook(idea.hook ?? '')
    setVisualBrief(idea.visual_brief ?? '')
    setCaptionAngle(idea.caption_angle ?? '')
    setHashtags(idea.hashtags_suggestion ?? '')
    setSavedCaption(idea.generated_caption ?? '')
  }, [ideaId, idea.hook, idea.visual_brief, idea.caption_angle, idea.hashtags_suggestion, idea.generated_caption])

  return (
    <>
      <IdeaBriefCard
        ideaId={ideaId}
        hook={hook}
        visualBrief={visualBrief}
        captionAngle={captionAngle}
        hashtags={hashtags}
        publishDate={idea.publish_date}
        onBriefUpdated={(fields) => {
          if ('hook' in fields) setHook(fields.hook ?? '')
          if ('visual_brief' in fields) setVisualBrief(fields.visual_brief ?? '')
          if ('caption_angle' in fields) setCaptionAngle(fields.caption_angle ?? '')
          if ('hashtags_suggestion' in fields) setHashtags(fields.hashtags_suggestion ?? '')
        }}
      />

      <Card id="stage-caption" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: '60ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" /> Caption
          </CardTitle>
        </CardHeader>
        <CardContent>
          <IdeaCaptionEditor
            ideaId={ideaId}
            initialCaption={savedCaption}
            hook={hook}
            visualBrief={visualBrief}
            captionAngle={captionAngle}
            hashtags={hashtags}
            onSaved={setSavedCaption}
          />
        </CardContent>
      </Card>

      <Card id="stage-material" className="scroll-mt-20 animate-in fade-in slide-in-from-bottom-1 duration-300" style={{ animationDelay: '120ms', animationFillMode: 'backwards' }}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scissors className="h-4 w-4 text-cyan-500" /> Material de video
          </CardTitle>
        </CardHeader>
        <CardContent>
          {savedCaption.trim() ? (
            <IdeaVideoPanel ideaId={ideaId} ideaTitle={idea.title} videos={videos} publicEnabled={publicEnabled} />
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-4 text-center text-sm text-muted-foreground">
              Guarda el caption basado en la idea antes de subir la grabación.
            </p>
          )}
        </CardContent>
      </Card>
    </>
  )
}

/** Compact caption + recording gate for the client profile sheet. */
export function IdeaStudioCompact({
  ideaId,
  idea,
  videos,
}: {
  ideaId: string
  idea: Pick<ContentIdea, 'hook' | 'visual_brief' | 'caption_angle' | 'hashtags_suggestion' | 'publish_date' | 'generated_caption' | 'title'>
  videos: ContentIdeaVideo[]
}) {
  const [hook, setHook] = useState(idea.hook ?? '')
  const [visualBrief, setVisualBrief] = useState(idea.visual_brief ?? '')
  const [captionAngle, setCaptionAngle] = useState(idea.caption_angle ?? '')
  const [hashtags, setHashtags] = useState(idea.hashtags_suggestion ?? '')
  const [savedCaption, setSavedCaption] = useState(idea.generated_caption ?? '')

  useEffect(() => {
    setHook(idea.hook ?? '')
    setVisualBrief(idea.visual_brief ?? '')
    setCaptionAngle(idea.caption_angle ?? '')
    setHashtags(idea.hashtags_suggestion ?? '')
    setSavedCaption(idea.generated_caption ?? '')
  }, [ideaId, idea.hook, idea.visual_brief, idea.caption_angle, idea.hashtags_suggestion, idea.generated_caption])

  return (
    <>
      <IdeaBriefCard
        ideaId={ideaId}
        hook={hook}
        visualBrief={visualBrief}
        captionAngle={captionAngle}
        hashtags={hashtags}
        publishDate={idea.publish_date}
        onBriefUpdated={(fields) => {
          if ('hook' in fields) setHook(fields.hook ?? '')
          if ('visual_brief' in fields) setVisualBrief(fields.visual_brief ?? '')
          if ('caption_angle' in fields) setCaptionAngle(fields.caption_angle ?? '')
          if ('hashtags_suggestion' in fields) setHashtags(fields.hashtags_suggestion ?? '')
        }}
      />
      <IdeaCaptionEditor
        ideaId={ideaId}
        initialCaption={savedCaption}
        hook={hook}
        visualBrief={visualBrief}
        captionAngle={captionAngle}
        hashtags={hashtags}
        onSaved={setSavedCaption}
      />
      {savedCaption.trim() ? (
        <IdeaVideoPanel ideaId={ideaId} ideaTitle={idea.title} videos={videos} />
      ) : (
        <p className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-3 text-center text-xs text-muted-foreground">
          Guarda el caption antes de grabar.
        </p>
      )}
    </>
  )
}
