'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Database, Bot, Sparkles, GitBranch, FolderSync,
  FileCode2, Zap, Network, FlaskConical, Users,
  ArrowRight, Check, BookOpen,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { Inter } from 'next/font/google'
import LandingNav from '@/components/landing-nav'
import ReminisceLogo from '@/components/ReminisceLogo'

const inter = Inter({ subsets: ['latin'] })

const Scene3D = dynamic(() => import('@/components/Scene3D'), {
  ssr: false, loading: () => null,
})
const BentoScene = dynamic(() => import('@/components/BentoScene'), {
  ssr: false, loading: () => null,
})

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

function CountUp({ value, suffix = '' }: { value: string; suffix?: string }) {
  const ref   = useRef<HTMLSpanElement>(null)
  const fired = useRef(false)
  useEffect(() => {
    const num = parseFloat(value.replace(/[^0-9.]/g, ''))
    const isFloat = value.includes('.')
    if (isNaN(num)) return
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting || fired.current) return
      fired.current = true
      let start = 0
      const step = (ts: number) => {
        if (!start) start = ts
        const p = Math.min((ts - start) / 1800, 1)
        const ease = 1 - Math.pow(1 - p, 3)
        if (ref.current)
          ref.current.textContent =
            (isFloat ? (ease * num).toFixed(1) : Math.floor(ease * num).toString()) + suffix
        if (p < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, { threshold: 0.5 })
    if (ref.current) io.observe(ref.current)
    return () => io.disconnect()
  }, [value, suffix])
  return <span ref={ref}>0{suffix}</span>
}

function ScanLine({ accent }: { accent: string }) {
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0,
      top: 0, height: 2,
      background: `linear-gradient(to right,
        transparent 0%,
        ${hexToRgba(accent, 0.6)} 40%,
        ${hexToRgba(accent, 0.9)} 50%,
        ${hexToRgba(accent, 0.6)} 60%,
        transparent 100%)`,
      animation: 'scanline 3.2s ease-in-out infinite',
      pointerEvents: 'none', zIndex: 2,
    }}/>
  )
}

function StepDot({ accent, active }: { accent: string; active: boolean }) {
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%',
      background: active ? accent : 'rgba(255,255,255,0.12)',
      border: `2px solid ${active ? accent : 'rgba(255,255,255,0.2)'}`,
      boxShadow: active ? `0 0 12px ${hexToRgba(accent, 0.6)}` : 'none',
      transition: 'all 0.4s ease',
      flexShrink: 0, zIndex: 2,
    }}/>
  )
}

// ── Floating ring — lightweight CSS-only 3D accent ────────────────────────────
function FloatingRing({ accent, size = 120, opacity = 0.18, delay = '0s' }: {
  accent: string; size?: number; opacity?: number; delay?: string
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `1.5px solid ${hexToRgba(accent, opacity)}`,
      boxShadow: `0 0 ${size * 0.3}px ${hexToRgba(accent, opacity * 0.5)},
                  inset 0 0 ${size * 0.2}px ${hexToRgba(accent, opacity * 0.3)}`,
      animation: `ring-float 6s ease-in-out ${delay} infinite`,
      pointerEvents: 'none', flexShrink: 0,
    }}/>
  )
}

export default function Home() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const [scrollY,    setScrollY]    = useState(0)
  const [mobile,     setMobile]     = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  const stepsRef = useRef<HTMLDivElement>(null)
  useScrollReveal()

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const s = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', s, { passive: true })
    return () => window.removeEventListener('scroll', s)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          const idx = parseInt((e.target as HTMLElement).dataset.step || '0')
          setActiveStep(idx)
        }
      })
    }, { threshold: 0.35, rootMargin: '-10% 0px -40% 0px' })
    const timer = setTimeout(() => {
      document.querySelectorAll('[data-step]').forEach(el => io.observe(el))
    }, 600)
    return () => { clearTimeout(timer); io.disconnect() }
  }, [])

  // ── Feature data ─────────────────────────────────────────────────────────────
  const features = [
    {
      icon: Database,    tag: 'Core',          size: 'large',
      title: 'Context Engine',
      desc: 'Store your architecture, tech stack, and every decision. Every AI call reads from this automatically — no repetition, no copy-pasting, no hallucinations from missing context.',
      bullets: ['Version history on every file', 'Bidirectional local folder sync', 'Ownership model: Reminisce vs developer files'],
    },
    {
      icon: Bot,         tag: 'Core',          size: 'medium',
      title: 'AI Agent',
      desc: 'Pick a feature, pick a model, hit run. Full project context per call. Run history and git branch logged automatically.',
      bullets: ['15+ models across 6 providers', 'Auto-logs to agent-runs.md', 'BYOK for all providers'],
    },
    {
      icon: Sparkles,    tag: 'Onboarding',    size: 'medium',
      title: 'Project Wizard',
      desc: 'Four-stage conversation generates your entire blueprint — phases, features, context documents, prompts, and editor integration files.',
      bullets: ['Parallel wave generation', 'GitHub repo enrichment', 'Editor file auto-generation'],
    },
    {
      icon: GitBranch,   tag: 'Git',           size: 'small',
      title: 'Git Integration',
      desc: 'Reads your local .git/ directly. Branch and commit surface in PAM and context injection — no API calls, no auth.',
      bullets: ['Branch-aware context', 'Works offline'],
    },
    {
      icon: FolderSync,  tag: 'Sync',          size: 'small',
      title: 'Local Sync',
      desc: 'Connect your project folder. Reminisce writes context files to disk. Changes sync back on focus return.',
      bullets: ['Conflict detection', 'Pull and push controls'],
    },
    {
      icon: FileCode2,   tag: 'Editors',       size: 'small',
      title: 'Editor Files',
      desc: 'Auto-generates .cursorrules, CLAUDE.md, or copilot-instructions.md so every coding session starts with full context.',
      bullets: ['Cursor, Claude Code, Copilot, Windsurf', 'Set once in Settings'],
    },
    {
      icon: Network,     tag: 'Visual',        size: 'small',
      title: 'Graph View',
      desc: 'Visual map of every phase and feature with live status tracking.',
      bullets: ['Drag and drop', 'Phase dependencies'],
    },
    {
      icon: BookOpen,    tag: 'Prompts',       size: 'small',
      title: 'Prompt Library',
      desc: 'Three-tab archive: Blueprint prompts, custom prompts, and auto-populated changelog.',
      bullets: ['Copy for editor', 'Send to agent'],
    },
    {
      icon: FlaskConical,tag: 'Testing',       size: 'small',
      title: 'API Lab',
      desc: 'Built-in HTTP client for endpoint testing as you build.',
      bullets: ['All methods', 'Response inspector'],
    },
    {
      icon: Zap,         tag: 'AI',            size: 'small',
      title: 'PAM',
      desc: 'Project Action Manager. Ask about progress, mark features done, generate prompts — all via chat.',
      bullets: ['Scope drift alerts', 'Auto-changelog'],
    },
    {
      icon: Users,       tag: 'Team',          size: 'small',
      title: 'Collaboration',
      desc: 'Invite up to 5 members. Everyone works from the same live context.',
      bullets: ['Owner and member roles', 'Shared blueprint access'],
    },
  ]

  const steps = [
    { num: '01', title: 'Run the Wizard',          desc: 'Answer questions about what you\'re building. Reminisce generates context documents, phases, feature prompts, and editor integration files automatically.' },
    { num: '02', title: 'Connect your folder',     desc: 'Link your local project folder. Context files sync to disk. Your editor reads them on every session — no manual setup.' },
    { num: '03', title: 'Context injected',        desc: 'Before every AI call, your full project context — architecture, git branch, active phase, feature list — is assembled and attached in under 50ms.' },
    { num: '04', title: 'Build with PAM',          desc: 'Chat with your Project Action Manager. Ask for status, mark features done, generate prompts. Every action is logged to your project changelog.' },
    { num: '05', title: 'History saved back',      desc: 'Agent runs, PAM actions, and context changes are all logged to versioned markdown files in your project. Nothing is ever lost.' },
  ]

  const stats = [
    { val: '15',  suf: '+',  label: 'AI Models' },
    { val: '50',  suf: 'ms', label: 'Context Injection' },
    { val: '5',   suf: '×',  label: 'Faster Context Recall' },
    { val: '∞',   suf: '',   label: 'Memory Capacity' },
  ]

  // Bento layout
  // Row 1: Context Engine (col 1-2, tall) | AI Agent (col 3, tall)
  // Row 2: Wizard (col 1-2) | Git (col 3)
  // Row 3: Local Sync | Editor Files | Graph | Prompt Library
  // Row 4: API Lab | PAM | Collaboration (spans 1-2) [or 3 equal]
  const bentoLayout = [
    { fi: 0,  col: '1 / 3', row: '1 / 3', minH: 320 },
    { fi: 1,  col: '3 / 4', row: '1 / 3', minH: 320 },
    { fi: 2,  col: '1 / 3', row: '3 / 4', minH: 210 },
    { fi: 3,  col: '3 / 4', row: '3 / 4', minH: 210 },
    { fi: 4,  col: '1 / 2', row: '4 / 5', minH: 170 },
    { fi: 5,  col: '2 / 3', row: '4 / 5', minH: 170 },
    { fi: 6,  col: '3 / 4', row: '4 / 5', minH: 170 },
    { fi: 7,  col: '1 / 2', row: '5 / 6', minH: 155 },
    { fi: 8,  col: '2 / 3', row: '5 / 6', minH: 155 },
    { fi: 9,  col: '3 / 4', row: '5 / 6', minH: 155 },
    { fi: 10, col: '1 / 4', row: '6 / 7', minH: 130 },
  ]

  const heroFade = Math.max(0, 1 - scrollY / 500)
  const heroUp   = scrollY * 0.18

  return (
    <div className={inter.className} style={{
      background: '#05050f', color: '#fff',
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      <style>{`
        .sr{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.06s}.d2{transition-delay:.14s}.d3{transition-delay:.22s}
        .d4{transition-delay:.30s}.d5{transition-delay:.38s}.d6{transition-delay:.46s}
        @keyframes badge-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes ring-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-10px) rotate(6deg)}}
        @keyframes scanline{
          0%{transform:translateY(-4px);opacity:0}
          5%{opacity:1}95%{opacity:1}
          100%{transform:translateY(300px);opacity:0}
        }
        @keyframes orb-drift{
          0%,100%{transform:translate(0,0) scale(1)}
          33%{transform:translate(30px,-20px) scale(1.04)}
          66%{transform:translate(-20px,15px) scale(0.97)}
        }
        .bento-card{transition:border-color .22s,background .22s,transform .22s}
        .bento-card:hover{transform:translateY(-3px)}
        .step-card{transition:border-color .2s,background .2s}
        .step-card.active{border-color:var(--ac-border)!important;background:var(--ac-bg)!important}
      `}</style>

      {/* Fixed radial top glow */}
      <div style={{
        position: 'fixed', top: -240, left: '50%',
        transform: 'translateX(-50%)',
        width: 900, height: 560,
        background: `radial-gradient(ellipse,${hexToRgba(ac, 0.15)} 0%,transparent 68%)`,
        pointerEvents: 'none', zIndex: 0,
        transition: 'background 0.5s ease',
      }}/>

      <LandingNav />

      {/* ══════════ HERO ══════════════════════════════════════════ */}
      <section style={{
        position: 'relative', height: '100vh',
        display: 'flex', alignItems: 'center',
        justifyContent: 'center', overflow: 'hidden',
      }}>
        {/* WebGL network canvas */}
        <div style={{
          position: 'absolute', inset: 0,
          opacity: heroFade, transition: 'opacity .1s linear',
        }}>
          <Scene3D accent={ac} />
        </div>

        {/* Floating rings — CSS 3D accent layer */}
        {!mobile && (
          <>
            <div style={{ position: 'absolute', top: '18%', left: '8%', pointerEvents: 'none' }}>
              <FloatingRing accent={ac} size={180} opacity={0.12} delay="0s" />
            </div>
            <div style={{ position: 'absolute', top: '55%', right: '7%', pointerEvents: 'none' }}>
              <FloatingRing accent={ac} size={120} opacity={0.09} delay="2s" />
            </div>
            <div style={{ position: 'absolute', bottom: '12%', left: '22%', pointerEvents: 'none' }}>
              <FloatingRing accent={ac} size={80} opacity={0.07} delay="4s" />
            </div>
          </>
        )}

        {/* Centre radial glow */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 720, height: 720,
          background: `radial-gradient(ellipse,${hexToRgba(ac, 0.14)} 0%,transparent 60%)`,
          pointerEvents: 'none',
        }}/>

        {/* Hero copy */}
        <div style={{
          position: 'relative', zIndex: 2, textAlign: 'center',
          padding: mobile ? '0 24px' : '0 48px',
          maxWidth: 880,
          transform: `translateY(${heroUp}px)`,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14, marginBottom: 40,
          }}>
            <ReminisceLogo
              size={mobile ? 72 : 96}
              color="#ffffff"
              glowColor={hexToRgba(ac, 0.55)}
            />
            <span style={{
              fontSize: mobile ? 22 : 28, fontWeight: 900,
              letterSpacing: '0.18em', textTransform: 'uppercase' as const,
              fontStyle: 'italic', color: '#fff',
            }}>
              Reminisce
            </span>
          </div>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: hexToRgba(ac, 0.1),
            border: `1px solid ${hexToRgba(ac, 0.3)}`,
            borderRadius: 999, padding: '5px 16px',
            fontSize: 10, fontWeight: 800,
            letterSpacing: '0.18em', color: ac,
            textTransform: 'uppercase' as const,
            marginBottom: 24,
            animation: 'badge-float 4s ease-in-out infinite',
          }}>
            <GitBranch size={10} /> AI Context Platform for Developers
          </div>

          <h1 style={{
            fontSize: mobile ? 'clamp(30px,9vw,46px)' : 'clamp(44px,5.5vw,72px)',
            fontWeight: 900, letterSpacing: '-0.03em',
            lineHeight: 1.06, color: '#fff', margin: '0 0 20px',
          }}>
            Your project context,<br />
            <span style={{
              background: `linear-gradient(135deg,${ac} 0%,#fff 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              always in the room.
            </span>
          </h1>

          <p style={{
            fontSize: mobile ? 15 : 18,
            color: 'rgba(255,255,255,0.52)',
            lineHeight: 1.75, maxWidth: 580,
            margin: '0 auto 14px',
          }}>
            Reminisce stores your architecture, decisions, and git state — then
            injects them into every AI call automatically. Syncs to your local
            folder. Generates editor integration files. Remembers everything.
          </p>
          <p style={{
            fontSize: mobile ? 13 : 15,
            color: hexToRgba(ac, 0.8),
            marginBottom: 40, fontWeight: 700,
          }}>
            Define once. Build forever.
          </p>

          <div style={{
            display: 'flex', gap: 14,
            justifyContent: 'center', flexWrap: 'wrap' as const,
          }}>
            <Link href="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: ac, color: '#000',
              padding: mobile ? '12px 28px' : '14px 40px',
              borderRadius: 999, fontSize: 14, fontWeight: 800,
              letterSpacing: '0.04em', textDecoration: 'none',
              boxShadow: `0 0 48px ${hexToRgba(ac, 0.48)}`,
            }}>
              Start free <ArrowRight size={15}/>
            </Link>
            <Link href="/capabilities" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.14)',
              color: 'rgba(255,255,255,0.85)',
              padding: mobile ? '12px 28px' : '14px 40px',
              borderRadius: 999, fontSize: 14, fontWeight: 600,
              textDecoration: 'none', backdropFilter: 'blur(12px)',
            }}>
              See all features
            </Link>
          </div>
        </div>

        {/* Scroll caret */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 6,
          opacity: Math.max(0, 1 - scrollY / 120),
        }}>
          <span style={{
            fontSize: 9, letterSpacing: '0.22em',
            color: 'rgba(255,255,255,0.18)',
            textTransform: 'uppercase' as const,
          }}>scroll</span>
          <div style={{
            width: 1, height: 44,
            background: `linear-gradient(to bottom,${ac},transparent)`,
          }}/>
        </div>
      </section>

      {/* ══════════ STATS ══════════════════════════════════════════ */}
      <section style={{
        padding: mobile ? '60px 24px' : '80px 60px',
        borderTop: `1px solid ${hexToRgba(ac, 0.1)}`,
        borderBottom: `1px solid ${hexToRgba(ac, 0.1)}`,
        background: hexToRgba(ac, 0.04),
      }}>
        <div style={{
          maxWidth: 1120, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
          gap: 32,
        }}>
          {stats.map((s, i) => (
            <div key={i} className={`sr d${i + 1}`} style={{ position: 'relative' }}>
              <div style={{
                position: 'relative',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '28px 16px',
                minHeight: mobile ? 120 : 150,
              }}>
                {/* Hex frame */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: hexToRgba(ac, 0.06),
                  border: `1px solid ${hexToRgba(ac, 0.2)}`,
                  borderRadius: 20,
                  clipPath: 'polygon(25% 0%,75% 0%,100% 50%,75% 100%,25% 100%,0% 50%)',
                }}/>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(ellipse at 50% 50%,${hexToRgba(ac, 0.12)} 0%,transparent 70%)`,
                  pointerEvents: 'none',
                }}/>
                <div style={{
                  fontSize: mobile ? 40 : 54, fontWeight: 900,
                  letterSpacing: '-0.04em', color: ac,
                  lineHeight: 1, marginBottom: 6, position: 'relative',
                }}>
                  {s.val === '∞' ? '∞' : <CountUp value={s.val} suffix={s.suf}/>}
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.45)',
                  fontWeight: 600, letterSpacing: '0.06em',
                  textAlign: 'center', position: 'relative',
                }}>
                  {s.label}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ═══════════════════════════════════ */}
      <section style={{
        padding: mobile ? '80px 24px' : '120px 60px',
        maxWidth: 1120, margin: '0 auto',
      }}>
        <div className="sr" style={{ textAlign: 'center', marginBottom: 64 }}>
          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
            color: ac, textTransform: 'uppercase' as const, marginBottom: 14,
          }}>How it works</p>
          <h2 style={{
            fontSize: mobile ? 28 : 46, fontWeight: 800,
            letterSpacing: '-0.03em', color: '#fff',
          }}>
            Five steps. Fully automatic.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: mobile ? 40 : 80, alignItems: 'start',
        }}>
          {/* Steps */}
          <div ref={stepsRef} style={{ position: 'relative' }}>
            {!mobile && (
              <div style={{
                position: 'absolute', left: 5, top: 14,
                width: 2, bottom: 14, background: 'rgba(255,255,255,0.08)', zIndex: 0,
              }}>
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0,
                  height: `${((activeStep + 1) / steps.length) * 100}%`,
                  background: `linear-gradient(to bottom,${ac},${hexToRgba(ac, 0.2)})`,
                  transition: 'height 0.5s ease',
                  boxShadow: `0 0 8px ${hexToRgba(ac, 0.5)}`,
                }}/>
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {steps.map((s, i) => (
                <div
                  key={i}
                  data-step={i}
                  className={`step-card${activeStep === i ? ' active' : ''}`}
                  style={{
                    display: 'flex', gap: mobile ? 16 : 20,
                    alignItems: 'flex-start',
                    padding: '20px 24px',
                    background: activeStep === i ? hexToRgba(ac, 0.06) : 'rgba(255,255,255,0.025)',
                    border: `1px solid ${activeStep === i ? hexToRgba(ac, 0.3) : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: 16,
                    '--ac-border': hexToRgba(ac, 0.3),
                    '--ac-bg': hexToRgba(ac, 0.06),
                  } as React.CSSProperties}
                >
                  <div style={{
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 0, flexShrink: 0,
                    marginTop: 2, position: 'relative', zIndex: 1,
                  }}>
                    <StepDot accent={ac} active={activeStep === i} />
                  </div>
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 800,
                      color: hexToRgba(ac, 0.6),
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase' as const,
                      display: 'block', marginBottom: 4,
                    }}>Step {s.num}</span>
                    <h3 style={{
                      fontSize: 15, fontWeight: 700,
                      color: '#fff', marginBottom: 6,
                    }}>{s.title}</h3>
                    <p style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.45)',
                      lineHeight: 1.7, margin: 0,
                    }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context demo — now git-aware */}
          <div className="sr d2" style={{
            position: 'relative',
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 18, padding: '24px',
            fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
            fontSize: mobile ? 11 : 12.5,
            lineHeight: 1.7, color: 'rgba(255,255,255,0.75)',
            overflowX: 'auto', overflow: 'hidden',
          }}>
            <ScanLine accent={ac} />

            {/* 3D depth illusion — layered inner glow */}
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 18,
              background: `radial-gradient(ellipse at 80% 20%,${hexToRgba(ac, 0.08)} 0%,transparent 60%)`,
              pointerEvents: 'none',
            }}/>

            <div style={{ color: hexToRgba(ac, 0.65), marginBottom: 12, position: 'relative' }}>
              {'// Context header — injected automatically'}
            </div>
            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[PROJECT] </span>Notebook App — Phase 2</div>
            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[STACK]   </span>Next.js · Supabase · TypeScript</div>
            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[BRANCH]  </span><span style={{ color: hexToRgba(ac, 0.9) }}>feature/user-auth</span></div>
            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[COMMIT]  </span>Add JWT middleware and token refresh</div>
            <div><span style={{ color: 'rgba(255,255,255,0.3)' }}>[PHASE]   </span>Authentication &amp; User Sessions</div>
            <div style={{ marginTop: 10, color: hexToRgba(ac, 0.65) }}>[ACTIVE_FEATURES]</div>
            <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.5)' }}>
              <div>→ OAuth2 flow implementation</div>
              <div>→ Session token refresh</div>
              <div>→ Protected route middleware</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.3)' }}>[EDITOR]  </span>.cursorrules injected ✓
            </div>
            <div style={{
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              margin: '14px 0',
            }}/>
            <div style={{ color: 'rgba(255,255,255,0.35)' }}>[YOUR_PROMPT]</div>
            <div style={{ marginTop: 4 }}>Review the OAuth flow for security issues...</div>
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

      {/* ══════════ BENTO FEATURES ═════════════════════════════════ */}
      <section style={{
        padding: mobile ? '60px 24px' : '100px 60px',
        maxWidth: 1120, margin: '0 auto',
      }}>
        <div className="sr" style={{ textAlign: 'center', marginBottom: 60 }}>
          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
            color: ac, textTransform: 'uppercase' as const, marginBottom: 14,
          }}>Platform</p>
          <h2 style={{
            fontSize: mobile ? 28 : 46, fontWeight: 800,
            letterSpacing: '-0.03em', color: '#fff', marginBottom: 12,
          }}>
            Eleven tools. One platform.
          </h2>
          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,0.42)',
            maxWidth: 520, margin: '0 auto',
          }}>
            From first idea to shipped code — context stored, git-aware,
            editor-integrated, and always in sync with your local folder.
          </p>
        </div>

        {mobile ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {features.map((f, i) => {
              const Icon = f.icon
              return (
                <div key={i} className="bento-card" style={{
                  padding: '24px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 18,
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = hexToRgba(ac, 0.35)
                  e.currentTarget.style.background = hexToRgba(ac, 0.05)
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                  e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 11,
                    background: hexToRgba(ac, 0.1),
                    border: `1px solid ${hexToRgba(ac, 0.2)}`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: 'center', marginBottom: 14,
                  }}>
                    <Icon size={19} color={ac}/>
                  </div>
                  <div style={{
                    fontSize: 9, fontWeight: 800, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    color: hexToRgba(ac, 0.7), marginBottom: 5,
                  }}>{f.tag}</div>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 7 }}>{f.title}</h3>
                  <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.65, margin: 0 }}>{f.desc}</p>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gridAutoRows: 'minmax(80px, auto)',
            gap: 16,
          }}>
            {bentoLayout.map(({ fi, col, row, minH }) => {
              const f = features[fi]
              const Icon = f.icon
              const isLarge = f.size === 'large'
              const isMed   = f.size === 'medium'

              return (
                <div key={fi}
                  className={`sr bento-card d${(fi % 3) + 1}`}
                  style={{
                    gridColumn: col, gridRow: row,
                    minHeight: minH,
                    padding: isLarge ? '32px' : isMed ? '28px' : '24px',
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: isLarge ? 24 : 18,
                    position: 'relative', overflow: 'hidden',
                    display: 'flex', flexDirection: 'column',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = hexToRgba(ac, 0.35)
                    e.currentTarget.style.background = hexToRgba(ac, 0.05)
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.background = 'rgba(255,255,255,0.025)'
                  }}
                >
                  {/* 3D WebGL orb — large cards only */}
                  {isLarge && (
                    <div style={{
                      position: 'absolute',
                      right: -40, bottom: -40,
                      width: 200, height: 200,
                      opacity: 0.45, pointerEvents: 'none',
                    }}>
                      <BentoScene accent={ac} />
                    </div>
                  )}

                  {/* CSS 3D depth glow — medium cards */}
                  {isMed && !isLarge && (
                    <>
                      <div style={{
                        position: 'absolute',
                        right: -30, bottom: -30,
                        width: 130, height: 130, borderRadius: '50%',
                        background: `radial-gradient(ellipse,${hexToRgba(ac, 0.28)} 0%,transparent 70%)`,
                        pointerEvents: 'none',
                        animation: 'orb-drift 8s ease-in-out infinite',
                      }}/>
                      <div style={{
                        position: 'absolute',
                        right: 20, bottom: 20,
                        width: 60, height: 60, borderRadius: '50%',
                        border: `1px solid ${hexToRgba(ac, 0.2)}`,
                        pointerEvents: 'none',
                        animation: 'ring-float 5s ease-in-out infinite',
                      }}/>
                    </>
                  )}

                  {/* Small card accent corner dot */}
                  {!isLarge && !isMed && (
                    <div style={{
                      position: 'absolute',
                      top: 12, right: 12,
                      width: 8, height: 8, borderRadius: '50%',
                      background: hexToRgba(ac, 0.35),
                      boxShadow: `0 0 8px ${hexToRgba(ac, 0.5)}`,
                    }}/>
                  )}

                  {/* Content */}
                  <div style={{ position: 'relative', zIndex: 1, flex: 1 }}>
                    <div style={{
                      width: isLarge ? 48 : 40,
                      height: isLarge ? 48 : 40,
                      borderRadius: isLarge ? 14 : 11,
                      background: hexToRgba(ac, 0.1),
                      border: `1px solid ${hexToRgba(ac, 0.22)}`,
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center',
                      marginBottom: isLarge ? 20 : 14,
                    }}>
                      <Icon size={isLarge ? 22 : 19} color={ac}/>
                    </div>
                    <div style={{
                      fontSize: 9, fontWeight: 800,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase' as const,
                      color: hexToRgba(ac, 0.7), marginBottom: 6,
                    }}>{f.tag}</div>
                    <h3 style={{
                      fontSize: isLarge ? 20 : isMed ? 17 : 14,
                      fontWeight: 700, color: '#fff',
                      marginBottom: isLarge ? 12 : 8,
                    }}>{f.title}</h3>
                    <p style={{
                      fontSize: isLarge ? 14 : 13,
                      color: 'rgba(255,255,255,0.45)',
                      lineHeight: 1.7, margin: 0,
                    }}>{f.desc}</p>

                    {(isLarge || isMed) && (
                      <div style={{
                        marginTop: 20, display: 'flex',
                        flexDirection: 'column', gap: 8,
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
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ══════════ PRICING CTA ════════════════════════════════ */}
      <section style={{
        padding: mobile ? '60px 24px' : '80px 60px',
        maxWidth: 860, margin: '0 auto',
      }}>
        <div className="sr" style={{
          borderRadius: 24,
          padding: mobile ? '48px 28px' : '64px 56px',
          textAlign: 'center',
          position: 'relative', overflow: 'hidden',
          background: hexToRgba(ac, 0.06),
          border: `1px solid ${hexToRgba(ac, 0.22)}`,
          boxShadow: `0 0 80px ${hexToRgba(ac, 0.08)}`,
        }}>
          {/* Depth glow */}
          <div style={{
            position: 'absolute', top: -60, left: '50%',
            transform: 'translateX(-50%)',
            width: 400, height: 240,
            background: `radial-gradient(ellipse,${hexToRgba(ac, 0.16)} 0%,transparent 70%)`,
            pointerEvents: 'none',
          }}/>

          {/* Floating ring accents */}
          {!mobile && (
            <>
              <div style={{
                position: 'absolute', left: 32, top: 32,
                width: 64, height: 64, borderRadius: '50%',
                border: `1px solid ${hexToRgba(ac, 0.12)}`,
                animation: 'ring-float 7s ease-in-out infinite',
                pointerEvents: 'none',
              }}/>
              <div style={{
                position: 'absolute', right: 40, bottom: 32,
                width: 44, height: 44, borderRadius: '50%',
                border: `1px solid ${hexToRgba(ac, 0.1)}`,
                animation: 'ring-float 5s ease-in-out 2s infinite',
                pointerEvents: 'none',
              }}/>
            </>
          )}

          <div style={{ position: 'relative' }}>
            {/* Plan pills */}
            <div style={{
              display: 'flex', gap: 10,
              justifyContent: 'center',
              marginBottom: 28, flexWrap: 'wrap' as const,
            }}>
              {[
                { label: 'Free — $0/mo',   sub: '2 projects · Community models',    dim: false },
                { label: 'Pro — $12/mo',   sub: 'Unlimited · Claude · Local sync',  dim: false, highlight: true },
              ].map(p => (
                <div key={p.label} style={{
                  padding: '10px 20px',
                  borderRadius: 12,
                  background: p.highlight ? hexToRgba(ac, 0.12) : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${p.highlight ? hexToRgba(ac, 0.4) : 'rgba(255,255,255,0.1)'}`,
                  textAlign: 'left' as const,
                  minWidth: 160,
                }}>
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: p.highlight ? ac : '#fff',
                    marginBottom: 3,
                  }}>{p.label}</div>
                  <div style={{
                    fontSize: 11,
                    color: p.highlight ? hexToRgba(ac, 0.7) : 'rgba(255,255,255,0.35)',
                  }}>{p.sub}</div>
                </div>
              ))}
            </div>

            <h2 style={{
              fontSize: mobile ? 26 : 42, fontWeight: 900,
              color: '#fff', letterSpacing: '-0.02em',
              margin: '0 0 14px', lineHeight: 1.1,
            }}>
              Start free.<br/>
              <span style={{
                background: `linear-gradient(135deg,${ac},#fff)`,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}>
                Upgrade when you&apos;re ready.
              </span>
            </h2>
            <p style={{
              fontSize: mobile ? 14 : 16,
              color: 'rgba(255,255,255,0.45)',
              margin: '0 auto 36px',
              maxWidth: 420, lineHeight: 1.7,
            }}>
              No credit card required to start. Pro unlocks Claude Sonnet,
              local sync, editor files, and team collaboration.
            </p>
            <div style={{
              display: 'flex', gap: 12,
              justifyContent: 'center', flexWrap: 'wrap' as const,
            }}>
              <Link href="/signup" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: mobile ? '12px 28px' : '14px 36px',
                background: ac, color: '#000',
                borderRadius: 999, textDecoration: 'none',
                fontSize: 13, fontWeight: 800, letterSpacing: '0.05em',
                boxShadow: `0 0 32px ${hexToRgba(ac, 0.4)}`,
              }}>
                Start free <ArrowRight size={14}/>
              </Link>
              <Link href="/upgrade" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: mobile ? '12px 28px' : '14px 36px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.14)',
                color: 'rgba(255,255,255,0.85)',
                borderRadius: 999, textDecoration: 'none',
                fontSize: 13, fontWeight: 600,
                backdropFilter: 'blur(12px)',
              }}>
                See pricing →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ═════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: mobile ? '44px 24px' : '64px 60px',
        maxWidth: 1120, margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: mobile ? 'column' : 'row',
          alignItems: mobile ? 'flex-start' : 'center',
          justifyContent: 'space-between', gap: 28,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ReminisceLogo size={22} color="#ffffff"/>
            <span style={{
              fontWeight: 800, fontSize: 15,
              fontStyle: 'italic',
              textTransform: 'uppercase' as const,
              letterSpacing: '-0.01em',
            }}>Reminisce</span>
          </div>
          <div style={{ display: 'flex', gap: mobile ? 18 : 36, flexWrap: 'wrap' as const }}>
            {[
              ['Features',    '/capabilities'],
              ['Engineering', '/engineering'],
              ['Docs',        '/docs'],
              ['Pricing',     '/upgrade'],
              ['Sign in',     '/login'],
            ].map(([l, h]) => (
              <Link key={l} href={h} style={{
                fontSize: 13, color: 'rgba(255,255,255,0.36)',
                textDecoration: 'none', transition: 'color .15s',
              }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.36)'}
              >{l}</Link>
            ))}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.18)' }}>
            © {new Date().getFullYear()} Reminisce
          </div>
        </div>
      </footer>
    </div>
  )
}
