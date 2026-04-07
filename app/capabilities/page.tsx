'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Database, Bot, Sparkles, GitBranch, FolderSync,
  FileCode2, Network, FlaskConical, Users, Zap,
  BookOpen, ArrowRight, Check,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Inter } from 'next/font/google'
import LandingNav from '@/components/landing-nav'

const BentoScene = dynamic(() => import('@/components/BentoScene'), {
  ssr: false, loading: () => null,
})

const inter = Inter({ subsets: ['latin'] })

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => {
        if (e.isIntersecting) e.target.classList.add('sr-vis')
      }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.sr').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

export default function CapabilitiesPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const [mobile, setMobile] = useState(false)
  useScrollReveal()

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  const features = [
    {
      icon: Sparkles,
      tag: 'Start here',
      title: 'Project Wizard',
      desc: 'A four-stage conversation that generates your entire project blueprint. Reminisce reads your repo URL, detects your tech stack, then produces context documents, phase breakdowns, feature prompts, and editor integration files — all in one parallel generation run.',
      bullets: [
        'Idea → features → stack → generate',
        'GitHub repo enrichment (public repos, no auth)',
        'Parallel wave generation across 5 documents',
        'Auto-generates editor integration files',
      ],
      accent3d: 'large',
    },
    {
      icon: Database,
      tag: 'Memory layer',
      title: 'Context Engine',
      desc: 'The authoritative store for everything about your project. Architecture decisions, tech stack, coding conventions, product scope, and version history are all saved as versioned markdown. Every AI call reads from this automatically before executing.',
      bullets: [
        'File tree grouped by folder (context/, workflow/, editor/, logs/)',
        'Ownership model: Reminisce-managed vs developer-owned',
        'REMINISCE:SUMMARY tags for fast tiered injection',
        'Version history with side-by-side diff',
      ],
      accent3d: 'large',
    },
    {
      icon: FolderSync,
      tag: 'Local first',
      title: 'Local Folder Sync',
      desc: 'Connect your project\'s local folder. Reminisce writes context files to disk on push. When you edit them in Cursor or VS Code and switch back, changes sync automatically. Conflicts are detected and surfaced with a review diff before overwriting.',
      bullets: [
        'Pull: local files → Reminisce database',
        'Push: Reminisce database → local disk',
        'Conflict detection on focus return',
        'File-level ownership — developer files are never overwritten',
      ],
      accent3d: 'medium',
    },
    {
      icon: GitBranch,
      tag: 'Repository aware',
      title: 'Git Integration',
      desc: 'Reads your local .git/ directory directly — no API calls, no authentication, works offline. Branch name and last commit surface in every PAM message, every context injection, and the project overview. Every changelog entry is tagged with the active branch.',
      bullets: [
        'Reads branch, last commit, remote URL',
        'Branch shown in PAM system prompt',
        'Changelog entries tagged with branch name',
        'Works with GitHub, GitLab, Bitbucket, or any git remote',
      ],
      accent3d: 'medium',
    },
    {
      icon: FileCode2,
      tag: 'Editor integration',
      title: 'Editor Files',
      desc: 'After blueprint generation, Reminisce creates a context file tailored to your AI coding tool. Set your editor preference once in Settings — every regeneration updates the file automatically. Push to your local folder and every coding session starts fully informed.',
      bullets: [
        'Cursor → .cursorrules',
        'Claude Code → CLAUDE.md',
        'GitHub Copilot → .github/copilot-instructions.md',
        'Windsurf → .windsurfrules',
      ],
      accent3d: 'medium',
    },
    {
      icon: Bot,
      tag: 'AI execution',
      title: 'AI Agent',
      desc: 'Pick a feature from your board, select a model, and hit Run. The agent reads your full project context — architecture, tech stack, coding guidelines — and generates complete, accurate code. Every run is logged to agent-runs.md automatically.',
      bullets: [
        '15+ models across Anthropic, OpenAI, Google, Groq, Cerebras, SambaNova',
        'Full project context per run',
        'Run history appended to agent-runs.md',
        'BYOK supported for all providers',
      ],
      accent3d: 'medium',
    },
    {
      icon: Zap,
      tag: 'Project intelligence',
      title: 'PAM',
      desc: 'Project Action Manager — the embedded AI assistant that knows your project inside out. Ask for a status briefing, mark features done, add features to phases, create prompts, or set reminders. Every confirmed action is appended to your changes.md changelog.',
      bullets: [
        '/status, /done, /block, /prompt, /add, /remind commands',
        'Scope alert: warns when requests diverge from blueprint',
        'Tiered context: summaries always, full files on keyword match',
        'Auto-appends to changes.md on every confirmed action',
      ],
      accent3d: 'small',
    },
    {
      icon: BookOpen,
      tag: 'Prompt management',
      title: 'Prompt Library',
      desc: 'Three-tab archive of every prompt in your project. Blueprint tab shows the wizard-generated master prompt and phase/feature prompts with usage counts and model suggestions. Custom tab is for user-created prompts. Changelog tab renders your agent-runs.md and changes.md automatically.',
      bullets: [
        'Blueprint: master + phase + feature prompts, grouped by phase',
        'Custom: user-created and PAM-generated prompts',
        'Changelog: auto-populated agent run and change logs',
        '"Copy for editor" appends context file list',
      ],
      accent3d: 'small',
    },
    {
      icon: Network,
      tag: 'Visualise',
      title: 'Graph View',
      desc: 'A visual map of every phase, feature, and their relationships. Track what\'s planned, in progress, and done without opening a single file.',
      bullets: [
        'Drag and drop layout',
        'Status tracking per feature',
        'Phase dependency view',
      ],
      accent3d: 'small',
    },
    {
      icon: FlaskConical,
      tag: 'Testing',
      title: 'API Lab',
      desc: 'Built-in HTTP client for testing API endpoints as you build them. Send requests, inspect responses, and catch issues without leaving the platform.',
      bullets: [
        'GET POST PUT DELETE PATCH',
        'Headers and body editor',
        'Response inspector',
      ],
      accent3d: 'small',
    },
    {
      icon: Users,
      tag: 'Team',
      title: 'Collaboration',
      desc: 'Invite up to 5 members to a project. Everyone works from the same live context — same blueprint, same PAM, same prompt library. Owner manages settings and wizard; members build and use all tools.',
      bullets: [
        'Up to 5 members per project',
        'Owner and member roles',
        'Shared blueprint, prompts, and context',
        'Pro plan required',
      ],
      accent3d: 'small',
    },
  ]

  return (
    <div className={`${inter.className} page-enter`} style={{
      background: '#05050f', color: '#fff',
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      <style>{`
        .sr{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.06s}.d2{transition-delay:.14s}.d3{transition-delay:.22s}
        .d4{transition-delay:.30s}.d5{transition-delay:.38s}.d6{transition-delay:.46s}
        @keyframes orb-drift{
          0%,100%{transform:translate(0,0) scale(1)}
          33%{transform:translate(24px,-16px) scale(1.04)}
          66%{transform:translate(-16px,12px) scale(0.97)}
        }
        @keyframes ring-float{
          0%,100%{transform:translateY(0) rotate(0deg)}
          50%{transform:translateY(-8px) rotate(5deg)}
        }
        @keyframes dot-pulse{
          0%,100%{opacity:0.4;transform:scale(1)}
          50%{opacity:1;transform:scale(1.3)}
        }
        .feat{transition:border-color .2s,background .2s,transform .2s}
        .feat:hover{transform:translateY(-4px)}
      `}</style>

      {/* Fixed top glow */}
      <div style={{
        position: 'fixed', top: -200, left: '50%',
        transform: 'translateX(-50%)',
        width: 800, height: 500,
        background: `radial-gradient(ellipse,${hexToRgba(ac, 0.14)} 0%,transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }}/>

      <LandingNav />

      {/* Hero */}
      <section style={{
        padding: mobile ? '130px 24px 60px' : '160px 60px 80px',
        textAlign: 'center', position: 'relative', zIndex: 1,
      }}>
        {/* Floating ring accents behind hero text */}
        {!mobile && (
          <>
            <div style={{
              position: 'absolute', top: 100, left: '12%',
              width: 100, height: 100, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.1)}`,
              animation: 'ring-float 7s ease-in-out infinite',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', top: 160, right: '10%',
              width: 60, height: 60, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.08)}`,
              animation: 'ring-float 5s ease-in-out 2s infinite',
              pointerEvents: 'none',
            }}/>
          </>
        )}

        <div className="sr" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: hexToRgba(ac, 0.1),
          border: `1px solid ${hexToRgba(ac, 0.3)}`,
          borderRadius: 999, padding: '6px 20px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          color: ac, textTransform: 'uppercase' as const, marginBottom: 28,
        }}>
          <Zap size={10}/> Platform Features
        </div>

        <h1 className="sr" style={{
          fontSize: mobile ? 'clamp(32px,8vw,48px)' : 'clamp(42px,5.5vw,72px)',
          fontWeight: 900, letterSpacing: '-0.03em',
          lineHeight: 1.06, maxWidth: 820, margin: '0 auto 20px',
        }}>
          Everything you need to build with AI —{' '}
          <span style={{
            background: `linear-gradient(135deg,${ac},#fff)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            without the friction.
          </span>
        </h1>
        <p className="sr" style={{
          maxWidth: 560, margin: '0 auto',
          fontSize: mobile ? 14 : 17,
          color: 'rgba(255,255,255,0.5)', lineHeight: 1.75,
        }}>
          Eleven tools, one platform. Context stored. Git-aware. Editor-integrated.
          Local sync. Team collaboration. From first idea to shipped code.
        </p>
      </section>

      {/* Features grid */}
      <section style={{
        maxWidth: 1160, margin: '0 auto',
        padding: mobile ? '20px 24px 100px' : '20px 60px 140px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)',
          gap: 16,
        }}>
          {features.map((f, i) => {
            const Icon = f.icon
            const isLarge  = f.accent3d === 'large'
            const isMed    = f.accent3d === 'medium'

            return (
              <div key={i}
                className={`sr feat d${(i % 3) + 1}`}
                style={{
                  borderRadius: 20, padding: '32px 28px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  display: 'flex', flexDirection: 'column', gap: 0,
                  position: 'relative', overflow: 'hidden',
                  // Large cards span 2 columns on desktop
                  gridColumn: isLarge && !mobile ? 'span 2' : undefined,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = hexToRgba(ac, 0.32)
                  e.currentTarget.style.background = hexToRgba(ac, 0.05)
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                }}
              >
                {/* 3D WebGL orb — large cards */}
                {isLarge && !mobile && (
                  <div style={{
                    position: 'absolute',
                    right: -50, bottom: -50,
                    width: 220, height: 220,
                    opacity: 0.4, pointerEvents: 'none',
                  }}>
                    <BentoScene accent={ac} />
                  </div>
                )}

                {/* CSS 3D depth glow — medium cards */}
                {isMed && (
                  <>
                    <div style={{
                      position: 'absolute',
                      right: -24, top: -24,
                      width: 110, height: 110, borderRadius: '50%',
                      background: `radial-gradient(ellipse,${hexToRgba(ac, 0.22)} 0%,transparent 70%)`,
                      animation: 'orb-drift 9s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}/>
                    <div style={{
                      position: 'absolute',
                      right: 16, top: 16,
                      width: 40, height: 40, borderRadius: '50%',
                      border: `1px solid ${hexToRgba(ac, 0.18)}`,
                      animation: 'ring-float 6s ease-in-out infinite',
                      pointerEvents: 'none',
                    }}/>
                  </>
                )}

                {/* Small card: glowing dot accent */}
                {!isLarge && !isMed && (
                  <div style={{
                    position: 'absolute',
                    top: 14, right: 14,
                    width: 7, height: 7, borderRadius: '50%',
                    background: hexToRgba(ac, 0.5),
                    boxShadow: `0 0 8px ${hexToRgba(ac, 0.6)}`,
                    animation: 'dot-pulse 3s ease-in-out infinite',
                  }}/>
                )}

                {/* Content */}
                <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: 13,
                    background: hexToRgba(ac, 0.1),
                    border: `1px solid ${hexToRgba(ac, 0.22)}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 20, flexShrink: 0,
                  }}>
                    <Icon size={21} color={ac}/>
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
                    textTransform: 'uppercase' as const,
                    color: hexToRgba(ac, 0.75), marginBottom: 6,
                  }}>{f.tag}</div>
                  <h3 style={{
                    fontSize: isLarge ? 20 : 17,
                    fontWeight: 700, color: '#fff',
                    margin: '0 0 10px', letterSpacing: '-0.01em',
                  }}>{f.title}</h3>
                  <p style={{
                    fontSize: 13.5,
                    color: 'rgba(255,255,255,0.48)',
                    lineHeight: 1.72, margin: '0 0 20px',
                    flex: 1,
                    maxWidth: isLarge ? 520 : undefined,
                  }}>{f.desc}</p>
                  <div style={{
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: 16,
                    display: 'flex', flexDirection: 'column', gap: 8,
                  }}>
                    {f.bullets.map((b, bi) => (
                      <div key={bi} style={{
                        display: 'flex', alignItems: 'center',
                        gap: 8, fontSize: 12,
                        color: 'rgba(255,255,255,0.45)',
                      }}>
                        <Check size={11} color={ac}/>{b}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* CTA */}
        <div className="sr" style={{
          borderRadius: 24,
          padding: mobile ? '48px 28px' : '60px 56px',
          textAlign: 'center', marginTop: 60,
          position: 'relative', overflow: 'hidden',
          background: hexToRgba(ac, 0.06),
          border: `1px solid ${hexToRgba(ac, 0.2)}`,
          boxShadow: `0 0 80px ${hexToRgba(ac, 0.07)}`,
        }}>
          {/* 3D orb inside CTA */}
          <div style={{
            position: 'absolute', right: -60, top: -60,
            width: 200, height: 200, opacity: 0.3,
            pointerEvents: 'none',
          }}>
            <BentoScene accent={ac} />
          </div>
          <div style={{
            position: 'absolute', top: -60, left: '50%',
            transform: 'translateX(-50%)',
            width: 320, height: 220,
            background: `radial-gradient(ellipse,${hexToRgba(ac, 0.14)} 0%,transparent 70%)`,
            pointerEvents: 'none',
          }}/>
          <div style={{ position: 'relative' }}>
            <h2 style={{
              fontSize: mobile ? 24 : 40, fontWeight: 900,
              color: '#fff', letterSpacing: '-0.02em',
              margin: '0 0 14px',
            }}>Ready to try it yourself?</h2>
            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,0.45)',
              margin: '0 auto 36px', maxWidth: 440, lineHeight: 1.7,
            }}>
              Free to start. No credit card. Your first project is ready
              in under two minutes.
            </p>
            <Link href="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 36px', background: ac, color: '#000',
              borderRadius: 999, textDecoration: 'none',
              fontSize: 13, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              boxShadow: `0 0 40px ${hexToRgba(ac, 0.4)}`,
            }}>
              Start Building Free <ArrowRight size={14}/>
            </Link>
          </div>
        </div>
      </section>

      <footer style={{
        padding: '48px 60px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', maxWidth: 1160, margin: '0 auto',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
          © {new Date().getFullYear()} Reminisce
        </div>
        <Link href="/dashboard" style={{
          fontSize: 12, color: 'rgba(255,255,255,0.3)',
          textDecoration: 'none', transition: 'color .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.color = '#fff'}
        onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}
        >
          Launch Workspace →
        </Link>
      </footer>
    </div>
  )
}
