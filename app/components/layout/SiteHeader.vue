<script setup lang="ts">
import { Menu, Search, X } from '@lucide/vue'
import { navLinks, profile } from '~/data/site'

/**
 * Fixed header that turns into a frosted glass bar once you scroll, and hides
 * itself when you scroll down / reappears when you scroll up.
 *
 * That hide-on-scroll behaviour is worth the effort: a permanently visible
 * header eats vertical space on a laptop, but one that vanishes forever is
 * annoying to get back. Reacting to scroll *direction* gives you both.
 */

const { progress, direction } = useScrollProgress()
const { handleAnchor, stop, start } = useSmoothScroll()

const mobileOpen = ref(false)
const paletteOpen = ref(false)

/** Past the first 6% of the page we switch from transparent to glass. */
const isScrolled = computed(() => progress.value > 0.02)

/**
 * Hide when scrolling down, but only once we are well past the hero — hiding
 * the header in the first 100px feels twitchy.
 */
const isHidden = computed(
  () => direction.value === 1 && progress.value > 0.08 && !mobileOpen.value,
)

/** Which nav item is currently in view, for the active underline. */
const activeSection = ref('')

onMounted(() => {
  // One IntersectionObserver watching all the sections is far cheaper than a
  // scroll handler measuring each one on every frame.
  const sections = navLinks
    .map((l) => document.getElementById(l.section))
    .filter(Boolean) as HTMLElement[]

  if (!sections.length) return

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) activeSection.value = entry.target.id
      }
    },
    // A band across the middle of the screen: a section counts as "active"
    // only while it occupies the centre, not the moment its top edge appears.
    { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
  )

  sections.forEach((s) => observer.observe(s))
  onUnmounted(() => observer.disconnect())
})

/** Anchor links need intercepting so Lenis handles the scroll, not the browser. */
function onNavClick(event: MouseEvent, to: string) {
  if (!to.includes('#')) return // a real route — let Nuxt handle it
  if (useRoute().path !== '/') return // not on the home page — let it navigate
  event.preventDefault()
  mobileOpen.value = false
  handleAnchor(to, -90)
}

// Lock background scrolling while the mobile menu is open, or the page slides
// around underneath the overlay.
watch(mobileOpen, (isOpen) => (isOpen ? stop() : start()))

// Close the menu on route change, otherwise it stays open over the new page.
watch(() => useRoute().fullPath, () => (mobileOpen.value = false))
</script>

<template>
  <header
    class="fixed inset-x-0 top-0 z-50 transition-transform duration-500"
    :class="isHidden ? '-translate-y-full' : 'translate-y-0'"
    style="transition-timing-function: var(--ease-out-expo)"
  >
    <div
      class="transition-all duration-500"
      :class="isScrolled ? 'glass border-b' : 'border-b border-transparent'"
    >
      <!-- `gutter` instead of px-5/sm:px-8/lg:px-12: identical spacing, but it
           also clears the notch when an iPhone is held in landscape, where the
           camera housing overlaps one end of the bar. -->
      <nav
        class="gutter mx-auto flex h-16 max-w-350 items-center justify-between"
        aria-label="Main"
      >
        <!-- ---------------------------------------------------------- logo -->
        <NuxtLink
          to="/"
          class="group flex items-center gap-2.5"
          data-cursor-label="Home"
          aria-label="Home"
        >
          <span class="relative flex size-7 items-center justify-center">
            <span class="border-brand/40 absolute inset-0 rounded-full border transition-transform duration-700 group-hover:rotate-180" />
            <span class="bg-brand size-1.5 rounded-full" />
          </span>
          <span class="font-serif text-lg leading-none tracking-tight">
            {{ profile.name }}
          </span>
        </NuxtLink>

        <!-- ------------------------------------------------- desktop links -->
        <ul class="hidden items-center gap-1 md:flex">
          <li v-for="link in navLinks" :key="link.to">
            <MagneticWrap :strength="0.25" :padding="10">
              <NuxtLink
                :to="link.to"
                class="relative block px-3 py-2 text-sm transition-colors"
                :class="
                  activeSection === link.section
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                "
                @click="onNavClick($event, link.to)"
              >
                {{ link.label }}
                <!-- Active underline. Scaling from 0 rather than toggling
                     visibility lets it animate in and out. -->
                <span
                  class="bg-brand absolute inset-x-3 -bottom-px h-px origin-left transition-transform duration-400"
                  :class="activeSection === link.section ? 'scale-x-100' : 'scale-x-0'"
                />
              </NuxtLink>
            </MagneticWrap>
          </li>
        </ul>

        <!-- ------------------------------------------------------- actions -->
        <div class="flex items-center gap-1.5 sm:gap-2">
          <!-- Command palette trigger. The ⌘K hint tells people the shortcut
               exists — a palette nobody knows about is wasted work. -->
          <Button
            variant="ghost"
            size="sm"
            class="text-muted-foreground hidden gap-2 rounded-full sm:flex"
            aria-label="Open command palette"
            data-cursor-label="Search"
            @click="paletteOpen = true"
          >
            <Search class="size-3.5" />
            <kbd class="border-border/60 bg-muted/50 rounded border px-1.5 py-0.5 font-mono text-[10px]">
              ⌘K
            </kbd>
          </Button>

          <ThemeToggle />

          <!-- Mobile menu button -->
          <!-- `tap-target` keeps the 36px look but gives the finger a 44px
               hit area on touch screens. See the utility in main.css. -->
          <Button
            variant="ghost"
            size="icon"
            class="tap-target rounded-full md:hidden"
            :aria-expanded="mobileOpen"
            aria-controls="mobile-menu"
            :aria-label="mobileOpen ? 'Close menu' : 'Open menu'"
            @click="mobileOpen = !mobileOpen"
          >
            <X v-if="mobileOpen" class="size-4" />
            <Menu v-else class="size-4" />
          </Button>
        </div>
      </nav>
    </div>

    <!-- ------------------------------------------------------ mobile menu -->
    <!--
      TELEPORTED TO <body>, AND IT HAS TO BE.

      `position: fixed` normally resolves against the viewport — except when an
      ancestor has a `transform`, `filter` or `will-change`. Any of those make
      that ancestor the containing block instead. This <header> animates with
      `translate-y` for its hide-on-scroll behaviour, so a fixed child inside it
      resolves `top-16 bottom-0` against the header's own 64px-tall box and
      collapses to roughly zero height.

      Teleport moves the element to the end of <body> in the real DOM while
      keeping it here in the template — so it still reads `mobileOpen` and the
      component's methods, but escapes the transformed ancestor.
    -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]"
        leave-active-class="transition-all duration-300 ease-in"
        enter-from-class="opacity-0 -translate-y-4"
        leave-to-class="opacity-0 -translate-y-4"
      >
        <!--
          NOT the `glass` utility here. Glass is only ~4% opaque — perfect for a
          slim bar floating over content, but a full-screen panel at that
          opacity leaves the page legible underneath and the menu unreadable.

          z-40 keeps it below the header (z-50) so the close button stays on top.
        -->
        <!--
          `overscroll-contain` matters on iOS: without it, scrolling to the end
          of this panel hands the gesture on to the page behind, which then
          scrolls under the overlay. The menu is meant to be a dead end.
        -->
        <div
          v-if="mobileOpen"
          id="mobile-menu"
          class="bg-background/98 fixed inset-x-0 top-16 bottom-0 z-40 overflow-y-auto overscroll-contain border-t backdrop-blur-2xl md:hidden"
        >
          <ul class="gutter flex flex-col gap-2 py-10">
            <li
              v-for="(link, i) in navLinks"
              :key="link.to"
              class="border-border/50 border-b"
            >
              <NuxtLink
                :to="link.to"
                class="flex items-baseline gap-4 py-5 font-serif text-4xl tracking-tight"
                @click="onNavClick($event, link.to)"
              >
                <span class="text-brand/60 font-mono text-xs">
                  {{ String(i + 1).padStart(2, '0') }}
                </span>
                {{ link.label }}
              </NuxtLink>
            </li>
          </ul>

          <!-- The one place the home indicator really bites: a full-width CTA
               pinned near the bottom of the screen ends up with the indicator
               bar sitting across it. `pb-safe` adds the inset on top of the
               2.5rem design padding, and resolves to just 2.5rem elsewhere. -->
          <div class="gutter pb-safe flex flex-col gap-3" style="--pb-safe: 2.5rem">
            <Button
              variant="brand"
              size="pill"
              class="w-full"
              as="a"
              :href="`mailto:${profile.email}`"
            >
              Start a project
            </Button>
          </div>
        </div>
      </Transition>
    </Teleport>

    <CommandPalette v-model:open="paletteOpen" />
  </header>
</template>
