<script setup lang="ts">
import gsap from 'gsap'
import { Check, Download, Eye, FileText } from '@lucide/vue'
import { toast } from 'vue-sonner'
import { profile, socials } from '~/data/site'

/**
 * About.
 *
 * The headline effect here is scroll-driven text illumination: the paragraph
 * starts dim and each word brightens as it passes the middle of the screen.
 *
 * HOW IT WORKS
 * `scrub: true` binds the animation's playhead directly to the scrollbar
 * instead of playing it on a timer. Combined with a `stagger`, the words light
 * up in sequence — the visitor is literally scrubbing through the animation,
 * so reading and scrolling become the same gesture.
 */

const root = ref<HTMLElement | null>(null)
const reduced = useReducedMotion()

const isDownloaded = ref(false)
let downloadTimer: ReturnType<typeof setTimeout> | undefined

function handleDownload() {
  isDownloaded.value = true
  toast.success('Downloading Curriculum Vitae', {
    description: 'SROS Songha.pdf · 337 KB',
  })
  if (downloadTimer) clearTimeout(downloadTimer)
  downloadTimer = setTimeout(() => {
    isDownloaded.value = false
  }, 2800)
}

onUnmounted(() => {
  if (downloadTimer) clearTimeout(downloadTimer)
})

/** The three short statements beside the portrait. */
const principles = [
  { title: 'Ship it', body: 'A working thing today beats a perfect thing I never finish.' },
  { title: 'Feel the frame', body: 'If it stutters on a cheap phone, it is not done.' },
  { title: 'Ask early', body: 'Two hours stuck alone is worse than one question.'},
  { title: 'Leave notes', body: 'Nobody clears the dungeon twice without a map.' },
]

useGsapContext(root, () => {
  if (reduced.value) return

  // Each word of the bio brightens as it crosses the middle of the viewport.
  gsap.fromTo(
    '.about-bio .split-word',
    { opacity: 0.85 },
    {
      opacity: 1,
      ease: 'none',
      stagger: 0.4, // relative weighting between words, not seconds — scrub scales it
      scrollTrigger: {
        trigger: '.about-bio',
        // Start when the paragraph's top hits 85% down the screen, finish when
        // its bottom reaches the middle.
        start: 'top 85%',
        end: 'bottom 55%',
        scrub: true,
      },
    },
  )

  // The vertical rule beside the portrait draws itself as you arrive.
  gsap.from('.about-rule', {
    scaleY: 0,
    transformOrigin: 'top',
    duration: 1.4,
    ease: 'power3.inOut',
    scrollTrigger: { trigger: '.about-rule', start: 'top 85%' },
  })
})
</script>

<template>
  <section id="about" ref="root" class="relative overflow-hidden py-28 sm:py-36 lg:py-44">
    <div class="mx-auto max-w-350 px-5 sm:px-8 lg:px-12">
      <SectionHeading
        index="01"
        label="About me"
        title="Engineer by trade,"
        accent="obsessive by habit."
      />

      <div class="mt-16 grid gap-14 lg:mt-24 lg:grid-cols-12 lg:gap-16">
        <!-- ------------------------------------------------- bio column -->
        <div class="lg:col-span-7">
          <!-- Words mode: we only need per-word targets, not per-letter. Using
               chars here would create ~700 spans for no visual benefit. -->
          <div class="about-bio space-y-6">
            <SplitText
              v-for="(paragraph, i) in profile.bio"
              :key="i"
              :text="paragraph"
              as="p"
              type="words"
              :masked="false"
              class="text-[clamp(1.05rem,2vw,1.4rem)] leading-[1.65]"
            />
          </div>

          <!-- CV Download card & actions with dedicated Web Crawler -->
          <div
            class="about-cv-card relative border-border/70 bg-card/40 hover:border-brand/40 mt-12 rounded-2xl border p-5 backdrop-blur-md transition-all sm:p-6"
          >
            <!-- Web Crawler animation focused exclusively on the CV download -->
            <WebCrawler container-selector=".about-cv-card" />

            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div class="flex items-center gap-3.5">
                <div class="bg-brand/10 border-brand/20 text-brand flex size-11 shrink-0 items-center justify-center rounded-xl border">
                  <FileText class="size-5" />
                </div>
                <div>
                  <div class="flex flex-wrap items-center gap-2">
                    <span class="font-serif text-base font-medium text-foreground sm:text-lg">Curriculum Vitae</span>
                    <span class="border-brand/30 bg-brand/10 text-brand rounded-full border px-2 py-0.5 font-mono text-[10px] font-semibold tracking-wider uppercase">
                      PDF · 337 KB
                    </span>
                  </div>
                  <p class="text-muted-foreground mt-0.5 text-xs">
                    Skills, work experience, and educational background.
                  </p>
                </div>
              </div>

              <div class="flex items-center gap-2.5">
                <a
                  :href="profile.cvUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="border-border/70 hover:border-brand/50 hover:text-foreground text-muted-foreground inline-flex h-10 items-center gap-1.5 rounded-full border px-3.5 font-mono text-xs transition-colors"
                  data-cursor-label="Preview"
                  aria-label="Preview Sros Songha's CV in browser"
                >
                  <Eye class="size-3.5" />
                  <span>Preview</span>
                </a>

                <MagneticWrap :strength="0.3">
                  <Button
                    variant="brand"
                    size="sm"
                    as="a"
                    :href="profile.cvUrl"
                    download="SROS Songha.pdf"
                    target="_blank"
                    class="h-10 gap-2 rounded-full px-5 font-medium shadow-sm transition-all"
                    :data-cursor-label="isDownloaded ? 'Saved!' : 'Download'"
                    aria-label="Download Sros Songha's Curriculum Vitae (PDF)"
                    @click="handleDownload"
                  >
                    <component
                      :is="isDownloaded ? Check : Download"
                      class="size-4 transition-transform duration-300"
                      :class="{ 'scale-110': isDownloaded }"
                    />
                    <span>{{ isDownloaded ? 'Downloaded!' : 'Download CV' }}</span>
                  </Button>
                </MagneticWrap>
              </div>
            </div>
          </div>

          <!-- Social links -->
          <RevealOnScroll :stagger="0.08" class="mt-8 flex flex-wrap gap-2.5">
            <a
              v-for="social in socials"
              :key="social.href"
              :href="social.href"
              :target="social.href.startsWith('http') ? '_blank' : undefined"
              rel="noopener noreferrer"
              class="group border-border hover:border-brand/50 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors"
              :data-cursor-label="social.label"
            >
              <span class="bg-brand/60 group-hover:bg-brand size-1.5 rounded-full transition-colors" />
              {{ social.label }}
              <span class="text-muted-foreground font-mono text-xs">{{ social.handle }}</span>
            </a>
          </RevealOnScroll>
        </div>

        <!-- --------------------------------------------- portrait column -->
        <div class="lg:col-span-5">
          <div class="flex gap-6">
            <!-- The drawing rule -->
            <div class="about-rule bg-linear-to-b from-brand via-brand/40 to-transparent hidden w-px shrink-0 sm:block" />

            <div class="flex-1">
              <!-- Portrait -->
              <TiltCard :max="7" :lift="18" radius="rounded-2xl" class="mb-10">
                <div class="border-border/60 relative aspect-4/5 overflow-hidden rounded-2xl border">
                  <img
                    src="/images/profile.jpeg"
                    :alt="profile.name"
                    class="absolute inset-0 size-full object-cover"
                  />

                  <!-- Scrim so the name plate stays legible over the photo -->
                  <div
                    class="absolute inset-0"
                    style="background: linear-gradient(to top, rgba(0, 0, 0, 0.75), transparent 45%)"
                  />

                  <!-- Name plate -->
                  <div class="absolute inset-x-0 bottom-0 p-6">
                    <p class="font-serif text-3xl tracking-tight text-white">{{ profile.name }}</p>
                    <p class="mt-1 font-mono text-[10px] tracking-[0.25em] text-white/70 uppercase">
                      {{ profile.role }}
                    </p>
                  </div>
                </div>
              </TiltCard>

              <!-- Principles -->
              <RevealOnScroll :stagger="0.1" class="space-y-6">
                <div v-for="principle in principles" :key="principle.title">
                  <h3 class="font-mono text-[11px] tracking-[0.25em] uppercase">
                    <span class="text-brand">→ </span>{{ principle.title }}
                  </h3>
                  <p class="text-muted-foreground mt-2 text-sm leading-relaxed">
                    {{ principle.body }}
                  </p>
                </div>
              </RevealOnScroll>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
