'use client'

import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import type { ClientStock } from '@/lib/inventario/video-stock-core'
import { GOLD_HEX, HEALTH_META, RAW_HEX, daysLeftLabel, runOutLabel, videosLabel } from './stock-labels'

export interface VideoStockSceneProps {
  clients: ClientStock[]
  today: string
  selectedId: string | null
  onSelect: (clientId: string | null) => void
}

/** World units per video. Columns above VISUAL_CAP videos stop growing (the tooltip keeps the real count). */
const UNIT = 0.3
const VISUAL_CAP = 26
const SPACING = 1.7
const PLINTH_H = 0.14
const GAP = 0.05

interface Column {
  client: ClientStock
  group: THREE.Group
  plinthMat: THREE.MeshStandardMaterial
  goldMat: THREE.MeshStandardMaterial | null
  goldMesh: THREE.Mesh | null
  rawMat: THREE.MeshPhysicalMaterial | null
  rawMesh: THREE.Mesh | null
  rawEdges: THREE.LineSegments | null
  ring: THREE.Mesh | null
  hit: THREE.Mesh
  goldH: number
  rawH: number
  delay: number
}

interface Tip {
  client: ClientStock
  x: number
  y: number
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - Math.min(Math.max(t, 0), 1), 3)
}

/**
 * The inventory as a skyline: one column per client, front row = most urgent.
 * Gold block = edited videos left, glass block = raw footage waiting, plinth
 * color = how many days the edited videos last, blue ring = has grabaciones.
 */
export function VideoStockScene({ clients, today, selectedId, onSelect }: VideoStockSceneProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const labelRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<string | null>(selectedId)
  const onSelectRef = useRef(onSelect)
  const [unsupported, setUnsupported] = useState(false)
  const [tip, setTip] = useState<Tip | null>(null)

  onSelectRef.current = onSelect
  selectedRef.current = selectedId

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

    // Everything we allocate, so unmount can free it.
    const disposables: { dispose: () => void }[] = []
    const track = <T extends { dispose: () => void }>(x: T): T => {
      disposables.push(x)
      return x
    }

    // Studio reflections so the gold reads as metal, not brown plastic.
    const pmrem = track(new THREE.PMREMGenerator(renderer))
    const room = new RoomEnvironment()
    const envMap = track(pmrem.fromScene(room, 0.04).texture)
    room.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose())
      else mat?.dispose()
    })
    scene.environment = envMap
    scene.environmentIntensity = 0.55

    // ── Layout: urgent clients in the front row ──
    const n = Math.max(clients.length, 1)
    const cols = Math.max(1, Math.ceil(Math.sqrt(n * 1.8)))
    const rows = Math.ceil(n / cols)
    const width = cols * SPACING
    const depth = rows * SPACING
    const radius = Math.max(width, depth)
    scene.fog = new THREE.Fog(0x070707, radius * 1.3, radius * 3.2)

    // ── Lights ──
    scene.add(new THREE.HemisphereLight(0xfff4dc, 0x0a0a0a, 0.7))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(6, 14, 10)
    scene.add(key)
    const rim = new THREE.DirectionalLight(0x8fb4ff, 0.6)
    rim.position.set(-10, 6, -12)
    scene.add(rim)
    const glow = new THREE.PointLight(0xe6af23, 30, radius * 2, 1.6)
    glow.position.set(0, 7, 0)
    scene.add(glow)

    // ── Floor ──
    const floor = new THREE.Mesh(
      track(new THREE.CircleGeometry(radius * 5, 64)),
      track(new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.95, metalness: 0.1 })),
    )
    floor.rotation.x = -Math.PI / 2
    scene.add(floor)
    const grid = new THREE.GridHelper(radius * 2.4, Math.round(radius * 2.4 / (SPACING / 2)), 0xe6af23, 0x262626)
    const gridMat = grid.material as THREE.Material
    gridMat.transparent = true
    gridMat.opacity = 0.18
    grid.position.y = 0.002
    track(grid.geometry)
    track(gridMat)
    scene.add(grid)

    // ── Dust: slow gold particles for depth ──
    const dustCount = 260
    const dustPos = new Float32Array(dustCount * 3)
    for (let i = 0; i < dustCount; i++) {
      dustPos[i * 3] = (Math.random() - 0.5) * radius * 2.4
      dustPos[i * 3 + 1] = Math.random() * 9
      dustPos[i * 3 + 2] = (Math.random() - 0.5) * radius * 2.4
    }
    const dustGeo = track(new THREE.BufferGeometry())
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3))
    const dust = new THREE.Points(
      dustGeo,
      track(new THREE.PointsMaterial({ color: 0xe6af23, size: 0.05, transparent: true, opacity: 0.45, depthWrite: false })),
    )
    scene.add(dust)

    // ── Shared geometry: one unit box, scaled per column ──
    const box = track(new THREE.BoxGeometry(1, 1, 1))
    const boxEdges = track(new THREE.EdgesGeometry(box))
    const ringGeo = track(new THREE.TorusGeometry(0.62, 0.025, 8, 48))
    const edgeMatBase = new THREE.LineBasicMaterial({ color: RAW_HEX, transparent: true, opacity: 0.9 })
    track(edgeMatBase)

    const columns: Column[] = clients.map((client, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      const group = new THREE.Group()
      group.position.set((col - (cols - 1) / 2) * SPACING, 0, ((rows - 1) / 2 - row) * SPACING)
      scene.add(group)

      const health = HEALTH_META[client.health]
      const plinthMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x141414,
          emissive: new THREE.Color(health.hex),
          emissiveIntensity: 0.3,
          roughness: 0.6,
          metalness: 0.2,
        }),
      )
      const plinth = new THREE.Mesh(box, plinthMat)
      plinth.scale.set(1.18, PLINTH_H, 1.18)
      plinth.position.y = PLINTH_H / 2
      group.add(plinth)
      // Neon outline in the health color: the status reads even under a tall column.
      const plinthEdges = new THREE.LineSegments(
        boxEdges,
        track(new THREE.LineBasicMaterial({ color: health.hex, transparent: true, opacity: 0.95 })),
      )
      plinthEdges.scale.copy(plinth.scale)
      plinthEdges.position.copy(plinth.position)
      group.add(plinthEdges)

      const goldH = Math.min(client.listos, VISUAL_CAP) * UNIT
      const rawH = Math.min(client.crudo, VISUAL_CAP) * UNIT

      let goldMat: THREE.MeshStandardMaterial | null = null
      let goldMesh: THREE.Mesh | null = null
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
        goldMesh = new THREE.Mesh(box, goldMat)
        goldMesh.scale.set(0.86, 0.001, 0.86)
        group.add(goldMesh)
      }

      let rawMat: THREE.MeshPhysicalMaterial | null = null
      let rawMesh: THREE.Mesh | null = null
      let rawEdges: THREE.LineSegments | null = null
      let ring: THREE.Mesh | null = null
      if (rawH > 0) {
        rawMat = track(
          new THREE.MeshPhysicalMaterial({
            color: RAW_HEX,
            emissive: new THREE.Color(RAW_HEX),
            emissiveIntensity: 0.25,
            roughness: 0.15,
            metalness: 0,
            transparent: true,
            opacity: 0.32,
            depthWrite: false,
          }),
        )
        rawMesh = new THREE.Mesh(box, rawMat)
        rawMesh.scale.set(0.86, 0.001, 0.86)
        group.add(rawMesh)
        rawEdges = new THREE.LineSegments(boxEdges, track(edgeMatBase.clone()))
        rawEdges.scale.copy(rawMesh.scale)
        group.add(rawEdges)

        ring = new THREE.Mesh(
          ringGeo,
          track(new THREE.MeshBasicMaterial({ color: RAW_HEX, transparent: true, opacity: 0.85 })),
        )
        ring.rotation.x = Math.PI / 2
        group.add(ring)
      }

      // Invisible hit box so thin / empty columns are still easy to point at.
      const hitH = Math.max(goldH + rawH + PLINTH_H + 0.4, 1)
      const hit = new THREE.Mesh(box, track(new THREE.MeshBasicMaterial({ visible: false })))
      hit.scale.set(SPACING * 0.9, hitH, SPACING * 0.9)
      hit.position.y = hitH / 2
      hit.userData.clientId = client.clientId
      group.add(hit)

      return {
        client,
        group,
        plinthMat,
        goldMat,
        goldMesh,
        rawMat,
        rawMesh,
        rawEdges,
        ring,
        hit,
        goldH,
        rawH,
        delay: reduceMotion ? 0 : row * 140 + col * 35,
      }
    })

    const byId = new Map(columns.map((c) => [c.client.clientId, c]))

    // ── Camera + controls ──
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200)
    const overviewTarget = new THREE.Vector3(0, 1.2, 0)
    const overviewDist = radius * 0.95 + 6
    camera.position.set(0, overviewDist * 0.62, overviewDist * 0.8)

    const controls = new OrbitControls(camera, canvas)
    controls.target.copy(overviewTarget)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    // Wheel scrolling belongs to the page; focus comes from selecting a client.
    controls.enableZoom = false
    controls.enablePan = false
    controls.maxPolarAngle = Math.PI / 2.25
    controls.minPolarAngle = Math.PI / 7
    controls.autoRotate = !reduceMotion
    controls.autoRotateSpeed = 0.45
    controls.update()
    // OrbitControls sets touch-action:none; keep vertical page scroll on phones.
    canvas.style.touchAction = 'pan-y'

    let idleTimer: ReturnType<typeof setTimeout> | undefined
    const onControlStart = () => {
      controls.autoRotate = false
      if (idleTimer) clearTimeout(idleTimer)
    }
    const onControlEnd = () => {
      if (reduceMotion) return
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        controls.autoRotate = true
      }, 6000)
    }
    controls.addEventListener('start', onControlStart)
    controls.addEventListener('end', onControlEnd)

    // ── Sizing ──
    const resize = () => {
      const w = mount.clientWidth || 1
      const h = mount.clientHeight || 1
      renderer.setSize(w, h, false)
      camera.aspect = w / h
      // Narrow screens need to back off so the whole grid fits.
      camera.fov = w < 640 ? 52 : 38
      camera.updateProjectionMatrix()
    }
    resize()
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null
    ro?.observe(mount)

    // ── Picking ──
    const raycaster = new THREE.Raycaster()
    const pointer = new THREE.Vector2()
    const hits = columns.map((c) => c.hit)
    let hoveredId: string | null = null
    let downAt: { x: number; y: number } | null = null

    const pick = (ev: PointerEvent): Column | null => {
      const rect = canvas.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(pointer, camera)
      const hit = raycaster.intersectObjects(hits, false)[0]
      return hit ? byId.get(hit.object.userData.clientId as string) ?? null : null
    }

    const onMove = (ev: PointerEvent) => {
      const col = pick(ev)
      hoveredId = col?.client.clientId ?? null
      canvas.style.cursor = col ? 'pointer' : 'grab'
      if (col && ev.pointerType === 'mouse') {
        const rect = mount.getBoundingClientRect()
        setTip({ client: col.client, x: ev.clientX - rect.left, y: ev.clientY - rect.top })
      } else {
        setTip(null)
      }
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
      const col = pick(ev)
      const id = col?.client.clientId ?? null
      onSelectRef.current(id && id === selectedRef.current ? null : id)
    }
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerleave', onLeave)
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)

    // ── Loop ──
    const start = performance.now()
    const goalTarget = new THREE.Vector3()
    const desired = new THREE.Vector3()
    const dir = new THREE.Vector3()
    const top = new THREE.Vector3()
    let raf = 0

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const t = now - start
      const sel = selectedRef.current
      const focus = sel ? byId.get(sel) ?? null : null

      for (const c of columns) {
        const isSel = c.client.clientId === sel
        const isHover = c.client.clientId === hoveredId
        const g = reduceMotion ? 1 : easeOutCubic((t - c.delay) / 1100)
        const gh = c.goldH * g
        const rh = c.rawH * easeOutCubic((t - c.delay - 250) / 1100)
        if (c.goldMesh) {
          c.goldMesh.scale.y = Math.max(gh, 0.001)
          c.goldMesh.position.y = PLINTH_H + gh / 2
        }
        const rawBase = PLINTH_H + gh + (c.goldH > 0 ? GAP : 0)
        if (c.rawMesh && c.rawEdges) {
          const h = reduceMotion ? c.rawH : rh
          c.rawMesh.scale.y = Math.max(h, 0.001)
          c.rawMesh.position.y = rawBase + h / 2
          c.rawEdges.scale.y = c.rawMesh.scale.y
          c.rawEdges.position.y = c.rawMesh.position.y
        }
        if (c.ring) {
          c.ring.position.y = rawBase + (reduceMotion ? c.rawH : rh) + 0.32
          const ringMat = c.ring.material as THREE.MeshBasicMaterial
          if (sel && !isSel) {
            ringMat.opacity = 0.12
          } else if (!reduceMotion) {
            const pulse = 1 + Math.sin(t / 420 + c.delay) * 0.08
            c.ring.scale.set(pulse, pulse, pulse)
            ringMat.opacity = 0.55 + Math.sin(t / 420 + c.delay) * 0.3
          }
        }

        // Focus: the selected column glows, the rest step back.
        const dim = sel && !isSel ? 0.22 : 1
        if (c.goldMat) {
          c.goldMat.opacity += (dim - c.goldMat.opacity) * 0.15
          const glowTo = isSel ? 0.55 : isHover ? 0.35 : 0.12
          c.goldMat.emissiveIntensity += (glowTo - c.goldMat.emissiveIntensity) * 0.15
        }
        if (c.rawMat) {
          const base = !reduceMotion ? 0.25 + Math.sin(t / 600 + c.delay) * 0.1 : 0.25
          c.rawMat.emissiveIntensity = isSel || isHover ? 0.6 : base
          c.rawMat.opacity += ((sel && !isSel ? 0.08 : 0.32) - c.rawMat.opacity) * 0.15
          const edgeMat = c.rawEdges?.material as THREE.LineBasicMaterial | undefined
          if (edgeMat) edgeMat.opacity += ((sel && !isSel ? 0.15 : 0.9) - edgeMat.opacity) * 0.15
        }
        c.plinthMat.emissiveIntensity += ((sel && !isSel ? 0.06 : isSel || isHover ? 0.9 : 0.3) - c.plinthMat.emissiveIntensity) * 0.15
      }

      if (!reduceMotion) dust.rotation.y = t / 60000

      // Fly the camera toward the selected client, back to the overview otherwise.
      let goalDist = overviewDist
      if (focus) {
        const h = PLINTH_H + focus.goldH + focus.rawH
        focus.group.getWorldPosition(goalTarget)
        goalTarget.y = Math.max(h / 2, 0.8)
        goalDist = Math.max(h * 2.4, 12)
      } else {
        goalTarget.copy(overviewTarget)
      }
      const k = reduceMotion ? 1 : 0.06
      controls.target.lerp(goalTarget, k)
      dir.subVectors(camera.position, controls.target).normalize()
      desired.copy(controls.target).addScaledVector(dir, goalDist)
      camera.position.lerp(desired, k)
      controls.update()

      // Pin the label over the selected column.
      const label = labelRef.current
      if (label) {
        if (focus) {
          focus.group.getWorldPosition(top)
          top.y = PLINTH_H + focus.goldH + focus.rawH + (focus.ring ? 0.6 : 0.25)
          top.project(camera)
          const w = mount.clientWidth
          const h = mount.clientHeight
          label.style.transform = `translate(-50%, -100%) translate(${((top.x + 1) / 2) * w}px, ${((1 - top.y) / 2) * h - 10}px)`
          label.style.opacity = top.z < 1 ? '1' : '0'
        } else {
          label.style.opacity = '0'
        }
      }

      renderer.render(scene, camera)
    }
    raf = requestAnimationFrame(frame)

    return () => {
      cancelAnimationFrame(raf)
      if (idleTimer) clearTimeout(idleTimer)
      ro?.disconnect()
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerleave', onLeave)
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      controls.removeEventListener('start', onControlStart)
      controls.removeEventListener('end', onControlEnd)
      controls.dispose()
      for (const d of disposables) d.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      canvas.remove()
    }
  }, [clients])

  const selected = selectedId ? clients.find((c) => c.clientId === selectedId) ?? null : null

  if (unsupported) {
    return (
      <div className="flex h-full min-h-[240px] items-center justify-center rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
        Este navegador no puede mostrar la vista 3D. La lista de abajo tiene los mismos números.
      </div>
    )
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <div ref={mountRef} className="absolute inset-0" />
      {/* Vignette keeps the edges calm so the columns read first. */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.65)_100%)]" />

      <div
        ref={labelRef}
        aria-hidden
        className="pointer-events-none absolute left-0 top-0 whitespace-nowrap rounded-lg border border-[#e6af23]/40 bg-black/80 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg backdrop-blur transition-opacity duration-300"
      >
        {selected && (
          <>
            <div className="font-semibold">{selected.clientName}</div>
            <div className="text-white/70">
              <span className="text-[#e6af23]">{videosLabel(selected.listos)} listos</span>
              {selected.crudo > 0 && <span className="text-[#93c5fd]"> · {selected.crudo} en crudo</span>}
            </div>
          </>
        )}
      </div>

      {tip && tip.client.clientId !== selectedId && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-lg border border-white/10 bg-black/85 p-3 text-xs text-white shadow-xl backdrop-blur"
          style={{
            left: Math.min(tip.x + 14, (mountRef.current?.clientWidth ?? 9999) - 232),
            top: Math.max(tip.y - 10, 8),
          }}
        >
          <div className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: HEALTH_META[tip.client.health].hex }}
            />
            <span className="min-w-0 truncate font-semibold">{tip.client.clientName}</span>
          </div>
          <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-white/70">
            <dt>Listos</dt>
            <dd className="text-right font-medium text-[#e6af23]">{tip.client.listos}</dd>
            <dt>En crudo</dt>
            <dd className="text-right font-medium text-[#93c5fd]">{tip.client.crudo}</dd>
            <dt>Alcanza</dt>
            <dd className="text-right font-medium text-white">{daysLeftLabel(tip.client)}</dd>
          </dl>
          <div className="mt-2 border-t border-white/10 pt-2 text-white/60">
            {runOutLabel(tip.client.runOutDate, today)}
          </div>
        </div>
      )}
    </div>
  )
}
