/**
 * Every shape of data the site uses, in one place.
 *
 * Why bother with types at all? Because the moment you type `project.titel`
 * instead of `project.title`, TypeScript underlines it in your editor rather
 * than letting you find out from a blank space on the live site.
 */

/** A single link on a project card (repo, live demo, case study...). */
export interface ProjectLink {
  label: string
  /** `href` is optional: a project can be private/NDA with no public link. */
  href?: string
  /** Matches a key in the icon map inside ProjectLinks.vue */
  icon?: 'github' | 'external' | 'video' | 'docs'
}

/** A headline number shown on the project detail page ("40% faster", "12k users"). */
export interface ProjectMetric {
  value: string
  label: string
}

export interface Project {
  /** URL segment: /work/roomie */
  slug: string
  title: string
  /** One punchy line, shown on the card. */
  tagline: string
  /** Two or three sentences, shown on the detail page. */
  description: string
  year: string
  /** What you actually did on it. */
  role: string
  /** Technologies — rendered as badges. */
  stack: string[]
  /** Short category labels used by the filter buttons. */
  tags: string[]
  links: ProjectLink[]
  /** Bullet points describing the interesting engineering. */
  highlights: string[]
  metrics?: ProjectMetric[]
  /**
   * Two OKLCH/CSS colours used to build this project's gradient.
   * Giving each project its own colour is what stops a grid of cards from
   * looking like a spreadsheet.
   */
  accent: [string, string]
  /** `true` puts it in the horizontal-scroll showcase on the home page. */
  featured: boolean
  /** Live / Archived / In progress — rendered as a small status pill. */
  status: 'shipped' | 'building' | 'experiment'
}

export interface Experience {
  period: string
  role: string
  organisation: string
  description: string
  tags: string[]
}

export interface SkillGroup {
  title: string
  /** A short sentence about how you use this group of tools. */
  summary: string
  items: { name: string; level: number }[]
}

export interface SocialLink {
  label: string
  href: string
  handle: string
}


