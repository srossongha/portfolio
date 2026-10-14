<script setup lang="ts">
import { ArrowUp } from '@lucide/vue'
import { navLinks, profile, socials } from '~/data/site'

const { scrollTo } = useSmoothScroll()
const year = new Date().getFullYear()

/** A live clock in the visitor's timezone — a small sign of a real person. */
const time = ref('')
onMounted(() => {
  const update = () => {
    time.value = new Date().toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }
  update()
  const id = setInterval(update, 1000 * 30)
  onUnmounted(() => clearInterval(id))
})
</script>

<template>
  <footer class="border-border/60 relative border-t">
    <!-- Oversized wordmark bleeding off the bottom edge. Cropping type like
         this is a reliable way to make a footer feel designed rather than
         left over. `select-none` stops it hijacking text selection. -->
    <div class="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden select-none" aria-hidden="true">
      <p class="text-foreground/4 translate-y-[22%] text-center font-serif text-[clamp(5rem,22vw,20rem)] leading-none tracking-tighter">
        {{ profile.name }}
      </p>
    </div>

    <!-- gutter + pb-safe: notch-aware sides, and the last thing on the page
         clears the home indicator instead of tucking under it. -->
    <div class="gutter pb-safe relative mx-auto max-w-350 pt-16" style="--pb-safe: 4rem">
      <div class="flex flex-col gap-12 md:flex-row md:justify-between">
        <!-- Left: availability + email -->
        <div class="max-w-sm">
          <Badge variant="live" class="mb-5">
            <span class="relative flex size-1.5">
              <span class="bg-brand absolute inline-flex size-full animate-ping rounded-full opacity-70" />
              <span class="bg-brand relative inline-flex size-1.5 rounded-full" />
            </span>
            {{ profile.availability }}
          </Badge>

          <a
            :href="`mailto:${profile.email}`"
            class="group block font-serif text-3xl tracking-tight break-all sm:text-4xl"
            data-cursor-label="Email"
          >
            <span class="bg-brand/70 bg-size-[0%_1px] bg-bottom bg-no-repeat transition-[background-size] duration-500 group-hover:bg-size-[100%_1px]">
              {{ profile.email }}
            </span>
          </a>

          <p class="text-muted-foreground mt-4 font-mono text-xs">
            {{ profile.location }} — <ClientOnly>{{ time }}<template #fallback>--:--</template></ClientOnly>
          </p>
        </div>

        <!-- Right: link columns -->
        <div class="flex gap-12 sm:gap-20">
          <nav aria-label="Footer">
            <h2 class="text-muted-foreground mb-4 font-mono text-[10px] tracking-[0.25em] uppercase">
              Sitemap
            </h2>
            <ul class="space-y-2.5">
              <li v-for="link in navLinks" :key="link.to">
                <NuxtLink
                  :to="link.to"
                  class="text-muted-foreground hover:text-brand text-sm transition-colors"
                >
                  {{ link.label }}
                </NuxtLink>
              </li>
            </ul>
          </nav>

          <div>
            <h2 class="text-muted-foreground mb-4 font-mono text-[10px] tracking-[0.25em] uppercase">
              Elsewhere
            </h2>
            <ul class="space-y-2.5">
              <li v-for="social in socials" :key="social.href">
                <a
                  :href="social.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground hover:text-brand inline-flex items-center gap-1.5 text-sm transition-colors"
                >
                  {{ social.label }}
                  <span class="text-[9px] opacity-50">↗</span>
                </a>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Bottom bar -->
      <div class="border-border/50 mt-16 flex flex-col-reverse gap-4 border-t pt-6 sm:flex-row sm:items-center sm:justify-between">
        <p class="text-muted-foreground font-mono text-[11px]">
          © {{ year }} {{ profile.name }}. Built with Nuxt, Vue, and Tailwind CSS.
        </p>

        <Button
          variant="ghost"
          size="sm"
          class="text-muted-foreground hover:text-brand -ml-2 gap-2 self-start rounded-full sm:ml-0 sm:self-auto"
          @click="scrollTo(0)"
        >
          <ArrowUp class="size-3.5" />
          Back to top
        </Button>
      </div>
    </div>
  </footer>
</template>
