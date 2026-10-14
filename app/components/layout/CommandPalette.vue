<script setup lang="ts">
import {
  ArrowUpRight,
  Beaker,
  FileText,
  Home,
  Mail,
  Moon,
  Sun,
  User,
} from '@lucide/vue'
import type { Component } from 'vue'
import { navLinks, profile, projects, socials } from '~/data/site'

/**
 * A ⌘K command palette — the keyboard-first navigation power users expect.
 *
 * Built from shadcn's Command components, which wrap reka-ui's listbox
 * primitives. That means focus management, type-ahead filtering, arrow-key
 * navigation and the correct ARIA roles all come for free. Building this from
 * scratch and getting the accessibility right is a genuinely hard afternoon.
 *
 * The parent controls visibility through `v-model:open`, and the global
 * keyboard shortcut is registered here so it works from anywhere on the page.
 */

const open = defineModel<boolean>('open', { default: false })

const router = useRouter()
const colorMode = useColorMode()
const { scrollTo } = useSmoothScroll()

/**
 * VueUse's `useMagicKeys` gives a reactive object of currently-pressed keys,
 * including sensible combos. `Meta_K` is ⌘K on macOS; `Ctrl_K` covers everyone
 * else. Watching both means the shortcut works on every platform.
 */
const keys = useMagicKeys({
  // Without this, pressing ⌘K in the browser opens the address-bar search.
  passive: false,
  onEventFired(e) {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey) && e.type === 'keydown') {
      e.preventDefault()
    }
  },
})

watch([keys.Meta_K, keys.Ctrl_K], ([meta, ctrl]) => {
  if (meta || ctrl) open.value = !open.value
})

/** Close first, then act — otherwise the dialog's focus trap fights the scroll. */
function run(action: () => void) {
  open.value = false
  // One tick lets the dialog finish unmounting and release the body scroll lock.
  nextTick(() => setTimeout(action, 120))
}

function goToSection(to: string) {
  run(async () => {
    // An in-page anchor only works if we are already on the home page.
    if (!to.startsWith('/#')) {
      await router.push(to)
      return
    }
    if (router.currentRoute.value.path !== '/') await router.push('/')
    await nextTick()
    scrollTo(to.replace('/', ''), { offset: -80 })
  })
}

/**
 * `window` is not in scope inside a Vue template, so external links go through
 * this helper. `noopener` is not optional — without it the opened tab can reach
 * back through `window.opener` and navigate this page somewhere hostile.
 */
function openExternal(href: string) {
  run(() => window.open(href, '_blank', 'noopener,noreferrer'))
}

const sectionIcons: Record<string, Component> = {
  work: FileText,
  about: User,
  skills: Beaker,
  contact: Mail,
}
</script>

<template>
  <CommandDialog
    v-model:open="open"
    title="Command palette"
    description="Jump to a section, open a project, or change the theme."
  >
    <CommandInput placeholder="Type to search — sections, projects, links…" />

    <CommandList class="max-h-[min(60vh,26rem)]">
      <!-- Shown when nothing matches the query. -->
      <CommandEmpty>
        <span class="text-muted-foreground text-sm">Nothing found. Try “work” or “email”.</span>
      </CommandEmpty>

      <CommandGroup heading="Navigate">
        <CommandItem value="home" class="gap-3" @select="run(() => router.push('/'))">
          <Home class="size-4 opacity-60" />
          <span>Home</span>
        </CommandItem>
        <CommandItem
          v-for="link in navLinks"
          :key="link.to"
          :value="link.label"
          class="gap-3"
          @select="goToSection(link.to)"
        >
          <component :is="sectionIcons[link.section] ?? FileText" class="size-4 opacity-60" />
          <span>{{ link.label }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandSeparator />

      <CommandGroup heading="Projects">
        <CommandItem
          v-for="project in projects"
          :key="project.slug"
          :value="`${project.title} ${project.tags.join(' ')}`"
          class="gap-3"
          @select="run(() => router.push(`/work/${project.slug}`))"
        >
          <span
            class="size-2 shrink-0 rounded-full"
            :style="{ background: `linear-gradient(135deg, ${project.accent[0]}, ${project.accent[1]})` }"
          />
          <span>{{ project.title }}</span>
          <span class="text-muted-foreground ml-auto truncate text-xs">{{ project.year }}</span>
        </CommandItem>
      </CommandGroup>

      <CommandSeparator />

      <CommandGroup heading="Theme">
        <CommandItem value="light theme" class="gap-3" @select="run(() => (colorMode.preference = 'light'))">
          <Sun class="size-4 opacity-60" />
          <span>Light</span>
        </CommandItem>
        <CommandItem value="dark theme" class="gap-3" @select="run(() => (colorMode.preference = 'dark'))">
          <Moon class="size-4 opacity-60" />
          <span>Dark</span>
        </CommandItem>
      </CommandGroup>

      <CommandSeparator />

      <CommandGroup heading="Elsewhere">
        <CommandItem
          v-for="social in socials"
          :key="social.href"
          :value="social.label"
          class="gap-3"
          @select="openExternal(social.href)"
        >
          <ArrowUpRight class="size-4 opacity-60" />
          <span>{{ social.label }}</span>
          <span class="text-muted-foreground ml-auto truncate text-xs">{{ social.handle }}</span>
        </CommandItem>
      </CommandGroup>
    </CommandList>
  </CommandDialog>
</template>
