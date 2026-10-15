<script setup lang="ts">
import { Play, Pause } from '@lucide/vue'

/**
 * Autonomous AI Web Crawler Spider.
 *
 * Inspired by Slava Rybin's viral creative coding project:
 * - Begins perched at the top of the About Me section.
 * - Perfectly synchronized kinematics: knees stay bent at crisp, natural angles with
 *   ZERO rubbery stretching.
 * - Alternating tetrapod gait while walking ensures legs are never dragged or stretched.
 * - When arriving over a keyword ("Computer Science", "front-end developer", etc.),
 *   all 8 legs place down ONE BY ONE directly onto the letters of the text.
 * - Each foot tap emits a crisp micro laser ripple on the text.
 * - Continuously LOOPS through the bio milestones in an autonomous scanning patrol,
 *   while seamlessly adapting to manual user scroll focus.
 */

interface Props {
  containerSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '#about',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPaused = ref(false)
const currentStatus = ref('Standing by at perch')
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
 * 2-bone IK with outward normal constraint.
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

// 8 Clean arachnid legs with comfortable, un-stretched geometry (reach 48–54px, max 64px)
const LEG_DEFS: LegDef[] = [
  // Left side (Front to Back)
  { side: -1, hipAngleOffset: -0.78, hipDist: 10, restAngle: -0.82, reach: 52, len1: 30, len2: 34, group: 0 },
  { side: -1, hipAngleOffset: -0.26, hipDist: 9,  restAngle: -0.38, reach: 48, len1: 28, len2: 32, group: 1 },
  { side: -1, hipAngleOffset: 0.26,  hipDist: 9,  restAngle: 0.38,  reach: 48, len1: 28, len2: 32, group: 0 },
  { side: -1, hipAngleOffset: 0.78,  hipDist: 10, restAngle: 0.92,  reach: 54, len1: 30, len2: 36, group: 1 },

  // Right side (Front to Back)
  { side: 1, hipAngleOffset: 0.78,  hipDist: 10, restAngle: 0.82,  reach: 52, len1: 30, len2: 34, group: 1 },
  { side: 1, hipAngleOffset: 0.26,  hipDist: 9,  restAngle: 0.38,  reach: 48, len1: 28, len2: 32, group: 0 },
  { side: 1, hipAngleOffset: -0.26, hipDist: 9,  restAngle: -0.38, reach: 48, len1: 28, len2: 32, group: 1 },
  { side: 1, hipAngleOffset: -0.78, hipDist: 10, restAngle: -0.92, reach: 54, len1: 30, len2: 36, group: 0 },
]

// Step order for one-by-one foot placement when perching on text
const STEP_ORDER = [0, 4, 1, 5, 2, 6, 3, 7]

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
let scrollListener: (() => void) | null = null

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

    // Position initial perch above the first bio line
    const bioEl = container.querySelector('.about-bio') as HTMLElement | null
    if (bioEl) {
      const bioRect = bioEl.getBoundingClientRect()
      startX = bioRect.left - containerRect.left + 50
      startY = Math.max(45, bioRect.top - containerRect.top - 40)
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
  }

  setTimeout(refreshLandmarks, 150)
  setTimeout(refreshLandmarks, 600)
  setTimeout(refreshLandmarks, 1500)

  // ---------------------------------------------------------------------------
  // Target Foot Coordinates Directly ON the Words (No Unnatural Stretches!)
  // ---------------------------------------------------------------------------
  function getLandmarkFootTarget(lm: TextLandmark, legIndex: number): { x: number; y: number } {
    const b = lm.box
    // Comfortable span within natural leg reach (< 38px from center)
    const spanX = Math.min(36, b.width * 0.35)
    const innerX = Math.min(24, b.width * 0.22)

    switch (legIndex) {
      case 0: // Front-Left: top-left letters
        return { x: lm.x - innerX, y: b.top - 1 }
      case 4: // Front-Right: top-right letters
        return { x: lm.x + innerX, y: b.top - 1 }
      case 1: // Mid-Front-Left: middle-left letters
        return { x: lm.x - spanX, y: b.top + b.height * 0.38 }
      case 5: // Mid-Front-Right: middle-right letters
        return { x: lm.x + spanX, y: b.top + b.height * 0.38 }
      case 2: // Mid-Rear-Left: bottom-left letters
        return { x: lm.x - innerX, y: b.bottom + 1 }
      case 6: // Mid-Rear-Right: bottom-right letters
        return { x: lm.x + innerX, y: b.bottom + 1 }
      case 3: // Rear-Left: anchor behind-left
        return { x: lm.x - spanX * 0.95, y: b.bottom + 9 }
      case 7: // Rear-Right: anchor behind-right
        return { x: lm.x + spanX * 0.95, y: b.bottom + 9 }
      default:
        return { x: lm.x, y: lm.y }
    }
  }

  // ---------------------------------------------------------------------------
  // Spider Physics & Kinematic State
  // ---------------------------------------------------------------------------
  const spider = {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2, // Facing downward toward bio
    maxSpeed: 185, // px / sec
    activeGroup: 0 as 0 | 1,
    isMoving: false,
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

  // ---------------------------------------------------------------------------
  // Autonomous Looping Patrol & Scroll Synchronization
  // ---------------------------------------------------------------------------
  let currentMilestoneIndex = 0
  let milestoneDwellTime = 0
  let isReturningToPerch = false
  let lastUserScrollTime = 0

  scrollListener = () => {
    lastUserScrollTime = performance.now()
  }
  window.addEventListener('scroll', scrollListener, { passive: true })

  function getScrollFocusIndex(): number {
    if (!container || landmarks.length === 0) return -1
    const containerRect = container.getBoundingClientRect()
    const windowH = window.innerHeight

    if (containerRect.top > windowH * 0.65) return -1

    const viewportFocusY = windowH * 0.48 - containerRect.top

    let targetIdx = -1
    for (let i = 0; i < landmarks.length; i++) {
      if (viewportFocusY >= landmarks[i].y - 85) {
        targetIdx = i
      }
    }
    return targetIdx
  }

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
    spider.pedipalpPhase += dt * 7
    spider.idlePhase += dt * 2.5

    // 1. Determine Navigation Destination (Autonomous Loop or Scroll Tracking)
    const isUserScrolling = currentTime - lastUserScrollTime < 1300

    let destX = startX
    let destY = startY
    let targetLandmark: TextLandmark | null = null

    if (isUserScrolling) {
      // Direct scroll tracking mode
      const scrollIdx = getScrollFocusIndex()
      if (scrollIdx >= 0 && scrollIdx < landmarks.length) {
        currentMilestoneIndex = scrollIdx
        targetLandmark = landmarks[scrollIdx]
        destX = targetLandmark.x
        destY = targetLandmark.y
        isReturningToPerch = false
        milestoneDwellTime = 0
      } else {
        destX = startX
        destY = startY
      }
    } else {
      // Autonomous Loop Patrol mode
      if (isReturningToPerch) {
        destX = startX
        destY = startY
        const distToPerch = Math.hypot(startX - spider.x, startY - spider.y)
        if (distToPerch < 15) {
          milestoneDwellTime += dt
          if (milestoneDwellTime > 1.2) {
            // Reset web for clean fresh loop
            landmarks.forEach((lm) => {
              lm.isLanded = false
              lm.elements.forEach((el) => el.classList.remove(lm.highlightClass))
            })
            isReturningToPerch = false
            currentMilestoneIndex = 0
            milestoneDwellTime = 0
          }
        }
      } else if (landmarks.length > 0) {
        targetLandmark = landmarks[currentMilestoneIndex]
        destX = targetLandmark.x
        destY = targetLandmark.y

        const distToLandmark = Math.hypot(destX - spider.x, destY - spider.y)
        if (distToLandmark <= 10) {
          milestoneDwellTime += dt
          const targetDwell = currentMilestoneIndex === landmarks.length - 1 ? 2.4 : 1.8

          if (milestoneDwellTime >= targetDwell) {
            milestoneDwellTime = 0
            if (currentMilestoneIndex < landmarks.length - 1) {
              currentMilestoneIndex++
            } else {
              isReturningToPerch = true
            }
          }
        } else {
          milestoneDwellTime = 0
        }
      }
    }

    // Index visited landmarks
    landmarks.forEach((lm, idx) => {
      if (!isReturningToPerch && idx <= currentMilestoneIndex && !lm.isLanded) {
        lm.isLanded = true
        lm.landedAnimTime = 0

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
    })

    // 2. Smooth Steering & Movement (Arrive Behavior)
    const dx = destX - spider.x
    const dy = destY - spider.y
    const dist = Math.hypot(dx, dy)
    const isLandedOnTarget = targetLandmark !== null && dist <= 10

    if (dist > 6) {
      spider.isMoving = true
      const targetAngle = Math.atan2(dy, dx)
      const angleDiff = normalizeAngle(targetAngle - spider.angle)
      spider.angle += angleDiff * Math.min(dt * 7.5, 1)

      const speedFactor = clamp(dist / 38, 0.22, 1.0)
      const currentSpeed = spider.maxSpeed * speedFactor
      spider.vx = Math.cos(spider.angle) * currentSpeed
      spider.vy = Math.sin(spider.angle) * currentSpeed

      spider.x += spider.vx * dt
      spider.y += spider.vy * dt

      currentStatus.value = targetLandmark
        ? `Crawling to: ${targetLandmark.name}`
        : 'Loop complete · Returning to perch'
    } else {
      spider.isMoving = false
      spider.vx = 0
      spider.vy = 0
      spider.x = lerp(spider.x, destX, 0.2)
      spider.y = lerp(spider.y, destY, 0.2)

      currentStatus.value = targetLandmark
        ? `Landed on: ${targetLandmark.name}`
        : 'Standing by at perch'
    }

    // 3. Clean Kinematic Stepping (Gait while moving; One-by-One when landing on text)
    const activeColor = targetLandmark ? targetLandmark.themeColor : '#38bdf8'

    if (spider.isMoving) {
      // Alternating tetrapod gait while moving: NO stretching or trailing legs!
      const stepDuration = 0.11
      let groupNeedsStep = false

      LEG_DEFS.forEach((def, i) => {
        if (def.group === spider.activeGroup) {
          const hipX =
            spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
          const hipY =
            spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
          const idealAngle = spider.angle + def.restAngle * def.side
          const idealX = hipX + Math.cos(idealAngle) * def.reach
          const idealY = hipY + Math.sin(idealAngle) * def.reach

          const leg = legs[i]
          const footDist = Math.hypot(idealX - leg.currentFootX, idealY - leg.currentFootY)
          if (footDist > 16) {
            groupNeedsStep = true
          }
        }
      })

      if (groupNeedsStep) {
        LEG_DEFS.forEach((def, i) => {
          if (def.group === spider.activeGroup) {
            const leg = legs[i]
            if (!leg.isStepping) {
              const hipX =
                spider.x + Math.cos(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
              const hipY =
                spider.y + Math.sin(spider.angle + def.hipAngleOffset * def.side) * def.hipDist
              const idealAngle = spider.angle + def.restAngle * def.side
              const leadX = spider.vx * 0.14
              const leadY = spider.vy * 0.14

              leg.startFootX = leg.currentFootX
              leg.startFootY = leg.currentFootY
              leg.targetFootX = hipX + Math.cos(idealAngle) * def.reach + leadX
              leg.targetFootY = hipY + Math.sin(idealAngle) * def.reach + leadY
              leg.stepProgress = 0
              leg.isStepping = true
            }
          }
        })
      }

      let allGroupDone = true
      legs.forEach((leg) => {
        if (leg.isStepping) {
          leg.stepProgress += dt / stepDuration
          if (leg.stepProgress >= 1) {
            leg.stepProgress = 1
            leg.isStepping = false
            leg.currentFootX = leg.targetFootX
            leg.currentFootY = leg.targetFootY
          } else {
            allGroupDone = false
            const t = leg.stepProgress
            const smoothT = t * t * (3 - 2 * t)
            const lift = Math.sin(Math.PI * t) * 11
            leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, smoothT)
            leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, smoothT) - lift
          }
        }
      })

      if (allGroupDone && groupNeedsStep) {
        spider.activeGroup = spider.activeGroup === 0 ? 1 : 0
      }
    } else if (isLandedOnTarget && targetLandmark) {
      // Body is stationary over the word: legs place down ONE BY ONE onto the text!
      const stepDuration = 0.08
      let currentlyStepping = false

      for (let i = 0; i < legs.length; i++) {
        if (legs[i].isStepping) {
          currentlyStepping = true
          break
        }
      }

      if (!currentlyStepping) {
        for (let s = 0; s < STEP_ORDER.length; s++) {
          const i = STEP_ORDER[s]
          const leg = legs[i]
          const target = getLandmarkFootTarget(targetLandmark, i)
          const footDist = Math.hypot(target.x - leg.currentFootX, target.y - leg.currentFootY)

          if (footDist > 4) {
            leg.startFootX = leg.currentFootX
            leg.startFootY = leg.currentFootY
            leg.targetFootX = target.x
            leg.targetFootY = target.y
            leg.stepProgress = 0
            leg.isStepping = true
            break // Step ONE BY ONE!
          }
        }
      }

      legs.forEach((leg) => {
        if (leg.isStepping) {
          leg.stepProgress += dt / stepDuration
          if (leg.stepProgress >= 1) {
            leg.stepProgress = 1
            leg.isStepping = false
            leg.currentFootX = leg.targetFootX
            leg.currentFootY = leg.targetFootY

            // Micro laser ripple on the letter
            footRipples.push({
              x: leg.currentFootX,
              y: leg.currentFootY,
              radius: 1.5,
              maxRadius: 6,
              color: activeColor,
              alpha: 0.85,
            })
          } else {
            const t = leg.stepProgress
            const smoothT = t * t * (3 - 2 * t)
            const lift = Math.sin(Math.PI * t) * 8
            leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, smoothT)
            leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, smoothT) - lift
          }
        }
      })
    }

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

    // Render 8 Clean Legs with Outward Knee Arcs (NEVER stretched!)
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

      // Knee joint - crisp micro white node
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

      // Luminous targeting reticle under foot when landed on word
      if (isLandedOnTarget) {
        ctx.beginPath()
        ctx.arc(ik.footX, ik.footY, 3.6, 0, Math.PI * 2)
        ctx.strokeStyle = activeColor
        ctx.lineWidth = 0.9
        ctx.globalAlpha = 0.65
        ctx.stroke()
        ctx.globalAlpha = 1.0
      }
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

    // Pedipalps (front twitching sensory feelers)
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
    if (scrollListener) window.removeEventListener('scroll', scrollListener)
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
