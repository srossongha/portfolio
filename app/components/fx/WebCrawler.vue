<script setup lang="ts">
import { Play, Pause } from '@lucide/vue'

/**
 * Scroll-Driven "Literal Web Crawler" Spider.
 *
 * Inspired by Slava Rybin's viral creative coding concept:
 * 1. The spider starts perched at the top of the "About me" section.
 * 2. As the user scrolls down, the crawler automatically crawls downwards from
 *    top to bottom through the bio text.
 * 3. Its long, spindly legs specifically step onto and land on key important words:
 *    - "Computer Science" (Cyan OCR box)
 *    - "front-end developer" (Brand Gold OCR box)
 *    - "Vue, Nuxt, and React" (Purple OCR box)
 *    - "Roomie" (Emerald OCR box)
 *    - "details" (Rose OCR box)
 * 4. When a word is reached, it triggers the viral indexing effect:
 *    - The word lights up with a glowing bounding box highlight and colored border.
 *    - High-tech corner reticles [ ] and node tags appear.
 *    - An expanding shockwave ring and cyber sparks emit from the letters.
 * 5. A persistent geometric web graph connects visited words into an interconnected
 *    data web, with active silk strands attached to the spider's spinneret.
 */

interface Props {
  containerSelector?: string
}

const props = withDefaults(defineProps<Props>(), {
  containerSelector: '#about',
})

const canvasRef = ref<HTMLCanvasElement | null>(null)
const isPaused = ref(false)
const currentStatus = ref('Scroll to guide crawler')
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
 * 2-bone Inverse Kinematics with high arcing knees.
 */
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

interface TextLandmark {
  id: string
  name: string
  tag: string
  words: string[]
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
  scrollTriggerProgress: number
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

interface WebEdge {
  fromX: number
  fromY: number
  toX: number
  toY: number
  color: string
}

// 8 Spindly, long arachnid legs spanning across text lines
const LEG_DEFS: LegDef[] = [
  // Left side (Front to Back)
  { side: -1, hipAngleOffset: -0.85, hipDist: 11, restAngle: -0.92, reach: 82, len1: 38, len2: 46, bendDirection: -1, group: 0 },
  { side: -1, hipAngleOffset: -0.32, hipDist: 10, restAngle: -0.44, reach: 72, len1: 34, len2: 40, bendDirection: -1, group: 1 },
  { side: -1, hipAngleOffset: 0.32, hipDist: 10, restAngle: 0.44, reach: 72, len1: 34, len2: 40, bendDirection: 1, group: 0 },
  { side: -1, hipAngleOffset: 0.85, hipDist: 11, restAngle: 1.05, reach: 86, len1: 40, len2: 48, bendDirection: 1, group: 1 },

  // Right side (Front to Back)
  { side: 1, hipAngleOffset: 0.85, hipDist: 11, restAngle: 0.92, reach: 82, len1: 38, len2: 46, bendDirection: 1, group: 1 },
  { side: 1, hipAngleOffset: 0.32, hipDist: 10, restAngle: 0.44, reach: 72, len1: 34, len2: 40, bendDirection: 1, group: 0 },
  { side: 1, hipAngleOffset: -0.32, hipDist: 10, restAngle: -0.44, reach: 72, len1: 34, len2: 40, bendDirection: -1, group: 1 },
  { side: 1, hipAngleOffset: -0.85, hipDist: 11, restAngle: -1.05, reach: 86, len1: 40, len2: 48, bendDirection: -1, group: 0 },
]

// Landmarks with distinctive colors matching the screenshot
const LANDMARK_CONFIGS = [
  {
    id: 'cs',
    name: 'Computer Science',
    tag: 'NODE_01 // CS',
    words: ['computer', 'science'],
    highlightClass: 'crawler-highlight-cyan',
    themeColor: '#38bdf8',
    progress: 0.14,
  },
  {
    id: 'frontend',
    name: 'Front-end Developer',
    tag: 'NODE_02 // FE_DEV',
    words: ['front-end', 'developer'],
    highlightClass: 'crawler-highlight-gold',
    themeColor: '#facc15',
    progress: 0.35,
  },
  {
    id: 'stack',
    name: 'Vue, Nuxt, React',
    tag: 'NODE_03 // CORE_STACK',
    words: ['vue', 'nuxt', 'react'],
    highlightClass: 'crawler-highlight-purple',
    themeColor: '#c084fc',
    progress: 0.55,
  },
  {
    id: 'roomie',
    name: 'Roomie (ស្រុកខ្ញុំ)',
    tag: 'NODE_04 // ROOMIE',
    words: ['roomie'],
    highlightClass: 'crawler-highlight-emerald',
    themeColor: '#34d399',
    progress: 0.75,
  },
  {
    id: 'details',
    name: 'Craft & Details',
    tag: 'NODE_05 // DETAILS',
    words: ['details'],
    highlightClass: 'crawler-highlight-rose',
    themeColor: '#fb7185',
    progress: 0.92,
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
    refreshLandmarks()
  }

  resizeObserver = new ResizeObserver(() => updateSize())
  resizeObserver.observe(container)

  let landmarks: TextLandmark[] = []
  let startX = width * 0.22
  let startY = 110

  function refreshLandmarks() {
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const allWordEls = Array.from(container.querySelectorAll<HTMLElement>('.about-bio .split-word'))

    // Initial position at top of About Me (above the first bio paragraph)
    const bioEl = container.querySelector('.about-bio') as HTMLElement | null
    if (bioEl) {
      const bioRect = bioEl.getBoundingClientRect()
      startX = bioRect.left - containerRect.left + 50
      startY = Math.max(50, bioRect.top - containerRect.top - 42)
    }

    const list: TextLandmark[] = []

    LANDMARK_CONFIGS.forEach((cfg) => {
      const matchedEls: HTMLElement[] = []
      cfg.words.forEach((q) => {
        const found = allWordEls.filter((w) =>
          w.textContent?.trim().toLowerCase().includes(q.toLowerCase()),
        )
        found.forEach((el) => {
          if (!matchedEls.includes(el)) matchedEls.push(el)
        })
      })

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

        list.push({
          id: cfg.id,
          name: cfg.name,
          tag: cfg.tag,
          words: cfg.words,
          highlightClass: cfg.highlightClass,
          themeColor: cfg.themeColor,
          elements: matchedEls,
          x: (minLeft + maxRight) / 2,
          y: (minTop + maxBottom) / 2,
          box: {
            left: minLeft - 3,
            right: maxRight + 3,
            top: minTop - 2,
            bottom: maxBottom + 2,
            width: maxRight - minLeft + 6,
            height: maxBottom - minTop + 4,
          },
          scrollTriggerProgress: cfg.progress,
          isLanded: false,
          landedAnimTime: 0,
        })
      }
    })

    landmarks = list
  }

  setTimeout(refreshLandmarks, 300)
  setTimeout(refreshLandmarks, 1200)

  // ---------------------------------------------------------------------------
  // Spider Initial State: Perched at top of About Me
  // ---------------------------------------------------------------------------
  const spider = {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2, // Facing downwards towards bio
    activeGroup: 0 as 0 | 1,
    state: 'perched' as 'perched' | 'crawling' | 'landed',
    speed: 3.4,
    pedipalpPhase: 0,
  }

  // Initialize 8 legs
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
  const sparkles: Sparkle[] = []
  const webEdges: WebEdge[] = []
  const visitedLandmarks: TextLandmark[] = []

  // ---------------------------------------------------------------------------
  // Scroll Progress Calculation
  // ---------------------------------------------------------------------------
  function getScrollFraction(): number {
    if (!container) return 0
    const rect = container.getBoundingClientRect()
    const windowH = window.innerHeight

    // Starts when top of #about is well inside viewport
    const startY = windowH * 0.72
    const totalDist = rect.height * 0.62
    const dist = startY - rect.top
    return clamp(dist / Math.max(totalDist, 1), 0, 1)
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
    spider.pedipalpPhase += dt * 6

    // 1. Determine Target Destination based on Scroll Fraction
    const scrollProg = getScrollFraction()

    let destX = startX
    let destY = startY
    let targetLandmark: TextLandmark | null = null

    if (landmarks.length > 0) {
      if (scrollProg < landmarks[0].scrollTriggerProgress) {
        // Top perch
        destX = startX
        destY = startY
        targetLandmark = null
      } else {
        // Find highest landmark passed
        for (let i = landmarks.length - 1; i >= 0; i--) {
          if (scrollProg >= landmarks[i].scrollTriggerProgress) {
            targetLandmark = landmarks[i]
            destX = targetLandmark.x
            destY = targetLandmark.y
            break
          }
        }
      }
    }

    // 2. Spider Navigation & Crawling
    const dx = destX - spider.x
    const dy = destY - spider.y
    const distToDest = Math.hypot(dx, dy)

    if (distToDest > 18) {
      spider.state = 'crawling'
      const desiredAngle = Math.atan2(dy, dx)
      const angleDiff = normalizeAngle(desiredAngle - spider.angle)
      spider.angle += angleDiff * Math.min(dt * 7.5, 1)

      const moveSpeed = spider.speed * 60 * dt
      spider.vx = Math.cos(spider.angle) * moveSpeed
      spider.vy = Math.sin(spider.angle) * moveSpeed
      spider.x += spider.vx
      spider.y += spider.vy

      currentStatus.value = targetLandmark
        ? `Crawling to: ${targetLandmark.name}`
        : 'Perched at top'
    } else {
      spider.vx = 0
      spider.vy = 0

      if (targetLandmark) {
        spider.state = 'landed'
        currentStatus.value = `Indexing: ${targetLandmark.name}`

        // Trigger landmark activation
        if (!targetLandmark.isLanded) {
          targetLandmark.isLanded = true
          targetLandmark.landedAnimTime = 0

          // Apply multi-color highlight class matching the viral video
          targetLandmark.elements.forEach((el) => {
            el.classList.add(targetLandmark!.highlightClass)
          })

          // Add to visited nodes list
          if (!visitedLandmarks.includes(targetLandmark)) {
            // Create web lines from previous visited landmarks to this one
            if (visitedLandmarks.length > 0) {
              const prev = visitedLandmarks[visitedLandmarks.length - 1]
              webEdges.push({
                fromX: prev.x,
                fromY: prev.y,
                toX: targetLandmark.x,
                toY: targetLandmark.y,
                color: targetLandmark.themeColor,
              })
              // Cross-connection for mesh aesthetic
              if (visitedLandmarks.length > 1) {
                const first = visitedLandmarks[0]
                webEdges.push({
                  fromX: first.x,
                  fromY: first.y,
                  toX: targetLandmark.x,
                  toY: targetLandmark.y,
                  color: 'rgba(255, 255, 255, 0.25)',
                })
              }
            } else {
              // Connect initial web line from perch
              webEdges.push({
                fromX: startX,
                fromY: startY,
                toX: targetLandmark.x,
                toY: targetLandmark.y,
                color: targetLandmark.themeColor,
              })
            }
            visitedLandmarks.push(targetLandmark)
          }

          // Trigger shockwave ring
          shockwaves.push({
            x: targetLandmark.x,
            y: targetLandmark.y,
            radius: 8,
            maxRadius: 65,
            color: targetLandmark.themeColor,
            alpha: 1,
          })

          // Emit sparks
          for (let s = 0; s < 12; s++) {
            const spAngle = Math.random() * Math.PI * 2
            const spSpeed = 25 + Math.random() * 55
            sparkles.push({
              x: targetLandmark.x + (Math.random() - 0.5) * targetLandmark.box.width,
              y: targetLandmark.box.bottom,
              vx: Math.cos(spAngle) * spSpeed,
              vy: -20 - Math.random() * 35,
              size: 1.5 + Math.random() * 2,
              color: targetLandmark.themeColor,
              alpha: 1,
              life: 0.65 + Math.random() * 0.45,
            })
          }
        }
      } else {
        spider.state = 'perched'
        currentStatus.value = 'Perched at top'
      }
    }

    landmarks.forEach((lm) => {
      if (lm.isLanded) lm.landedAnimTime += dt
    })

    // 3. Leg Stepping Simulation (Alternating Tetrapod Gait)
    const isMoving = spider.state === 'crawling'
    const stepDuration = 0.12

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

            const leadX = spider.vx * 6.5
            const leadY = spider.vy * 6.5
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
    legs.forEach((leg) => {
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
          // High arcing step lift
          const lift = Math.sin(Math.PI * t) * 16
          leg.currentFootX = lerp(leg.startFootX, leg.targetFootX, t)
          leg.currentFootY = lerp(leg.startFootY, leg.targetFootY, t) - lift
        }
      }
    })

    if (allCurrentGroupDone && isMoving && groupNeedsStep) {
      spider.activeGroup = spider.activeGroup === 0 ? 1 : 0
    }

    // -------------------------------------------------------------------------
    // Canvas Rendering
    // -------------------------------------------------------------------------
    ctx.clearRect(0, 0, width, height)

    // 1. Digital Geometric Web Graph (criss-crossing lines between visited words)
    if (webEdges.length > 0) {
      ctx.save()
      webEdges.forEach((edge) => {
        ctx.beginPath()
        ctx.moveTo(edge.fromX, edge.fromY)
        ctx.lineTo(edge.toX, edge.toY)
        ctx.strokeStyle = edge.color
        ctx.lineWidth = 1.0
        ctx.setLineDash([4, 4])
        ctx.globalAlpha = 0.45
        ctx.stroke()

        // Web intersection nodes
        ctx.beginPath()
        ctx.arc((edge.fromX + edge.toX) / 2, (edge.fromY + edge.toY) / 2, 2, 0, Math.PI * 2)
        ctx.fillStyle = edge.color
        ctx.globalAlpha = 0.6
        ctx.fill()
      })

      // Active silk thread from spider's spinneret to closest visited landmark
      if (visitedLandmarks.length > 0) {
        const lastLanded = visitedLandmarks[visitedLandmarks.length - 1]
        ctx.beginPath()
        ctx.moveTo(spider.x - Math.cos(spider.angle) * 12, spider.y - Math.sin(spider.angle) * 12)
        ctx.lineTo(lastLanded.x, lastLanded.y)
        ctx.strokeStyle = lastLanded.themeColor
        ctx.lineWidth = 1.4
        ctx.setLineDash([3, 2])
        ctx.globalAlpha = 0.7
        ctx.stroke()
      }
      ctx.restore()
    }

    // 2. High-Tech OCR Corner Reticles & Tags on Visited Landmarks
    landmarks.forEach((lm) => {
      if (lm.isLanded) {
        ctx.save()
        const b = lm.box
        const cornerLen = 7

        // Corner brackets: ┌ ┐ └ ┘
        ctx.strokeStyle = lm.themeColor
        ctx.lineWidth = 1.5
        ctx.shadowColor = lm.themeColor
        ctx.shadowBlur = 6

        // Top-left
        ctx.beginPath()
        ctx.moveTo(b.left, b.top + cornerLen)
        ctx.lineTo(b.left, b.top)
        ctx.lineTo(b.left + cornerLen, b.top)
        ctx.stroke()

        // Top-right
        ctx.beginPath()
        ctx.moveTo(b.right - cornerLen, b.top)
        ctx.lineTo(b.right, b.top)
        ctx.lineTo(b.right, b.top + cornerLen)
        ctx.stroke()

        // Bottom-left
        ctx.beginPath()
        ctx.moveTo(b.left, b.bottom - cornerLen)
        ctx.lineTo(b.left, b.bottom)
        ctx.lineTo(b.left + cornerLen, b.bottom)
        ctx.stroke()

        // Bottom-right
        ctx.beginPath()
        ctx.moveTo(b.right - cornerLen, b.bottom)
        ctx.lineTo(b.right, b.bottom)
        ctx.lineTo(b.right, b.bottom - cornerLen)
        ctx.stroke()

        // Tech tag above box
        ctx.font = '600 9px ui-monospace, SFMono-Regular, Menlo, monospace'
        ctx.fillStyle = lm.themeColor
        ctx.shadowBlur = 4
        ctx.fillText(`[${lm.tag}]`, b.left, b.top - 5)

        ctx.restore()
      }
    })

    // 3. Shockwave Pulses
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i]
      sw.radius += dt * 65
      sw.alpha -= dt * 1.5
      if (sw.alpha <= 0) {
        shockwaves.splice(i, 1)
        continue
      }
      ctx.save()
      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
      ctx.strokeStyle = sw.color
      ctx.globalAlpha = sw.alpha
      ctx.lineWidth = 1.8
      ctx.shadowColor = sw.color
      ctx.shadowBlur = 8
      ctx.stroke()
      ctx.restore()
    }

    // 4. Floating Cyber Sparks
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

    // 5. Spider Rendering (Shadow + Long Spindly Legs + Carapace + Core)
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.55)'
    ctx.shadowBlur = 10
    ctx.shadowOffsetY = 4

    // Render 8 Spindly Legs with High Arcing Knees
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

      // Femur (upper leg segment)
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(ik.kneeX, ik.kneeY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.92)'
      ctx.lineWidth = 2.4
      ctx.lineCap = 'round'
      ctx.stroke()

      // Tibia (lower leg segment, long & tapered)
      ctx.beginPath()
      ctx.moveTo(ik.kneeX, ik.kneeY)
      ctx.lineTo(ik.footX, ik.footY)
      ctx.strokeStyle = 'rgba(240, 200, 100, 0.96)'
      ctx.lineWidth = 1.4
      ctx.stroke()

      // Knee joint pin
      ctx.beginPath()
      ctx.arc(ik.kneeX, ik.kneeY, 2.2, 0, Math.PI * 2)
      ctx.fillStyle = '#fef08a'
      ctx.fill()

      // Foot contact tip
      ctx.beginPath()
      ctx.arc(ik.footX, ik.footY, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#38bdf8'
      ctx.fill()
    })

    // Render Spider Body
    ctx.translate(spider.x, spider.y)
    ctx.rotate(spider.angle)

    // Abdomen (rear)
    ctx.beginPath()
    ctx.ellipse(-10, 0, 11, 8, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#11141b'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.85)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Cephalothorax (front)
    ctx.beginPath()
    ctx.ellipse(5, 0, 8, 6.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = '#090b0e'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.95)'
    ctx.lineWidth = 1.6
    ctx.stroke()

    // Glowing core reactor
    ctx.beginPath()
    ctx.arc(-8, 0, 2.6, 0, Math.PI * 2)
    ctx.fillStyle = '#38bdf8'
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 8
    ctx.fill()

    // Pedipalps (front twitching feelers)
    const palpTwitch = Math.sin(spider.pedipalpPhase) * 1.5
    ctx.beginPath()
    ctx.moveTo(12, -3)
    ctx.lineTo(17 + palpTwitch, -5)
    ctx.moveTo(12, 3)
    ctx.lineTo(17 - palpTwitch, 5)
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.85)'
    ctx.lineWidth = 1.4
    ctx.stroke()

    // Cyber eye cluster (4 glowing eyes)
    ctx.fillStyle = '#38bdf8'
    ctx.shadowColor = '#38bdf8'
    ctx.shadowBlur = 4
    ctx.beginPath()
    ctx.arc(11, -2.5, 1.2, 0, Math.PI * 2)
    ctx.arc(11, 2.5, 1.2, 0, Math.PI * 2)
    ctx.arc(12.5, -1, 1.0, 0, Math.PI * 2)
    ctx.arc(12.5, 1, 1.0, 0, Math.PI * 2)
    ctx.fill()

    ctx.restore()
  }

  animFrameId = requestAnimationFrame(loop)

  onUnmounted(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    // Clean up all highlight classes from bio words
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
