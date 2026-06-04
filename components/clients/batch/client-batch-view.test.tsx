import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'
import { ClientBatchView } from './client-batch-view'
import type { ClientVideoPipeline } from '@/lib/actions/video-pipeline'
import type { BatchVideo } from '@/lib/utils/batch-view'
import type { ContentIdeaVideo } from '@/lib/supabase/types'

vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={typeof href === 'string' ? href : '#'}>{children}</a>
  ),
}))

function rawFile(): ContentIdeaVideo {
  return {
    id: 'f1', idea_id: 'i', kind: 'raw', name: 'clip.mp4', drive_file_id: null,
    drive_view_link: null, drive_thumb_url: null, storage_provider: 'r2', mime_type: 'video/mp4',
    size_bytes: 1000, duration_sec: 42, notes: null, uploaded_by: null, status: 'uploaded',
    error_message: null, uploaded_at: '2026-06-01', updated_at: '2026-06-01',
  }
}

function mkVideo(overrides: Partial<BatchVideo> = {}): BatchVideo {
  return {
    id: 'idea-1', client_id: 'c1', content_type: 'C', title: 'Video de prueba',
    hook: null, visual_brief: null, caption_angle: null, hashtags_suggestion: null, rationale: null,
    status: 'idea', production_task_id: null, recording_session_id: null, theme: null,
    generation_prompt: null, model: null, generated_caption: null, caption_platform: null,
    caption_generated_at: null, published_at: null, approval_status: 'pending', approved_by: null,
    approved_at: null, submitted_at: null, recording_date: null, publish_date: null,
    created_by: null, created_at: '2026-06-01', updated_at: '2026-06-01',
    videos: { raw: [], broll: [], edited: [] },
    ...overrides,
  } as BatchVideo
}

function mkPipeline(videos: BatchVideo[]): ClientVideoPipeline {
  return {
    client: {
      id: 'c1', name: '612 C. Lounge', industry: 'Food & Beverage', status: 'active',
      platforms: ['instagram', 'facebook', 'tiktok'], logo_url: null, logo_dark_url: null,
      brand_colors: {}, metricool_blog_id: null,
    } as ClientVideoPipeline['client'],
    videos: videos as ClientVideoPipeline['videos'],
    assets: [],
  }
}

const selectedVideo = mkVideo({
  id: 'v-real',
  content_type: 'C',
  title: '612 de noche: planes para cada vibe',
  hook: '¿No sabes qué hacer esta noche en Arecibo?',
  visual_brief: 'Carrusel de 4-5 slides tipo elige tu plan.',
  caption_angle: 'Tono juguetón y cercano.',
  hashtags_suggestion: '#612cigarlounge #arecibo #loungepr',
})
const recordedVideo = mkVideo({
  id: 'v-rec',
  content_type: 'R',
  title: 'Cómo encender un cigarro como un pro',
  hook: 'Paso a paso para encender bien tu cigarro',
  videos: { raw: [rawFile()], broll: [], edited: [] },
})

describe('ClientBatchView', () => {
  beforeEach(() => {
    render(<ClientBatchView pipeline={mkPipeline([selectedVideo, recordedVideo])} />)
  })
  afterEach(() => cleanup())

  it('shows the client name and status', () => {
    expect(screen.getByRole('heading', { name: '612 C. Lounge' })).toBeInTheDocument()
    expect(screen.getByText('Activo')).toBeInTheDocument()
  })

  it('renders the 7-stage stepper in Spanish and marks the current stage with AQUÍ', () => {
    for (const label of ['Idea', 'Título', 'Caption', 'Video', 'Edición', 'Aprobación', 'Publicación']) {
      expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1)
    }
    // Batch sits at "title": one video has only a hook (title), the other is recorded (video).
    expect(screen.getByText('AQUÍ')).toBeInTheDocument()
  })

  it('shows a beginner-friendly guidance hint with the current stage', () => {
    expect(screen.getByText(/Este lote está en la etapa/i)).toBeInTheDocument()
  })

  it('lists every video in the batch with its title', () => {
    // The selected video's title appears both on its card and in the detail panel.
    expect(screen.getAllByRole('heading', { name: '612 de noche: planes para cada vibe' }).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByRole('heading', { name: 'Cómo encender un cigarro como un pro' })).toBeInTheDocument()
  })

  it('renders per-video recorded/por-grabar status', () => {
    expect(screen.getAllByText('Por grabar').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Grabado').length).toBeGreaterThan(0)
  })

  it('opens the first video in the detail panel with its real fields and pending files', () => {
    expect(screen.getByText('Detalle del video')).toBeInTheDocument()
    expect(screen.getByText('Gancho')).toBeInTheDocument()
    expect(screen.getByText('Idea visual')).toBeInTheDocument()
    expect(screen.getByText('#612cigarlounge')).toBeInTheDocument()
    // raw + edited not uploaded for the selected video → "Pendiente"
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Sube la grabación de este video')).toBeInTheDocument()
  })

  it('switches the detail panel when another video is selected', () => {
    fireEvent.click(screen.getByRole('button', { name: /Cómo encender un cigarro como un pro/i }))
    // recorded video → detail shows the preview, not the dropzone CTA
    expect(screen.queryByText('Sube la grabación de este video')).not.toBeInTheDocument()
  })
})

describe('ClientBatchView empty state', () => {
  afterEach(() => cleanup())
  it('shows a friendly empty state when the batch has no videos', () => {
    render(<ClientBatchView pipeline={mkPipeline([])} />)
    expect(screen.getByText('Este lote aún no tiene videos')).toBeInTheDocument()
  })
})
