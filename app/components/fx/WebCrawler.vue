<script setup lang="ts">
import { Play, Pause, Sparkles } from '@lucide/vue'

/**
 * Procedural "Web Crawler" Spider — Attention & Landmark Guided.
 *
 * Inspired by the viral creative coding phenomenon by Slava Rybin (@rybinfx),
 * this crawler brings the technical metaphor of a "web crawler" literally to
 * life: an autonomous digital spider that physically crawls across the webpage,
 * climbs typography and cards, and touches the most important information
 * (CV Download button, tech stack, portrait, principles) to draw the visitor's
 * immediate attention.
 *
 * KEY HIGHLIGHTS:
 * 1. Curated Landmark Navigation: Instead of erratic micro-hops, it navigates
 *    meaningfully between primary portfolio highlights (CV, Stack, Portrait, Principles).
 * 2. "Touch & Attention" Mechanic: Upon reaching a key section or button, the spider
 *    reaches its front legs forward to physically tap the element, triggering
 *    expanding golden shockwave halos, cyber brackets, and glowing beacons.
 * 3. 8-Legged Inverse Kinematics (IK) with alternating tetrapod gait and organic curved pathing.
 * 4. Digital silk web trail weaving between visited landmarks.
 * 5. Interactive: click anywhere to command the spider to investigate.
 * 6. High-performance HTML5 Canvas with IntersectionObserver pause when off-screen.
 */

interface Props {
  containerSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '#about',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPaused = ref(false)
const currentStatus = ref('Guiding: Curriculum Vitae')
const activeHighlightLabel = ref('Curriculum Vitae (PDF)')
const indexedCount = ref(0)
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

interface LandmarkTarget {
  x: number
  y: number
  touchX: number
  touchY: number
  width: number
  height: number
  label: string
  type: string
  badgeText: string
  priority: number
}

interface AttentionPulse {
  x: number
  y: number
  radius: number
  maxRadius: number
  alpha: number
  color: string
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

interface WebAnchor {
  x: number
  y: number
  label: string
}

// 8 Leg definitions: 4 on left, 4 on right, with anatomical offsets and reaches
const LEG_DEFS: LegDef[] = [
  // Left side (indices 0..3)
  {
    side: -1,
    hipAngleOffset: -0.65,
    hipDist: 11,
    restAngle: -0.95,
    reach: 48,
    len1: 23,
    len2: 27,
    bendDirection: -1,
    group: 0,
  },
  {
    side: -1,
    hipAngleOffset: -0.25,
    hipDist: 10,
    restAngle: -0.4,
    reach: 42,
    len1: 20,
    len2: 24,
    bendDirection: -1,
    group: 1,
  },
  {
    side: -1,
    hipAngleOffset: 0.25,
    hipDist: 10,
    restAngle: 0.4,
    reach: 42,
    len1: 20,
    len2: 24,
    bendDirection: 1,
    group: 0,
  },
  {
    side: -1,
    hipAngleOffset: 0.65,
    hipDist: 11,
    restAngle: 1.05,
    reach: 50,
    len1: 24,
    len2: 28,
    bendDirection: 1,
    group: 1,
  },

  // Right side (indices 4..7)
  {
    side: 1,
    hipAngleOffset: 0.65,
    hipDist: 11,
    restAngle: 0.95,
    reach: 48,
    len1: 23,
    len2: 27,
    bendDirection: 1,
    group: 1,
  },
  {
    side: 1,
    hipAngleOffset: 0.25,
    hipDist: 10,
    restAngle: 0.4,
    reach: 42,
    len1: 20,
    len2: 24,
    bendDirection: 1,
    group: 0,
  },
  {
    side: 1,
    hipAngleOffset: -0.25,
    hipDist: 10,
    restAngle: -0.4,
    reach: 42,
    len1: 20,
    len2: 24,
    bendDirection: -1,
    group: 1,
  },
  {
    side: 1,
    hipAngleOffset: -0.65,
    hipDist: 11,
    restAngle: -1.05,
    reach: 50,
    len1: 24,
    len2: 28,
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

  // Spider Agent State
  const spider = {
    x: width * 0.45,
    y: height * 0.45,
    vx: 0,
    vy: 0,
    angle: 0,
    targetAngle: 0,
    activeGroup: 0 as 0 | 1,
    state: 'crawling' as 'crawling' | 'touching',
    touchTimer: 0,
    touchDuration: 4.2, // seconds to touch and draw attention to each milestone
    speed: 3.4, // smooth, confident traversal speed
    tapPhase: 0,
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

  // Landmark targets and interactive visual effects
  let landmarks: LandmarkTarget[] = []
  let currentLandmarkIndex = 0
  let manualTarget: LandmarkTarget | null = null
  const webAnchors: WebAnchor[] = []
  const attentionPulses: AttentionPulse[] = []
  const sparkles: Sparkle[] = []

  function refreshLandmarks() {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const targetElements = container.querySelectorAll('[data-crawler-target]')
    const list: LandmarkTarget[] = []

    targetElements.forEach((el) => {
      const elRect = el.getBoundingClientRect()
      const relX = elRect.left - rect.left
      const relY = elRect.top - rect.top
      const label = el.getAttribute('data-crawler-target') || 'Important Milestone'
      const type = el.getAttribute('data-crawler-type') || 'item'

      // Calculate where the spider should physically touch the element
      // For CV card: touch right at the Download CV button edge
      // For portrait: touch at the bottom-left corner
      let touchX = relX + elRect.width * 0.75
      let touchY = relY + elRect.height * 0.4
      let badgeText = label

      if (type === 'cv') {
        touchX = relX + Math.min(elRect.width - 60, elRect.width * 0.82)
        touchY = relY + elRect.height * 0.5
        badgeText = '★ ACTION: DOWNLOAD CV (PDF)'
      } else if (type === 'profile') {
        touchX = relX + 30
        touchY = relY + elRect.height * 0.85
        badgeText = '★ IDENTITY: SROS SONGHA'
      } else if (type === 'stack') {
        touchX = relX + elRect.width * 0.4
        touchY = relY + elRect.height * 0.3
        badgeText = '★ CORE STACK: VUE · NUXT · REACT'
      } else if (type === 'principles') {
        touchX = relX + 40
        touchY = relY + 30
        badgeText = '★ PHILOSOPHY: SHIP IT'
      } else if (type === 'social') {
        touchX = relX + elRect.width * 0.3
        touchY = relY + elRect.height * 0.5
        badgeText = '★ CONNECT: GITHUB & TELEGRAM'
      }

      list.push({
        x: relX + elRect.width / 2,
        y: relY + elRect.height / 2,
        touchX,
        touchY,
        width: elRect.width,
        height: elRect.height,
        label,
        type,
        badgeText,
        priority: type === 'cv' ? 100 : 50,
      })
    })

    if (list.length > 0) {
      // Sort so CV is first priority!
      list.sort((a, b) => b.priority - a.priority)
      landmarks = list
    } else {
      // Fallback landmarks
      landmarks = [
        {
          x: width * 0.4,
          y: height * 0.55,
          touchX: width * 0.45,
          touchY: height * 0.55,
          width: 280,
          height: 80,
          label: 'Curriculum Vitae',
          type: 'cv',
          badgeText: '★ ACTION: DOWNLOAD CV',
          priority: 100,
        },
        {
          x: width * 0.3,
          y: height * 0.3,
          touchX: width * 0.35,
          touchY: height * 0.3,
          width: 320,
          height: 120,
          label: 'Frontend Stack',
          type: 'stack',
          badgeText: '★ VUE & NUXT DEV',
          priority: 80,
        },
      ]
    }
  }

  setTimeout(refreshLandmarks, 300)
  setTimeout(refreshLandmarks, 1200)

  // Interactive Click Guidance:
  // User clicking anywhere on the section guides the spider to touch that point!
  const handleContainerClick = (e: MouseEvent) => {
    if (!container) return
    const rect = container.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    // Attention pulse
    attentionPulses.push({
      x: clickX,
      y: clickY,
      radius: 6,
      maxRadius: 65,
      alpha: 1,
      color: 'rgba(217, 160, 60, 1)',
    })

    manualTarget = {
      x: clickX,
      y: clickY,
      touchX: clickX,
      touchY: clickY,
      width: 40,
      height: 20,
      label: 'User Requested Spot',
      type: 'user',
      badgeText: '★ USER GUIDED INSPECTION',
      priority: 999,
    }

    spider.state = 'crawling'
    spider.touchTimer = 0
    currentStatus.value = 'Rushing to user click'
  }
  container.addEventListener('click', handleContainerClick)

  // Pause when off-screen
  let isVisibleOnScreen = true
  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      isVisibleOnScreen = entry.isIntersecting
    },
    { threshold: 0.08 },
  )
  intersectionObserver.observe(container)

  // Main Animation Loop
  let lastTime = performance.now()

  function loop(currentTime: number) {
    animFrameId = requestAnimationFrame(loop)
    if (!ctx || !canvas || !isVisibleOnScreen || isPaused.value) return

    const dt = Math.min((currentTime - lastTime) / 1000, 0.08)
    lastTime = currentTime

    // -------------------------------------------------------------------------
    // Target Navigation & Attention Sequence
    // -------------------------------------------------------------------------
    const activeTarget = manualTarget || landmarks[currentLandmarkIndex]

    if (activeTarget) {
      activeHighlightLabel.value = activeTarget.label
      const dx = activeTarget.touchX - spider.x
      const dy = activeTarget.touchY - spider.y
      const distToTarget = Math.hypot(dx, dy)

      if (spider.state === 'crawling') {
        currentStatus.value = `Crawling to: ${activeTarget.label}`

        // Steer angle smoothly towards destination with organic sway
        const desiredAngle = Math.atan2(dy, dx)
        // Add subtle organic sine weave when covering longer distances
        const weave = distToTarget > 60 ? Math.sin(currentTime * 0.004) * 0.15 : 0
        const angleDiff = normalizeAngle(desiredAngle + weave - spider.angle)
        spider.angle += angleDiff * Math.min(dt * 5.2, 1)

        const moveSpeed = spider.speed * 60 * dt
        if (distToTarget > 22) {
          spider.vx = Math.cos(spider.angle) * moveSpeed
          spider.vy = Math.sin(spider.angle) * moveSpeed
          spider.x += spider.vx
          spider.y += spider.vy
        } else {
          // Arrived at landmark! Switch to "touch & attention" state
          spider.state = 'touching'
          spider.touchTimer = spider.touchDuration
          spider.tapPhase = 0
          indexedCount.value += 1
          currentStatus.value = `Highlighting: ${activeTarget.label}`

          // Emit initial attention shockwaves
          for (let p = 0; p < 2; p++) {
            attentionPulses.push({
              x: activeTarget.touchX,
              y: activeTarget.touchY,
              radius: 8 + p * 12,
              maxRadius: 75,
              alpha: 0.95 - p * 0.2,
              color: 'rgba(217, 160, 60, 1)',
            })
          }

          // Emit initial sparkles
          for (let s = 0; s < 8; s++) {
            const sparkAngle = Math.random() * Math.PI * 2
            const sparkSpeed = 20 + Math.random() * 45
            sparkles.push({
              x: spider.x,
              y: spider.y,
              vx: Math.cos(sparkAngle) * sparkSpeed,
              vy: Math.sin(sparkAngle) * sparkSpeed,
              size: 1.5 + Math.random() * 2,
              alpha: 1,
              life: 0.6 + Math.random() * 0.8,
            })
          }

          // Drop web anchor connecting landmark
          webAnchors.push({
            x: activeTarget.touchX,
            y: activeTarget.touchY,
            label: activeTarget.label,
          })
          if (webAnchors.length > 8) webAnchors.shift()
        }
      } else if (spider.state === 'touching') {
        spider.touchTimer -= dt
        spider.tapPhase += dt * 8

        // Periodically emit attention halos while touching
        if (Math.random() < 0.035) {
          attentionPulses.push({
            x: activeTarget.touchX,
            y: activeTarget.touchY,
            radius: 8,
            maxRadius: 55,
            alpha: 0.8,
            color: 'rgba(217, 160, 60, 0.9)',
          })
        }

        // Gentle floating sparks
        if (Math.random() < 0.12) {
          sparkles.push({
            x: activeTarget.touchX + (Math.random() - 0.5) * 30,
            y: activeTarget.touchY + (Math.random() - 0.5) * 20,
            vx: (Math.random() - 0.5) * 15,
            vy: -15 - Math.random() * 20,
            size: 1.2 + Math.random() * 1.8,
            alpha: 0.9,
            life: 0.8 + Math.random() * 0.5,
          })
        }

        if (spider.touchTimer <= 0) {
          // Finished touching landmark, choose next important landmark
          spider.state = 'crawling'
          if (manualTarget) {
            manualTarget = null
          } else if (landmarks.length > 0) {
            currentLandmarkIndex = (currentLandmarkIndex + 1) % landmarks.length
          }
        }
      }
    }

    // -------------------------------------------------------------------------
    // Procedural Leg Stepping (Alternating Tetrapod Gait)
    // -------------------------------------------------------------------------
    const isMoving = spider.state === 'crawling'
    const stepDuration = 0.14

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
        if (footDist > 22) {
          groupNeedsStep = true
        }
      }
    })

    // Stepping trigger
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

            // Step ahead along velocity vector
            const leadX = spider.vx * 8
            const leadY = spider.vy * 8
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
          const lift = Math.sin(Math.PI * t) * 9
          leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, t)
          leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, t) - lift
        }
      } else if (spider.state === 'touching' && (i === 0 || i === 4)) {
        // When touching a landmark, the two front legs tap gently on the target!
        const tapOffset = Math.sin(spider.tapPhase + (i === 0 ? 0 : Math.PI)) * 4
        leg.currentFootX += Math.cos(spider.angle) * tapOffset * 0.1
        leg.currentFootY += Math.sin(spider.angle) * tapOffset * 0.1
      }
    })

    // Switch alternating groups
    if (allCurrentGroupDone && isMoving && groupNeedsStep) {
      spider.activeGroup = spider.activeGroup === 0 ? 1 : 0
    }

    // -------------------------------------------------------------------------
    // Canvas Rendering
    // -------------------------------------------------------------------------
    ctx.clearRect(0, 0, width, height)

    // 1. Digital Silk Web Trail connecting visited landmarks
    if (webAnchors.length > 1) {
      ctx.beginPath()
      ctx.moveTo(webAnchors[0].x, webAnchors[0].y)
      for (let i = 1; i < webAnchors.length; i++) {
        // Curve smoothly through anchor points
        const xc = (webAnchors[i].x + webAnchors[i - 1].x) / 2
        const yc = (webAnchors[i].y + webAnchors[i - 1].y) / 2
        ctx.quadraticCurveTo(webAnchors[i - 1].x, webAnchors[i - 1].y, xc, yc)
      }
      ctx.lineTo(spider.x, spider.y)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.28)'
      ctx.lineWidth = 1.4
      ctx.setLineDash([4, 4])
      ctx.stroke()
      ctx.setLineDash([])

      // Glowing anchor joints
      webAnchors.forEach((pt) => {
        ctx.beginPath()
        ctx.arc(pt.x, pt.y, 3, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(217, 160, 60, 0.65)'
        ctx.fill()
      })
    }

    // 2. Attention Shockwave Pulses (drawing attention directly to the touched item!)
    for (let i = attentionPulses.length - 1; i >= 0; i--) {
      const pulse = attentionPulses[i]
      pulse.radius += dt * 42
      pulse.alpha -= dt * 1.1
      if (pulse.alpha <= 0) {
        attentionPulses.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, pulse.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(217, 160, 60, ${pulse.alpha})`
      ctx.lineWidth = 1.8
      ctx.stroke()

      // Inner soft halo
      ctx.beginPath()
      ctx.arc(pulse.x, pulse.y, pulse.radius * 0.7, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(217, 160, 60, ${pulse.alpha * 0.5})`
      ctx.lineWidth = 1
      ctx.stroke()
      ctx.restore()
    }

    // 3. Floating Golden Sparks
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

    // 4. Cyber Attention HUD & Reticle (Active when Touching Important Information)
    if (spider.state === 'touching' && activeTarget) {
      ctx.save()

      // Target bounding highlight
      const pad = 12
      const boxX = activeTarget.x - activeTarget.width / 2 - pad
      const boxY = activeTarget.y - activeTarget.height / 2 - pad
      const boxW = activeTarget.width + pad * 2
      const boxH = activeTarget.height + pad * 2
      const tick = 10

      // Glowing corner brackets
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.9)'
      ctx.lineWidth = 2

      // Top-Left
      ctx.beginPath()
      ctx.moveTo(boxX, boxY + tick)
      ctx.lineTo(boxX, boxY)
      ctx.lineTo(boxX + tick, boxY)
      ctx.stroke()

      // Top-Right
      ctx.beginPath()
      ctx.moveTo(boxX + boxW - tick, boxY)
      ctx.lineTo(boxX + boxW, boxY)
      ctx.lineTo(boxX + boxW, boxY + tick)
      ctx.stroke()

      // Bottom-Left
      ctx.beginPath()
      ctx.moveTo(boxX, boxY + boxH - tick)
      ctx.lineTo(boxX, boxY + boxH)
      ctx.lineTo(boxX + tick, boxY + boxH)
      ctx.stroke()

      // Bottom-Right
      ctx.beginPath()
      ctx.moveTo(boxX + boxW - tick, boxY + boxH)
      ctx.lineTo(boxX + boxW, boxY + boxH)
      ctx.lineTo(boxX + boxW, boxY + boxH - tick)
      ctx.stroke()

      // Attention Badge Tag above the target
      ctx.font = 'bold 11px ui-monospace, SFMono-Regular, Menlo, monospace'
      ctx.fillStyle = 'rgba(217, 160, 60, 0.98)'
      ctx.shadowColor = 'rgba(217, 160, 60, 0.5)'
      ctx.shadowBlur = 6
      ctx.fillText(activeTarget.badgeText, boxX, boxY - 6)

      // Attention Pointer Arrow pointing down to the touched element
      const arrowX = activeTarget.touchX
      const arrowY = activeTarget.touchY - 26 + Math.sin(currentTime * 0.008) * 4
      ctx.beginPath()
      ctx.moveTo(arrowX, arrowY + 12)
      ctx.lineTo(arrowX - 5, arrowY + 4)
      ctx.lineTo(arrowX + 5, arrowY + 4)
      ctx.closePath()
      ctx.fillStyle = 'rgba(217, 160, 60, 1)'
      ctx.fill()

      ctx.restore()
    }

    // 5. Spider Rendering (8 Legs + Body + Glowing Core)
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 9
    ctx.shadowOffsetY = 4

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
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.88)'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.stroke()

      // Tibia (Knee to Foot)
      ctx.beginPath()
      ctx.moveTo(ik.kneeX, ik.kneeY)
      ctx.lineTo(ik.footX, ik.footY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.98)'
      ctx.lineWidth = 1.5
      ctx.stroke()

      // Knee joint pin
      ctx.beginPath()
      ctx.arc(ik.kneeX, ik.kneeY, 2, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(255, 225, 140, 1)'
      ctx.fill()

      // Foot tip
      ctx.beginPath()
      ctx.arc(ik.footX, ik.footY, 1.6, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(217, 160, 60, 1)'
      ctx.fill()
    })

    // Draw Body
    ctx.translate(spider.x, spider.y)
    ctx.rotate(spider.angle)

    // Abdomen (rear oval)
    ctx.beginPath()
    ctx.ellipse(-9, 0, 10, 7.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(24, 25, 30)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.8)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Thorax (front shield)
    ctx.beginPath()
    ctx.ellipse(5, 0, 7.5, 6, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(18, 19, 23)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.9)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Glowing core indicator
    ctx.beginPath()
    ctx.arc(-8, 0, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(217, 160, 60, 0.95)'
    ctx.fill()

    // Front feelers (pedipalps)
    ctx.beginPath()
    ctx.moveTo(11, -3)
    ctx.lineTo(15, -5)
    ctx.moveTo(11, 3)
    ctx.lineTo(15, 5)
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.8)'
    ctx.lineWidth = 1.3
    ctx.stroke()

    // Bright cyber eyes
    ctx.beginPath()
    ctx.arc(10, -2.5, 1.4, 0, Math.PI * 2)
    ctx.arc(10, 2.5, 1.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 235, 160, 1)'
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

    <!-- Minimal HUD Badge in bottom corner -->
    <div
      class="pointer-events-auto absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-full border border-border/60 bg-background/85 px-3 py-1.5 font-mono text-[11px] shadow-sm backdrop-blur-md transition-all hover:border-brand/50 sm:right-6 sm:bottom-6"
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
