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
 * Coordinate transform helper: converts local spider coordinates to world coordinates.
 */
function localToWorld(
  originX: number,
  originY: number,
  angle: number,
  lx: number,
  ly: number,
) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return {
    x: originX + cos * lx - sin * ly,
    y: originY + sin * lx + cos * ly,
  }
}

interface LegJoints {
  coxaStartX: number
  coxaStartY: number
  coxaEndX: number
  coxaEndY: number
  kneeX: number
  kneeY: number
  ankleX: number
  ankleY: number
  footX: number
  footY: number
}

/**
 * Articulated 4-part arachnid leg IK solver.
 * Segments:
 * 1. Coxa: Carapace anchor base extending outward.
 * 2. Femur: High-arcing thigh reaching to the knee.
 * 3. Tibia: Shin segment stepping downward.
 * 4. Tarsus: Cyber claw tip planted directly onto the page.
 */
function solve4PartLeg(
  spiderAngle: number,
  bodyX: number,
  bodyY: number,
  localHip: [number, number],
  coxaLen: number,
  coxaAngleOffset: number,
  footX: number,
  footY: number,
  lenFemur: number,
  lenTibia: number,
  lenTarsus: number,
  side: 1 | -1,
  fwdBias: number,
): LegJoints {
  const cos = Math.cos(spiderAngle)
  const sin = Math.sin(spiderAngle)

  // 1. Part 1: Coxa base on carapace
  const hipStartX = bodyX + cos * localHip[0] - sin * localHip[1]
  const hipStartY = bodyY + sin * localHip[0] + cos * localHip[1]

  // Coxa tip extending outward from carapace
  const coxaWorldAngle = spiderAngle + coxaAngleOffset
  const coxaEndX = hipStartX + Math.cos(coxaWorldAngle) * coxaLen
  const coxaEndY = hipStartY + Math.sin(coxaWorldAngle) * coxaLen

  // Maximum physical reach of the articulated limb from coxaEnd to claw tip
  const maxLimbReach = lenFemur + lenTibia + lenTarsus - 0.001

  // Vector from coxaEnd to target foot position
  let fDx = footX - coxaEndX
  let fDy = footY - coxaEndY
  let fDist = Math.hypot(fDx, fDy)
  if (fDist < 0.001) {
    fDist = 0.001
    fDx = 0.001
    fDy = 0
  }

  // Mathematically guarantee the foot NEVER stretches beyond the physical limb reach
  let finalFootX = footX
  let finalFootY = footY
  if (fDist > maxLimbReach) {
    finalFootX = coxaEndX + (fDx / fDist) * maxLimbReach
    finalFootY = coxaEndY + (fDy / fDist) * maxLimbReach
    fDist = maxLimbReach
    fDx = finalFootX - coxaEndX
    fDy = finalFootY - coxaEndY
  }

  const dirX = fDx / fDist
  const dirY = fDy / fDist

  // 2. Part 4: Tarsus claw
  // The tarsus is ALWAYS exactly lenTarsus long from ankle to foot!
  const finalAnkleX = finalFootX - dirX * lenTarsus
  const finalAnkleY = finalFootY - dirY * lenTarsus

  // 3. Parts 2 & 3: Solve 2-bone IK (Femur & Tibia) between coxaEnd and finalAnkle
  let dx = finalAnkleX - coxaEndX
  let dy = finalAnkleY - coxaEndY
  let d = Math.hypot(dx, dy)
  if (d < 0.001) d = 0.001
  const maxAnkleReach = lenFemur + lenTibia - 0.001
  if (d > maxAnkleReach) {
    d = maxAnkleReach
    dx = dirX * d
    dy = dirY * d
  }

  const cosA = (lenFemur * lenFemur + d * d - lenTibia * lenTibia) / (2 * lenFemur * d)
  const clampedCosA = Math.max(-1, Math.min(1, cosA))
  const sinA = Math.sqrt(Math.max(0, 1 - clampedCosA * clampedCosA))
  const kneeAlong = lenFemur * clampedCosA
  const kneeHeight = lenFemur * sinA

  const basePointX = coxaEndX + (dx / d) * kneeAlong
  const basePointY = coxaEndY + (dy / d) * kneeAlong

  // Limb perpendicular unit normal
  const p1X = -dy / d
  const p1Y = dx / d

  // Forward and Right unit vectors in world space
  const fx = Math.cos(spiderAngle)
  const fy = Math.sin(spiderAngle)
  const rx = -Math.sin(spiderAngle)
  const ry = Math.cos(spiderAngle)

  // Anatomical bias: front legs bend forward, rear legs bend backward, all bend outward
  const biasX = fx * fwdBias + rx * (side * 0.7)
  const biasY = fy * fwdBias + ry * (side * 0.7)

  const dot = p1X * biasX + p1Y * biasY
  const nx = dot >= 0 ? p1X : -p1X
  const ny = dot >= 0 ? p1Y : -p1Y

  const kneeX = basePointX + nx * kneeHeight
  const kneeY = basePointY + ny * kneeHeight

  return {
    coxaStartX: hipStartX,
    coxaStartY: hipStartY,
    coxaEndX,
    coxaEndY,
    kneeX,
    kneeY,
    ankleX: finalAnkleX,
    ankleY: finalAnkleY,
    footX: finalFootX,
    footY: finalFootY,
  }
}

// -----------------------------------------------------------------------------
// Spider Data Structures & Landmark Definitions
// -----------------------------------------------------------------------------

interface LegDef {
  id: string
  side: 1 | -1
  localHip: [number, number]
  coxaLen: number
  coxaAngle: number
  rest: [number, number]
  lenFemur: number
  lenTibia: number
  lenTarsus: number
  fwdBias: number
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

// 8 Anatomical 4-part arachnid legs (Coxa + Femur + Tibia + Tarsus):
// - Front legs (L1, R1) bend & point FORWARD
// - Mid legs (L2, R2, L3, R3) splay OUTWARD
// - Rear legs (L4, R4) articulate with high knee, sweeping tibia, and downward claw trailing the abdomen
const LEG_DEFS: LegDef[] = [
  // Left side (Front to Back)
  { id: 'L1', side: -1, localHip: [7, -4],   coxaAngle: -0.75, coxaLen: 7, rest: [48, -54],  lenFemur: 26, lenTibia: 28, lenTarsus: 16, fwdBias: 0.85 },
  { id: 'L2', side: -1, localHip: [3, -6],   coxaAngle: -1.35, coxaLen: 6, rest: [14, -68],  lenFemur: 24, lenTibia: 26, lenTarsus: 14, fwdBias: 0.35 },
  { id: 'L3', side: -1, localHip: [-3, -6],  coxaAngle: -1.85, coxaLen: 6, rest: [-20, -64], lenFemur: 24, lenTibia: 26, lenTarsus: 14, fwdBias: -0.35 },
  { id: 'L4', side: -1, localHip: [-7, -4],  coxaAngle: -2.45, coxaLen: 8, rest: [-54, -48], lenFemur: 28, lenTibia: 30, lenTarsus: 18, fwdBias: -0.85 },

  // Right side (Front to Back)
  { id: 'R1', side: 1,  localHip: [7, 4],    coxaAngle: 0.75,  coxaLen: 7, rest: [48, 54],   lenFemur: 26, lenTibia: 28, lenTarsus: 16, fwdBias: 0.85 },
  { id: 'R2', side: 1,  localHip: [3, 6],    coxaAngle: 1.35,  coxaLen: 6, rest: [14, 68],   lenFemur: 24, lenTibia: 26, lenTarsus: 14, fwdBias: 0.35 },
  { id: 'R3', side: 1,  localHip: [-3, 6],   coxaAngle: 1.85,  coxaLen: 6, rest: [-20, 64],  lenFemur: 24, lenTibia: 26, lenTarsus: 14, fwdBias: -0.35 },
  { id: 'R4', side: 1,  localHip: [-7, 4],   coxaAngle: 2.45,  coxaLen: 8, rest: [-54, 48],  lenFemur: 28, lenTibia: 30, lenTarsus: 18, fwdBias: -0.85 },
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

  interface TextWordTarget {
    left: number
    right: number
    top: number
    bottom: number
    width: number
    height: number
  }

  let textWords: TextWordTarget[] = []
  let landmarks: TextLandmark[] = []
  let waypoints: Waypoint[] = []
  let currentWaypointIndex = 0

  let startX = width * 0.22
  let startY = 85

  /**
   * Snaps a foot target directly onto random letters of nearby text words.
   * If a text word is within reachRadius, the foot lands directly on a character!
   */
  function snapFootToText(
    idealX: number,
    idealY: number,
    words: TextWordTarget[],
    reachRadius = 38,
  ): { x: number; y: number } {
    if (words.length === 0) return { x: idealX, y: idealY }

    let bestWord: TextWordTarget | null = null
    let minDist = reachRadius

    for (let i = 0; i < words.length; i++) {
      const w = words[i]
      const cx = Math.max(w.left, Math.min(w.right, idealX))
      const cy = Math.max(w.top, Math.min(w.bottom, idealY))
      const d = Math.hypot(cx - idealX, cy - idealY)
      if (d < minDist) {
        minDist = d
        bestWord = w
      }
    }

    if (bestWord) {
      const paddingX = Math.min(3, bestWord.width * 0.15)
      const paddingY = Math.min(2, bestWord.height * 0.15)
      const footX = bestWord.left + paddingX + Math.random() * Math.max(1, bestWord.width - paddingX * 2)
      const footY = bestWord.top + paddingY + Math.random() * Math.max(1, bestWord.height - paddingY * 2)
      return { x: footX, y: footY }
    }

    return { x: idealX, y: idealY }
  }

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

    // Capture bounding boxes of all individual words across the bio text
    textWords = allWordEls.map((el) => {
      const r = el.getBoundingClientRect()
      const left = r.left - containerRect.left
      const right = r.right - containerRect.left
      const top = r.top - containerRect.top
      const bottom = r.bottom - containerRect.top
      return {
        left,
        right,
        top,
        bottom,
        width: right - left,
        height: bottom - top,
      }
    })

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

    // Build smooth continuous patrol circuit 100% through the bio text paragraphs
    if (list.length >= 5) {
      waypoints = [
        { x: startX, y: startY, name: 'Perch' },
        { x: list[0].x, y: list[0].y, landmarkId: list[0].id, name: list[0].name },
        { x: list[1].x, y: list[1].y, landmarkId: list[1].id, name: list[1].name },
        { x: list[2].x, y: list[2].y, landmarkId: list[2].id, name: list[2].name },
        { x: list[3].x, y: list[3].y, landmarkId: list[3].id, name: list[3].name },
        { x: list[4].x, y: list[4].y, landmarkId: list[4].id, name: list[4].name },
        // Return ascent: weave back UP across the left/center of the bio text paragraphs!
        { x: bioLeft + 45, y: list[4].y - 8, name: 'Bio: Craft & Logic' },
        { x: (bioLeft + bioRight) / 2 - 25, y: (list[3].y + list[2].y) / 2, name: 'Bio: Frameworks' },
        { x: bioLeft + 40, y: (list[1].y + list[0].y) / 2, name: 'Bio: Foundations' },
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
    speed: 180, // px / sec: brisk, agile arachnid sprint (faster!)
    pedipalpPhase: 0,
    idlePhase: 0,
    sCurvePhase: 0,
  }

  type SpiderMovementMode =
    | 'scuttle'      // Fast agile dart forward
    | 'micro_pause'  // Natural 0.12s pause between strides ("movement one stop like real spider")
    | 'landing_legs' // Stopped directly on landmark word: legs place down one by one
    | 'inspecting'   // Scanning word with active OCR highlight for ~1.2s

  let movementMode: SpiderMovementMode = 'scuttle'
  let movementTimer = 0.45
  let landingLegStepIndex = 0
  let inspectTimer = 0

  // Initialize legs at anatomical rest positions
  const legs: LegState[] = LEG_DEFS.map((def) => {
    const foot = localToWorld(spider.x, spider.y, spider.angle, def.rest[0], def.rest[1])
    return {
      currentFootX: foot.x,
      currentFootY: foot.y,
      startFootX: foot.x,
      startFootY: foot.y,
      targetFootX: foot.x,
      targetFootY: foot.y,
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
    spider.idlePhase += dt * 4

    // Determine currently active landmark theme color
    const nextLm = waypoints[currentWaypointIndex]?.landmarkId
      ? landmarks.find((l) => l.id === waypoints[currentWaypointIndex].landmarkId)
      : null
    const activeColor = nextLm ? nextLm.themeColor : '#38bdf8'

    // 1. Waypoint Navigation & Organic Movement Cadence (S-Curve Weaving)
    if (waypoints.length > 0) {
      const targetWaypoint = waypoints[currentWaypointIndex]
      const dx = targetWaypoint.x - spider.x
      const dy = targetWaypoint.y - spider.y
      const dist = Math.hypot(dx, dy)

      if (movementMode === 'scuttle') {
        spider.sCurvePhase += dt * 4.2
        spider.pedipalpPhase += dt * 10

        // Perpendicular normal vector for lateral S-curve weaving
        const invDist = 1 / (dist || 1)
        const nx = -dy * invDist
        const ny = dx * invDist

        // S-curve wave amplitude (smoothly tapers to 0 when nearing destination)
        const waveAmp = Math.sin(spider.sCurvePhase) * Math.min(dist * 0.45, 34)
        const virtualTargetX = targetWaypoint.x + nx * waveAmp
        const virtualTargetY = targetWaypoint.y + ny * waveAmp

        const targetAngle = Math.atan2(virtualTargetY - spider.y, virtualTargetX - spider.x)
        const angleDiff = normalizeAngle(targetAngle - spider.angle)

        spider.angle += angleDiff * Math.min(dt * 8.5, 1)
        spider.vx = Math.cos(spider.angle) * spider.speed
        spider.vy = Math.sin(spider.angle) * spider.speed
        spider.x += spider.vx * dt
        spider.y += spider.vy * dt

        currentStatus.value = `Crawling to: ${targetWaypoint.name}`

        // Check if approaching a landmark word that has not been scanned yet
        if (targetWaypoint.landmarkId && dist < 26) {
          const lm = landmarks.find((l) => l.id === targetWaypoint.landmarkId)
          if (lm && !lm.isLanded) {
            movementMode = 'landing_legs'
            landingLegStepIndex = 0
            spider.vx = 0
            spider.vy = 0
            spider.x = targetWaypoint.x
            spider.y = targetWaypoint.y
            currentStatus.value = `Landing on: ${targetWaypoint.name}`
          }
        }

        // Timer for scuttle burst: quick burst, then a brisk micro-pause ("one stop")
        if (movementMode === 'scuttle') {
          movementTimer -= dt
          if (movementTimer <= 0) {
            movementMode = 'micro_pause'
            movementTimer = 0.10 + Math.random() * 0.08
            spider.vx = 0
            spider.vy = 0
          }

          // Advance non-landmark waypoints or already-landed landmarks
          if (dist < 26) {
            currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length
            if (currentWaypointIndex === 0) {
              // Full circuit completed - reset landmarks for fresh scan on next lap
              landmarks.forEach((lm) => {
                lm.isLanded = false
                lm.elements.forEach((el) => el.classList.remove(lm.highlightClass))
              })
            }
          }
        }
      } else if (movementMode === 'micro_pause') {
        // Real spider momentary freeze between strides
        spider.vx = 0
        spider.vy = 0
        spider.pedipalpPhase += dt * 16 // Sensory feelers twitch alertly
        movementTimer -= dt
        if (movementTimer <= 0) {
          movementMode = 'scuttle'
          movementTimer = 0.35 + Math.random() * 0.22
        }
      } else if (movementMode === 'landing_legs') {
        // Spider is parked directly on the word - legs place down ONE BY ONE onto text letters!
        spider.vx = 0
        spider.vy = 0
        spider.pedipalpPhase += dt * 14

        // Check if the current leg in the sequence needs to start its step
        if (landingLegStepIndex < STEP_ORDER.length) {
          const legIdx = STEP_ORDER[landingLegStepIndex]
          const leg = legs[legIdx]
          const def = LEG_DEFS[legIdx]

          if (!leg.isStepping && leg.stepProgress >= 1) {
            const ideal = localToWorld(spider.x, spider.y, spider.angle, def.rest[0], def.rest[1])
            // Snap foot directly onto text letters!
            const snapped = snapFootToText(ideal.x, ideal.y, textWords, 45)
            leg.startFootX = leg.currentFootX
            leg.startFootY = leg.currentFootY
            leg.targetFootX = snapped.x
            leg.targetFootY = snapped.y
            leg.stepProgress = 0
            leg.isStepping = true
          }
        }

        currentStatus.value = `Clamping: ${targetWaypoint.name} (${Math.min(landingLegStepIndex + 1, 8)}/8)`
      } else if (movementMode === 'inspecting') {
        spider.vx = 0
        spider.vy = 0
        spider.pedipalpPhase += dt * 10
        inspectTimer -= dt
        if (inspectTimer <= 0) {
          // Inspection complete, scuttle to next milestone
          currentWaypointIndex = (currentWaypointIndex + 1) % waypoints.length
          movementMode = 'scuttle'
          movementTimer = 0.4
        }
      }
    }

    // 2. Physical Constraint & Stepping Logic
    // Physical constraint: planted feet cannot stretch beyond maximum limb reach
    legs.forEach((leg, i) => {
      const def = LEG_DEFS[i]
      const cos = Math.cos(spider.angle)
      const sin = Math.sin(spider.angle)
      const hipX = spider.x + cos * def.localHip[0] - sin * def.localHip[1]
      const hipY = spider.y + sin * def.localHip[0] + cos * def.localHip[1]
      const coxaAngle = spider.angle + def.coxaAngle
      const cEndX = hipX + Math.cos(coxaAngle) * def.coxaLen
      const cEndY = hipY + Math.sin(coxaAngle) * def.coxaLen
      const maxReach = def.lenFemur + def.lenTibia + def.lenTarsus - 2

      const cdx = leg.currentFootX - cEndX
      const cdy = leg.currentFootY - cEndY
      const cdist = Math.hypot(cdx, cdy)
      if (cdist > maxReach) {
        leg.currentFootX = cEndX + (cdx / cdist) * maxReach
        leg.currentFootY = cEndY + (cdy / cdist) * maxReach
      }
    })

    // Brisk, agile stepping speed (60ms scuttle, 50ms landing)
    const stepDuration = movementMode === 'landing_legs' ? 0.05 : 0.06

    function triggerLegStep(legIdx: number) {
      const leg = legs[legIdx]
      const def = LEG_DEFS[legIdx]
      const ideal = localToWorld(spider.x, spider.y, spider.angle, def.rest[0], def.rest[1])
      const leadX = spider.vx * 0.16
      const leadY = spider.vy * 0.16
      const rawTargetX = ideal.x + leadX
      const rawTargetY = ideal.y + leadY

      // Snap foot directly onto letters of nearby words!
      const snapped = snapFootToText(rawTargetX, rawTargetY, textWords, 45)

      leg.startFootX = leg.currentFootX
      leg.startFootY = leg.currentFootY
      leg.targetFootX = snapped.x
      leg.targetFootY = snapped.y
      leg.stepProgress = 0
      leg.isStepping = true
    }

    if (movementMode === 'scuttle') {
      // Dual-side stepping: Left side (0..3) and Right side (4..7) step independently
      // Tripod / tetrapod balance: at least 6 legs firmly planted on the text at all times!
      const leftStepping = legs[0].isStepping || legs[1].isStepping || legs[2].isStepping || legs[3].isStepping
      const rightStepping = legs[4].isStepping || legs[5].isStepping || legs[6].isStepping || legs[7].isStepping

      if (!leftStepping) {
        let maxDist = 13 // Trigger threshold
        let chosenIdx = -1
        for (const i of [3, 2, 1, 0]) {
          const leg = legs[i]
          const def = LEG_DEFS[i]
          const ideal = localToWorld(spider.x, spider.y, spider.angle, def.rest[0], def.rest[1])
          const leadX = spider.vx * 0.16
          const leadY = spider.vy * 0.16
          const idealX = ideal.x + leadX
          const idealY = ideal.y + leadY
          const dist = Math.hypot(idealX - leg.currentFootX, idealY - leg.currentFootY)
          if (dist > maxDist) {
            maxDist = dist
            chosenIdx = i
          }
        }
        if (chosenIdx !== -1) {
          triggerLegStep(chosenIdx)
        }
      }

      if (!rightStepping) {
        let maxDist = 13 // Trigger threshold
        let chosenIdx = -1
        for (const i of [7, 6, 5, 4]) {
          const leg = legs[i]
          const def = LEG_DEFS[i]
          const ideal = localToWorld(spider.x, spider.y, spider.angle, def.rest[0], def.rest[1])
          const leadX = spider.vx * 0.16
          const leadY = spider.vy * 0.16
          const idealX = ideal.x + leadX
          const idealY = ideal.y + leadY
          const dist = Math.hypot(idealX - leg.currentFootX, idealY - leg.currentFootY)
          if (dist > maxDist) {
            maxDist = dist
            chosenIdx = i
          }
        }
        if (chosenIdx !== -1) {
          triggerLegStep(chosenIdx)
        }
      }
    }

    // Animate the stepping leg(s)
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
            maxRadius: 7.0,
            color: activeColor,
            alpha: 0.9,
          })

          // If in landing_legs mode, advance to next leg!
          if (movementMode === 'landing_legs') {
            landingLegStepIndex++
            if (landingLegStepIndex >= STEP_ORDER.length) {
              // ALL 8 LEGS HAVE FIRMLY LANDED ON THE TEXT!
              const targetWaypoint = waypoints[currentWaypointIndex]
              if (targetWaypoint?.landmarkId) {
                const lm = landmarks.find((l) => l.id === targetWaypoint.landmarkId)
                if (lm) {
                  lm.isLanded = true
                  lm.elements.forEach((el) => el.classList.add(lm.highlightClass))

                  shockwaves.push({
                    x: lm.x,
                    y: lm.y,
                    radius: 8,
                    maxRadius: 65,
                    color: lm.themeColor,
                    alpha: 1,
                  })

                  for (let s = 0; s < 12; s++) {
                    const spAngle = Math.random() * Math.PI * 2
                    const spSpeed = 25 + Math.random() * 50
                    sparkles.push({
                      x: lm.x + (Math.random() - 0.5) * lm.box.width,
                      y: lm.box.bottom,
                      vx: Math.cos(spAngle) * spSpeed,
                      vy: -18 - Math.random() * 32,
                      size: 1.4 + Math.random() * 1.8,
                      color: lm.themeColor,
                      alpha: 1,
                      life: 0.6 + Math.random() * 0.4,
                    })
                  }
                  currentStatus.value = `Scanned: ${lm.name} // OCR Active`
                }
              }

              movementMode = 'inspecting'
              inspectTimer = 1.2 // Snappy 1.2s inspection dwell on word
            }
          }
        } else {
          const t = leg.stepProgress
          const smoothT = t * t * (3 - 2 * t)
          const lift = Math.sin(Math.PI * t) * 13
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
      const spinneret = localToWorld(spider.x, spider.y, spider.angle, -11, 0)
      ctx.beginPath()
      ctx.moveTo(spinneret.x, spinneret.y)
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

    // Render 8 Articulated 4-Part Arachnid Legs (Coxa -> Femur -> Tibia -> Tarsus)
    LEG_DEFS.forEach((def, i) => {
      const leg = legs[i]

      const ik = solve4PartLeg(
        spider.angle,
        spider.x,
        spider.y,
        def.localHip,
        def.coxaLen,
        def.coxaAngle,
        leg.currentFootX,
        leg.currentFootY,
        def.lenFemur,
        def.lenTibia,
        def.lenTarsus,
        def.side,
        def.fwdBias,
      )

      // Part 1: Coxa (heavy carapace anchor bracket)
      ctx.beginPath()
      ctx.moveTo(ik.coxaStartX, ik.coxaStartY)
      ctx.lineTo(ik.coxaEndX, ik.coxaEndY)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.95)'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.stroke()

      // Part 2: Femur (high-arcing thigh segment)
      ctx.beginPath()
      ctx.moveTo(ik.coxaEndX, ik.coxaEndY)
      ctx.lineTo(ik.kneeX, ik.kneeY)
      ctx.strokeStyle = 'rgba(203, 213, 225, 0.95)'
      ctx.lineWidth = 2.0
      ctx.stroke()

      // Part 3: Tibia (shin segment stepping downward)
      ctx.beginPath()
      ctx.moveTo(ik.kneeX, ik.kneeY)
      ctx.lineTo(ik.ankleX, ik.ankleY)
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.9)'
      ctx.lineWidth = 1.6
      ctx.stroke()

      // Part 4: Tarsus (cyber claw tip contacting page)
      ctx.beginPath()
      ctx.moveTo(ik.ankleX, ik.ankleY)
      ctx.lineTo(ik.footX, ik.footY)
      ctx.strokeStyle = activeColor
      ctx.lineWidth = 1.3
      ctx.stroke()

      // Joints:
      // Coxa/trochanter joint - micro slate node
      ctx.beginPath()
      ctx.arc(ik.coxaEndX, ik.coxaEndY, 1.4, 0, Math.PI * 2)
      ctx.fillStyle = '#64748b'
      ctx.fill()

      // Knee joint - glowing white node
      ctx.beginPath()
      ctx.arc(ik.kneeX, ik.kneeY, 1.8, 0, Math.PI * 2)
      ctx.fillStyle = '#ffffff'
      ctx.shadowColor = activeColor
      ctx.shadowBlur = 4
      ctx.fill()

      // Ankle joint - metallic micro node
      ctx.beginPath()
      ctx.arc(ik.ankleX, ik.ankleY, 1.4, 0, Math.PI * 2)
      ctx.fillStyle = 'rgba(203, 213, 225, 0.95)'
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
