// https://nuxt.com/docs/api/configuration/nuxt-config
//
// This is the single control panel for the whole app. Nuxt reads this file at
// startup and uses it to wire up modules, styles, build tools and rendering.
import tailwindcss from '@tailwindcss/vite'

export default defineNuxtConfig({
  // Nuxt uses this date to decide which "future defaults" are safe to turn on.
  // Pinning it means a future Nuxt upgrade will not silently change behaviour.
  compatibilityDate: '2026-08-11',

  // Nuxt Devtools: press the little Nuxt logo in the browser to inspect
  // components, the payload, routes and performance while you develop.
  devtools: { enabled: true },

  // Server-side rendering. The HTML is built on the server first (great for SEO
  // and for the first paint), then Vue "hydrates" it in the browser.
  // Everything 3D is wrapped in <ClientOnly> because WebGL only exists in a browser.
  ssr: true,

  // Modules are Nuxt plugins-on-steroids: they can add components, composables,
  // config and build steps. Order matters only when two modules touch the same thing.
  modules: [
    '@vueuse/nuxt', // auto-imports every VueUse composable (useMouse, useElementSize, ...)
    '@nuxtjs/color-mode', // dark/light mode with no flash of wrong theme on load
    'shadcn-nuxt', // registers ./app/components/ui as shadcn-vue components
  ],

  // Global stylesheets. Tailwind v4 is configured *inside* main.css
  // (v4 is "CSS-first" — there is no tailwind.config.js any more).
  // vue-sonner ships its own stylesheet for the toast stack animations.
  css: ['~/assets/css/main.css', 'vue-sonner/style.css'],

  // Tailwind v4 ships as a Vite plugin instead of a PostCSS plugin.
  vite: {
    plugins: [tailwindcss()],
  },

  // shadcn-vue settings. `prefix: ''` means components are <Button>, not <ShadcnButton>.
  shadcn: {
    prefix: '',
    componentDir: './app/components/ui',
  },

  // color-mode writes a class on <html> (`dark` / `light`) with no suffix,
  // which is exactly what Tailwind's `dark:` variant expects.
  colorMode: {
    classSuffix: '',
    preference: 'dark', // what a brand-new visitor gets
    fallback: 'dark', // used when the system preference can't be read
    storageKey: 'portfolio-theme',
  },

  // Auto-import rules for components.
  // `pathPrefix: false` keeps names short: app/components/sections/HeroSection.vue
  // is used as <HeroSection />, not <SectionsHeroSection />.
  // (That means every component filename must be unique across the folders.)
  components: [
    { path: '~/components/ui', pathPrefix: false },
    { path: '~/components/fx', pathPrefix: false },
    { path: '~/components/layout', pathPrefix: false },
    { path: '~/components/sections', pathPrefix: false },
    { path: '~/components', pathPrefix: false },
  ],

  // Default <head> for every page. Individual pages override this with useSeoMeta().
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        {
          rel: 'preconnect',
          href: 'https://fonts.gstatic.com',
          crossorigin: '',
        },
        {
          rel: 'stylesheet',
          href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Geist:wght@300;400;500;600;700&family=Geist+Mono:wght@400;500&display=swap',
        },
      ],
      meta: [
        // `viewport-fit=cover` lets the page draw into the notch / rounded
        // corners instead of being letterboxed by iOS. It is also what makes
        // `env(safe-area-inset-*)` report real numbers — without it every
        // inset is 0 and the safe-area CSS in main.css silently does nothing.
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover',
        },
        { name: 'theme-color', content: '#0a0a0b' },
      ],
    },
    // Route transitions. `out-in` = old page finishes leaving before the new one enters.
    pageTransition: { name: 'page', mode: 'out-in' },
  },

  // View Transitions API — used by the theme toggle for the circular wipe effect.
  experimental: {
    viewTransition: true,
  },

  // Nitro is Nuxt's server engine. Prerendering these routes at build time turns
  // them into static HTML files, so they load instantly and rank well.
  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/'],
    },
  },

  typescript: {
    // Set to true if you want the dev server to fail on type errors.
    // `npm run typecheck` runs the same check on demand.
    typeCheck: false,
    strict: true,
  },
})
