import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { VideoPipelineTable } from './video-pipeline-table'
import type { PipelineVideo } from '@/lib/actions/video-pipeline'

vi.mock('./video-pipeline-row', () => ({
  VideoPipelineRow: ({ video }: { video: PipelineVideo }) => (
    <tr><td>{video.title}</td></tr>
  ),
}))

function v(id: string, title: string) {
  return { id, title, videos: { raw: [], broll: [], edited: [] } } as unknown as PipelineVideo
}

describe('VideoPipelineTable', () => {
  it('renders a row per video and the column headers', () => {
    render(<VideoPipelineTable videos={[v('1', 'A'), v('2', 'B')]} assetCount={0} />)
    expect(screen.getByText('A')).toBeInTheDocument()
    expect(screen.getByText('B')).toBeInTheDocument()
    expect(screen.getByText('Video')).toBeInTheDocument()
    expect(screen.getByText('Progreso')).toBeInTheDocument()
    expect(screen.getByText('Material')).toBeInTheDocument()
  })
})
