<script setup lang="ts">
import { Play, Pause } from '@lucide/vue'

/**
 * Autonomous AI Web Crawler Spider.
 *
 * Inspired by Slava Rybin's viral creative coding project:
 * - 100% autonomous with continuous, fluid motion (NO STOPPING).
 * - Realistic procedural arachnid locomotion: legs place down ONE BY ONE in a continuous
 *   metachronal ripple wave (7 legs planted on the page while 1 leg swings and taps down).
 * - Long, spindly, stretchable legs ("leg can sketch") spanning 75–84px across text lines.
 * - Outward-normal 2-bone Inverse Kinematics guarantees clean, high-arcing knees with
 *   zero knee-crossing or distortion.
 * - Each foot tap emits a crisp micro laser ripple on the letters.
 * - Seamlessly patrols across the bio, indexing "Computer Science", "front-end developer",
 *   "Vue, Nuxt, and React", "Roomie", and "details", leaving behind an interconnected citation web.
 * - Loops smoothly in a continuous circuit around the text.
 */

interface Props {
  containerSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '#about',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPaused = ref(false)
const currentStatus = ref('Patrolling bio')
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

/**
 * High-precision 2-bone IK with outward normal constraint.
 * Guarantees that knees ALWAYS arc outward away from the body center cleanly.
 */
function solveKnee(
  spiderX: number,
  spiderY: number,
  hipX: number,
  hipY: number,
  footX: number,
  footY: number,
  len1: number,
  len2: number,
) {
  let dx = footX - hipX
  let dy = footY - hipY
  let d = Math.hypot(dx, dy)
  if (d < 0.001) d = 0.001
  const maxReach = len1 + len2 - 0.001
  if (d > maxReach) {
    footX = hipX + (dx / d) * maxReach
    footY = hipY + (dy / d) * maxReach
    d = maxReach
    dx = footX - hipX
    dy = footY - hipY
  }

  const cosA = (len1 * len1 + d * d - len2 * len2) / (2 * len1 * d)
  const clampedCosA = Math.max(-1, Math.min(1, cosA))
  const sinA = Math.sqrt(Math.max(0, 1 - clampedCosA * clampedCosA))
  const kneeAlong = len1 * clampedCosA
  const kneeHeight = len1 * sinA

  const basePointX = hipX + (dx / d) * kneeAlong
  const basePointY = hipY + (dy / d) * kneeAlong

  // Normal vector perpendicular to limb
  const p1X = -dy / d
  const p1Y = dx / d

  // Vector pointing outward away from spider center
  const awayX = basePointX - spiderX
  const awayY = basePointY - spiderY

  // Pick perpendicular that points outward
  const dot = p1X * awayX + p1Y * awayY
  const nx = dot >= 0 ? p1X : -p1X
  const ny = dot >= 0 ? p1Y : -p1Y

  const kneeX = basePointX + nx * kneeHeight
  const kneeY = basePointY + ny * kneeHeight

  return { kneeX, kneeY, footX, footY }
}

// -----------------------------------------------------------------------------
// Spider Data Structures & Landmark Definitions
// -----------------------------------------------------------------------------

interface LegDef {
  side: 1 | -1
  hipAngleOffset: number
  hipDist: number
  restAngle: number
  reach: number
  len1: number
  len2: number
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

interface TextLandmark {
  id: string
  name: string
  tag: string
  phraseWords: string[]
  highlightClass: string
  themeColor: string
  elements: HTMLElement[]
  x: number
  y: number
  box: {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }
  isLanded: boolean
  landedAnimTime: number
}

interface Waypoint {
  x: number
  y: number
  landmarkId?: string
  name: string
}

interface Shockwave {
  x: number
  y: number
  radius: number
  maxRadius: number
  color: string
  alpha: number
}

interface FootRipple {
  x: number
  y: number
  radius: number
  maxRadius: number
  color: string
  alpha: number
}

interface Sparkle {
  x: number
  y: number
  vx: number
  vy: number
  size: number
  color: string
  alpha: number
  life: number
}

// 8 Spindly, long arachnid legs that can stretch and reach across text lines (~75–84px)
const LEG_DEFS: LegDef[] = [
  // Left side (Front to Back)
  { side: -1, hipAngleOffset: -0.82, hipDist: 11, restAngle: -0.92, reach: 76, len1: 36, len2: 44 },
  { side: -1, hipAngleOffset: -0.28, hipDist: 10, restAngle: -0.42, reach: 68, len1: 32, len2: 40 },
  { side: -1, hipAngleOffset: 0.28,  hipDist: 10, restAngle: 0.42,  reach: 68, len1: 32, len2: 40 },
  { side: -1, hipAngleOffset: 0.82,  hipDist: 11, restAngle: 1.05,  reach: 80, len1: 38, len2: 46 },

  // Right side (Front to Back)
  { side: 1, hipAngleOffset: 0.82,  hipDist: 11, restAngle: 0.92,  reach: 76, len1: 36, len2: 44 },
  { side: 1, hipAngleOffset: 0.28,  hipDist: 10, restAngle: 0.42,  reach: 68, len1: 32, len2: 40 },
  { side: 1, hipAngleOffset: -0.28, hipDist: 10, restAngle: -0.42, reach: 68, len1: 32, len2: 40 },
  { side: 1, hipAngleOffset: -0.82, hipDist: 11, restAngle: -1.05, reach: 80, len1: 38, len2: 46 },
]

// Stepping order for the one-by-one wave gait:
// Alternating between sides, moving from rear legs to front legs
const STEP_ORDER = [3, 7, 2, 6, 1, 5, 0, 4]

// Ordered milestones down the About Me bio
const LANDMARK_CONFIGS = [
  {
    id: 'cs',
    name: 'Computer Science',
    tag: 'NODE_01 // CS',
    phraseWords: ['computer', 'science'],
    highlightClass: 'crawler-highlight-cyan',
    themeColor: '#38bdf8',
  },
  {
    id: 'frontend',
    name: 'Front-end Developer',
    tag: 'NODE_02 // FE_DEV',
    phraseWords: ['front-end', 'developer'],
    highlightClass: 'crawler-highlight-gold',
    themeColor: '#facc15',
  },
  {
    id: 'stack',
    name: 'Core Stack',
    tag: 'NODE_03 // CORE_STACK',
    phraseWords: ['vue,', 'nuxt,', 'and', 'react'],
    highlightClass: 'crawler-highlight-purple',
    themeColor: '#c084fc',
  },
  {
    id: 'roomie',
    name: 'Roomie (ស្រុកខ្ញុំ)',
    tag: 'NODE_04 // ROOMIE',
    phraseWords: ['roomie'],
    highlightClass: 'crawler-highlight-emerald',
    themeColor: '#34d399',
  },
  {
    id: 'details',
    name: 'Craft & Details',
    tag: 'NODE_05 // DETAILS',
    phraseWords: ['details'],
    highlightClass: 'crawler-highlight-rose',
    themeColor: '#fb7185',
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

  let landmarks: TextLandmark[] = []
  let waypoints: Waypoint[] = []
  let currentWaypointIndex = 0

  let startX = width * 0.22
  let startY = 85

  function updateSize() {
    if (!container || !canvas || !ctx) return
    width = container.clientWidth
    height = container.clientHeight
    dpr = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    refreshLandmarks()
  }

  resizeObserver = new ResizeObserver(() => updateSize())
  resizeObserver.observe(container)

  // Find exact contiguous word sequence in the bio
  function findPhraseElements(allEls: HTMLElement[], words: string[]): HTMLElement[] {
    for (let i = 0; i <= allEls.length - words.length; i++) {
      let match = true
      for (let j = 0; j < words.length; j++) {
        const text = allEls[i + j].textContent?.trim().toLowerCase() || ''
        if (!text.includes(words[j].toLowerCase())) {
          match = false
          break
        }
      }
      if (match) {
        return allEls.slice(i, i + words.length)
      }
    }
    return []
  }

  function refreshLandmarks() {
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const allWordEls = Array.from(container.querySelectorAll<HTMLElement>('.about-bio .split-word'))
    if (allWordEls.length === 0) return

    const bioEl = container.querySelector('.about-bio') as HTMLElement | null
    let bioLeft = width * 0.15
    let bioRight = width * 0.55
    let bioTop = 100

    if (bioEl) {
      const bioRect = bioEl.getBoundingClientRect()
      bioLeft = bioRect.left - containerRect.left
      bioRight = bioRect.right - containerRect.left
      bioTop = bioRect.top - containerRect.top
      startX = bioLeft + 45
      startY = Math.max(45, bioTop - 40)
    }

    const list: TextLandmark[] = []

    LANDMARK_CONFIGS.forEach((cfg) => {
      const matchedEls = findPhraseElements(allWordEls, cfg.phraseWords)

      if (matchedEls.length > 0) {
        let minLeft = Infinity
        let maxRight = -Infinity
        let minTop = Infinity
        let maxBottom = -Infinity

        matchedEls.forEach((el) => {
          const r = el.getBoundingClientRect()
          minLeft = Math.min(minLeft, r.left - containerRect.left)
          maxRight = Math.max(maxRight, r.right - containerRect.left)
          minTop = Math.min(minTop, r.top - containerRect.top)
          maxBottom = Math.max(maxBottom, r.bottom - containerRect.top)
        })

        const existing = landmarks.find((lm) => lm.id === cfg.id)

        list.push({
          id: cfg.id,
          name: cfg.name,
          tag: cfg.tag,
          phraseWords: cfg.phraseWords,
          highlightClass: cfg.highlightClass,
          themeColor: cfg.themeColor,
          elements: matchedEls,
          x: (minLeft + maxRight) / 2,
          y: (minTop + maxBottom) / 2,
          box: {
            left: minLeft - 5,
            right: maxRight + 5,
            top: minTop - 3,
            bottom: maxBottom + 3,
            width: maxRight - minLeft + 10,
            height: maxBottom - minTop + 6,
          },
          isLanded: existing ? existing.isLanded : false,
          landedAnimTime: existing ? existing.landedAnimTime : 0,
        })
      }
    })

    landmarks = list

    // Build smooth continuous patrol circuit through the bio text
    if (list.length >= 5) {
      waypoints = [
        { x: startX, y: startY, name: 'Perch' },
        { x: list[0].x, y: list[0].y, landmarkId: list[0].id, name: list[0].name },
        { x: list[1].x, y: list[1].y, landmarkId: list[1].id, name: list[1].name },
        { x: list[2].x, y: list[2].y, landmarkId: list[2].id, name: list[2].name },
        { x: list[3].x, y: list[3].y, landmarkId: list[3].id, name: list[3].name },
        { x: list[4].x, y: list[4].y, landmarkId: list[4].id, name: list[4].name },
        { x: Math.min(width - 50, bioRight + 40), y: list[4].y + 35, name: 'Lower turn' },
        { x: Math.min(width - 40, bioRight + 60), y: (list[1].y + list[2].y) / 2, name: 'Mid perimeter' },
        { x: Math.min(width - 50, bioRight + 30), y: startY + 15, name: 'Top perimeter' },
      ]
    }
  }

  setTimeout(refreshLandmarks, 150)
  setTimeout(refreshLandmarks, 600)
  setTimeout(refreshLandmarks, 1500)

  // ---------------------------------------------------------------------------
  // Spider Physics & Kinematic State
  // ---------------------------------------------------------------------------
  const spider = {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2, // Facing downward
    speed: 108, // px / sec: smooth, continuous crawl
    pedipalpPhase: 0,
    idlePhase: 0,
  }

  // Initialize legs
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

  const shockwaves: Shockwave[] = []
  const footRipples: FootRipple[] = []
  const sparkles: Sparkle[] = []

  let isVisibleOnScreen = true
  intersectionObserver = new IntersectionObserver(
    ([entry]) => {
      isVisibleOnScreen = entry.isIntersecting
    },
    { threshold: 0.05 },
  )
  intersectionObserver.observe(container)

  // ---------------------------------------------------------------------------
  // Main Animation Loop
  // ---------------------------------------------------------------------------
  let lastTime = performance.now()

  function loop(currentTime: number) {
    animFrameId = requestAnimationFrame(loop)
    if (!ctx || !canvas || !isVisibleOnScreen || isPaused.value) return

    const dt = Math.min((currentTime - lastTime) / 1000, 0.08)
    lastTime = currentTime
    spider.pedipalpPhase += dt * 8
    spider.idlePhase += dt * 3

    // 1. Continuous Non-Stop Waypoint Navigation
    if (waypoints.length > 0) {
      const targetWaypoint = waypoints[currentWaypointIndex]
      const dx = targetWaypoint.x - spider.x
      const dy = targetWaypoint.y - spider.y
      const dist = Math.hypot(dx, dy)

      // Smooth steering toward target
      const targetAngle = Math.atan2(dy, dx)
      const angleDiff = normalizeAngle(targetAngle - spider.angle)
      spider.angle += angleDiff * Math.min(dt * 6.0, 1)

      // Constant fluid velocity - NEVER STOPS
      spider.vx = Math.cos(spider.angle) * spider.speed
      spider.vy = Math.sin(spider.angle) * spider.speed

      spider.x += spider.vx * dt
      spider.y += spider.vy * dt

      currentStatus.value = `Crawling to: ${targetWaypoint.name}`

      // Check if passing over a landmark milestone
      if (targetWaypoint.landmarkId && dist < 36) {
        const lm = landmarks.find((l) => l.id === targetWaypoint.landmarkId)
        if (lm && !lm.isLanded) {
          lm.isLanded = true
          lm.elements.forEach((el) => el.classList.add(lm.highlightClass))

          shockwaves.push({
            x: lm.x,
            y: lm.y,
            radius: 8,
            maxRadius: 60,
            color: lm.themeColor,
            alpha: 1,
          })

          for (let s = 0; s < 10; s++) {
            const spAngle = Math.random() * Math.PI * 2
            const spSpeed = 20 + Math.random() * 45
            sparkles.push({
              x: lm.x + (Math.random() - 0.5) * lm.box.width,
              y: lm.box.bottom,
              vx: Math.cos(spAngle) * spSpeed,
              vy: -15 - Math.random() * 30,
              size: 1.4 + Math.random() * 1.8,
              color: lm.themeColor,
              alpha: 1,
              life: 0.6 + Math.random() * 0.4,
            })
          }
        }
      }

      // Smoothly advance to next waypoint when within 28px without stopping
      if (dist < 28) {
        currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length

        // When completing a full loop back to perch, reset landmarks for fresh scan
        if (currentWaypointIndex === 0) {
          landmarks.forEach((lm) => {
            lm.isLanded = false
            lm.elements.forEach((el) => el.classList.remove(lm.highlightClass))
          })
        }
      }
    }

    // Determine currently active landmark theme color
    const nextLm = waypoints[currentWaypointIndex]?.landmarkId
      ? landmarks.find((l) => l.id === waypoints[currentWaypointIndex].landmarkId)
      : null
    const activeColor = nextLm ? nextLm.themeColor : '#38bdf8'

    // 2. Realistic Continuous One-by-One Metachronal Stepping
    const stepDuration = 0.085

    // Check if any leg is currently in the air
    let anyLegStepping = false
    for (let i = 0; i < legs.length; i++) {
      if (legs[i].isStepping) {
        anyLegStepping = true
        break
      }
    }

    // If all legs are planted, choose the single leg furthest from its ideal footprint
    if (!anyLegStepping) {
      let maxDist = 17 // Step trigger threshold
      let chosenLegIdx = -1

      for (let s = 0; s < STEP_ORDER.length; s++) {
        const i = STEP_ORDER[s]
        const def = LEG_DEFS[i]
        const leg = legs[i]

        const hipX =
          spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
        const hipY =
          spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
        const idealAngle = spider.angle + def.restAngle * def.side

        // Step leads in direction of velocity (legs stretch out and sketch smoothly!)
        const leadX = spider.vx * 0.22
        const leadY = spider.vy * 0.22
        const idealX = hipX + Math.cos(idealAngle) * def.reach + leadX
        const idealY = hipY + Math.sin(idealAngle) * def.reach + leadY

        const dist = Math.hypot(idealX - leg.currentFootX, idealY - leg.currentFootY)
        if (dist > maxDist) {
          maxDist = dist
          chosenLegIdx = i
        }
      }

      if (chosenLegIdx !== -1) {
        const leg = legs[chosenLegIdx]
        const def = LEG_DEFS[chosenLegIdx]

        const hipX =
          spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
        const hipY =
          spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
        const idealAngle = spider.angle + def.restAngle * def.side
        const leadX = spider.vx * 0.22
        const leadY = spider.vy * 0.22

        leg.startFootX = leg.currentFootX
        leg.startFootY = leg.currentFootY
        leg.targetFootX = hipX + Math.cos(idealAngle) * def.reach + leadX
        leg.targetFootY = hipY + Math.sin(idealAngle) * def.reach + leadY
        leg.stepProgress = 0
        leg.isStepping = true
      }
    }

    // Animate the single stepping leg smoothly
    legs.forEach((leg) => {
      if (leg.isStepping) {
        leg.stepProgress += dt / stepDuration
        if (leg.stepProgress >= 1) {
          leg.stepProgress = 1
          leg.isStepping = false
          leg.currentFootX = leg.targetFootX
          leg.currentFootY = leg.targetFootY

          // Micro laser ripple on the letters/page when foot taps down!
          footRipples.push({
            x: leg.currentFootX,
            y: leg.currentFootY,
            radius: 1.5,
            maxRadius: 6.5,
            color: activeColor,
            alpha: 0.85,
          })
        } else {
          const t = leg.stepProgress
          const smoothT = t * t * (3 - 2 * t)
          // Parabolic knee lift
          const lift = Math.sin(Math.PI * t) * 14
          leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, smoothT)
          leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, smoothT) - lift
        }
      }
    })

    // -------------------------------------------------------------------------
    // Canvas Rendering
    // -------------------------------------------------------------------------
    ctx.clearRect(0, 0, width, height)

    const landedList = landmarks.filter((lm) => lm.isLanded)

    // 1. Geometric Data Web Mesh
    if (landedList.length > 0) {
      ctx.save()

      ctx.beginPath()
      ctx.moveTo(startX, startY)
      ctx.lineTo(landedList[0].x, landedList[0].y)
      ctx.strokeStyle = landedList[0].themeColor
      ctx.lineWidth = 1.0
      ctx.setLineDash([4, 4])
      ctx.globalAlpha = 0.45
      ctx.stroke()

      for (let i = 1; i < landedList.length; i++) {
        const prev = landedList[i - 1]
        const curr = landedList[i]
        ctx.beginPath()
        ctx.moveTo(prev.x, prev.y)
        ctx.lineTo(curr.x, curr.y)
        ctx.strokeStyle = curr.themeColor
        ctx.lineWidth = 1.1
        ctx.setLineDash([4, 4])
        ctx.globalAlpha = 0.5
        ctx.stroke()

        if (i >= 2) {
          const skipNode = landedList[i - 2]
          ctx.beginPath()
          ctx.moveTo(skipNode.x, skipNode.y)
          ctx.lineTo(curr.x, curr.y)
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'
          ctx.lineWidth = 0.8
          ctx.setLineDash([2, 4])
          ctx.stroke()
        }
      }

      landedList.forEach((lm) => {
        ctx.beginPath()
        ctx.arc(lm.x, lm.y, 2.5, 0, Math.PI * 2)
        ctx.fillStyle = lm.themeColor
        ctx.globalAlpha = 0.85
        ctx.fill()
      })

      // Active silk line to spider's spinneret
      const lastLanded = landedList[landedList.length - 1]
      ctx.beginPath()
      ctx.moveTo(spider.x - Math.cos(spider.angle) * 11, spider.y - Math.sin(spider.angle) * 11)
      ctx.lineTo(lastLanded.x, lastLanded.y)
      ctx.strokeStyle = lastLanded.themeColor
      ctx.lineWidth = 1.2
      ctx.setLineDash([3, 2])
      ctx.globalAlpha = 0.7
      ctx.stroke()

      ctx.restore()
    }

    // 2. High-Tech OCR Bounding Box & Corner Brackets
    landmarks.forEach((lm) => {
      if (lm.isLanded) {
        ctx.save()
        const b = lm.box
        const cornerLen = 6

        ctx.beginPath()
        ctx.roundRect(b.left, b.top, b.width, b.height, 4)
        ctx.fillStyle = lm.themeColor
        ctx.globalAlpha = 0.16
        ctx.fill()

        ctx.beginPath()
        ctx.roundRect(b.left, b.top, b.width, b.height, 4)
        ctx.strokeStyle = lm.themeColor
        ctx.lineWidth = 1.2
        ctx.globalAlpha = 0.8
        ctx.shadowColor = lm.themeColor
        ctx.shadowBlur = 8
        ctx.stroke()

        ctx.lineWidth = 1.6
        ctx.globalAlpha = 1.0

        ctx.beginPath()
        ctx.moveTo(b.left - 2, b.top + cornerLen)
        ctx.lineTo(b.left - 2, b.top - 2)
        ctx.lineTo(b.left + cornerLen, b.top - 2)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(b.right + 2 - cornerLen, b.top - 2)
        ctx.lineTo(b.right + 2, b.top - 2)
        ctx.lineTo(b.right + 2, b.top + cornerLen)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(b.left - 2, b.bottom - cornerLen)
        ctx.lineTo(b.left - 2, b.bottom + 2)
        ctx.lineTo(b.left + cornerLen, b.bottom + 2)
        ctx.stroke()

        ctx.beginPath()
        ctx.moveTo(b.right + 2 - cornerLen, b.bottom + 2)
        ctx.lineTo(b.right + 2, b.bottom + 2)
        ctx.lineTo(b.right + 2, b.bottom - cornerLen)
        ctx.stroke()

        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.fillStyle = lm.themeColor
        ctx.shadowBlur = 4
        ctx.fillText(`[${lm.tag}]`, b.left - 2, b.top - 6)

        ctx.restore()
      }
    })

    // 3. Shockwave Pulses
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i]
      sw.radius += dt * 65
      sw.alpha -= dt * 1.6
      if (sw.alpha <= 0) {
        shockwaves.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
      ctx.strokeStyle = sw.color
      ctx.globalAlpha = sw.alpha
      ctx.lineWidth = 1.6
      ctx.shadowColor = sw.color
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.restore()
    }

    // 4. Micro Foot Contact Ripples on the Text
    for (let i = footRipples.length - 1; i >= 0; i--) {
      const fr = footRipples[i]
      fr.radius += dt * 18
      fr.alpha -= dt * 3.0
      if (fr.alpha <= 0) {
        footRipples.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.beginPath()
      ctx.arc(fr.x, fr.y, fr.radius, 0, Math.PI * 2)
      ctx.strokeStyle = fr.color
      ctx.globalAlpha = fr.alpha
      ctx.lineWidth = 1.1
      ctx.stroke()
      ctx.restore()
    }

    // 5. Floating Cyber Sparks
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const sp = sparkles[i]
      sp.x += sp.vx * dt
      sp.y += sp.vy * dt
      sp.alpha -= dt / sp.life
      if (sp.alpha <= 0) {
        sparkles.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.beginPath()
      ctx.arc(sp.x, sp.y, sp.size, 0, Math.PI * 2)
      ctx.fillStyle = sp.color
      ctx.globalAlpha = sp.alpha
      ctx.shadowColor = sp.color
      ctx.shadowBlur = 6
      ctx.fill()
      ctx.restore()
    }

    // 6. Clean Spider Rendering
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
    ctx.shadowBlur = 8
    ctx.shadowOffsetY = 3

    // Render 8 Spindly, Stretchable Legs with Outward Knee Arcs
    LEG_DEFS.forEach((def, i) => {
      const leg = legs[i]
      const hipX = spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
      const hipY = spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist

      const ik = solveKnee(
        spider.x,
        spider.y,
        hipX,
        hipY,
        leg.currentFootX,
        leg.currentFootY,
        def.len1,
        def.len2,
      )

      // Femur (upper limb segment) - clean metallic slate
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(ik.kneeX, ik.kneeY)
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.95)'
      ctx.lineWidth = 2.0
      ctx.lineCap = 'round'
      ctx.stroke()

      // Tibia (lower tapered limb segment) - glowing theme accent
      ctx.beginPath()
      ctx.moveTo(ik.kneeX, ik.kneeY)
      ctx.lineTo(ik.footX, ik.footY)
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 1.4
      ctx.stroke()

      // Knee joint - micro white node
      ctx.beginPath()
      ctx.arc(ik.kneeX, ik.kneeY, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = activeColor
      ctx.shadowBlur = 4
      ctx.fill()

      // Foot contact point - planted directly on the text!
      ctx.beginPath()
      ctx.arc(ik.footX, ik.footY, 2.0, 0, Math.PI * 2)
      ctx.fillStyle = activeColor
      ctx.shadowColor = activeColor
      ctx.shadowBlur = 6
      ctx.fill()
    })

    // Render Spider Body
    ctx.translate(spider.x, spider.y)
    ctx.rotate(spider.angle)

    const breath = Math.sin(spider.idlePhase) * 0.5

    // Abdomen (rear)
    ctx.beginPath()
    ctx.ellipse(-9, 0, 10 + breath, 7.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#0b0f19'
    ctx.fill()
    ctx.strokeStyle = activeColor
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Pulsing cyber core reactor
    ctx.beginPath()
    ctx.arc(-7, 0, 2.4, 0, Math.PI * 2)
    ctx.fillStyle = activeColor
    ctx.shadowColor = activeColor
    ctx.shadowBlur = 8
    ctx.fill()

    // Cephalothorax (front)
    ctx.beginPath()
    ctx.ellipse(5, 0, 7.5, 6, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#060911'
    ctx.fill()
    ctx.strokeStyle = 'rgba(203, 213, 225, 0.85)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Pedipalps (front sensory feelers)
    const palp = Math.sin(spider.pedipalpPhase) * 1.5
    ctx.beginPath()
    ctx.moveTo(11, -3)
    ctx.lineTo(16 + palp, -5)
    ctx.moveTo(11, 3)
    ctx.lineTo(16 - palp, 5)
    ctx.strokeStyle = activeColor
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Cyber eye cluster (4 glowing scanning eyes)
    ctx.fillStyle = activeColor
    ctx.shadowColor = activeColor
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(10, -2, 1.1, 0, Math.PI * 2)
    ctx.arc(10, 2, 1.1, 0, Math.PI * 2)
    ctx.arc(11.5, -0.8, 0.9, 0, Math.PI * 2)
    ctx.arc(11.5, 0.8, 0.9, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  animFrameId = requestAnimationFrame(loop)

  onUnmounted(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    landmarks.forEach((lm) => {
      lm.elements.forEach((el) => el.classList.remove(lm.highlightClass))
    })
  })
})

function togglePause() {
  isPaused.value = !isPaused.value
}
</script>

<template>
  <div class="pointer-events-none absolute inset-0 z-15 overflow-hidden">
    <!-- HTML5 Canvas rendering layer -->
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

      <span class="text-muted-foreground hidden sm:inline">AI Crawler:</span>
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
