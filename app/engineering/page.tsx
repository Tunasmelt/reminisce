'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  ArrowRight, GitBranch, Layers, Zap,
  Database, Bot, FolderSync, FileCode2,
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
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sr-vis') }),
      { threshold: 0.08 }
    )
    document.querySelectorAll('.sr').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

// Animated connector line between pipeline steps
function PipelineConnector({ accent, active }: { accent: string; active: boolean }) {
  return (
    <div style={{
      width: 2, height: 28, margin: '0 auto',
      background: active
        ? `linear-gradient(to bottom, ${accent}, ${hexToRgba(accent, 0.3)})`
        : 'rgba(255,255,255,0.08)',
      transition: 'background 0.5s ease',
      boxShadow: active ? `0 0 6px ${hexToRgba(accent, 0.5)}` : 'none',
      borderRadius: 2,
    }}/>
  )
}

export default function EngineeringPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const [mobile, setMobile] = useState(false)
  const [activeStep, setActiveStep] = useState(-1)
  useScrollReveal()

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  // Scroll-driven step activation
  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = parseInt((e.target as HTMLElement).dataset.step || '-1')
          if (idx >= 0) setActiveStep(idx)
        }
      })
    }, { threshold: 0.4, rootMargin: '-5% 0px -45% 0px' })
    const timer = setTimeout(() => {
      document.querySelectorAll('[data-step]').forEach(el => io.observe(el))
    }, 400)
    return () => { clearTimeout(timer); io.disconnect() }
  }, [])

  const steps = [
    {
      icon: Database,   num: '01',
      title: 'Run the Wizard',
      desc:  'Answer four questions about your project — idea, features, tech stack, and scope. Reminisce fires five parallel generation calls and builds your complete project blueprint in one run.',
      detail: 'Generates: architecture.md · tech-stack.md · coding-guidelines.md · product-scope.md · phases.md · master-prompt.md · editor integration file',
    },
    {
      icon: FolderSync, num: '02',
      title: 'Connect your local folder',
      desc:  'Point Reminisce at your project root. Context files are written to disk immediately. Your git branch and last commit are read from .git/ — no API calls, no auth required.',
      detail: 'Reads: .git/HEAD · .git/logs/HEAD · package.json · go.mod · requirements.txt',
    },
    {
      icon: FileCode2,  num: '03',
      title: 'Editor integration activates',
      desc:  'Your chosen editor file (.cursorrules, CLAUDE.md, or copilot-instructions.md) is in your project root. Every time you open your editor in that folder, full project context is loaded automatically.',
      detail: 'Supports: Cursor · Claude Code · GitHub Copilot · Windsurf · Generic (reminisce-context.md)',
    },
    {
      icon: Zap,        num: '04',
      title: 'Context injected in <50ms',
      desc:  'Before every AI call — agent run or PAM message — Reminisce assembles your full project header. Git branch, active phase, feature list, and summaries from every context file, tiered by relevance.',
      detail: 'Always injected: summaries + workflow files + git state. Smart-loaded: full file content on keyword match.',
    },
    {
      icon: Bot,        num: '05',
      title: 'Output logged automatically',
      desc:  'Every agent run appends a timestamped entry to agent-runs.md. Every PAM action appends to changes.md. Both files are git-branch-tagged so you can trace every change back to where it happened.',
      detail: 'Logs: reminisce/logs/agent-runs.md · reminisce/logs/changes.md (both auto-synced to local folder on push)',
    },
    {
      icon: Layers,     num: '06',
      title: 'Team stays in sync',
      desc:  'Up to five members share the same live context — same blueprint, same prompt library, same PAM. Any member can mark features done, create prompts, or run agent tasks. Context is always the ground truth.',
      detail: 'Owner manages: wizard · settings · member invites. Members access: PAM · agent · prompts · context view.',
    },
  ]

  const models = [
    { provider: 'Anthropic',  name: 'Claude Sonnet 4.6',  use: 'Architecture, complex reasoning, long context', tier: 'Pro'  },
    { provider: 'Anthropic',  name: 'Claude Haiku 4.5',   use: 'Fast responses, light tasks',                  tier: 'Pro'  },
    { provider: 'OpenAI',     name: 'GPT-4o',             use: 'General coding, multimodal',                   tier: 'Pro'  },
    { provider: 'Google',     name: 'Gemini 2.5 Pro',     use: 'Long context, data analysis',                  tier: 'Pro'  },
    { provider: 'Mistral',    name: 'Mistral Large',      use: 'Code generation, long documents',              tier: 'Pro'  },
    { provider: 'Mistral',    name: 'Codestral',          use: 'Code-specific generation',                     tier: 'Pro'  },
    { provider: 'Groq',       name: 'Llama 3.3 70B',     use: 'General tasks — fast, no cost',                tier: 'Free' },
    { provider: 'Groq',       name: 'Llama 4 Scout',     use: 'Capable generalist, no cost',                  tier: 'Free' },
    { provider: 'Groq',       name: 'Kimi K2',           use: 'Long context reasoning, no cost',              tier: 'Free' },
    { provider: 'Groq',       name: 'Qwen3 32B',         use: 'Multilingual reasoning, no cost',              tier: 'Free' },
    { provider: 'Cerebras',   name: 'Llama 3.3 70B',     use: 'Ultra-fast inference, no cost',                tier: 'Free' },
    { provider: 'SambaNova',  name: 'Llama 405B',        use: 'Large model quality, no cost',                 tier: 'Free' },
    { provider: 'Mistral',    name: 'Mistral Small',     use: 'Lightweight, no cost',                         tier: 'Free' },
  ]

  return (
    <div className={`${inter.className} page-enter`} style={{
      background: '#05050f', color: '#fff',
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      <style>{`
        .sr{opacity:0;transform:translateY(20px);transition:opacity .65s ease,transform .65s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.06s}.d2{transition-delay:.14s}.d3{transition-delay:.22s}
        .d4{transition-delay:.30s}.d5{transition-delay:.38s}.d6{transition-delay:.46s}
        @keyframes icon-glow{
          0%,100%{box-shadow:0 0 0 0 transparent}
          50%{box-shadow:0 0 16px 2px var(--ac-glow)}
        }
        @keyframes ring-float{
          0%,100%{transform:translateY(0) rotate(0deg)}
          50%{transform:translateY(-8px) rotate(4deg)}
        }
        @keyframes scanline{
          0%{transform:translateY(-4px);opacity:0}5%{opacity:1}
          95%{opacity:1}100%{transform:translateY(220px);opacity:0}
        }
        .step-row{transition:border-color .2s,background .2s,transform .2s}
        .step-row:hover{transform:translateX(4px)}
        .step-row.active-step{border-color:var(--ac-border)!important;background:var(--ac-bg)!important}
        .model-row{transition:background .15s}
        .model-row:hover{background:rgba(255,255,255,0.04)!important}
      `}</style>

      {/* Fixed glow */}
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
        {/* Floating ring accents */}
        {!mobile && (
          <>
            <div style={{
              position: 'absolute', top: 90, left: '8%',
              width: 90, height: 90, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.1)}`,
              animation: 'ring-float 7s ease-in-out infinite',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', top: 140, right: '9%',
              width: 56, height: 56, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.07)}`,
              animation: 'ring-float 5s ease-in-out 2.5s infinite',
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
          <GitBranch size={10}/> How It Works
        </div>

        <h1 className="sr" style={{
          fontSize: mobile ? 'clamp(30px,8vw,46px)' : 'clamp(40px,5vw,68px)',
          fontWeight: 900, letterSpacing: '-0.03em',
          lineHeight: 1.06, maxWidth: 780, margin: '0 auto 20px',
        }}>
          Simple to use.{' '}
          <span style={{
            background: `linear-gradient(135deg,${ac},#fff)`,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Precise under the hood.
          </span>
        </h1>

        <p className="sr" style={{
          maxWidth: 560, margin: '0 auto',
          fontSize: mobile ? 14 : 17,
          color: 'rgba(255,255,255,0.5)', lineHeight: 1.75,
        }}>
          Six steps from first idea to a fully context-aware, git-integrated,
          editor-connected development environment.
        </p>
      </section>

      {/* Pipeline — scroll-activated step cards */}
      <section style={{
        maxWidth: 860, margin: '0 auto',
        padding: mobile ? '20px 24px 80px' : '20px 60px 100px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {steps.map((s, i) => (
            <div key={i}>
              <div
                data-step={i}
                className={`step-row d${i + 1}${activeStep === i ? ' active-step' : ''}`}
                style={{
                  opacity: 1,
                  borderRadius: 20, padding: '24px 28px',
                  display: 'flex', alignItems: 'flex-start', gap: 20,
                  background: activeStep === i ? hexToRgba(ac, 0.05) : 'rgba(255,255,255,0.025)',
                  border: `1px solid ${activeStep === i ? hexToRgba(ac, 0.3) : 'rgba(255,255,255,0.08)'}`,
                  position: 'relative', overflow: 'hidden',
                  '--ac-border': hexToRgba(ac, 0.3),
                  '--ac-bg': hexToRgba(ac, 0.05),
                  '--ac-glow': hexToRgba(ac, 0.4),
                } as React.CSSProperties}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = hexToRgba(ac, 0.3)
                  e.currentTarget.style.background   = hexToRgba(ac, 0.04)
                }}
                onMouseLeave={e => {
                  if (activeStep !== i) {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.background   = 'rgba(255,255,255,0.025)'
                  }
                }}
              >
                {/* Step icon — glows when active */}
                <div style={{
                  flexShrink: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 6,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12,
                    background: hexToRgba(ac, activeStep === i ? 0.15 : 0.08),
                    border: `1px solid ${hexToRgba(ac, activeStep === i ? 0.4 : 0.2)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.3s',
                    animation: activeStep === i ? 'icon-glow 2s ease-in-out infinite' : 'none',
                  }}>
                    <s.icon size={20} color={ac}/>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 800,
                    color: activeStep === i ? ac : hexToRgba(ac, 0.4),
                    letterSpacing: '0.08em',
                    transition: 'color 0.3s',
                  }}>{s.num}</span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <h3 style={{
                    fontSize: 17, fontWeight: 700,
                    color: '#fff', margin: '0 0 8px',
                  }}>{s.title}</h3>
                  <p style={{
                    fontSize: 13.5, color: 'rgba(255,255,255,0.48)',
                    lineHeight: 1.72, margin: '0 0 12px',
                  }}>{s.desc}</p>
                  {/* Detail line — file/system detail */}
                  <div style={{
                    fontSize: 11, fontFamily: 'ui-monospace,monospace',
                    color: hexToRgba(ac, 0.5),
                    background: hexToRgba(ac, 0.06),
                    border: `1px solid ${hexToRgba(ac, 0.15)}`,
                    borderRadius: 6, padding: '6px 10px',
                    lineHeight: 1.6,
                  }}>
                    {s.detail}
                  </div>
                </div>

                {/* Active step: 3D depth orb */}
                {activeStep === i && (
                  <div style={{
                    position: 'absolute', right: -30, top: -30,
                    width: 100, height: 100, opacity: 0.25,
                    pointerEvents: 'none',
                  }}>
                    <BentoScene accent={ac} />
                  </div>
                )}
              </div>

              {/* Animated connector between steps */}
              {i < steps.length - 1 && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', paddingLeft: 40 }}>
                  <PipelineConnector accent={ac} active={activeStep > i} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Context demo — git-aware, with REMINISCE:SUMMARY pattern */}
      <section style={{
        maxWidth: 1060, margin: '0 auto',
        padding: mobile ? '0 24px 80px' : '0 60px 100px',
        position: 'relative', zIndex: 1,
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: mobile ? 40 : 60, alignItems: 'center',
        }}>
          <div className="sr">
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
              textTransform: 'uppercase' as const, color: ac, marginBottom: 16,
            }}>
              What the AI actually sees
            </p>
            <h2 style={{
              fontSize: mobile ? 24 : 36, fontWeight: 900,
              color: '#fff', letterSpacing: '-0.02em',
              margin: '0 0 16px', lineHeight: 1.15,
            }}>
              Every prompt carries your full project context.
            </h2>
            <p style={{
              fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.78,
              margin: '0 0 20px',
            }}>
              Reminisce assembles a precision header before every AI call —
              git branch, active phase, feature list, and tiered context summaries
              — injected silently in under 50ms.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Summaries',     desc: 'Always injected — one paragraph per context file' },
                { label: 'Workflow',      desc: 'Always full — phases.md and features.md' },
                { label: 'Git state',     desc: 'Branch + last commit in every message' },
                { label: 'Smart-load',    desc: 'Full file content loaded on keyword match' },
              ].map(({ label, desc }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: ac, flexShrink: 0, marginTop: 5,
                    boxShadow: `0 0 6px ${hexToRgba(ac, 0.6)}`,
                  }}/>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Code block — git-aware with REMINISCE:SUMMARY */}
          <div className="sr d2" style={{
            borderRadius: 16, padding: '24px',
            background: 'rgba(4,4,16,0.9)',
            border: '1px solid rgba(255,255,255,0.1)',
            fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
            fontSize: mobile ? 11 : 12, lineHeight: 1.7,
            color: 'rgba(255,255,255,0.75)',
            overflowX: 'auto', position: 'relative',
          }}>
            {/* Scanline */}
            <div style={{
              position: 'absolute', left: 0, right: 0, top: 0, height: 2,
              background: `linear-gradient(to right,transparent,${hexToRgba(ac, 0.8)},transparent)`,
              animation: 'scanline 3s ease-in-out infinite',
              pointerEvents: 'none', zIndex: 2,
            }}/>

            {/* 3D depth inner glow */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 16,
              background: `radial-gradient(ellipse at 85% 15%,${hexToRgba(ac, 0.07)} 0%,transparent 55%)`,
              pointerEvents: 'none',
            }}/>

            <div style={{ color: hexToRgba(ac, 0.6), marginBottom: 10, position: 'relative' }}>
              {'// Context header — assembled in <50ms'}
            </div>
            <div style={{ position: 'relative' }}>
              <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[PROJECT] </span>Notebook App — Phase 2</div>
              <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[BRANCH]  </span><span style={{ color: hexToRgba(ac, 0.9) }}>feature/user-auth</span></div>
              <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[COMMIT]  </span>Add JWT middleware</div>
              <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[PHASE]   </span>Authentication &amp; Sessions (in_progress)</div>
              <div style={{ marginTop: 10, color: hexToRgba(ac, 0.6) }}>
                {'<!-- REMINISCE:SUMMARY -->'}
              </div>
              <div style={{ paddingLeft: 14, color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>
                Next.js 14 app with Supabase auth, TypeScript strict mode,
                Tailwind for styling. Currently implementing JWT refresh flow
                and protected route middleware.
              </div>
              <div style={{ color: hexToRgba(ac, 0.6) }}>{'<!-- /REMINISCE:SUMMARY -->'}</div>
              <div style={{ marginTop: 10, color: hexToRgba(ac, 0.6) }}>[ACTIVE_FEATURES]</div>
              <div style={{ paddingLeft: 14, color: 'rgba(255,255,255,0.5)' }}>
                <div>→ OAuth2 flow implementation</div>
                <div>→ Token refresh middleware</div>
              </div>
              <div style={{ marginTop: 10 }}>
                <span style={{ color: 'rgba(255,255,255,0.3)' }}>[EDITOR]  </span>.cursorrules injected ✓
              </div>
              <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '12px 0' }}/>
              <div style={{ color: 'rgba(255,255,255,0.35)' }}>[YOUR_PROMPT]</div>
              <div style={{ marginTop: 4 }}>Review the OAuth flow for security issues...</div>
            </div>

            {/* Timing badge */}
            <div style={{
              position: 'absolute', bottom: 14, right: 14,
              fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
              color: ac, background: hexToRgba(ac, 0.1),
              border: `1px solid ${hexToRgba(ac, 0.25)}`,
              borderRadius: 999, padding: '3px 10px',
            }}>
              &lt; 50ms
            </div>
          </div>
        </div>
      </section>

      {/* Model table */}
      <section style={{
        maxWidth: 1060, margin: '0 auto',
        padding: mobile ? '0 24px 100px' : '0 60px 120px',
        position: 'relative', zIndex: 1,
      }}>
        <div className="sr" style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{
            fontSize: mobile ? 24 : 36, fontWeight: 900,
            color: '#fff', letterSpacing: '-0.02em', margin: '0 0 10px',
          }}>
            Models available
          </h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.35)', margin: 0 }}>
            Free models cost 🪙 coins. Pro models cost 💎 gems.
          </p>
        </div>

        <div className="sr" style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 18, overflow: 'hidden',
          position: 'relative',
        }}>
          {/* Table 3D depth glow */}
          <div style={{
            position: 'absolute', top: 0, right: 0,
            width: 300, height: 200, pointerEvents: 'none',
            background: `radial-gradient(ellipse at 80% 20%,${hexToRgba(ac, 0.06)} 0%,transparent 70%)`,
          }}/>

          {/* Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1.4fr 2.2fr 90px',
            padding: '14px 24px',
            background: 'rgba(255,255,255,0.04)',
            fontSize: 9, fontWeight: 800, letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.3)',
            textTransform: 'uppercase' as const,
          }}>
            <div>Provider</div>
            <div>Model</div>
            {!mobile && <div>Best for</div>}
            <div>Tier</div>
          </div>

          {/* Free / Pro section dividers */}
          {models.map((m, i) => {
            const prevTier = i > 0 ? models[i - 1].tier : null
            const showDivider = prevTier === 'Pro' && m.tier === 'Free'
            return (
              <div key={i}>
                {showDivider && (
                  <div style={{
                    padding: '8px 24px',
                    background: 'rgba(255,255,255,0.015)',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.14em',
                    color: 'rgba(255,255,255,0.2)',
                    textTransform: 'uppercase' as const,
                  }}>
                    Community models — free with coins
                  </div>
                )}
                <div
                  className="model-row"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: mobile ? '1fr 1fr' : '1fr 1.4fr 2.2fr 90px',
                    padding: '13px 24px',
                    borderTop: '1px solid rgba(255,255,255,0.05)',
                    fontSize: 13, alignItems: 'center',
                    background: 'transparent',
                  }}
                >
                  <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{m.provider}</div>
                  <div style={{ fontWeight: 600, color: '#fff', fontSize: 13 }}>{m.name}</div>
                  {!mobile && (
                    <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}>{m.use}</div>
                  )}
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 800, padding: '3px 8px',
                      borderRadius: 999, letterSpacing: '0.06em',
                      textTransform: 'uppercase' as const,
                      background: m.tier === 'Free' ? 'rgba(255,255,255,0.06)' : hexToRgba(ac, 0.1),
                      border: `1px solid ${m.tier === 'Free' ? 'rgba(255,255,255,0.1)' : hexToRgba(ac, 0.2)}`,
                      color: m.tier === 'Free' ? 'rgba(255,255,255,0.42)' : ac,
                    }}>
                      {m.tier}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section style={{
        maxWidth: 860, margin: '0 auto',
        padding: mobile ? '0 24px 80px' : '0 60px 100px',
        position: 'relative', zIndex: 1,
      }}>
        <div className="sr" style={{
          borderRadius: 24,
          padding: mobile ? '48px 28px' : '60px 56px',
          textAlign: 'center', overflow: 'hidden',
          position: 'relative',
          background: hexToRgba(ac, 0.06),
          border: `1px solid ${hexToRgba(ac, 0.2)}`,
          boxShadow: `0 0 80px ${hexToRgba(ac, 0.07)}`,
        }}>
          {/* 3D orb in CTA */}
          <div style={{
            position: 'absolute', right: -40, bottom: -40,
            width: 160, height: 160, opacity: 0.3,
            pointerEvents: 'none',
          }}>
            <BentoScene accent={ac} />
          </div>
          <div style={{
            position: 'absolute', top: -60, left: '50%',
            transform: 'translateX(-50%)',
            width: 300, height: 200,
            background: `radial-gradient(ellipse,${hexToRgba(ac, 0.14)} 0%,transparent 70%)`,
            pointerEvents: 'none',
          }}/>
          <div style={{ position: 'relative' }}>
            <h2 style={{
              fontSize: mobile ? 24 : 40, fontWeight: 900,
              color: '#fff', letterSpacing: '-0.02em', margin: '0 0 14px',
            }}>
              See it in action.
            </h2>
            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,0.45)',
              margin: '0 auto 36px', maxWidth: 400, lineHeight: 1.7,
            }}>
              Create your first project free. No credit card, no setup.
              Your blueprint is ready in under two minutes.
            </p>
            <Link href="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '13px 36px', background: ac, color: '#000',
              borderRadius: 999, textDecoration: 'none',
              fontSize: 13, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase' as const,
              boxShadow: `0 0 40px ${hexToRgba(ac, 0.4)}`,
            }}>
              Start for Free <ArrowRight size={14}/>
            </Link>
          </div>
        </div>
      </section>

      <footer style={{
        padding: '48px 60px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', maxWidth: 1120, margin: '0 auto',
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
