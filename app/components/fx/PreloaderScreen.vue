<script setup lang="ts">
import gsap from 'gsap'
import { profile } from '~/data/site'

/**
 * The first thing a visitor sees.
 *
 * A loading screen has one honest job — cover the moment where fonts swap and
 * WebGL compiles — and one theatrical job: set the tone before any content
 * arrives. This does both:
 *
 *   1. A counter runs 000 -> 100 while real work happens in the background.
 *   2. The name rises out of a mask, letter by letter.
 *   3. On completion the panel breaks into vertical slats that sweep upward,
 *      revealing the hero already mid-animation underneath.
 *
 * HONEST PROGRESS
 * A counter that just runs on a timer is a lie. This one eases quickly to 90%,
 * then *waits* for the things that actually matter (fonts decoded, window load
 * fired) before completing. If the machine is fast it feels instant; if it is
 * slow, the bar genuinely reflects that.
 */

/** Flip to `false` if you want the intro on every single page refresh. */
const SHOW_ONCE_PER_SESSION = true

const { isReady, progress } = useAppReady()
const { stop, start } = useSmoothScroll()
const prefersReducedMotion = useReducedMotion()

const root = ref<HTMLElement | null>(null)
const counterEl = ref<HTMLElement | null>(null)
/** Local flag so we can unmount the DOM entirely once the intro is finished. */
const visible = ref(true)

/** How many vertical slats the panel breaks into on exit. */
const SLATS = 6

/** Waits for the browser to finish the work a visitor would actually notice. */
function waitForRealWork() {
  const jobs: Promise<unknown>[] = []

  // Custom fonts: if we reveal before these decode, every heading visibly
  // reflows from the fallback font. This is the single biggest cause of a
  // "cheap" first impression.
  if ('fonts' in document) jobs.push(document.fonts.ready)

  // Images, stylesheets, iframes.
  if (document.readyState !== 'complete') {
    jobs.push(new Promise((resolve) => window.addEventListener('load', resolve, { once: true })))
  }

  // Never hang forever on a flaky network — 4s and we move on regardless.
  const timeout = new Promise((resolve) => setTimeout(resolve, 4000))
  return Promise.race([Promise.all(jobs), timeout])
}

/** Tears down the intro and hands control to the page. */
function finish(instant = false) {
  document.documentElement.classList.remove('is-loading')
  start() // release the Lenis scroll lock
  isReady.value = true
  if (instant) visible.value = false
  if (SHOW_ONCE_PER_SESSION) sessionStorage.setItem('intro-seen', '1')
}

onMounted(async () => {
  // Someone arriving from an internal navigation has already watched this.
  const alreadySeen =
    SHOW_ONCE_PER_SESSION && sessionStorage.getItem('intro-seen') === '1'

  if (alreadySeen || prefersReducedMotion.value) {
    progress.value = 100
    finish(true)
    return
  }

  // Lock the page. Scrolling behind a fixed overlay makes ScrollTrigger measure
  // positions that are about to change, so we freeze until the reveal is done.
  document.documentElement.classList.add('is-loading')
  stop()

  // `counter` is a plain object. GSAP can tween any numeric property on any
  // object, not just DOM nodes — we then mirror the value into the template.
  const counter = { value: 0 }

  const tl = gsap.timeline()

  // --- 1. Intro: brand mark, then the name rising out of its mask ----------
  tl.from('.preloader-mark', { scale: 0.6, opacity: 0, duration: 0.5, ease: 'power3.out' })
    .from(
      '.preloader-name .split-char',
      { yPercent: 120, duration: 0.6, stagger: 0.03, ease: 'power4.out' },
      '-=0.3',
    )
    .from('.preloader-role', { opacity: 0, y: 14, duration: 0.4 }, '-=0.3')

  // --- 2. Counter races to 90, then waits for reality ----------------------
  tl.to(
    counter,
    {
      value: 90,
      duration: 0.7,
      ease: 'power2.inOut',
      onUpdate: () => {
        progress.value = counter.value
      },
    },
    0.1,
  )
  // The growing rule under the counter is driven by the same progress value.
  tl.to('.preloader-bar-fill', { scaleX: 0.9, duration: 0.7, ease: 'power2.inOut' }, 0.1)

  await tl.then() // wait for the timeline above to play out
  await waitForRealWork() // ...and for fonts/assets to genuinely be ready

  // --- 3. Complete the counter, then sweep the slats away ------------------
  const outro = gsap.timeline({
    onComplete: () => {
      visible.value = false
    },
  })

  outro
    .to(counter, {
      value: 100,
      duration: 0.3,
      ease: 'power2.out',
      onUpdate: () => {
        progress.value = counter.value
      },
    })
    .to('.preloader-bar-fill', { scaleX: 1, duration: 0.3, ease: 'power2.out' }, '<')
    // Text leaves first so the slats reveal a clean panel, not a half-empty one.
    .to(
      ['.preloader-name .split-char', '.preloader-role', '.preloader-counter', '.preloader-bar'],
      { yPercent: -110, opacity: 0, duration: 0.4, stagger: 0.01, ease: 'power3.in' },
      '+=0.08',
    )
    // The slats. `stagger` from the centre outwards reads as more deliberate
    // than a plain left-to-right sweep.
    .to(
      '.preloader-slat',
      {
        scaleY: 0,
        duration: 0.65,
        ease: 'power4.inOut',
        stagger: { each: 0.035, from: 'center' },
      },
      '-=0.2',
    )
    // Hand over to the page slightly BEFORE the slats finish, so the hero is
    // already moving as it is uncovered. Overlapping the two is what makes a
    // transition feel like one motion instead of two.
    .add(() => finish(), '-=0.4')
})

/** Formatted as 000, 047, 100 — a fixed width stops the layout from twitching. */
const displayValue = computed(() => String(Math.round(progress.value)).padStart(3, '0'))
</script>

<template>
  <!-- `visible` unmounts the whole overlay once finished, so it costs nothing
       afterwards and can never trap a click. -->
  <div
    v-if="visible"
    ref="root"
    class="fixed inset-0 z-100 flex items-center justify-center overflow-hidden"
    role="status"
    aria-live="polite"
    :aria-label="`Loading, ${displayValue} percent`"
  >
    <!-- The slats: absolutely positioned columns that make up the background.
         They animate scaleY -> 0 with `transform-origin: top` to sweep upward. -->
    <div class="absolute inset-0 flex" aria-hidden="true">
      <div
        v-for="n in SLATS"
        :key="n"
        class="preloader-slat bg-background h-full origin-top"
        :style="{ width: `${100 / SLATS}%` }"
      />
    </div>

    <!-- A soft gold glow so the panel is not a flat black rectangle. -->
    <div
      class="pointer-events-none absolute inset-0 opacity-60"
      aria-hidden="true"
      style="
        background: radial-gradient(
          ellipse 60% 50% at 50% 55%,
          color-mix(in oklch, var(--brand) 12%, transparent),
          transparent 70%
        );
      "
    />

    <!-- Centre content -->
    <div class="relative flex flex-col items-center gap-6 px-6 text-center">
      <!-- Rotating brand mark -->
      <div class="preloader-mark relative size-14">
        <div class="border-brand/30 absolute inset-0 rounded-full border" />
        <div
          class="border-t-brand absolute inset-0 animate-spin rounded-full border border-transparent"
          style="animation-duration: 1.4s"
        />
        <div class="bg-brand absolute inset-[42%] rounded-full" />
      </div>

      <SplitText
        :text="profile.name"
        as="h1"
        class="preloader-name font-serif text-6xl leading-[0.95] tracking-tight sm:text-7xl"
      />

      <p class="preloader-role text-muted-foreground font-mono text-[11px] tracking-[0.32em] uppercase">
        {{ profile.role }}
      </p>
    </div>

    <!-- Counter + progress rule, pinned to the bottom edge -->
    <div class="absolute inset-x-0 bottom-0 px-6 pb-8 sm:px-10">
      <div class="preloader-bar bg-border/60 relative h-px w-full overflow-hidden">
        <!-- scaleX is animated instead of width: transforms are composited on
             the GPU, width changes force a layout on every single frame. -->
        <div class="preloader-bar-fill bg-brand h-full w-full origin-left scale-x-0" />
      </div>
      <div class="mt-4 flex items-end justify-between">
        <span class="text-muted-foreground font-mono text-[10px] tracking-[0.3em] uppercase">
          Loading
        </span>
        <span
          ref="counterEl"
          class="preloader-counter font-mono text-5xl leading-none tabular-nums sm:text-6xl"
        >
          {{ displayValue }}
        </span>
      </div>
    </div>
  </div>
</template>
