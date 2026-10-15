<script setup lang="ts">
import { Play, Pause } from '@lucide/vue'

/**
 * Procedural "Web Crawler" Spider — Dedicated CV Attention Guide.
 *
 * Scoped directly to the Curriculum Vitae card:
 * 1. The bio text above remains 100% clean, crisp, and clearly visible.
 * 2. The spider lives directly on the CV card, patrols its perimeter, and
 *    physically perches on the "Download CV" button.
 * 3. Taps its front legs on the button, radiates golden attention shockwaves,
 *    bounces a directional arrow, and emits cyber sparks to get visitors
 *    to download the CV.
 * 4. Interactive: reacts to pointer hover over the card and celebrates with
 *    a leap & sparkle burst when the button is clicked.
 */

interface Props {
  containerSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '.about-cv-card',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPaused = ref(false)
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
  side: 1 | -1
  hipAngleOffset: number
  hipDist: number
  restAngle: number
  reach: number
  len1: number
  len2: number
  bendDirection: number
  group: 0 | 1
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

interface CVWaypoint {
  x: number
  y: number
  label: string
  isPrimary: boolean
  stayDuration: number
}

interface PulseHalo {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
}

interface Sparkle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  alpha: number
  life: number
}

// 8 Leg definitions with realistic geometry
const LEG_DEFS: LegDef[] = [
  // Left side
  { side: -1, hipAngleOffset: -0.65, hipDist: 9, restAngle: -0.95, reach: 40, len1: 19, len2: 23, bendDirection: -1, group: 0 },
  { side: -1, hipAngleOffset: -0.25, hipDist: 8, restAngle: -0.4, reach: 35, len1: 17, len2: 20, bendDirection: -1, group: 1 },
  { side: -1, hipAngleOffset: 0.25, hipDist: 8, restAngle: 0.4, reach: 35, len1: 17, len2: 20, bendDirection: 1, group: 0 },
  { side: -1, hipAngleOffset: 0.65, hipDist: 9, restAngle: 1.05, reach: 42, len1: 20, len2: 24, bendDirection: 1, group: 1 },

  // Right side
  { side: 1, hipAngleOffset: 0.65, hipDist: 9, restAngle: 0.95, reach: 40, len1: 19, len2: 23, bendDirection: 1, group: 1 },
  { side: 1, hipAngleOffset: 0.25, hipDist: 8, restAngle: 0.4, reach: 35, len1: 17, len2: 20, bendDirection: 1, group: 0 },
  { side: 1, hipAngleOffset: -0.25, hipDist: 8, restAngle: -0.4, reach: 35, len1: 17, len2: 20, bendDirection: -1, group: 1 },
  { side: 1, hipAngleOffset: -0.65, hipDist: 9, restAngle: -1.05, reach: 42, len1: 20, len2: 24, bendDirection: -1, group: 0 },
]

// -----------------------------------------------------------------------------
// Component Lifecycle
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

  const PADDING = 24 // extra margin around the card for legs & halos
  let cardWidth = container.clientWidth
  let cardHeight = container.clientHeight
  let totalWidth = cardWidth + PADDING * 2
  let totalHeight = cardHeight + PADDING * 2
  let dpr = Math.min(window.devicePixelRatio || 1, 2)

  function updateSize() {
    if (!container || !canvas || !ctx) return
    cardWidth = container.clientWidth
    cardHeight = container.clientHeight
    totalWidth = cardWidth + PADDING * 2
    totalHeight = cardHeight + PADDING * 2
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(totalWidth * dpr)
    canvas.height = Math.floor(totalHeight * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    refreshWaypoints()
  }

  resizeObserver = new ResizeObserver(() => updateSize())
  resizeObserver.observe(container)

  // Waypoints across the CV card
  let waypoints: CVWaypoint[] = []
  let currentWaypointIndex = 0

  function refreshWaypoints() {
    if (!container) return
    const rect = container.getBoundingClientRect()

    // Find the Download CV button inside the card
    const btn = container.querySelector('a[download]') as HTMLElement | null
    const previewBtn = container.querySelector('a[data-cursor-label="Preview"]') as HTMLElement | null

    let btnX = PADDING + cardWidth * 0.85
    let btnY = PADDING + cardHeight * 0.5

    if (btn) {
      const bRect = btn.getBoundingClientRect()
      btnX = bRect.left - rect.left + bRect.width / 2 + PADDING
      btnY = bRect.top - rect.top + bRect.height / 2 + PADDING
    }

    let prevX = PADDING + cardWidth * 0.65
    let prevY = PADDING + cardHeight * 0.5
    if (previewBtn) {
      const pRect = previewBtn.getBoundingClientRect()
      prevX = pRect.left - rect.left + pRect.width / 2 + PADDING
      prevY = pRect.top - rect.top + pRect.height / 2 + PADDING
    }

    waypoints = [
      // 1. Primary Highlight: Directly on the Download CV button!
      {
        x: btnX,
        y: btnY - 8,
        label: 'Download CV',
        isPrimary: true,
        stayDuration: 5.5, // spends longest time guarding the button
      },
      // 2. Card perimeter patrol: top-right corner
      {
        x: PADDING + cardWidth - 25,
        y: PADDING + 12,
        label: 'Top Border',
        isPrimary: false,
        stayDuration: 1.2,
      },
      // 3. Card perimeter: left badge (Curriculum Vitae title)
      {
        x: PADDING + 45,
        y: PADDING + 20,
        label: 'Curriculum Vitae Badge',
        isPrimary: false,
        stayDuration: 2.2,
      },
      // 4. Preview link
      {
        x: prevX,
        y: prevY - 6,
        label: 'Preview',
        isPrimary: false,
        stayDuration: 1.8,
      },
      // 5. Back to Download CV button
      {
        x: btnX - 10,
        y: btnY + 4,
        label: 'Download CV',
        isPrimary: true,
        stayDuration: 6.0,
      },
    ]
  }

  updateSize()

  // Spider state
  const spider = {
    x: PADDING + cardWidth * 0.8,
    y: PADDING + cardHeight * 0.5,
    vx: 0,
    vy: 0,
    angle: -Math.PI / 2,
    activeGroup: 0 as 0 | 1,
    state: 'touching' as 'crawling' | 'touching',
    touchTimer: 4.5,
    tapPhase: 0,
    speed: 3.0,
    jumpOffset: 0,
    isHovered: false,
  }

  // Initialize leg positions
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

  const halos: PulseHalo[] = []
  const sparkles: Sparkle[] = []

  // Hover detection on the CV card
  const onPointerEnter = () => {
    spider.isHovered = true
  }
  const onPointerLeave = () => {
    spider.isHovered = false
  }

  // Click celebration: When the user clicks the Download CV button or card
  const onCardClick = () => {
    spider.jumpOffset = 18 // playful hop

    // Burst of celebratory golden sparkles
    for (let i = 0; i < 20; i++) {
      const spAngle = Math.random() * Math.PI * 2
      const spSpeed = 30 + Math.random() * 70
      sparkles.push({
        x: spider.x,
        y: spider.y,
        vx: Math.cos(spAngle) * spSpeed,
        vy: Math.sin(spAngle) * spSpeed,
        size: 1.8 + Math.random() * 2.2,
        alpha: 1,
        life: 0.8 + Math.random() * 0.6,
      })
    }

    halos.push({
      x: spider.x,
      y: spider.y,
      radius: 10,
      maxRadius: 70,
      alpha: 1,
    })
  }

  container.addEventListener('mouseenter', onPointerEnter)
  container.addEventListener('mouseleave', onPointerLeave)
  container.addEventListener('click', onCardClick)

  // Pause when off screen
  let isVisibleOnScreen = true
  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      isVisibleOnScreen = entry.isIntersecting
    },
    { threshold: 0.1 },
  )
  intersectionObserver.observe(container)

  // Animation Loop
  let lastTime = performance.now()

  function loop(currentTime: number) {
    animFrameId = requestAnimationFrame(loop)
    if (!ctx || !canvas || !isVisibleOnScreen || isPaused.value) return

    const dt = Math.min((currentTime - lastTime) / 1000, 0.08)
    lastTime = currentTime

    // Handle celebratory jump decay
    if (spider.jumpOffset > 0) {
      spider.jumpOffset = Math.max(0, spider.jumpOffset - dt * 45)
    }

    // -------------------------------------------------------------------------
    // Navigation along the CV Card
    // -------------------------------------------------------------------------
    const target = waypoints[currentWaypointIndex] || {
      x: PADDING + cardWidth * 0.85,
      y: PADDING + cardHeight * 0.5,
      label: 'Download CV',
      isPrimary: true,
      stayDuration: 5.0,
    }

    const dx = target.x - spider.x
    const dy = target.y - spider.y
    const distToTarget = Math.hypot(dx, dy)

    if (spider.state === 'crawling') {
      const desiredAngle = Math.atan2(dy, dx)
      const angleDiff = normalizeAngle(desiredAngle - spider.angle)
      spider.angle += angleDiff * Math.min(dt * 5.5, 1)

      const moveSpeed = spider.speed * 60 * dt
      if (distToTarget > 12) {
        spider.vx = Math.cos(spider.angle) * moveSpeed
        spider.vy = Math.sin(spider.angle) * moveSpeed
        spider.x += spider.vx
        spider.y += spider.vy
      } else {
        // Arrived at target
        spider.state = 'touching'
        spider.touchTimer = target.stayDuration
        spider.tapPhase = 0

        // If primary (Download button), emit attention halos!
        if (target.isPrimary) {
          halos.push({
            x: spider.x,
            y: spider.y,
            radius: 8,
            maxRadius: 55,
            alpha: 1,
          })
        }
      }
    } else if (spider.state === 'touching') {
      spider.touchTimer -= dt
      spider.tapPhase += dt * (spider.isHovered ? 14 : 9)

      // Emit periodic golden pulse while guarding the button
      if (target.isPrimary && Math.random() < 0.04) {
        halos.push({
          x: target.x,
          y: target.y + 6,
          radius: 6,
          maxRadius: 48,
          alpha: 0.85,
        })
      }

      // Gentle floating sparkles
      if (target.isPrimary && Math.random() < 0.1) {
        sparkles.push({
          x: target.x + (Math.random() - 0.5) * 35,
          y: target.y + (Math.random() - 0.5) * 20,
          vx: (Math.random() - 0.5) * 12,
          vy: -15 - Math.random() * 18,
          size: 1.2 + Math.random() * 1.6,
          alpha: 0.9,
          life: 0.7 + Math.random() * 0.5,
        })
      }

      if (spider.touchTimer <= 0) {
        spider.state = 'crawling'
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length
      }
    }

    // -------------------------------------------------------------------------
    // Procedural Leg Stepping (Alternating Tetrapod Gait)
    // -------------------------------------------------------------------------
    const isMoving = spider.state === 'crawling'
    const stepDuration = 0.13

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
        if (footDist > 18) {
          groupNeedsStep = true
        }
      }
    })

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

            const leadX = spider.vx * 6
            const leadY = spider.vy * 6
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
          const lift = Math.sin(Math.PI * t) * 8
          leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, t)
          leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, t) - lift
        }
      } else if (spider.state === 'touching' && (i === 0 || i === 4)) {
        // Front legs rhythmically tap on the CV button
        const tapOffset = Math.sin(spider.tapPhase + (i === 0 ? 0 : Math.PI)) * 4
        leg.currentFootX += Math.cos(spider.angle) * tapOffset * 0.12
        leg.currentFootY += Math.sin(spider.angle) * tapOffset * 0.12
      }
    })

    if (allCurrentGroupDone && isMoving && groupNeedsStep) {
      spider.activeGroup = spider.activeGroup === 0 ? 1 : 0
    }

    // -------------------------------------------------------------------------
    // Canvas Rendering
    // -------------------------------------------------------------------------
    ctx.clearRect(0, 0, totalWidth, totalHeight)

    // 1. Attention Halos (Expanding from the CV button!)
    for (let i = halos.length - 1; i >= 0; i--) {
      const h = halos[i]
      h.radius += dt * 40
      h.alpha -= dt * 1.2
      if (h.alpha <= 0) {
        halos.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(h.x, h.y, h.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(217, 160, 60, ${h.alpha})`
      ctx.lineWidth = 1.6
      ctx.stroke()
    }

    // 2. Floating Golden Sparks
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const sp = sparkles[i]
      sp.x += sp.vx * dt
      sp.y += sp.vy * dt
      sp.alpha -= dt / sp.life
      if (sp.alpha <= 0) {
        sparkles.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(255, 215, 120, ${sp.alpha})`
      ctx.fill()
    }

    // 3. Attention Arrow pointing down directly to Download CV button
    if (spider.state === 'touching' && target.isPrimary) {
      const arrowX = target.x
      const arrowY = target.y - 28 + Math.sin(currentTime * 0.009) * 3
      ctx.save()
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowY + 10)
      ctx.lineTo(arrowX - 5, arrowY + 3)
      ctx.lineTo(arrowX + 5, arrowY + 3)
      ctx.closePath()
      ctx.fillStyle = 'rgba(217, 160, 60, 1)'
      ctx.shadowColor = 'rgba(217, 160, 60, 0.6)'
      ctx.shadowBlur = 8
      ctx.fill()

      // Mini cyber tag
      ctx.font = 'bold 9px ui-monospace, monospace'
      ctx.fillStyle = 'rgba(217, 160, 60, 0.95)'
      ctx.fillText('DOWNLOAD CV', arrowX - 34, arrowY - 2)
      ctx.restore()
    }

    // 4. Spider Rendering (Shadow + Legs + Body + Feelers)
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3

    // Draw 8 Legs
    LEG_DEFS.forEach((def, i) => {
      const leg = legs[i]
      const hipX = spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
      const hipY =
        spider.y - spider.jumpOffset + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist

      const ik = solveIK(
        hipX,
        hipY,
        leg.currentFootX,
        leg.currentFootY,
        def.len1,
        def.len2,
        def.bendDirection * def.side,
      )

      // Femur
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(ik.kneeX, ik.kneeY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.9)'
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.stroke()

      // Tibia
      ctx.beginPath()
      ctx.moveTo(ik.kneeX, ik.kneeY)
      ctx.lineTo(ik.footX, ik.footY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.98)'
      ctx.lineWidth = 1.4
      ctx.stroke()

      // Knee pin
      ctx.beginPath()
      ctx.arc(ik.kneeX, ik.kneeY, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 225, 140, 1)'
      ctx.fill()

      // Foot tip
      ctx.beginPath()
      ctx.arc(ik.footX, ik.footY, 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(217, 160, 60, 1)'
      ctx.fill()
    })

    // Draw Body
    ctx.translate(spider.x, spider.y - spider.jumpOffset)
    ctx.rotate(spider.angle)

    // Abdomen
    ctx.beginPath()
    ctx.ellipse(-8, 0, 8.5, 6.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(24, 25, 30)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.8)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Thorax
    ctx.beginPath()
    ctx.ellipse(4, 0, 6.5, 5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(18, 19, 23)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.9)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Glowing core indicator
    ctx.beginPath()
    ctx.arc(-7, 0, 2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(217, 160, 60, 0.95)'
    ctx.fill()

    // Front feelers
    ctx.beginPath()
    ctx.moveTo(9, -2.5)
    ctx.lineTo(13, -4)
    ctx.moveTo(9, 2.5)
    ctx.lineTo(13, 4)
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.8)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Glowing cyber eyes
    ctx.beginPath()
    ctx.arc(8, -2, 1.2, 0, Math.PI * 2)
    ctx.arc(8, 2, 1.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 235, 160, 1)'
    ctx.fill()

    ctx.restore()
  }

  animFrameId = requestAnimationFrame(loop)

  onUnmounted(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    container.removeEventListener('mouseenter', onPointerEnter)
    container.removeEventListener('mouseleave', onPointerLeave)
    container.removeEventListener('click', onCardClick)
  })
})

function togglePause() {
  isPaused.value = !isPaused.value
}
</script>

<template>
  <div class="pointer-events-none absolute -inset-6 z-20 overflow-visible">
    <!-- HTML5 Canvas layer scoped over CV card -->
    <canvas ref="canvasRef" class="size-full overflow-visible" />

    <!-- Minimal HUD Badge directly on the card -->
    <div
      class="pointer-events-auto absolute -top-3 right-4 z-30 flex items-center gap-1.5 rounded-full border border-brand/40 bg-background/90 px-2.5 py-0.5 font-mono text-[10px] shadow-xs backdrop-blur-md transition-all hover:border-brand"
    >
      <span class="relative flex size-1.5">
        <span
          class="bg-brand absolute inline-flex size-full rounded-full opacity-75"
          :class="{ 'animate-ping': !isPaused }"
        />
        <span class="bg-brand relative inline-flex size-1.5 rounded-full" />
      </span>

      <span class="text-brand font-medium">Web Crawler · CV</span>

      <button
        class="text-muted-foreground hover:text-foreground ml-0.5 flex size-4 items-center justify-center rounded-full hover:bg-muted/60 transition-colors"
        :title="isPaused ? 'Resume crawler' : 'Pause crawler'"
        :aria-label="isPaused ? 'Resume crawler' : 'Pause crawler'"
        @click="togglePause"
      >
        <Play v-if="isPaused" class="size-2.5 text-brand" />
        <Pause v-else class="size-2.5" />
      </button>
    </div>
  </div>
</template>
