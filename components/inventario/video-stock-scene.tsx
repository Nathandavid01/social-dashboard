'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import type { CalendarDay } from '@/lib/inventario/client-detail-core'
import { ROW_DEPTH, layoutStage, toArc } from '@/lib/inventario/stage-layout'
import { cameraControls, flightArrived } from '@/lib/inventario/scene-camera'
import {
  BADGE_PX,
  DAY_STYLE,
  FORMAT_TILE,
  TIER_TITLE,
  TILE_H,
  TILE_W,
  makeSign,
  paintBadge,
  paintDayTile,
} from './scene-paint'
import { GOLD_HEX, HEALTH_META, RAW_HEX, daysLeftLabel, runOutLabel, shortDateLabel } from './stock-labels'

export interface VideoStockSceneProps {
  clients: ClientStock[]
  today: string
  selectedId: string | null
  onSelect: (clientId: string | null) => void
  /** The selected client's next 14 days; drawn as a floating calendar. */
  calendar?: CalendarDay[] | null
}

/** Gold column: world units per edited video, capped so it never hides the row behind. */
const UNIT = 0.09
const COLUMN_CAP = 12
const COLUMN_R = 0.3
const PEDESTAL_H = 0.12
/** Medallion (logo + counts): world size and lift above the column top. */
const BADGE = 1.5
const BADGE_LIFT = 0.6
/** Amphitheater: the front row bends around a point this far in front of it. */
const ARC_RADIUS = 16
const SIGN_W = 4.4
/** Floating calendar: 2 weeks × 7 days. */
const TILE = 0.92
const TILE_GAP = 0.12
/** Width of the profile panel that covers the right of the stage on desktop. */
const PANEL_PX = 372

interface Seat {
  client: ClientStock
  group: THREE.Group
  goldMesh: THREE.Mesh | null
  goldMat: THREE.MeshStandardMaterial | null
  goldH: number
  rawRing: THREE.Mesh | null
  badge: THREE.Sprite
  badgeMat: THREE.SpriteMaterial
  hit: THREE.Mesh
  delay: number
}

interface Ribbon {
  key: string
  group: THREE.Group
  tiles: { mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; day: CalendarDay; delay: number }[]
  born: number
  dispose: () => void
}

type Tip =
  | { kind: 'client'; client: ClientStock; x: number; y: number }
  | { kind: 'day'; day: CalendarDay; x: number; y: number }

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)
}

function easeOutBack(t: number): number {
  const x = Math.min(Math.max(t, 0), 1)
  const c1 = 1.4
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2)
}

/** Point on the amphitheater circle (center ARC_RADIUS in front of the front row). */
function arcPoint(r: number, a: number): [number, number] {
  return [r * Math.sin(a), ARC_RADIUS - r * Math.cos(a)]
}

/** A curved step: annular sector from `inner` to `outer`, extruded `height` up. */
function arcStepGeometry(inner: number, outer: number, halfAngle: number, height: number): THREE.ExtrudeGeometry {
  // Drawn in (x, -z); rotateX(-90°) turns the extrusion depth into +y.
  const shape = new THREE.Shape()
  const steps = 48
  for (let i = 0; i <= steps; i++) {
    const [x, z] = arcPoint(outer, -halfAngle + (2 * halfAngle * i) / steps)
    if (i === 0) shape.moveTo(x, -z)
    else shape.lineTo(x, -z)
  }
  for (let i = steps; i >= 0; i--) {
    const [x, z] = arcPoint(inner, -halfAngle + (2 * halfAngle * i) / steps)
    shape.lineTo(x, -z)
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, curveSegments: 1 })
  geo.rotateX(-Math.PI / 2)
  return geo
}

function arcTubeGeometry(radius: number, halfAngle: number, y: number): THREE.TubeGeometry {
  const pts: THREE.Vector3[] = []
  for (let i = 0; i <= 48; i++) {
    const [x, z] = arcPoint(radius, -halfAngle + (2 * halfAngle * i) / 48)
    pts.push(new THREE.Vector3(x, y, z))
  }
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 96, 0.03, 6, false)
}

/**
 * The inventory as an amphitheater: one curved tier per status, the most
 * urgent in front, each client a medallion with its logo facing you and its
 * counts painted on. Selecting a client flies the camera to it and unfolds
 * its next two weeks as a floating calendar (reel/post per day).
 */
export function VideoStockScene({ clients, today, selectedId, onSelect, calendar = null }: VideoStockSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const calendarRef = useRef<CalendarDay[] | null>(calendar)
  const onSelectRef = useRef(onSelect)
  const [unsupported, setUnsupported] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)
  // The person zoomed / moved: offer a one-click way back to the whole stand.
  const [moved, setMoved] = useState(false)
  const onUserMoveRef = useRef(() => setMoved(true))
  const resetRef = useRef<() => void>(() => {})

  onSelectRef.current = onSelect
  selectedRef.current = selectedId
  calendarRef.current = calendar

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    } catch {
      setUnsupported(true)
      return
    }

    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setClearColor(0x070707, 1)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.1
    const canvas = renderer.domElement
    canvas.style.display = 'block'
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'Vista 3D del inventario de video por cliente. La lista debajo tiene los mismos datos.')
    mount.appendChild(canvas)

    const scene = new THREE.Scene()
    // Logos load async; ignore any that land after unmount.
    let disposed = false

    // Everything we allocate, so unmount can free it.
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(x: T): T => {
      disposables.push(x)
      return x
    }

    // Studio reflections so the gold reads as metal, not brown plastic.
    const pmrem = track(new THREE.PMREMGenerator(renderer))
    const room = new RoomEnvironment()
    scene.environment = track(pmrem.fromScene(room, 0.04).texture)
    scene.environmentIntensity = 0.5
    room.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })

    // ── Layout ──
    const initialWidth = mount.clientWidth || 1024
    const perRow = initialWidth < 640 ? 5 : initialWidth < 1024 ? 9 : 12
    const stage = layoutStage(clients, perRow)
    const frameW = stage.width + SIGN_W + 1.5
    // The arc bends the row ends toward the camera; frame from that bulge back.
    const bulge = ARC_RADIUS * (1 - Math.cos(Math.min(stage.width / 2 / ARC_RADIUS, 1.2)))
    const spanZ = bulge - stage.depth + ROW_DEPTH
    const center = new THREE.Vector3(-(SIGN_W + 0.3) / 2, stage.height * 0.38 + 0.9, stage.depth + spanZ * 0.5 + 0.6)
    const radius = Math.max(frameW, Math.abs(stage.depth))
    scene.fog = new THREE.Fog(0x070707, radius * 1.4, radius * 3.5)

    // ── Lights ──
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x0a0a0a, 0.8))
    const key = new THREE.DirectionalLight(0xffffff, 1.5)
    key.position.set(4, 12, 10)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.5)
    rim.position.set(-8, 6, -14)
    scene.add(rim)

    // ── Floor ──
    const floor = new THREE.Mesh(
      track(new THREE.CircleGeometry(radius * 5, 64)),
      track(new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.95, metalness: 0.1 })),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)

    // ── Shared geometry ──
    const box = track(new THREE.BoxGeometry(1, 1, 1))
    const cyl = track(new THREE.CylinderGeometry(1, 1, 1, 40))
    const ringGeo = track(new THREE.TorusGeometry(0.5, 0.035, 10, 48))
    const plane = track(new THREE.PlaneGeometry(1, 1))
    const stepMat = track(new THREE.MeshStandardMaterial({ color: 0x121212, roughness: 0.75, metalness: 0.25 }))

    // ── Curved steps: one per row, glowing front edge in the tier color ──
    const rows = new Map<number, { y: number; z: number; hex: string }>()
    for (const item of stage.items) {
      if (!rows.has(item.row)) rows.set(item.row, { y: item.y, z: item.z, hex: HEALTH_META[item.health].hex })
    }
    for (const { y, z, hex } of rows.values()) {
      const stepH = y + 0.2
      const inner = ARC_RADIUS - z - 0.55
      const outer = inner + ROW_DEPTH
      const half = (stage.width / 2 + 0.6) / inner
      scene.add(new THREE.Mesh(track(arcStepGeometry(inner, outer, half, stepH)), stepMat))
      scene.add(
        new THREE.Mesh(
          track(arcTubeGeometry(inner, half, stepH + 0.01)),
          track(new THREE.MeshStandardMaterial({ color: 0x000000, emissive: new THREE.Color(hex), emissiveIntensity: 1.6 })),
        ),
      )
    }

    // ── Tier signs, at the left end of each tier's first row ──
    for (const tier of stage.tiers) {
      const tex = track(makeSign(TIER_TITLE[tier.health], tier.count, HEALTH_META[tier.health].hex))
      const sign = new THREE.Sprite(track(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })))
      sign.scale.set(SIGN_W, SIGN_W * (200 / 640), 1)
      const at = toArc(-stage.width / 2 - SIGN_W / 2 - 0.3, tier.z, ARC_RADIUS)
      // Level with its medallions, so each sign reads as the label of its row.
      // The arc pulls the sign toward the camera, which drops it on screen; lift it
      // by the same amount (camera looks down ~45°) so it stays beside its row.
      const lift = (at.z - tier.z) * Math.tan(0.78)
      sign.position.set(at.x, tier.y + 0.2 + PEDESTAL_H + BADGE_LIFT + 0.2 + lift, at.z)
      scene.add(sign)
    }

    // ── Seats ──
    const itemById = new Map(stage.items.map((i) => [i.clientId, i]))
    const seats: Seat[] = clients.flatMap((client) => {
      const item = itemById.get(client.clientId)
      if (!item) return []
      const health = HEALTH_META[client.health]
      const at = toArc(item.x, item.z, ARC_RADIUS)
      const group = new THREE.Group()
      group.position.set(at.x, item.y + 0.2, at.z)
      scene.add(group)

      const pedestal = new THREE.Mesh(
        cyl,
        track(
          new THREE.MeshStandardMaterial({
            color: 0x161616,
            emissive: new THREE.Color(health.hex),
            emissiveIntensity: 0.35,
            roughness: 0.5,
            metalness: 0.4,
          }),
        ),
      )
      pedestal.scale.set(0.5, PEDESTAL_H, 0.5)
      pedestal.position.y = PEDESTAL_H / 2
      group.add(pedestal)

      const goldH = Math.min(client.listos, COLUMN_CAP) * UNIT
      let goldMesh: THREE.Mesh | null = null
      let goldMat: THREE.MeshStandardMaterial | null = null
      if (goldH > 0) {
        goldMat = track(
          new THREE.MeshStandardMaterial({
            color: GOLD_HEX,
            metalness: 0.9,
            roughness: 0.22,
            emissive: new THREE.Color(GOLD_HEX),
            emissiveIntensity: 0.08,
            transparent: true,
            opacity: 1,
          }),
        )
        goldMesh = new THREE.Mesh(cyl, goldMat)
        goldMesh.scale.set(COLUMN_R, 0.001, COLUMN_R)
        group.add(goldMesh)
      }

      let rawRing: THREE.Mesh | null = null
      if (client.crudo > 0) {
        rawRing = new THREE.Mesh(ringGeo, track(new THREE.MeshBasicMaterial({ color: RAW_HEX, transparent: true, opacity: 0.85 })))
        rawRing.rotation.x = Math.PI / 2
        rawRing.position.y = PEDESTAL_H + 0.02
        group.add(rawRing)
      }

      const badgeCanvas = document.createElement('canvas')
      badgeCanvas.width = BADGE_PX
      badgeCanvas.height = BADGE_PX
      const badgeCtx = badgeCanvas.getContext('2d')
      if (badgeCtx) paintBadge(badgeCtx, client, null)
      const badgeTex = track(new THREE.CanvasTexture(badgeCanvas))
      badgeTex.colorSpace = THREE.SRGBColorSpace
      badgeTex.anisotropy = 4
      const badgeMat = track(new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthWrite: false }))
      const badge = new THREE.Sprite(badgeMat)
      badge.scale.setScalar(0.001)
      badge.userData.clientId = client.clientId
      group.add(badge)
      if (client.logoUrl && badgeCtx) {
        const img = new Image()
        img.decoding = 'async'
        img.onload = () => {
          if (disposed || !img.naturalWidth) return
          paintBadge(badgeCtx, client, img)
          badgeTex.needsUpdate = true
        }
        img.src = client.logoUrl
      }

      const hitH = PEDESTAL_H + goldH + BADGE_LIFT + BADGE
      const hit = new THREE.Mesh(box, track(new THREE.MeshBasicMaterial({ visible: false })))
      hit.scale.set(1.4, hitH, 1.2)
      hit.position.y = hitH / 2
      hit.userData.clientId = client.clientId
      group.add(hit)

      return [
        {
          client,
          group,
          goldMesh,
          goldMat,
          goldH,
          rawRing,
          badge,
          badgeMat,
          hit,
          delay: reduceMotion ? 0 : item.row * 120 + item.col * 45,
        },
      ]
    })
    const byId = new Map(seats.map((s) => [s.client.clientId, s]))

    // ── Floating calendar for the selected client ──
    let ribbon: Ribbon | null = null
    const tileH = TILE * (TILE_H / TILE_W)
    const buildRibbon = (seat: Seat, days: CalendarDay[], key: string): Ribbon => {
      const group = new THREE.Group()
      const own: { dispose: () => void }[] = []
      const tiles: Ribbon['tiles'] = []
      // Above the medallion, two weeks stacked like a wall calendar.
      group.position.copy(seat.group.position)
      group.position.y += PEDESTAL_H + seat.goldH + BADGE_LIFT + BADGE * 0.65 + 0.9 + tileH + TILE_GAP / 2
      days.forEach((day, i) => {
        const col = i % 7
        const row = Math.floor(i / 7)
        const c = document.createElement('canvas')
        c.width = TILE_W
        c.height = TILE_H
        const ctx = c.getContext('2d')
        if (ctx) paintDayTile(ctx, day, day.date === today)
        const tex = new THREE.CanvasTexture(c)
        tex.colorSpace = THREE.SRGBColorSpace
        tex.anisotropy = 4
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })
        own.push(tex, mat)
        const mesh = new THREE.Mesh(plane, mat)
        mesh.scale.set(TILE, tileH, 1)
        mesh.position.set((col - 3) * (TILE + TILE_GAP), (0.5 - row) * (tileH + TILE_GAP), 0)
        mesh.userData.dayIndex = i
        group.add(mesh)
        tiles.push({ mesh, mat, day, delay: reduceMotion ? 0 : row * 140 + col * 55 })
      })
      scene.add(group)
      return {
        key,
        group,
        tiles,
        born: performance.now(),
        dispose: () => {
          scene.remove(group)
          own.forEach((d) => d.dispose())
        },
      }
    }

    // ── Camera: fixed three-quarter view that fits the whole stand ──
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 300)
    const ELEVATION = 0.78
    const viewDir = new THREE.Vector3(0, Math.sin(ELEVATION), Math.cos(ELEVATION)).normalize()
    let overviewDist = 20
    let hfov = 1
    const fit = () => {
      const vfov = THREE.MathUtils.degToRad(camera.fov)
      hfov = 2 * Math.atan(Math.tan(vfov / 2) * camera.aspect)
      const byWidth = frameW / 2 / Math.tan(hfov / 2)
      // What the stand covers vertically: its depth from above, its rise from the
      // front, plus the medallions on the top row.
      const spanY =
        spanZ * Math.sin(ELEVATION) +
        (stage.height + BADGE_LIFT + BADGE) * Math.cos(ELEVATION)
      const byDepth = spanY / 2 / Math.tan(vfov / 2)
      overviewDist = Math.max(byWidth, byDepth, 8) * 1.2
    }

    const controls = new OrbitControls(camera, canvas)
    controls.target.copy(center)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    // Wheel / pinch zooms toward the cursor (the page scrolls anywhere else);
    // right-drag / two fingers move around once you are close.
    const applyControls = () => Object.assign(controls, cameraControls(overviewDist))
    controls.minAzimuthAngle = -0.55
    controls.maxAzimuthAngle = 0.55
    controls.minPolarAngle = 0.4
    controls.maxPolarAngle = 1.2
    canvas.style.touchAction = 'pan-y'

    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      fit()
      applyControls()
    }
    resize()
    camera.position.copy(center).addScaledVector(viewDir, overviewDist)
    controls.update()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    ro?.observe(mount)

    // ── Flights: the scene moves the camera when the selection changes or on
    // reset; the rest of the time the person drives (zoom, tilt, move). ──
    let flightKey = ''
    let flying = true
    const onControlStart = () => {
      flying = false
      onUserMoveRef.current()
    }
    controls.addEventListener('start', onControlStart)
    resetRef.current = () => {
      flightKey = ''
    }

    // ── Picking ──
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const seatHits: THREE.Object3D[] = seats.flatMap((s) => [s.badge, s.hit])
    let hoveredId: string | null = null
    let downAt: { x: number; y: number } | null = null

    const aim = (ev: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
    }
    const pickDay = (): CalendarDay | null => {
      if (!ribbon) return null
      const hit = raycaster.intersectObjects(ribbon.tiles.map((t) => t.mesh), false)[0]
      return hit ? ribbon.tiles[hit.object.userData.dayIndex as number]?.day ?? null : null
    }
    const pickSeat = (): Seat | null => {
      const hit = raycaster.intersectObjects(seatHits, false)[0]
      return hit ? byId.get(hit.object.userData.clientId as string) ?? null : null
    }

    const onMove = (ev: PointerEvent) => {
      aim(ev)
      const rect = mount.getBoundingClientRect()
      const x = ev.clientX - rect.left
      const y = ev.clientY - rect.top
      const day = pickDay()
      const seat = day ? null : pickSeat()
      hoveredId = seat?.client.clientId ?? null
      canvas.style.cursor = seat || day ? 'pointer' : 'grab'
      if (ev.pointerType !== 'mouse') return setTip(null)
      if (day) setTip({ kind: 'day', day, x, y })
      else if (seat) setTip({ kind: 'client', client: seat.client, x, y })
      else setTip(null)
    }
    const onLeave = () => {
      hoveredId = null
      setTip(null)
    }
    const onDown = (ev: PointerEvent) => {
      downAt = { x: ev.clientX, y: ev.clientY }
    }
    const onUp = (ev: PointerEvent) => {
      if (!downAt) return
      const moved = Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y)
      downAt = null
      if (moved > 6) return // a drag, not a tap
      aim(ev)
      if (pickDay()) return // tapping the calendar keeps the client open
      const id = pickSeat()?.client.clientId ?? null
      onSelectRef.current(id && id === selectedRef.current ? null : id)
    }
    // A dropped GPU context (iOS background tab, too many GPU tabs) would leave a
    // black box; fall back to the message — the list keeps the numbers.
    const onContextLost = (ev: Event) => {
      ev.preventDefault()
      // Stop drawing now: the effect cleanup only runs when the data changes.
      visible = false
      cancelAnimationFrame(raf)
      raf = 0
      setUnsupported(true)
    }
    canvas.addEventListener('webglcontextlost', onContextLost)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)

    // ── Loop ──
    const start = performance.now()
    const goalTarget = new THREE.Vector3()
    const desired = new THREE.Vector3()
    const dir = viewDir.clone()
    const right = new THREE.Vector3()
    let raf = 0
    // Only draw while the stage is on screen — saves battery on phones.
    let visible = true

    const frame = (now: number) => {
      if (!visible) {
        raf = 0
        return
      }
      raf = requestAnimationFrame(frame)
      const t = now - start
      const sel = selectedRef.current
      const focus = sel ? byId.get(sel) ?? null : null

      // Calendar: rebuild when the selection or its data changes.
      const days = calendarRef.current
      const wantKey =
        focus && days && days.length > 0
          ? `${focus.client.clientId}:${days.map((d) => `${d.kind}${d.format ?? ''}${d.postId ?? ''}`).join('|')}`
          : ''
      if ((ribbon?.key ?? '') !== wantKey) {
        ribbon?.dispose()
        ribbon = focus && days && wantKey ? buildRibbon(focus, days, wantKey) : null
      }

      for (const s of seats) {
        const isSel = s.client.clientId === sel
        const isHover = s.client.clientId === hoveredId
        const dimmed = !!sel && !isSel
        const g = reduceMotion ? 1 : easeOutCubic((t - s.delay) / 900)
        const pop = reduceMotion ? 1 : easeOutBack((t - s.delay - 150) / 700)

        const h = s.goldH * g
        if (s.goldMesh && s.goldMat) {
          s.goldMesh.scale.y = Math.max(h, 0.001)
          s.goldMesh.position.y = PEDESTAL_H + h / 2
          s.goldMat.opacity += ((dimmed ? 0.2 : 1) - s.goldMat.opacity) * 0.15
          s.goldMat.emissiveIntensity += ((isSel ? 0.5 : isHover ? 0.3 : 0.08) - s.goldMat.emissiveIntensity) * 0.15
        }
        if (s.rawRing) {
          const m = s.rawRing.material as THREE.MeshBasicMaterial
          const wave = reduceMotion ? 0 : Math.sin(t / 450 + s.delay)
          s.rawRing.scale.setScalar(1 + wave * 0.08)
          m.opacity = dimmed ? 0.1 : 0.6 + wave * 0.25
        }

        const bob = reduceMotion ? 0 : Math.sin(t / 1100 + s.delay) * 0.04
        s.badge.position.y = PEDESTAL_H + h + BADGE_LIFT + bob
        const to = BADGE * Math.max(pop, 0.001) * (isSel ? 1.3 : isHover ? 1.14 : 1)
        const bs = s.badge.scale.x + (to - s.badge.scale.x) * (reduceMotion ? 1 : 0.2)
        s.badge.scale.set(bs, bs, 1)
        s.badgeMat.opacity += ((dimmed ? 0.18 : 1) - s.badgeMat.opacity) * 0.15
      }

      // Calendar tiles face the camera and flip in one by one.
      if (ribbon) {
        ribbon.group.quaternion.copy(camera.quaternion)
        const age = now - ribbon.born
        for (const tile of ribbon.tiles) {
          const p = reduceMotion ? 1 : Math.min(Math.max(easeOutBack((age - tile.delay) / 520), 0), 1.2)
          const shown = Math.min(p, 1)
          tile.mat.opacity = shown * (tile.day.kind === 'libre' ? 0.55 : 1)
          tile.mesh.rotation.x = reduceMotion ? 0 : (1 - shown) * (Math.PI / 2)
        }
      }

      // Fly to the selected client (and its calendar); back to the stand otherwise.
      const wantFlight = focus ? `${focus.client.clientId}:${ribbon ? 1 : 0}` : 'overview'
      if (wantFlight !== flightKey) {
        flightKey = wantFlight
        flying = true
      }
      let goalDist = overviewDist
      if (focus) {
        focus.group.getWorldPosition(goalTarget)
        // Between the medallion and the calendar above it.
        goalTarget.y += PEDESTAL_H + focus.goldH + BADGE_LIFT + (ribbon ? BADGE * 0.65 + 0.9 + tileH * 0.5 : 0.6)
        goalDist = ribbon ? 12.5 : 10
        // On desktop the profile panel covers the right side: keep the subject left of it.
        const w = mount.clientWidth
        if (w >= 768) {
          const worldPerPx = (2 * goalDist * Math.tan(hfov / 2)) / w
          right.setFromMatrixColumn(camera.matrixWorld, 0)
          goalTarget.addScaledVector(right, (PANEL_PX / 2) * worldPerPx)
        }
      } else {
        goalTarget.copy(center)
      }
      if (flying) {
        const k = reduceMotion ? 1 : 0.07
        controls.target.lerp(goalTarget, k)
        // Back to the whole stand also undoes any tilt; a client keeps your angle.
        if (focus) dir.subVectors(camera.position, controls.target).normalize()
        else dir.copy(viewDir)
        desired.copy(controls.target).addScaledVector(dir, goalDist)
        camera.position.lerp(desired, k)
        if (flightArrived(controls.target.distanceTo(goalTarget), camera.position.distanceTo(desired))) {
          flying = false
        }
      }
      controls.update()

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting
            if (visible && raf === 0) raf = requestAnimationFrame(frame)
          })
        : null
    io?.observe(mount)

    return () => {
      disposed = true
      cancelAnimationFrame(raf)
      ro?.disconnect()
      io?.disconnect()
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      ribbon?.dispose()
      controls.removeEventListener('start', onControlStart)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [clients, today])

  if (unsupported) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Este navegador no puede mostrar la vista 3D. La lista de abajo tiene los mismos números.
      </div>
    )
  }

  const dayStatus = (day: CalendarDay): string => {
    if (day.kind === 'libre') return 'No es día de publicación'
    if (day.kind === 'vacio') return `Toca ${day.format ? FORMAT_TILE[day.format].label.toLowerCase() : 'publicar'} — no hay video`
    if (day.kind === 'proyectado') return 'Listo para salir (sin agendar)'
    if (day.kind === 'agendado') return 'Agendado en Metricool'
    return 'Publicado'
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />
      {/* Vignette keeps the edges calm so the medallions read first. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_50%,rgba(0,0,0,0.6)_100%)]" />

      {moved && (
        <button
          type="button"
          onClick={() => {
            setMoved(false)
            onSelect(null)
            resetRef.current()
          }}
          className="absolute left-3 top-14 z-10 rounded-full border border-[#e6af23]/50 bg-black/75 px-3 py-1.5 text-xs font-medium text-[#e6af23] backdrop-blur transition-colors hover:bg-black"
        >
          Vista general
        </button>
      )}

      {tip?.kind === 'client' && tip.client.clientId !== selectedId && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-lg border border-white/10 bg-black/85 p-3 text-xs text-white shadow-xl backdrop-blur"
          style={{ left: Math.min(tip.x + 14, (mountRef.current?.clientWidth ?? 9999) - 232), top: Math.max(tip.y - 10, 8) }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: HEALTH_META[tip.client.health].hex }} />
            <span className="min-w-0 truncate font-semibold">{tip.client.clientName}</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-white/70">
            <dt>Reels listos</dt>
            <dd className="text-right font-medium text-[#e6af23]">{tip.client.reels}</dd>
            <dt>Posts listos</dt>
            <dd className="text-right font-medium text-[#c4b5fd]">{tip.client.posts}</dd>
            {tip.client.agendados > 0 && (
              <>
                <dt>Agendados</dt>
                <dd className="text-right font-medium text-white">{tip.client.agendados}</dd>
              </>
            )}
            <dt>En crudo</dt>
            <dd className="text-right font-medium text-[#93c5fd]">{tip.client.crudo}</dd>
            <dt>Alcanza</dt>
            <dd className="text-right font-medium text-white">{daysLeftLabel(tip.client)}</dd>
          </dl>
          <div className="mt-2 border-t border-white/10 pt-2 text-white/60">
            {runOutLabel(tip.client.runOutDate, today)}
            {tip.client.runOutFormat && ` (${FORMAT_TILE[tip.client.runOutFormat].label.toLowerCase()})`}
          </div>
          <div className="mt-1 text-[10px] text-white/40">Toca para ver su perfil y calendario</div>
        </div>
      )}

      {tip?.kind === 'day' && (
        <div
          className="pointer-events-none absolute z-10 max-w-64 rounded-lg border border-white/10 bg-black/85 px-3 py-2 text-xs text-white shadow-xl backdrop-blur"
          style={{ left: Math.min(tip.x + 14, (mountRef.current?.clientWidth ?? 9999) - 270), top: Math.max(tip.y - 10, 8) }}
        >
          <div className="font-semibold">
            {shortDateLabel(tip.day.date)}
            {tip.day.posting && tip.day.format && <span className="text-white/60"> · {FORMAT_TILE[tip.day.format].label}</span>}
          </div>
          <div style={{ color: tip.day.kind === 'libre' ? '#a1a1aa' : DAY_STYLE[tip.day.kind].edge }}>{dayStatus(tip.day)}</div>
          {tip.day.title && <div className="mt-1 text-white/80">{tip.day.title}</div>}
        </div>
      )}
    </div>
  )
}
