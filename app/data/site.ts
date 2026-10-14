/* ===========================================================================
   ✏️  EDIT ME FIRST

   This is the only file you need to touch to make the site yours.
   Every headline, project, job and social link on the whole website is read
   from here — no text is hard-coded inside components.
   =========================================================================== */

import type {
  Experience,
  Project,
  SkillGroup,
  SocialLink,
} from '~/types/portfolio'

/* ---------------------------------------------------------------- identity */

export const profile = {
  name: 'Sros Songha',
  /** Shown in the hero as two stacked lines. */
  firstName: 'Sros',
  lastName: 'Songha',
  role: 'Front-end Developer',
  /** The one-liner under the big name. */
  tagline: 'I build interfaces that feel alive.',
  /** Two or three sentences for the About section. */
  bio: [
    'I am a Computer Science student at the Institute of Technology of Cambodia (ITC) and a front-end developer based in Phnom Penh. Most of my energy goes into Vue, Nuxt, and React — building interfaces, then rebuilding them once I understand why the first version was wrong.',
    'Currently interning at T.O Group and previously at EKYC Solution Co., Ltd., turning designs into responsive UI, managing state, and connecting front-end applications to robust APIs and headless backends. Alongside that, I co-created Roomie (ស្រុកខ្ញុំ), a room-rental marketplace for Cambodia with Nuxt, Supabase, and Clerk, shipped live to production at sroknh.com.',
    'I care deeply about the details: a loading state that respects user time, a layout that survives a 320px phone screen, and motion that communicates meaning instead of mere decoration. Still young, still learning, and always eager to build with real teams.',
  ],
  location: 'Phnom Penh · UTC+7',
  availability: 'Open to new work',
  email: 'sanghakh122333@gmail.com',
  cvUrl: '/cv.pdf',
  /** Numbers in the hero strip. `suffix` is appended after the counter. */
  stats: [
    { value: 13, suffix: '+', label: 'Public repos' },
    { value: 2, suffix: '', label: 'Tech internships' },
    { value: 7, suffix: '', label: 'Days a week building' },
    { value: 100, suffix: '%', label: 'Curiosity driven' },
  ],
}

export const socials: SocialLink[] = [
  { label: 'GitHub', href: 'https://github.com/srossongha', handle: '@srossongha' },
  { label: 'LinkedIn', href: 'https://linkedin.com/in/sros-songha-164656419', handle: 'sros-songha' },
  { label: 'Telegram', href: 'https://t.me/srossangha', handle: '@srossangha' },
  { label: 'Email', href: `mailto:${profile.email}`, handle: profile.email },
]

/* ---------------------------------------------------------------- projects */

export const projects: Project[] = [
  {
    slug: 'roomie',
    title: 'Roomie (ស្រុកខ្ញុំ)',
    tagline: 'A room-rental marketplace for Cambodia built on Nuxt.',
    description:
      'A room-rental platform built for Cambodia: search with live filters, saved listings, host onboarding, scientific calculator, and English/Khmer bilingual support. Built with Nuxt 4, Vue 3, Supabase, and Clerk, shipped to production on Cloudflare Pages.',
    year: '2026',
    role: 'Front-end build — UI, profile edit, listing location & calculator',
    stack: ['Nuxt 4', 'Vue 3', 'TypeScript', 'shadcn-vue', 'Pinia', 'Supabase', 'Clerk', 'Cloudflare Pages'],
    tags: ['Product', 'Full-stack', 'Vue/Nuxt'],
    links: [
      { label: 'Live site', href: 'https://sroknh.com', icon: 'external' },
      { label: 'Case study', href: '/work/roomie', icon: 'docs' },
    ],
    highlights: [
      'Bilingual localization supporting both Khmer (ភាសាខ្មែរ) and English with seamless language switching.',
      'Designed and engineered responsive listing discovery, profile view/edit flows, and listing location mapping.',
      'Implemented a custom scientific calculator feature directly integrated into the platform.',
      'Integrated shadcn-vue components with Pinia reactive state for fluid user interactions.',
      'Auth secured with Clerk and real-time database managed on Supabase, deployed on Cloudflare Pages.',
    ],
    metrics: [
      { value: '2', label: 'Languages (KH/EN)' },
      { value: '100%', label: 'Typed API surface' },
      { value: 'Live', label: 'In production' },
    ],
    accent: ['oklch(0.78 0.14 78)', 'oklch(0.62 0.15 42)'],
    featured: true,
    status: 'shipped',
  },
  {
    slug: 'personal-finance-tracker',
    title: 'Personal Finance Tracker',
    tagline: 'Track monthly spending and budgeting — built to bridge from Vue to React.',
    description:
      'A clean personal finance web app for tracking income, monthly expenses, and category budgets. Built as a hands-on project to master React, Next.js, and TypeScript coming from a Vue and Nuxt background.',
    year: '2026',
    role: 'Solo build — React & Next.js transition',
    stack: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Vercel'],
    tags: ['Tool', 'React/Next.js'],
    links: [
      { label: 'Source', href: 'https://github.com/srossongha/personal-finance-tracker', icon: 'github' },
      { label: 'Live demo', href: 'https://personal-finance-tracker-asuna-6fb8.vercel.app', icon: 'external' },
      { label: 'Case study', href: '/work/personal-finance-tracker', icon: 'docs' },
    ],
    highlights: [
      'Interactive monthly expense logging with instant category aggregation and breakdown.',
      'Hands-on exploration of React hooks, component lifecycles, and state from a Vue 3 composition perspective.',
      'Type-safe transaction models and persistent local storage synchronization.',
      'Mobile-first responsive UI built with Tailwind CSS and deployed on Vercel.',
    ],
    metrics: [
      { value: '100%', label: 'TypeScript' },
      { value: '0ms', label: 'Client latency' },
      { value: 'Vercel', label: 'CI/CD deploy' },
    ],
    accent: ['oklch(0.76 0.15 160)', 'oklch(0.55 0.14 185)'],
    featured: true,
    status: 'shipped',
  },
  {
    slug: 'to-group-landing',
    title: 'T.O Group Landing Page',
    tagline: 'Modern agency landing page connecting Nuxt to Directus headless CMS.',
    description:
      'A responsive corporate landing page built during internship at T.O Group. Combines dynamic landing sections with Directus headless CMS, ensuring smooth content updates and high performance.',
    year: '2026',
    role: 'Front-end Intern build',
    stack: ['Vue 3', 'Nuxt', 'Tailwind CSS', 'Directus', 'REST API'],
    tags: ['Product', 'Vue/Nuxt', 'CMS'],
    links: [
      { label: 'Source', href: 'https://github.com/srossongha/T.O-Group-landing-page', icon: 'github' },
      { label: 'Case study', href: '/work/to-group-landing', icon: 'docs' },
    ],
    highlights: [
      'Modular section architecture for showcasing services, agency highlights, and team members.',
      'Connected to Directus headless CMS API for dynamic content delivery and decoupled administration.',
      'Optimized asset loading and typography for fast first-paint and mobile smoothness.',
    ],
    metrics: [
      { value: '<1s', label: 'First paint' },
      { value: '100%', label: 'Responsive' },
    ],
    accent: ['oklch(0.72 0.16 280)', 'oklch(0.54 0.15 305)'],
    featured: true,
    status: 'shipped',
  },
  {
    slug: 'hand-filter-cam',
    title: 'Hand Tracking Cam',
    tagline: 'Your hands are the mask. Real-time gesture-driven video filters.',
    description:
      'A webcam app that tracks both hands with MediaPipe and applies a filter only inside the area your hands cover. The filtered region is the convex hull of every landmark, so one hand gives you a patch and two hands bridge into a single shape spanning the space between them.',
    year: '2026',
    role: 'Solo build — CV & real-time graphics',
    stack: ['Python', 'MediaPipe', 'OpenCV', 'NumPy'],
    tags: ['Computer Vision', 'Experiment', 'Python'],
    links: [
      { label: 'Source', href: 'https://github.com/srossongha/hand-tracking', icon: 'github' },
      { label: 'Case study', href: '/work/hand-filter-cam', icon: 'docs' },
    ],
    highlights: [
      'Convex-hull masking over all 21 landmarks per hand, unioned across both hands into one continuous filtered region.',
      'Finger counting drives the filter: fist for original, then grayscale, invert, sepia and pixelate as you raise fingers.',
      'A dedicated thumbs-up gesture cycles the bonus filters — cartoon, edge detect, thermal — so the thumb never confuses the counter.',
      'Every gesture has a keyboard fallback, because lighting and camera angle will eventually let you down in a demo.',
      'On-screen HUD reports active filter, hand count, detected gesture and live FPS.',
    ],
    metrics: [
      { value: '42', label: 'Landmarks tracked' },
      { value: '8', label: 'Filters' },
      { value: '30fps', label: 'On a laptop cam' },
    ],
    accent: ['oklch(0.74 0.1 205)', 'oklch(0.55 0.13 250)'],
    featured: true,
    status: 'shipped',
  },
  {
    slug: 'identity-flow',
    title: 'Identity Flow',
    tagline: 'Document capture and liveness that people actually complete.',
    description:
      'An electronic know-your-customer journey engineered at EKYC Solution Co., Ltd.: guided document capture, edge and glare detection before upload, liveness checks, and a review queue for verification agents. The engineering problem is accuracy; the design problem is that every extra second of friction costs a real user.',
    year: '2026',
    role: 'Front-end Intern — Capture UX & State Machine',
    stack: ['Vue 3', 'TypeScript', 'WebRTC', 'Canvas', 'REST'],
    tags: ['Product', 'Computer Vision', 'Vue/Nuxt'],
    links: [
      { label: 'Company Project (EKYC Solution)', icon: 'docs' },
      { label: 'Case study', href: '/work/identity-flow', icon: 'docs' },
    ],
    highlights: [
      'Live frame analysis in a canvas pipeline — blur, glare and edge checks run before the shutter, so users are corrected in the moment rather than rejected minutes later.',
      'A capture state machine with explicit, recoverable states instead of a pile of booleans.',
      'Camera permission and hardware failures treated as first-class UI states, not error toasts.',
      'Every step instrumented so drop-off can be traced to an exact instruction.',
    ],
    metrics: [
      { value: '<3s', label: 'Median capture' },
      { value: '6', label: 'Guided states' },
    ],
    accent: ['oklch(0.72 0.14 22)', 'oklch(0.5 0.13 12)'],
    featured: false,
    status: 'shipped',
  },
  {
    slug: 'sakura',
    title: 'Sakura',
    tagline: 'A flower that blooms when you touch it. Pure CSS.',
    description:
      'A small piece of creative coding: layered radial gradients form the petals, a keyframed transform sends them drifting, and a click pauses the fall to bloom the flower. No canvas, no library — a study in how much life you can get out of transforms and easing alone.',
    year: '2025',
    role: 'Creative coding',
    stack: ['CSS', 'Keyframes', 'HTML'],
    tags: ['Creative', 'Experiment'],
    links: [
      { label: 'Source', href: 'https://github.com/srossongha/sakura', icon: 'github' },
      { label: 'Case study', href: '/work/sakura', icon: 'docs' },
    ],
    highlights: [
      'Petals drawn with a single radial-gradient and an asymmetric border-radius.',
      'Bloom state toggles animation-play-state rather than swapping animations, so the motion never jumps.',
      'Runs on the compositor — transform and opacity only.',
    ],
    accent: ['oklch(0.82 0.11 350)', 'oklch(0.66 0.16 12)'],
    featured: false,
    status: 'shipped',
  },
  {
    slug: 'cpp-syntax-examples',
    title: 'C++ Syntax & Algorithms',
    tagline: 'Foundations of computer science, pointer memory, and algorithms.',
    description:
      'A curated collection of C++ implementations covering syntax fundamentals, data structures, pointer mechanics, and problem-solving patterns developed during coursework at the Institute of Technology of Cambodia (ITC).',
    year: '2026',
    role: 'Computer Science Coursework',
    stack: ['C++', 'Algorithms', 'Data Structures', 'GCC'],
    tags: ['Tool', 'Experiment'],
    links: [
      { label: 'Source', href: 'https://github.com/srossongha/cpp-syntax-examples', icon: 'github' },
      { label: 'Case study', href: '/work/cpp-syntax-examples', icon: 'docs' },
    ],
    highlights: [
      'Deep dive into memory management, pointers, and reference semantics in C++.',
      'Algorithmic problem-solving patterns implemented with clean, documented code structure.',
      'Serves as an ongoing reference library for computer science studies at ITC.',
    ],
    metrics: [
      { value: 'ITC', label: 'Coursework' },
      { value: 'C++17', label: 'Standard' },
    ],
    accent: ['oklch(0.7 0.12 240)', 'oklch(0.5 0.14 260)'],
    featured: false,
    status: 'shipped',
  },
  {
    slug: 'this-site',
    title: 'This Portfolio',
    tagline: 'Smooth scroll choreography, responsive typography, and clean design.',
    description:
      'The site you are reading. Crafted with Nuxt 4, Vue 3, GSAP ScrollTrigger, Lenis smooth scrolling, Tailwind CSS, and shadcn-vue. Designed to showcase front-end engineering with clean typography, responsive layouts, and buttery animations.',
    year: '2026',
    role: 'Design & build',
    stack: ['Nuxt 4', 'Vue 3', 'TypeScript', 'GSAP', 'Lenis', 'Tailwind v4', 'shadcn-vue'],
    tags: ['Product', 'Full-stack', 'Vue/Nuxt'],
    links: [
      { label: 'Source', href: 'https://github.com/srossongha/portfolio', icon: 'github' },
      { label: 'Live site', href: 'https://portfolio.sanghakh122333.workers.dev/', icon: 'external' },
      { label: 'Case study', href: '/work/this-site', icon: 'docs' },
    ],
    highlights: [
      'One Lenis instance drives smooth scrolling and hands its position to ScrollTrigger for synchronized pinning.',
      'Sections choreograph along multiple scroll axes — vertical, horizontal card showcase, and pinned depth cards.',
      'Command palette (⌘K) built with accessible dialog primitives and keyboard navigation.',
      'Accessibility first: every animation honors prefers-reduced-motion.',
    ],
    accent: ['oklch(0.8 0.14 78)', 'oklch(0.6 0.16 30)'],
    featured: true,
    status: 'building',
  },
]

/* ------------------------------------------------------------------ skills */

export const skillGroups: SkillGroup[] = [
  {
    title: 'Front-end',
    summary: 'Where I spend most of my time. Components, state, and motion.',
    items: [
      { name: 'Vue 3 / Nuxt', level: 85 },
      { name: 'Tailwind CSS', level: 90 },
      { name: 'TypeScript / JS', level: 75 },
      { name: 'Pinia / shadcn-vue', level: 80 },
      { name: 'React / Next.js', level: 65 },
      { name: 'GSAP / Lenis', level: 60 },
    ],
  },
  {
    title: 'Back-end & CMS',
    summary: 'APIs, headless CMS, and databases backing my interfaces.',
    items: [
      { name: 'Directus (Headless CMS)', level: 70 },
      { name: 'Node.js / NestJS', level: 55 },
      { name: 'PostgreSQL / MySQL', level: 65 },
      { name: 'Supabase / Neon', level: 70 },
      { name: 'Prisma & Clerk Auth', level: 70 },
    ],
  },
  {
    title: 'Tooling & Cloud',
    summary: 'How the work gets from my machine to production URLs.',
    items: [
      { name: 'Git & GitHub', level: 80 },
      { name: 'Cloudflare Pages / Vercel', level: 75 },
      { name: 'VS Code', level: 85 },
      { name: 'Figma to Code', level: 75 },
      { name: 'macOS / Terminal', level: 70 },
    ],
  },
  {
    title: 'Learning & Exploring',
    summary: 'Coursework at ITC and technologies I am exploring right now.',
    items: [
      { name: 'C++ (CS Foundations)', level: 75 },
      { name: 'Python (OpenCV & MediaPipe)', level: 65 },
      { name: 'REST APIs & Integration', level: 70 },
      { name: 'UI/UX Design Systems (Figma)', level: 75 },
    ],
  },
]

/** The endless ticker rows in the skills section. */
export const marqueeRows = [
  ['Nuxt 4', 'Vue 3', 'React', 'Next.js', 'TypeScript', 'Tailwind', 'Pinia', 'shadcn-vue'],
  ['PostgreSQL', 'MySQL', 'Directus', 'NestJS', 'Supabase', 'Neon', 'Prisma', 'Clerk'],
  ['Python', 'MediaPipe', 'OpenCV', 'C++', 'Vite', 'Git', 'GSAP', 'Lenis', 'Figma'],
]

/* -------------------------------------------------------------- experience */

export const experiences: Experience[] = [
  {
    period: 'Aug 2026 — Present',
    role: 'Front-end Intern',
    organisation: 'T.O Group',
    description:
      'Building production front-end features with Vue, Nuxt, and Tailwind CSS. Implementing responsive agency landing pages, managing application state, and connecting front-end views to Directus headless CMS and REST APIs.',
    tags: ['Vue 3', 'Nuxt', 'Tailwind CSS', 'Directus', 'APIs'],
  },
  {
    period: 'May 2026 — Aug 2026',
    role: 'Front-end Intern',
    organisation: 'EKYC Solution Co., Ltd.',
    description:
      'Engineered identity verification flows end-to-end: camera capture UX, liveness checks, and canvas-based live frame analysis (glare, blur, and boundary checks) using Vue 3, TypeScript, and WebRTC.',
    tags: ['Vue 3', 'TypeScript', 'WebRTC', 'Canvas', 'Camera UX'],
  },
  {
    period: '2025 — Present',
    role: 'Computer Science Student',
    organisation: 'Institute of Technology of Cambodia (ITC)',
    description:
      'Studying core software engineering, algorithms, data structures, and C++ programming. Applying academic computer science principles directly to real-world web engineering projects.',
    tags: ['Computer Science', 'C++', 'Data Structures', 'Algorithms'],
  },
  {
    period: 'Always',
    role: 'Perpetual Builder',
    organisation: 'Late nights & Open Source',
    description:
      'Still young, still learning. Focused on crafting delightful, responsive web experiences, computer vision experiments with Python & MediaPipe, and expanding from Vue/Nuxt into React & Next.js.',
    tags: ['Vue 3', 'Nuxt', 'React', 'Next.js', 'Python'],
  },
]

/* ------------------------------------------------------------- navigation */

export const navLinks = [
  { label: 'Work', to: '/#work', section: 'work' },
  { label: 'About', to: '/#about', section: 'about' },
  { label: 'Skills', to: '/#skills', section: 'skills' },
  { label: 'Contact', to: '/#contact', section: 'contact' },
]

/** Used for <title>, meta description and the OG card. */
export const seo = {
  title: `${profile.name} — ${profile.role}`,
  description:
    'Front-end developer from Cambodia studying at ITC. Building responsive web interfaces with Vue, Nuxt, and React.',
  url: 'https://portfolio.sanghakh122333.workers.dev/',
}
