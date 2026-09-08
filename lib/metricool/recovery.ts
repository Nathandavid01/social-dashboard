import type { ScheduledPost } from './scheduler'

/** Positive evidence only: unknown media shapes cannot authorize linkage. */
export function verifyRecoveryPost(post: ScheduledPost, expected: {
  postId: number; caption: string; mediaUrl: string; platforms: string[]
}): string | null {
  if (post.id !== expected.postId) return 'El ID no coincide.'
  if (post.draft || post.autoPublish !== true) return 'El post es un borrador o no tiene publicación automática.'
  if (post.text !== expected.caption) return 'El caption no coincide con el aprobado.'
  const media = (post.media ?? []).map(item => typeof item === 'string' ? item :
    item && typeof item === 'object' && 'url' in item && typeof item.url === 'string' ? item.url : null)
  if (media.length !== 1 || media[0] !== expected.mediaUrl) return 'El archivo de Metricool no coincide con el video aprobado.'
  const networks = [...new Set(post.providers.map(p => p.network.toLowerCase()))].sort()
  if (JSON.stringify(networks) !== JSON.stringify([...new Set(expected.platforms.map(p => p.toLowerCase()))].sort())) return 'Las redes no coinciden con las del cliente.'
  return null
}
