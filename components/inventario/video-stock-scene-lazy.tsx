'use client'

import dynamic from 'next/dynamic'
import type { VideoStockSceneProps } from './video-stock-scene'

/** three.js only runs in the browser and is heavy — load it after the page paints. */
const Scene = dynamic(() => import('./video-stock-scene').then((m) => m.VideoStockScene), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#0b0b0b]" />,
})

export function VideoStockSceneLazy(props: VideoStockSceneProps) {
  return <Scene {...props} />
}
