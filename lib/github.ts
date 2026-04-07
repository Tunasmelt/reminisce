// ─────────────────────────────────────────────────────────────────────────────
//  lib/github.ts
//
//  GitHub public metadata fetcher — no auth required for public repos.
//  Used by the wizard generate route to enrich architecture prompts
//  with real repo context (language, topics, description).
//
//  Level 1 integration only:
//    - Repo URL → owner/repo parsing
//    - Public metadata fetch (name, description, language, topics, branch)
//    - Stack detection from known config files
//  Level 2 (PAT for private repos) is planned as a future addition.
// ─────────────────────────────────────────────────────────────────────────────

export interface RepoMetadata {
  owner:         string
  repo:          string
  description:   string | null
  language:      string | null
  topics:        string[]
  defaultBranch: string
  provider:      'github' | 'gitlab' | 'bitbucket' | 'other'
  isPublic:      boolean
}

export interface DetectedStack {
  detected: string[]
  confidence: 'high' | 'medium' | 'low'
}

// ─────────────────────────────────────────────────────────────────────────────
//  URL parsing
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses a repository URL and returns { owner, repo, provider }.
 * Handles HTTPS and SSH formats for GitHub, GitLab, and Bitbucket.
 * Returns null if the URL cannot be parsed as a known git host.
 */
export function parseRepoUrl(url: string): {
  owner: string
  repo: string
  provider: 'github' | 'gitlab' | 'bitbucket' | 'other'
} | null {
  if (!url?.trim()) return null

  const cleaned = url.trim()
    .replace(/\.git$/, '')
    .replace(/\/$/, '')

  // HTTPS format: https://github.com/owner/repo
  const httpsMatch = cleaned.match(
    /^https?:\/\/(?:www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/([^/]+)\/([^/]+)/,
  )
  if (httpsMatch) {
    const host     = httpsMatch[1]
    const owner    = httpsMatch[2]
    const repo     = httpsMatch[3]
    const provider =
      host === 'github.com'    ? 'github'    :
      host === 'gitlab.com'    ? 'gitlab'    :
      host === 'bitbucket.org' ? 'bitbucket' : 'other'
    return { owner, repo, provider }
  }

  // SSH format: git@github.com:owner/repo
  const sshMatch = cleaned.match(
    /^git@(github\.com|gitlab\.com|bitbucket\.org):([^/]+)\/(.+)/,
  )
  if (sshMatch) {
    const host     = sshMatch[1]
    const owner    = sshMatch[2]
    const repo     = sshMatch[3]
    const provider =
      host === 'github.com'    ? 'github'    :
      host === 'gitlab.com'    ? 'gitlab'    :
      host === 'bitbucket.org' ? 'bitbucket' : 'other'
    return { owner, repo, provider }
  }

  return null
}

// ─────────────────────────────────────────────────────────────────────────────
//  GitHub public metadata fetch
//  No auth required for public repos.
//  Rate limit: 60 unauthenticated requests/hour per IP (GitHub).
//  For wizard usage (one call per project creation) this is ample.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetches public repository metadata from the GitHub API.
 * Returns null if the repo is private, not found, or the request fails.
 * Does not throw — all errors are caught and returned as null.
 */
export async function fetchRepoMetadata(
  repoUrl: string,
): Promise<RepoMetadata | null> {
  const parsed = parseRepoUrl(repoUrl)
  if (!parsed) return null

  // Only GitHub supported for Level 1 — GitLab/Bitbucket need auth for useful data
  if (parsed.provider !== 'github') {
    return {
      owner:         parsed.owner,
      repo:          parsed.repo,
      description:   null,
      language:      null,
      topics:        [],
      defaultBranch: 'main',
      provider:      parsed.provider,
      isPublic:      true, // assume public — we can't verify without auth
    }
  }

  try {
    const res = await fetch(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
      {
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Reminisce-App/1.0',
        },
        // 5 second timeout — don't block generation for metadata
        signal: AbortSignal.timeout(5000),
      },
    )

    if (!res.ok) {
      // 404 = private or doesn't exist, 403 = rate limited
      console.warn(`[github] fetchRepoMetadata: ${res.status} for ${parsed.owner}/${parsed.repo}`)
      return null
    }

    const data = await res.json()

    return {
      owner:         parsed.owner,
      repo:          parsed.repo,
      description:   data.description ?? null,
      language:      data.language ?? null,
      topics:        Array.isArray(data.topics) ? data.topics : [],
      defaultBranch: data.default_branch ?? 'main',
      provider:      'github',
      isPublic:      !data.private,
    }
  } catch (err) {
    // Timeout, network error, JSON parse failure — all non-fatal
    console.warn('[github] fetchRepoMetadata failed:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Stack detection from repo file contents
//  Reads well-known config files from the public GitHub API.
//  Returns detected technologies and confidence level.
//  Only runs for public repos — private repos return empty detection.
// ─────────────────────────────────────────────────────────────────────────────

// File paths to check → what they indicate
const STACK_INDICATORS: Array<{
  path: string
  indicators: Array<{ pattern: RegExp | string; tech: string }>
}> = [
  {
    path: 'package.json',
    indicators: [
      { pattern: '"next"',       tech: 'Next.js'    },
      { pattern: '"react"',      tech: 'React'      },
      { pattern: '"vue"',        tech: 'Vue.js'     },
      { pattern: '"svelte"',     tech: 'Svelte'     },
      { pattern: '"express"',    tech: 'Express'    },
      { pattern: '"fastify"',    tech: 'Fastify'    },
      { pattern: '"prisma"',     tech: 'Prisma'     },
      { pattern: '"drizzle-orm"',tech: 'Drizzle'    },
      { pattern: '"@supabase',   tech: 'Supabase'   },
      { pattern: '"stripe"',     tech: 'Stripe'     },
      { pattern: '"tailwindcss"',tech: 'Tailwind'   },
      { pattern: '"typescript"', tech: 'TypeScript' },
      { pattern: '"graphql"',    tech: 'GraphQL'    },
      { pattern: '"trpc"',       tech: 'tRPC'       },
    ],
  },
  {
    path: 'requirements.txt',
    indicators: [
      { pattern: 'django',  tech: 'Django'  },
      { pattern: 'fastapi', tech: 'FastAPI' },
      { pattern: 'flask',   tech: 'Flask'   },
      { pattern: 'sqlalchemy', tech: 'SQLAlchemy' },
      { pattern: 'celery',  tech: 'Celery'  },
      { pattern: 'redis',   tech: 'Redis'   },
    ],
  },
  {
    path: 'go.mod',
    indicators: [
      { pattern: 'gin-gonic', tech: 'Gin'   },
      { pattern: 'echo',      tech: 'Echo'  },
      { pattern: 'fiber',     tech: 'Fiber' },
    ],
  },
  {
    path: 'Cargo.toml',
    indicators: [
      { pattern: 'actix',  tech: 'Actix'  },
      { pattern: 'axum',   tech: 'Axum'   },
      { pattern: 'rocket', tech: 'Rocket' },
    ],
  },
  {
    path: 'pubspec.yaml',
    indicators: [
      { pattern: 'flutter', tech: 'Flutter' },
    ],
  },
]

/**
 * Reads known config files from a public GitHub repo and detects
 * the tech stack. Returns detected technologies and confidence level.
 *
 * Confidence:
 *   high   → package.json or requirements.txt found with clear matches
 *   medium → config file found but matches are sparse
 *   low    → no config files found, fell back to language/topic inference
 */
export async function detectStackFromRepo(
  repoUrl: string,
): Promise<DetectedStack> {
  const parsed = parseRepoUrl(repoUrl)
  if (!parsed || parsed.provider !== 'github') {
    return { detected: [], confidence: 'low' }
  }

  const detected = new Set<string>()
  let foundConfigFile = false

  for (const { path, indicators } of STACK_INDICATORS) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/${parsed.owner}/${parsed.repo}/HEAD/${path}`,
        {
          headers: { 'User-Agent': 'Reminisce-App/1.0' },
          signal: AbortSignal.timeout(3000),
        },
      )

      if (!res.ok) continue

      const content = await res.text()
      foundConfigFile = true

      for (const { pattern, tech } of indicators) {
        const matches =
          typeof pattern === 'string'
            ? content.toLowerCase().includes(pattern.toLowerCase())
            : pattern.test(content)
        if (matches) detected.add(tech)
      }

      // Stop after first successful config file — avoid burning rate limits
      if (detected.size > 0) break
    } catch {
      // Timeout or network error — skip this file
      continue
    }
  }

  const techs = Array.from(detected)
  const confidence: DetectedStack['confidence'] =
    techs.length >= 3 ? 'high' :
    techs.length >= 1 && foundConfigFile ? 'medium' : 'low'

  return { detected: techs, confidence }
}

/**
 * Convenience function — fetches both metadata and stack detection
 * in parallel. Used by the wizard generate route.
 * Returns null for metadata if the repo is inaccessible.
 */
export async function enrichProjectFromRepo(repoUrl: string): Promise<{
  metadata: RepoMetadata | null
  stack:    DetectedStack
}> {
  const [metadata, stack] = await Promise.all([
    fetchRepoMetadata(repoUrl),
    detectStackFromRepo(repoUrl),
  ])
  return { metadata, stack }
}
