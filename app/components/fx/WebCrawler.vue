<script setup lang="ts">
import { Play, Pause } from '@lucide/vue'

/**
 * Scroll-Driven "Web Crawler" Spider.
 *
 * Inspired by Slava Rybin's viral creative coding concept:
 * 1. The spider starts perched at the top of the "About me" section.
 * 2. As the user scrolls down, the crawler automatically crawls downwards from
 *    top to bottom through the bio text.
 * 3. Its legs specifically step onto and land on key important words (like
 *    "Computer Science", "front-end developer", "Vue, Nuxt, and React", "Roomie").
 * 4. When the text is landed on, it triggers a live visual reaction:
 *    - The word lights up in glowing brand gold with a text shadow.
 *    - An animated golden laser underline and cyber halo ripple across the word.
 *    - Floating golden micro-sparks emit from the letters.
 * 5. As the user continues scrolling, visited words remain illuminated,
 *    leaving a trail of highlighted achievements with a subtle silk web thread.
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

interface TextLandmark {
  id: string
  name: string
  words: string[]
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

interface WebPoint {
  x: number
  y: number
}

// 8 Leg definitions with realistic geometry
const LEG_DEFS: LegDef[] = [
  // Left side
  { side: -1, hipAngleOffset: -0.65, hipDist: 10, restAngle: -0.95, reach: 44, len1: 21, len2: 25, bendDirection: -1, group: 0 },
  { side: -1, hipAngleOffset: -0.25, hipDist: 9, restAngle: -0.4, reach: 38, len1: 18, len2: 22, bendDirection: -1, group: 1 },
  { side: -1, hipAngleOffset: 0.25, hipDist: 9, restAngle: 0.4, reach: 38, len1: 18, len2: 22, bendDirection: 1, group: 0 },
  { side: -1, hipAngleOffset: 0.65, hipDist: 10, restAngle: 1.05, reach: 46, len1: 22, len2: 26, bendDirection: 1, group: 1 },

  // Right side
  { side: 1, hipAngleOffset: 0.65, hipDist: 10, restAngle: 0.95, reach: 44, len1: 21, len2: 25, bendDirection: 1, group: 1 },
  { side: 1, hipAngleOffset: 0.25, hipDist: 9, restAngle: 0.4, reach: 38, len1: 18, len2: 22, bendDirection: 1, group: 0 },
  { side: 1, hipAngleOffset: -0.25, hipDist: 9, restAngle: -0.4, reach: 38, len1: 18, len2: 22, bendDirection: -1, group: 1 },
  { side: 1, hipAngleOffset: -0.65, hipDist: 10, restAngle: -1.05, reach: 46, len1: 22, len2: 26, bendDirection: -1, group: 0 },
]

// -----------------------------------------------------------------------------
// Component Execution
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

  // ---------------------------------------------------------------------------
  // Target Landmarks: Specific Important Words along the Bio
  // ---------------------------------------------------------------------------
  const LANDMARK_CONFIGS = [
    { id: 'cs', name: 'Computer Science', words: ['computer', 'science'], progress: 0.14 },
    { id: 'frontend', name: 'Front-end Developer', words: ['front-end', 'developer'], progress: 0.34 },
    { id: 'stack', name: 'Vue, Nuxt, React', words: ['vue', 'nuxt', 'react'], progress: 0.54 },
    { id: 'roomie', name: 'Roomie', words: ['roomie'], progress: 0.74 },
    { id: 'details', name: 'Details', words: ['details'], progress: 0.92 },
  ]

  let landmarks: TextLandmark[] = []
  let startX = width * 0.2
  let startY = 120

  function refreshLandmarks() {
    if (!container) return
    const containerRect = container.getBoundingClientRect()
    const allWordEls = Array.from(container.querySelectorAll<HTMLElement>('.about-bio .split-word'))

    // Initial position at top of About Me (above the first bio paragraph)
    const bioEl = container.querySelector('.about-bio') as HTMLElement | null
    if (bioEl) {
      const bioRect = bioEl.getBoundingClientRect()
      startX = bioRect.left - containerRect.left + 50
      startY = Math.max(60, bioRect.top - containerRect.top - 35)
    }

    const list: TextLandmark[] = []

    LANDMARK_CONFIGS.forEach((cfg) => {
      // Find matching word elements
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
          words: cfg.words,
          elements: matchedEls,
          x: (minLeft + maxRight) / 2,
          y: (minTop + maxBottom) / 2,
          box: {
            left: minLeft,
            right: maxRight,
            top: minTop,
            bottom: maxBottom,
            width: maxRight - minLeft,
            height: maxBottom - minTop,
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
  // Spider Initial State: Perched at the top of About Me
  // ---------------------------------------------------------------------------
  const spider = {
    x: startX,
    y: startY,
    vx: 0,
    vy: 0,
    angle: Math.PI / 2, // facing downwards toward the text
    activeGroup: 0 as 0 | 1,
    state: 'perched' as 'perched' | 'crawling' | 'landed',
    landedTimer: 0,
    speed: 3.2,
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
  const sparkles: Sparkle[] = []
  const silkWeb: WebPoint[] = [{ x: startX, y: startY }]

  // ---------------------------------------------------------------------------
  // Scroll Progress Calculation
  // ---------------------------------------------------------------------------
  function getScrollFraction(): number {
    if (!container) return 0
    const rect = container.getBoundingClientRect()
    const windowH = window.innerHeight

    // When top of #about enters upper view: 0.0
    // When bottom of bio reaches middle of view: 1.0
    const startY = windowH * 0.72
    const endY = windowH * 0.22
    const totalDist = rect.height * 0.65

    const dist = startY - rect.top
    return clamp(dist / Math.max(totalDist, 1), 0, 1)
  }

  // Visibility Tracking
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

    // 1. Determine Desired Destination based on Scroll Progress
    const scrollProg = getScrollFraction()

    let destX = startX
    let destY = startY
    let targetLandmark: TextLandmark | null = null

    // Find landmark corresponding to scroll progress
    if (landmarks.length > 0) {
      if (scrollProg < landmarks[0].scrollTriggerProgress) {
        // Still at top perch
        destX = startX
        destY = startY
        targetLandmark = null
      } else {
        // Find highest landmark whose threshold has been passed
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

    if (distToDest > 16) {
      spider.state = 'crawling'
      const desiredAngle = Math.atan2(dy, dx)
      const angleDiff = normalizeAngle(desiredAngle - spider.angle)
      spider.angle += angleDiff * Math.min(dt * 6.5, 1)

      const moveSpeed = spider.speed * 60 * dt
      spider.vx = Math.cos(spider.angle) * moveSpeed
      spider.vy = Math.sin(spider.angle) * moveSpeed
      spider.x += spider.vx
      spider.y += spider.vy

      currentStatus.value = targetLandmark
        ? `Crawling to: ${targetLandmark.name}`
        : 'Perched at top'
    } else {
      // Landed on the target!
      spider.vx = 0
      spider.vy = 0

      if (targetLandmark) {
        spider.state = 'landed'
        currentStatus.value = `Landed on: ${targetLandmark.name}`

        // Trigger landing effect on this landmark if not yet activated
        if (!targetLandmark.isLanded) {
          targetLandmark.isLanded = true
          targetLandmark.landedAnimTime = 0

          // Activate DOM elements (color highlight & glow)
          targetLandmark.elements.forEach((el) => {
            el.classList.add('crawler-landed')
          })

          // Trigger attention shockwave halo
          shockwaves.push({
            x: targetLandmark.x,
            y: targetLandmark.y,
            radius: 8,
            maxRadius: 55,
            alpha: 1,
          })

          // Emit golden cyber sparkles
          for (let s = 0; s < 10; s++) {
            const spAngle = Math.random() * Math.PI * 2
            const spSpeed = 20 + Math.random() * 45
            sparkles.push({
              x: targetLandmark.x + (Math.random() - 0.5) * targetLandmark.box.width,
              y: targetLandmark.box.bottom,
              vx: Math.cos(spAngle) * spSpeed,
              vy: -15 - Math.random() * 30,
              size: 1.4 + Math.random() * 2,
              alpha: 1,
              life: 0.7 + Math.random() * 0.5,
            })
          }

          // Add to silk web
          silkWeb.push({ x: targetLandmark.x, y: targetLandmark.y })
        }
      } else {
        spider.state = 'perched'
        currentStatus.value = 'Perched at top of bio'
      }
    }

    // Advance landing animation timer
    landmarks.forEach((lm) => {
      if (lm.isLanded) {
        lm.landedAnimTime += dt
      }
    })

    // 3. Procedural Leg Stepping (Alternating Tetrapod Gait)
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
      }
    })

    if (allCurrentGroupDone && isMoving && groupNeedsStep) {
      spider.activeGroup = spider.activeGroup === 0 ? 1 : 0
    }

    // -------------------------------------------------------------------------
    // Canvas Rendering
    // -------------------------------------------------------------------------
    ctx.clearRect(0, 0, width, height)

    // 1. Digital Silk Web connecting visited landmarks
    if (silkWeb.length > 1) {
      ctx.beginPath()
      ctx.moveTo(silkWeb[0].x, silkWeb[0].y)
      for (let i = 1; i < silkWeb.length; i++) {
        const xc = (silkWeb[i].x + silkWeb[i - 1].x) / 2
        const yc = (silkWeb[i].y + silkWeb[i - 1].y) / 2
        ctx.quadraticCurveTo(silkWeb[i - 1].x, silkWeb[i - 1].y, xc, yc)
      }
      ctx.lineTo(spider.x, spider.y)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.25)'
      ctx.lineWidth = 1.2
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
    }

    // 2. Landing Effects on Activated Words (Laser Underlines + Halos)
    landmarks.forEach((lm) => {
      if (lm.isLanded) {
        ctx.save()

        // Glowing golden laser underline below the word
        ctx.beginPath()
        ctx.moveTo(lm.box.left, lm.box.bottom + 2)
        ctx.lineTo(lm.box.right, lm.box.bottom + 2)
        ctx.strokeStyle = 'rgba(217, 160, 60, 0.85)'
        ctx.shadowColor = 'rgba(217, 160, 60, 0.6)'
        ctx.shadowBlur = 8
        ctx.lineWidth = 1.6
        ctx.stroke()

        // Tiny cyber tag indicator
        ctx.font = 'bold 9px ui-monospace, monospace'
        ctx.fillStyle = 'rgba(217, 160, 60, 0.9)'
        ctx.fillText(`[${lm.name.toUpperCase()}]`, lm.box.left, lm.box.top - 4)

        ctx.restore()
      }
    })

    // 3. Shockwave Pulses
    for (let i = shockwaves.length - 1; i >= 0; i--) {
      const sw = shockwaves[i]
      sw.radius += dt * 50
      sw.alpha -= dt * 1.4
      if (sw.alpha <= 0) {
        shockwaves.splice(i, 1)
        continue
      }
      ctx.beginPath()
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2)
      ctx.strokeStyle = `rgba(217, 160, 60, ${sw.alpha})`
      ctx.lineWidth = 1.6
      ctx.stroke()
    }

    // 4. Floating Golden Sparks
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
      ctx.fillStyle = `rgba(255, 220, 130, ${sp.alpha})`
      ctx.fill()
    }

    // 5. Spider Rendering (Shadow + Legs + Body + Glowing Core)
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
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

      // Femur
      ctx.beginPath()
      ctx.moveTo(hipX, hipY)
      ctx.lineTo(ik.kneeX, ik.kneeY)
      ctx.strokeStyle = 'rgba(217, 160, 60, 0.88)'
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
    ctx.translate(spider.x, spider.y)
    ctx.rotate(spider.angle)

    // Abdomen
    ctx.beginPath()
    ctx.ellipse(-8, 0, 9, 7, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(24, 25, 30)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.8)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Thorax
    ctx.beginPath()
    ctx.ellipse(4, 0, 7, 5.5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgb(18, 19, 23)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.9)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Glowing core
    ctx.beginPath()
    ctx.arc(-7, 0, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(217, 160, 60, 0.95)'
    ctx.fill()

    // Front feelers
    ctx.beginPath()
    ctx.moveTo(10, -2.5)
    ctx.lineTo(14, -4.5)
    ctx.moveTo(10, 2.5)
    ctx.lineTo(14, 4.5)
    ctx.strokeStyle = 'rgba(217, 160, 60, 0.8)'
    ctx.lineWidth = 1.2
    ctx.stroke()

    // Bright cyber eyes
    ctx.beginPath()
    ctx.arc(9, -2, 1.2, 0, Math.PI * 2)
    ctx.arc(9, 2, 1.2, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 235, 160, 1)'
    ctx.fill()

    ctx.restore()
  }

  animFrameId = requestAnimationFrame(loop)

  onUnmounted(() => {
    if (animFrameId) cancelAnimationFrame(animFrameId)
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    // Clean up any added classes
    landmarks.forEach((lm) => {
      lm.elements.forEach((el) => el.classList.remove('crawler-landed'))
    })
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
