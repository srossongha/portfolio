<script setup lang="ts">
import { Play, Pause, RotateCcw, Sparkles } from '@lucide/vue'

/**
 * Procedural "Web Crawler" Spider.
 *
 * Inspired by the viral creative coding phenomenon by Slava Rybin (@rybinfx),
 * this component literalizes the concept of a "web crawler" by simulating an
 * autonomous digital spider that physically traverses the page, climbs
 * typography, and indexes DOM nodes in real time.
 *
 * ENGINEERING HIGHLIGHTS:
 * 1. Two-bone analytical Inverse Kinematics (IK) for natural 8-legged joint motion.
 * 2. Alternating tetrapod gait (Group A / Group B) so 4 legs remain planted
 *    while 4 legs step in parabolic lift arcs.
 * 3. Autonomous DOM node targeting: queries real words in the About bio and
 *    crawls to them, pausing to "scan" with a cyber HUD bounding box.
 * 4. User interaction: click anywhere in the section to command the spider
 *    to scurry over and inspect that spot.
 * 5. Digital silk web trail connecting indexed targets.
 * 6. High performance: runs on requestAnimationFrame, paused via IntersectionObserver
 *    when off-screen, zero external 3D libraries.
 */

interface Props {
  /** CSS selector for the container whose words and space the crawler explores. */
  containerSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '#about',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPaused = ref(false)
const indexedCount = ref(0)
const currentStatus = ref('Crawling DOM')
const currentWord = ref('')
const reduced = useReducedMotion()

// -----------------------------------------------------------------------------
// Math & IK Helpers
// -----------------------------------------------------------------------------

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2
  while (angle < -Math.PI) angle += Math.PI * 2
  return angle
}

function solveIK(
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  len1: number,
  len2: number,
  bendDirection: number,
) {
  const dx = footX - hipX
  const dy = footY - hipY
  let dist = Math.hypot(dx, dy)
  const maxReach = len1 + len2 - 0.001
  if (dist > maxReach) dist = maxReach
  if (dist < 0.001) dist = 0.001

  const baseAngle = Math.atan2(dy, dx)
  const cosAlpha = (len1 * len1 + dist * dist - len2 * len2) / (2 * len1 * dist)
  const alpha = Math.acos(clamp(cosAlpha, -1, 1))

  const kneeAngle = baseAngle + bendDirection * alpha
  const kneeX = hipX + Math.cos(kneeAngle) * len1
  const kneeY = hipY + Math.sin(kneeAngle) * len1

  return {
    kneeX,
    kneeY,
    footX: hipX + Math.cos(baseAngle) * dist,
    footY: hipY + Math.sin(baseAngle) * dist,
  }
}

// -----------------------------------------------------------------------------
// Spider Data Structures
// -----------------------------------------------------------------------------

interface LegDef {
  side: 1 | -1 // -1 = left, 1 = right
  hipAngleOffset: number
  hipDist: number
  restAngle: number
  reach: number
  len1: number
  len2: number
  bendDirection: number
  group: 0 | 1 // 0 = Group A, 1 = Group B
}

interface LegState {
  currentFootX: number
  currentFootY: number
  startFootX: number
  startFootY: number
  targetFootX: number
  targetFootY: number
  stepProgress: number
  isStepping: boolean
}

interface TargetItem {
  x: number
  y: number
  width: number
  height: number
  text: string
}

interface WebPoint {
  x: number
  y: number
  alpha: number
}

interface ClickPing {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
}

// 8 Leg definitions: 4 on left (group alternating), 4 on right
const LEG_DEFS: LegDef[] = [
  // Left side (indices 0..3)
  {
    side: -1,
    hipAngleOffset: -0.65,
    hipDist: 10,
    restAngle: -0.95,
    reach: 46,
    len1: 22,
    len2: 26,
    bendDirection: -1,
    group: 0,
  },
  {
    side: -1,
    hipAngleOffset: -0.25,
    hipDist: 9,
    restAngle: -0.4,
    reach: 40,
    len1: 19,
    len2: 23,
    bendDirection: -1,
    group: 1,
  },
  {
    side: -1,
    hipAngleOffset: 0.25,
    hipDist: 9,
    restAngle: 0.4,
    reach: 40,
    len1: 19,
    len2: 23,
    bendDirection: 1,
    group: 0,
  },
  {
    side: -1,
    hipAngleOffset: 0.65,
    hipDist: 10,
    restAngle: 1.05,
    reach: 48,
    len1: 23,
    len2: 27,
    bendDirection: 1,
    group: 1,
  },

  // Right side (indices 4..7)
  {
    side: 1,
    hipAngleOffset: 0.65,
    hipDist: 10,
    restAngle: 0.95,
    reach: 46,
    len1: 22,
    len2: 26,
    bendDirection: 1,
    group: 1,
  },
  {
    side: 1,
    hipAngleOffset: 0.25,
    hipDist: 9,
    restAngle: 0.4,
    reach: 40,
    len1: 19,
    len2: 23,
    bendDirection: 1,
    group: 0,
  },
  {
    side: 1,
    hipAngleOffset: -0.25,
    hipDist: 9,
    restAngle: -0.4,
    reach: 40,
    len1: 19,
    len2: 23,
    bendDirection: -1,
    group: 1,
  },
  {
    side: 1,
    hipAngleOffset: -0.65,
    hipDist: 10,
    restAngle: -1.05,
    reach: 48,
    len1: 23,
    len2: 27,
    bendDirection: -1,
    group: 0,
  },
]

// -----------------------------------------------------------------------------
// Component Lifecycle & Execution
// -----------------------------------------------------------------------------

let animFrameId: number | null = null
let resizeObserver: ResizeObserver | null = null
let intersectionObserver: IntersectionObserver | null = null

onMounted(() => {
  if (reduced.value) return

  const canvas = canvasRef.value
  if (!canvas) return

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const container = document.querySelector(props.containerSelector) as HTMLElement | null
  if (!container) return

  // Canvas bounds
  let width = container.clientWidth
  let height = container.clientHeight
  let dpr = Math.min(window.devicePixelRatio || 1, 2)

  function updateSize() {
    if (!container || !canvas || !ctx) return
    width = container.clientWidth
    height = container.clientHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  }
  updateSize()

  resizeObserver = new ResizeObserver(() => updateSize())
  resizeObserver.observe(container)

  // Spider state
  const spider = {
    x: width * 0.25,
    y: height * 0.35,
    vx: 0,
    vy: 0,
    angle: 0,
    targetAngle: 0,
    activeGroup: 0 as 0 | 1,
    state: 'crawling' as 'crawling' | 'inspecting',
    inspectTimer: 0,
    scanProgress: 0,
    speed: 2.2,
  }

  // Initialize leg states
  const legs: LegState[] = LEG_DEFS.map((def) => {
    const hipX = spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
    const hipY = spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
    const footAngle = spider.angle + def.restAngle * def.side
    const footX = hipX + Math.cos(footAngle) * def.reach
    const footY = hipY + Math.sin(footAngle) * def.reach
    return {
      currentFootX: footX,
      currentFootY: footY,
      startFootX: footX,
      startFootY: footY,
      targetFootX: footX,
      targetFootY: footY,
      stepProgress: 1,
      isStepping: false,
    }
  })

  // Target collection
  let targets: TargetItem[] = []
  let currentTargetIndex = 0
  let manualTarget: TargetItem | null = null
  const webTrail: WebPoint[] = []
  const clickPings: ClickPing[] = []

  function refreshTargets() {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const wordElements = container.querySelectorAll(
      '.about-bio p, .about-bio .split-word, h2, h3, a',
    )
    const list: TargetItem[] = []

    wordElements.forEach((el) => {
      const elRect = el.getBoundingClientRect()
      // Relative to container
      const relX = elRect.left - rect.left
      const relY = elRect.top - rect.top
      const text = el.textContent?.trim() || ''
      if (text.length > 2 && text.length < 35 && elRect.width > 20 && elRect.height > 10) {
        list.push({
          x: relX + elRect.width / 2,
          y: relY + elRect.height / 2,
          width: elRect.width,
          height: elRect.height,
          text: text.slice(0, 24),
        })
      }
    })

    if (list.length > 0) {
      targets = list
    } else {
      // Fallback target grid
      targets = [
        { x: width * 0.3, y: height * 0.3, width: 80, height: 24, text: 'Frontend' },
        { x: width * 0.6, y: height * 0.45, width: 90, height: 24, text: 'Vue & Nuxt' },
        { x: width * 0.4, y: height * 0.65, width: 75, height: 24, text: 'Architecture' },
      ]
    }
  }

  // Refresh targets on mount and after layout shifts
  setTimeout(refreshTargets, 400)
  setTimeout(refreshTargets, 1500)

  // Click interaction: guide crawler to click location
  const handleContainerClick = (e: MouseEvent) => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    clickPings.push({
      x: clickX,
      y: clickY,
      radius: 4,
      maxRadius: 36,
      alpha: 1,
    })

    manualTarget = {
      x: clickX,
      y: clickY,
      width: 40,
      height: 20,
      text: 'USER_POI',
    }

    spider.state = 'crawling'
    spider.inspectTimer = 0
    currentStatus.value = 'Investigating Click'
  }
  container.addEventListener('click', handleContainerClick)

  // Visibility tracking
  let isVisibleOnScreen = true
  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      isVisibleOnScreen = entry.isIntersecting
    },
    { threshold: 0.1 },
  )
  intersectionObserver.observe(container)

  // Main Loop
  let lastTime = performance.now()

  function loop(currentTime: number) {
    animFrameId = requestAnimationFrame(loop)
    if (!ctx || !canvas || !isVisibleOnScreen || isPaused.value) return

    const dt = Math.min((currentTime - lastTime) / 1000, 0.1)
    lastTime = currentTime

    // -------------------------------------------------------------------------
    // Target Selection & Navigation
    // -------------------------------------------------------------------------
    const activeTarget = manualTarget || targets[currentTargetIndex]

    if (activeTarget) {
      currentWord.value = activeTarget.text
      const dx = activeTarget.x - spider.x
      const dy = activeTarget.y - spider.y
      const distToTarget = Math.hypot(dx, dy)

      if (spider.state === 'crawling') {
        currentStatus.value = `Crawling to: "${activeTarget.text}"`
        // Steer angle smoothly towards target
        const desiredAngle = Math.atan2(dy, dx)
        const angleDiff = normalizeAngle(desiredAngle - spider.angle)
        spider.angle += angleDiff * Math.min(dt * 4.5, 1)

        // Move body towards target
        const moveSpeed = spider.speed * 60 * dt
        if (distToTarget > 18) {
          spider.vx = Math.cos(spider.angle) * moveSpeed
          spider.vy = Math.sin(spider.angle) * moveSpeed
          spider.x += spider.vx
          spider.y += spider.vy
        } else {
          // Arrived at target!
          spider.state = 'inspecting'
          spider.inspectTimer = 2.4 // inspect for 2.4s
          spider.scanProgress = 0
          indexedCount.value += 1
          currentStatus.value = `Indexing: "${activeTarget.text}"`

          // Drop web point
          webTrail.push({
            x: spider.x,
            y: spider.y,
            alpha: 1,
          })
          if (webTrail.length > 14) webTrail.shift()
        }
      } else if (spider.state === 'inspecting') {
        spider.inspectTimer -= dt
        spider.scanProgress = Math.min(1, spider.scanProgress + dt / 2.2)

        if (spider.inspectTimer <= 0) {
          // Finished inspecting, choose next target
          spider.state = 'crawling'
          if (manualTarget) {
            manualTarget = null
          } else if (targets.length > 0) {
            currentTargetIndex = (currentTargetIndex + 1) % targets.length
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Procedural Leg Stepping (Alternating Tetrapod Gait)
    // -------------------------------------------------------------------------
    const isMoving = spider.state === 'crawling'
    const stepDuration = 0.16 // seconds per step

    // Check if current active group needs steps
    let groupNeedsStep = false
    LEG_DEFS.forEach((def, i) => {
      if (def.group === spider.activeGroup) {
        const hipX = spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
        const hipY = spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
        const idealAngle = spider.angle + def.restAngle * def.side
        const idealX = hipX + Math.cos(idealAngle) * def.reach
        const idealY = hipY + Math.sin(idealAngle) * def.reach

        const leg = legs[i]
        const footDist = Math.hypot(idealX - leg.currentFootX, idealY - leg.currentFootY)
        if (footDist > 20) {
          groupNeedsStep = true
        }
      }
    })

    // Trigger step for active group
    if (isMoving && groupNeedsStep) {
      LEG_DEFS.forEach((def, i) => {
        if (def.group === spider.activeGroup) {
          const leg = legs[i]
          if (!leg.isStepping) {
            const hipX =
              spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
            const hipY =
              spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
            const idealAngle = spider.angle + def.restAngle * def.side

            // Step slightly ahead of ideal position along velocity vector
            const leadX = spider.vx * 7
            const leadY = spider.vy * 7
            const targetX = hipX + Math.cos(idealAngle) * def.reach + leadX
            const targetY = hipY + Math.sin(idealAngle) * def.reach + leadY

            leg.startFootX = leg.currentFootX
            leg.startFootY = leg.currentFootY
            leg.targetFootX = targetX
            leg.targetFootY = targetY
            leg.stepProgress = 0
            leg.isStepping = true
          }
        }
      })
    }

    // Advance stepping legs
    let allCurrentGroupDone = true
    legs.forEach((leg, i) => {
      if (leg.isStepping) {
        leg.stepProgress += dt / stepDuration
        if (leg.stepProgress >= 1) {
          leg.stepProgress = 1
          leg.isStepping = false
          leg.currentFootX = leg.targetFootX
          leg.currentFootY = leg.targetFootY
        } else {
          allCurrentGroupDone = false
          const t = leg.stepProgress
          // Parabolic lift arc
          const lift = Math.sin(Math.PI * t) * 8
          leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, t)
          leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, t) - lift
        }
      }
    })

    // If current group has landed, switch active group to the opposite
    if (allCurrentGroupDone && isMoving && groupNeedsStep) {
      spider.activeGroup = spider.activeGroup === 0 ? 1 : 0
    }

    // -------------------------------------------------------------------------
    // Rendering
    // -------------------------------------------------------------------------
    ctx.clearRect(0, 0, width, height)

    // 1. Digital Silk Web Trail
    if (webTrail.length > 1) {
      ctx.beginPath()
      ctx.moveTo(webTrail[0].x, webTrail[0].y)
      for (let i = 1; i < webTrail.length; i++) {
        ctx.lineTo(webTrail[i].x, webTrail[i].y)
      }
      ctx.lineTo(spider.x, spider.y)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.22)'
      ctx.lineWidth = 1.2
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])

      // Web anchor dots
      webTrail.forEach((pt) => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(217, 160, 60, 0.45)'
        ctx.fill()
      })
    }

    // 2. Click Pings
    for (let i = clickPings.length - 1; i >= 0; i--) {
      const ping = clickPings[i]
      ping.radius += dt * 48
      ping.alpha -= dt * 1.4
      if (ping.alpha <= 0) {
        clickPings.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(ping.x, ping.y, ping.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(217, 160, 60, ${ping.alpha})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }

    // 3. Cyber Inspection HUD Overlay (when scanning a word)
    if (spider.state === 'inspecting' && activeTarget) {
      const pad = 8
      const boxX = activeTarget.x - activeTarget.width / 2 - pad
      const boxY = activeTarget.y - activeTarget.height / 2 - pad
      const boxW = activeTarget.width + pad * 2
      const boxH = activeTarget.height + pad * 2
      const tick = 6

      ctx.save()
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.85)'
      ctx.lineWidth = 1.4

      // Top-left corner
      ctx.beginPath()
      ctx.moveTo(boxX, boxY + tick)
      ctx.lineTo(boxX, boxY)
      ctx.lineTo(boxX + tick, boxY)
      ctx.stroke()

      // Top-right corner
      ctx.beginPath()
      ctx.moveTo(boxX + boxW - tick, boxY)
      ctx.lineTo(boxX + boxW, boxY)
      ctx.lineTo(boxX + boxW, boxY + tick)
      ctx.stroke()

      // Bottom-left corner
      ctx.beginPath()
      ctx.moveTo(boxX, boxY + boxH - tick)
      ctx.lineTo(boxX, boxY + boxH)
      ctx.lineTo(boxX + tick, boxY + boxH)
      ctx.stroke()

      // Bottom-right corner
      ctx.beginPath()
      ctx.moveTo(boxX + boxW - tick, boxY + boxH)
      ctx.lineTo(boxX + boxW, boxY + boxH)
      ctx.lineTo(boxX + boxW, boxY + boxH - tick)
      ctx.stroke()

      // Subtle scanline laser across target
      const scanY = boxY + boxH * spider.scanProgress
      ctx.beginPath()
      ctx.moveTo(boxX, scanY)
      ctx.lineTo(boxX + boxW, scanY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.45)'
      ctx.lineWidth = 1
      ctx.stroke()

      // Mini cyber tag label
      ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillStyle = 'rgba(217, 160, 60, 0.95)'
      ctx.fillText(`[INDEXED: 200 OK]`, boxX, boxY - 4)

      ctx.restore()
    }

    // 4. Spider Rendering (Shadows + Legs + Body)
    ctx.save()

    // Soft drop shadow under the spider
    ctx.shadowColor = 'rgba(0, 0, 0, 0.35)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3

    // Draw 8 Legs
    LEG_DEFS.forEach((def, i) => {
      const leg = legs[i]
      const hipX = spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
      const hipY = spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist

      const ik = solveIK(
        hipX,
        hipY,
        leg.currentFootX,
        leg.currentFootY,
        def.len1,
        def.len2,
        def.bendDirection * def.side,
      )

      // Femur (Hip to Knee)
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(ik.kneeX, ik.kneeY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.85)'
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.stroke()

      // Tibia (Knee to Foot)
      ctx.beginPath()
      ctx.moveTo(ik.kneeX, ik.kneeY)
      ctx.lineTo(ik.footX, ik.footY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.95)'
      ctx.lineWidth = 1.4
      ctx.stroke()

      // Joint pin
      ctx.beginPath()
      ctx.arc(ik.kneeX, ik.kneeY, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 215, 120, 1)'
      ctx.fill()

      // Foot tip
      ctx.beginPath()
      ctx.arc(ik.footX, ik.footY, 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(217, 160, 60, 1)'
      ctx.fill()
    })

    // Draw Body (Abdomen + Thorax + Eyes)
    ctx.translate(spider.x, spider.y)
    ctx.rotate(spider.angle)

    // Abdomen (rear teardrop/ellipse)
    ctx.beginPath()
    ctx.ellipse(-8, 0, 9, 6.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(24, 25, 30)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.7)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Thorax (front shield)
    ctx.beginPath()
    ctx.ellipse(4, 0, 6.5, 5.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(18, 19, 23)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.85)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Glowing core indicator on abdomen
    ctx.beginPath()
    ctx.arc(-7, 0, 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(217, 160, 60, 0.9)'
    ctx.fill()

    // Two bright cyber eyes on head
    ctx.beginPath()
    ctx.arc(8.5, -2, 1.2, 0, Math.PI * 2)
    ctx.arc(8.5, 2, 1.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 230, 150, 1)'
    ctx.fill()

    ctx.restore()
  }

  animFrameId = requestAnimationFrame(loop)

  onUnmounted(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    container.removeEventListener('click', handleContainerClick)
  })
})

function togglePause() {
  isPaused.value = !isPaused.value
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-15 overflow-hidden">
    <!-- HTML5 Canvas layer -->
    <canvas ref="canvasRef" class="size-full" />

    <!-- Minimal HUD Badge in bottom corner of section -->
    <div
      class="pointer-events-auto absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-background/80 px-3 py-1.5 font-mono text-[11px] shadow-sm backdrop-blur-md transition-all hover:border-brand/40 sm:right-6 sm:bottom-6"
    >
      <span class="relative flex size-2">
        <span
          class="bg-brand absolute inline-flex size-full rounded-full opacity-75"
          :class="{ 'animate-ping': !isPaused }"
        />
        <span class="bg-brand relative inline-flex size-2 rounded-full" />
      </span>

      <span class="text-muted-foreground hidden sm:inline">Web Crawler:</span>
      <span class="text-foreground font-medium">
        {{ isPaused ? 'Paused' : currentStatus }}
      </span>

      <span class="text-muted-foreground/60 text-[10px]">·</span>
      <span class="text-brand font-semibold">{{ indexedCount }} indexed</span>

      <!-- Pause / Resume button -->
      <button
        class="text-muted-foreground hover:text-foreground ml-1 flex size-5 items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
        :title="isPaused ? 'Resume crawler' : 'Pause crawler'"
        :aria-label="isPaused ? 'Resume crawler' : 'Pause crawler'"
        @click="togglePause"
      >
        <Play v-if="isPaused" class="size-3 text-brand" />
        <Pause v-else class="size-3" />
      </button>
    </div>
  </div>
</template>
