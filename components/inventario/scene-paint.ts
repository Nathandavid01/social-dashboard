import * as THREE from 'three'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import type { CalendarDay } from '@/lib/inventario/client-detail-core'
import { clientInitials } from '@/lib/inventario/client-initials'
import { GOLD_HEX, HEALTH_META, RAW_HEX } from './stock-labels'

/** Canvas painters for the 3D inventory: medallions, tier signs, calendar tiles. */

export const BADGE_PX = 320

export const TIER_TITLE: Record<ClientStock['health'], string> = {
  agotado: 'SIN VIDEOS',
  critico: 'MENOS DE 1 SEMANA',
  bajo: '1–2 SEMANAS',
  ok: '2+ SEMANAS',
  sin_cadencia: 'SIN CADENCIA',
}

const FONT = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif'

function bubble(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, text: string, ink: string) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 6
  ctx.strokeStyle = '#070707'
  ctx.stroke()
  ctx.fillStyle = ink
  ctx.font = `800 ${text.length > 2 ? r * 0.82 : r * 1.05}px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y + r * 0.06)
}

/**
 * The client's medallion: logo (or gold monogram) in a ring of its health
 * color, with the counts painted on it so nobody has to hover to read them —
 * gold bubble = edited videos left, blue bubble = raw clips waiting.
 */
export function paintBadge(ctx: CanvasRenderingContext2D, client: ClientStock, logo: HTMLImageElement | null): void {
  const S = BADGE_PX
  const c = S / 2
  const R = S * 0.36
  const ring = HEALTH_META[client.health].hex
  ctx.clearRect(0, 0, S, S)

  // Soft halo in the health color so the status reads from far away.
  const halo = ctx.createRadialGradient(c, c, R * 0.9, c, c, R * 1.38)
  halo.addColorStop(0, `${ring}88`)
  halo.addColorStop(1, `${ring}00`)
  ctx.fillStyle = halo
  ctx.fillRect(0, 0, S, S)

  ctx.beginPath()
  ctx.arc(c, c, R + 12, 0, Math.PI * 2)
  ctx.fillStyle = ring
  ctx.fill()
  ctx.beginPath()
  ctx.arc(c, c, R + 3, 0, Math.PI * 2)
  ctx.fillStyle = GOLD_HEX
  ctx.fill()

  ctx.save()
  ctx.beginPath()
  ctx.arc(c, c, R, 0, Math.PI * 2)
  ctx.clip()
  if (logo) {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, S, S)
    const s = Math.max((R * 2) / logo.naturalWidth, (R * 2) / logo.naturalHeight)
    const w = logo.naturalWidth * s
    const h = logo.naturalHeight * s
    ctx.drawImage(logo, c - w / 2, c - h / 2, w, h)
  } else {
    const g = ctx.createLinearGradient(0, c - R, 0, c + R)
    g.addColorStop(0, '#1d1d1d')
    g.addColorStop(1, '#070707')
    ctx.fillStyle = g
    ctx.fillRect(0, 0, S, S)
    const initials = clientInitials(client.clientName)
    ctx.fillStyle = GOLD_HEX
    ctx.font = `700 ${initials.length > 1 ? R * 0.78 : R * 0.95}px ${FONT}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(initials, c, c + R * 0.05)
  }
  ctx.restore()

  bubble(ctx, c + R * 0.78, c + R * 0.78, R * 0.42, GOLD_HEX, String(client.listos), '#111111')
  if (client.crudo > 0) {
    bubble(ctx, c - R * 0.78, c + R * 0.78, R * 0.34, RAW_HEX, `+${client.crudo}`, '#0b1a2e')
  }
}

/** Big status sign at the left of each tier: "SIN VIDEOS · 19". */
export function makeSign(title: string, count: number, hex: string): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 640
  canvas.height = 200
  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = 'rgba(7,7,7,0.82)'
    ctx.beginPath()
    ctx.roundRect(8, 8, 624, 184, 28)
    ctx.fill()
    ctx.lineWidth = 6
    ctx.strokeStyle = hex
    ctx.stroke()
    ctx.fillStyle = hex
    ctx.beginPath()
    ctx.arc(64, 100, 22, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.textBaseline = 'middle'
    ctx.textAlign = 'left'
    ctx.font = `800 54px ${FONT}`
    ctx.fillText(title, 108, 78, 500)
    ctx.fillStyle = 'rgba(255,255,255,0.7)'
    ctx.font = `600 40px ${FONT}`
    ctx.fillText(count === 1 ? '1 cliente' : `${count} clientes`, 108, 140)
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}


const DAY_NAMES = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB']
const MONTHS = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']

export const DAY_STYLE: Record<CalendarDay['kind'], { label: string; fill: string; edge: string; ink: string; sub: string }> = {
  agendado: { label: 'AGENDADO', fill: '#e6af23', edge: '#ffd86b', ink: '#111111', sub: 'rgba(0,0,0,0.65)' },
  proyectado: { label: 'LISTO', fill: '#14110a', edge: '#e6af23', ink: '#ffffff', sub: 'rgba(255,255,255,0.6)' },
  publicado: { label: 'PUBLICADO', fill: '#0b1f17', edge: '#34d399', ink: '#ffffff', sub: 'rgba(255,255,255,0.6)' },
  vacio: { label: 'SIN VIDEO', fill: '#230b0b', edge: '#ef4444', ink: '#ffffff', sub: 'rgba(255,255,255,0.6)' },
  libre: { label: '', fill: '#0e0e0e', edge: '#2a2a2a', ink: 'rgba(255,255,255,0.45)', sub: 'rgba(255,255,255,0.3)' },
}

/** Format pill colors — the profile panel uses the same ones. */
export const FORMAT_TILE: Record<'reel' | 'post' | 'story', { label: string; hex: string }> = {
  reel: { label: 'REEL', hex: '#e6af23' },
  post: { label: 'POST', hex: '#c4b5fd' },
  story: { label: 'STORY', hex: '#f9a8d4' },
}

export const TILE_W = 256
export const TILE_H = 320

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let line = ''
  for (const w of words) {
    const next = line ? `${line} ${w}` : w
    if (ctx.measureText(next).width <= maxW) {
      line = next
      continue
    }
    if (line) lines.push(line)
    line = w
    if (lines.length === maxLines) break
  }
  if (lines.length < maxLines && line) lines.push(line)
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    let last = lines[maxLines - 1]
    while (last.length > 1 && ctx.measureText(`${last}…`).width > maxW) last = last.slice(0, -1)
    lines[maxLines - 1] = `${last}…`
  }
  return lines
}

/** One day of the client's calendar: weekday, date, status and the post title. */
export function paintDayTile(ctx: CanvasRenderingContext2D, day: CalendarDay, isToday: boolean): void {
  const st = DAY_STYLE[day.kind]
  const [, m, d] = day.date.split('-').map(Number)
  ctx.clearRect(0, 0, TILE_W, TILE_H)

  ctx.beginPath()
  ctx.roundRect(6, 6, TILE_W - 12, TILE_H - 12, 26)
  ctx.fillStyle = st.fill
  ctx.fill()
  ctx.lineWidth = isToday ? 10 : 5
  ctx.strokeStyle = isToday ? '#ffffff' : st.edge
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = st.sub
  ctx.font = `700 30px ${FONT}`
  ctx.fillText(isToday ? 'HOY' : DAY_NAMES[day.weekday], TILE_W / 2, 52)

  // Which format this posting day takes, so you know what is due.
  if (day.posting) {
    const f = day.format
    const label = f ? FORMAT_TILE[f].label : 'REEL / POST'
    ctx.font = `800 ${f ? 22 : 18}px ${FONT}`
    const w = ctx.measureText(label).width + 26
    ctx.beginPath()
    ctx.roundRect(TILE_W / 2 - w / 2, 64, w, 30, 15)
    // On a gold (agendado) tile the pill inverts so it does not vanish.
    const onGold = day.kind === 'agendado'
    const hex = f ? FORMAT_TILE[f].hex : null
    ctx.fillStyle = onGold ? '#111111' : hex ?? 'rgba(255,255,255,0.18)'
    ctx.fill()
    ctx.fillStyle = onGold ? hex ?? '#ffffff' : hex ? '#111111' : '#ffffff'
    ctx.fillText(label, TILE_W / 2, 86)
  }
  ctx.fillStyle = st.ink
  ctx.font = `800 78px ${FONT}`
  ctx.fillText(String(d), TILE_W / 2, 160)
  ctx.fillStyle = st.sub
  ctx.font = `600 22px ${FONT}`
  ctx.fillText(MONTHS[m - 1], TILE_W / 2, 186)

  if (st.label) {
    ctx.font = `800 26px ${FONT}`
    ctx.fillStyle = day.kind === 'agendado' ? '#111111' : st.edge
    ctx.fillText(st.label, TILE_W / 2, 222)
  }
  if (day.title) {
    ctx.font = `600 22px ${FONT}`
    ctx.fillStyle = st.ink
    wrap(ctx, day.title, TILE_W - 40, 2).forEach((line, i) => ctx.fillText(line, TILE_W / 2, 258 + i * 26))
  }
}
