'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Database, Bot, Sparkles, GitBranch, FolderSync,
  FileCode2, Zap, Network, FlaskConical, Users,
  ArrowRight, Check, BookOpen,
  FileText, Shield, Share2,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import LandingNav from '@/components/landing-nav'
import ReminisceLogo from '@/components/ReminisceLogo'

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
      { threshold: 0.06 }
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
          ref.current.textContent = Math.floor(ease * num).toString() + suffix
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

// ThreeDCard — pure inline-style mouse-tilt card. No Framer Motion dependency.
function ThreeDCard({
  children,
  style,
  onMouseEnter,
  onMouseLeave,
  className,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)

  const handleMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setTilt({
      x: ((y - rect.height / 2) / rect.height) * 8,
      y: -((x - rect.width / 2) / rect.width) * 8,
    })
  }, [])

  const handleLeave = useCallback(() => {
    setTilt({ x: 0, y: 0 })
    setHovered(false)
    onMouseLeave?.()
  }, [onMouseLeave])

  const handleEnter = useCallback(() => {
    setHovered(true)
    onMouseEnter?.()
  }, [onMouseEnter])

  return (
    <div
      ref={ref}
      className={className}
      onMouseMove={handleMove}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: hovered
          ? 'transform 0.1s ease, border-color 0.3s ease, box-shadow 0.3s ease'
          : 'transform 0.5s cubic-bezier(0.23,1,0.32,1), border-color 0.5s ease, box-shadow 0.5s ease',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: hovered ? `0 20px 48px rgba(0,0,0,0.5), 0 0 24px ${hexToRgba(style?.borderColor as string || '#fff', 0.15)}` : 'none',
        ...style,
        borderColor: hovered ? hexToRgba(style?.borderColor as string || '#fff', 0.5) : style?.borderColor,
      }}
    >
      {/* Shimmer on hover */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)',
        opacity: hovered ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: 'none', zIndex: 1,
      }}/>
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>
        {children}
      </div>
    </div>
  )
}

function FloatingRing({ accent, size = 120, opacity = 0.18, delay = '0s' }: {
  accent: string; size?: number; opacity?: number; delay?: string
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      border: `1.5px solid ${hexToRgba(accent, opacity)}`,
      boxShadow: `0 0 ${size * 0.3}px ${hexToRgba(accent, opacity * 0.5)}`,
      animation: `ring-float 6s ease-in-out ${delay} infinite`,
      pointerEvents: 'none', flexShrink: 0,
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
      transition: 'all 0.4s ease', flexShrink: 0,
    }}/>
  )
}

function FeaturePoint({ accent, text }: { accent: string; text: string }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        fontSize: 16, fontWeight: 500, cursor: 'default',
      }}
    >
      <div style={{
        width: 8, height: 8, borderRadius: '50%',
        background: accent, flexShrink: 0,
        boxShadow: hov ? `0 0 14px ${accent}` : 'none',
        transform: hov ? 'scale(1.5)' : 'scale(1)',
        transition: 'all 0.3s ease',
      }}/>
      <span style={{
        transform: hov ? 'translateX(6px)' : 'none',
        transition: 'transform 0.3s ease',
        color: 'rgba(255,255,255,0.8)',
      }}>{text}</span>
    </div>
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
    const t = setTimeout(() => {
      document.querySelectorAll('[data-step]').forEach(el => io.observe(el))
    }, 600)
    return () => { clearTimeout(t); io.disconnect() }
  }, [])

  // ── Data ────────────────────────────────────────────────────────────────────

  const stats = [
    { val: '15', suf: '+',  label: 'AI Models' },
    { val: '50', suf: 'ms', label: 'Injection Speed' },
    { val: '∞',  suf: '',   label: 'Memory' },
    { val: '0',  suf: '',   label: 'Repetition' },
  ]

  const features = [
    {
      icon: Sparkles,   tag: 'Onboarding', size: 'large',
      title: 'Project Wizard',
      desc: 'A 4-stage AI conversation that generates your entire project blueprint, tech stack, and feature roadmap in minutes.',
      bullets: ['Parallel wave generation', 'GitHub repo enrichment', 'Editor file auto-generation'],
      extra: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }}>
          {['Idea','Features','Stack','Generate'].map((label, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                padding: '5px 14px', borderRadius: 999,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 10, fontWeight: 800,
                letterSpacing: '0.1em', textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.6)',
              }}>{label}</div>
              {i < 3 && <div style={{ width: 20, height: 1, background: 'rgba(255,255,255,0.1)' }}/>}
            </div>
          ))}
        </div>
      ),
    },
    {
      icon: Database,   tag: 'Core', size: 'large',
      title: 'Context Engine',
      desc: 'Versioned markdown store injected into every AI call. Your agent never forgets an architecture decision.',
      bullets: ['Version history on every file', 'Bidirectional local folder sync', 'Reminisce vs developer ownership model'],
      extra: (
        <div style={{ marginTop: 24 }}>
          <div style={{
            height: 4, width: '100%', borderRadius: 999,
            background: 'rgba(255,255,255,0.06)', overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: '33%', borderRadius: 999,
              background: ac,
              animation: 'sync-bar 3s ease-in-out infinite',
            }}/>
          </div>
          <div style={{
            marginTop: 8, fontSize: 9, fontWeight: 800,
            letterSpacing: '0.2em', textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.3)',
          }}>Syncing live context…</div>
        </div>
      ),
    },
    {
      icon: Bot,        tag: 'AI',   size: 'medium',
      title: 'AI Agent',
      desc: 'Pick a feature, pick a model, hit run. Full project context per call. Run history and git branch logged.',
      bullets: ['15+ models across 6 providers', 'Auto-logs to agent-runs.md', 'BYOK for all providers'],
    },
    {
      icon: GitBranch,  tag: 'Git',  size: 'medium',
      title: 'Git Integration',
      desc: 'Reads your local .git/ directly. Branch and commit surface in PAM and context injection — no API calls.',
      bullets: ['Branch-aware context', 'Works offline', 'Zero auth required'],
    },
    {
      icon: FolderSync, tag: 'Sync', size: 'small',
      title: 'Local Sync',
      desc: 'Connect your project folder. Reminisce writes context files to disk. Changes sync back on focus return.',
    },
    {
      icon: FileCode2,  tag: 'Editors', size: 'small',
      title: 'Editor Files',
      desc: 'Auto-generates .cursorrules, CLAUDE.md, or copilot-instructions.md so every session starts with full context.',
    },
    {
      icon: Network,    tag: 'Visual', size: 'small',
      title: 'Graph View',
      desc: 'Visual map of every phase and feature with live status, drag-and-drop, and canvas annotations.',
    },
    {
      icon: Zap,        tag: 'AI', size: 'small',
      title: 'PAM',
      desc: 'Project Action Manager — ask about progress, mark features done, generate prompts, all via chat.',
    },
    {
      icon: BookOpen,   tag: 'Prompts', size: 'small',
      title: 'Prompt Library',
      desc: 'Three-tab archive: Blueprint prompts, custom prompts, and auto-populated changelog.',
    },
    {
      icon: FlaskConical, tag: 'Testing', size: 'small',
      title: 'API Lab',
      desc: 'Built-in HTTP client for endpoint testing with method selector, auth, headers, and response inspector.',
    },
    {
      icon: Users,      tag: 'Team', size: 'small',
      title: 'Collaboration',
      desc: 'Invite up to 5 members. Everyone works from the same live context, blueprint, and board.',
    },
  ]

  const steps = [
    { num: '01', title: 'Run the Wizard', desc: 'Answer questions about what you\'re building. Reminisce generates context documents, phases, feature prompts, and editor files automatically.' },
    { num: '02', title: 'Connect your folder', desc: 'Link your local project folder. Context files sync to disk. Your editor reads them on every session — no manual setup.' },
    { num: '03', title: 'Context injected', desc: 'Before every AI call, your full project context — architecture, git branch, active phase, feature list — is assembled in under 50ms.' },
    { num: '04', title: 'Build with PAM', desc: 'Chat with your Project Action Manager. Ask for status, mark features done, generate prompts. Every action is logged to your project changelog.' },
    { num: '05', title: 'History saved back', desc: 'Agent runs, PAM actions, and context changes all log to versioned markdown files in your project. Nothing is ever lost.' },
  ]

  const heroFade = Math.max(0, 1 - scrollY / 500)
  const heroUp   = scrollY * 0.18

  // Bento layout: 12-column grid
  // Large = col-span-8 (left) and col-span-4 (right) — 2 rows each
  // Medium = col-span-6 — 1 row each
  // Small = col-span-4 — 1 row each
  const bentoLayout = [
    { fi: 0,  col: '1 / 9',  row: '1 / 3' },  // Project Wizard — large left
    { fi: 1,  col: '9 / 13', row: '1 / 3' },  // Context Engine — large right
    { fi: 2,  col: '1 / 7',  row: '3 / 4' },  // AI Agent — medium
    { fi: 3,  col: '7 / 13', row: '3 / 4' },  // Git Integration — medium
    { fi: 4,  col: '1 / 5',  row: '4 / 5' },  // Local Sync — small
    { fi: 5,  col: '5 / 9',  row: '4 / 5' },  // Editor Files — small
    { fi: 6,  col: '9 / 13', row: '4 / 5' },  // Graph — small
    { fi: 7,  col: '1 / 5',  row: '5 / 6' },  // PAM — small
    { fi: 8,  col: '5 / 9',  row: '5 / 6' },  // Prompt Library — small
    { fi: 9,  col: '9 / 13', row: '5 / 6' },  // API Lab — medium (now 4 col)
    { fi: 10, col: '1 / 13', row: '6 / 7' },  // Collaboration — wide bottom
  ]

  return (
    <div style={{
      background: '#05050f', color: '#fff',
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      <style>{`
        .sr{opacity:0;transform:translateY(32px);transition:opacity .8s ease,transform .8s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.05s}.d2{transition-delay:.12s}.d3{transition-delay:.19s}
        .d4{transition-delay:.26s}.d5{transition-delay:.33s}.d6{transition-delay:.4s}
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
        @keyframes sync-bar{
          0%{transform:translateX(-100%)}
          100%{transform:translateX(400%)}
        }
        @keyframes scroll-line{
          0%,100%{opacity:0.3;transform:scaleY(0.6)}
          50%{opacity:1;transform:scaleY(1)}
        }
        .step-card-active{
          border-color:var(--ac-border)!important;
          background:var(--ac-bg)!important
        }
      `}</style>

      {/* Fixed radial top glow */}
      <div style={{
        position: 'fixed', top: -240, left: '50%',
        transform: 'translateX(-50%)',
        width: 900, height: 560,
        background: `radial-gradient(ellipse,${hexToRgba(ac, 0.14)} 0%,transparent 68%)`,
        pointerEvents: 'none', zIndex: 0,
        transition: 'background 0.5s ease',
      }}/>

      <LandingNav />

      {/* ════════════════════════════════════════════════════════════
          HERO — unchanged from original
      ════════════════════════════════════════════════════════════ */}
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

        {/* Floating rings */}
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
          maxWidth: 760,
          transform: `translateY(${heroUp}px)`,
        }}>
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 14, marginBottom: 24,
          }}>
            <ReminisceLogo
              size={mobile ? 56 : 72}
              color="#ffffff"
              glowColor={hexToRgba(ac, 0.55)}
            />
          </div>

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
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: ac, display: 'inline-block' }}/> AI Context Platform for Developers
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
            lineHeight: 1.75, maxWidth: 560,
            margin: '0 auto 36px',
          }}>
            Define your project once. Every AI call, every editor session,
            every teammate — working from the same live context.
          </p>

          <div style={{
            display: 'flex', gap: 14,
            justifyContent: 'center', flexWrap: 'wrap' as const,
          }}>
            <Link href="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: ac, color: '#000',
              padding: mobile ? '12px 28px' : '15px 40px',
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
              padding: mobile ? '12px 28px' : '15px 40px',
              borderRadius: 999, fontSize: 14, fontWeight: 600,
              textDecoration: 'none', backdropFilter: 'blur(12px)',
            }}>
              See all features
            </Link>
          </div>
        </div>

        {/* Scroll indicator */}
        <div style={{
          position: 'absolute', bottom: 32, left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', gap: 8,
          opacity: Math.max(0, 1 - scrollY / 120),
        }}>
          <span style={{
            fontSize: 9, letterSpacing: '0.3em',
            color: 'rgba(255,255,255,0.2)',
            textTransform: 'uppercase' as const,
          }}>scroll</span>
          <div style={{
            width: 1, height: 48,
            background: `linear-gradient(to bottom,${ac},transparent)`,
            animation: 'scroll-line 2s ease-in-out infinite',
          }}/>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          STATS — single glass pill, AI Studio style
      ════════════════════════════════════════════════════════════ */}
      <section style={{ padding: mobile ? '64px 24px' : '96px 60px' }}>
        <div className="sr" style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
            gap: mobile ? 1 : 0,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 28,
            backdropFilter: 'blur(20px)',
            overflow: 'hidden',
          }}>
            {stats.map((s, i) => (
              <div key={i} style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: mobile ? '36px 16px' : '48px 24px',
                borderRight: (!mobile && i < 3) ? '1px solid rgba(255,255,255,0.06)' : 'none',
                borderBottom: (mobile && i < 2) ? '1px solid rgba(255,255,255,0.06)' : 'none',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  background: `radial-gradient(ellipse at 50% 0%,${hexToRgba(ac, 0.06)} 0%,transparent 70%)`,
                  pointerEvents: 'none',
                }}/>
                <div style={{
                  fontSize: mobile ? 44 : 58, fontWeight: 900,
                  letterSpacing: '-0.04em', color: '#fff',
                  lineHeight: 1, marginBottom: 8,
                }}>
                  {s.val === '∞' ? '∞' : <CountUp value={s.val} suffix={s.suf}/>}
                </div>
                <div style={{
                  fontSize: 10, color: 'rgba(255,255,255,0.35)',
                  fontWeight: 700, letterSpacing: '0.3em',
                  textTransform: 'uppercase' as const,
                  textAlign: 'center',
                }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          BENTO FEATURES — ThreeDCard mouse tilt, 12-col grid
      ════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: mobile ? '64px 24px' : '96px 60px 120px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Background BentoScene orb — very subtle */}
        {!mobile && (
          <div style={{
            position: 'absolute', top: 0, left: '50%',
            transform: 'translateX(-50%)',
            width: '100%', height: '100%',
            opacity: 0.07, pointerEvents: 'none',
          }}>
            <BentoScene accent={ac} />
          </div>
        )}

        <div style={{ maxWidth: 1280, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          {/* Section header */}
          <div className="sr" style={{ textAlign: 'center', marginBottom: mobile ? 48 : 80 }}>
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
              color: ac, textTransform: 'uppercase' as const, marginBottom: 16,
            }}>Platform</p>
            <h2 style={{
              fontSize: mobile ? 28 : 52, fontWeight: 800,
              letterSpacing: '-0.03em', color: '#fff',
              marginBottom: 16, lineHeight: 1.05,
            }}>
              Everything in one place.
            </h2>
            <p style={{
              fontSize: mobile ? 15 : 18, color: 'rgba(255,255,255,0.4)',
              maxWidth: 520, margin: '0 auto', lineHeight: 1.7,
            }}>
              A unified workspace for persistent project intelligence.
              From first idea to shipped code.
            </p>
          </div>

          {/* Bento grid — mobile: single column, desktop: 12-col */}
          {mobile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {features.map((f, i) => {
                const Icon = f.icon
                return (
                  <ThreeDCard key={i} style={{
                    padding: '32px 28px', borderRadius: 24,
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid',
                    borderColor: 'rgba(255,255,255,0.08)',
                    backdropFilter: 'blur(12px)',
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 14,
                      background: hexToRgba(ac, 0.12),
                      border: `1px solid ${hexToRgba(ac, 0.25)}`,
                      display: 'flex', alignItems: 'center',
                      justifyContent: 'center', marginBottom: 16,
                    }}>
                      <Icon size={20} color={ac}/>
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
                      textTransform: 'uppercase' as const,
                      color: ac, marginBottom: 8,
                    }}>{f.tag}</div>
                    <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 8 }}>{f.title}</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.7, margin: 0 }}>{f.desc}</p>
                  </ThreeDCard>
                )
              })}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(12, 1fr)',
              gridAutoRows: '200px',
              gap: 16,
            }}>
              {bentoLayout.map(({ fi, col, row }) => {
                const f = features[fi]
                const Icon = f.icon
                const isLarge  = f.size === 'large'
                const isMed    = f.size === 'medium'
                const padding  = isLarge ? '36px' : isMed ? '28px' : '22px'
                const radius   = isLarge ? 28 : 20

                return (
                  <ThreeDCard
                    key={fi}
                    className={`sr d${(fi % 3) + 1}`}
                    style={{
                      gridColumn: col, gridRow: row,
                      minHeight: isLarge ? 416 : 200,
                      padding,
                      background: 'rgba(255,255,255,0.025)',
                      border: '1px solid',
                      borderColor: 'rgba(255,255,255,0.07)',
                      borderRadius: radius,
                      display: 'flex', flexDirection: 'column',
                      backdropFilter: 'blur(12px)',
                    }}
                    onMouseEnter={() => {}}
                    onMouseLeave={() => {}}
                  >
                    {/* Large card — BentoScene orb bottom right */}
                    {isLarge && (
                      <div style={{
                        position: 'absolute',
                        right: -40, bottom: -40,
                        width: 180, height: 180,
                        opacity: 0.35, pointerEvents: 'none',
                      }}>
                        <BentoScene accent={ac} />
                      </div>
                    )}

                    {/* Medium card — drifting orb glow */}
                    {isMed && (
                      <div style={{
                        position: 'absolute',
                        right: -20, bottom: -20,
                        width: 110, height: 110, borderRadius: '50%',
                        background: `radial-gradient(ellipse,${hexToRgba(ac, 0.22)} 0%,transparent 70%)`,
                        animation: 'orb-drift 8s ease-in-out infinite',
                        pointerEvents: 'none',
                      }}/>
                    )}

                    {/* Small card — accent corner dot */}
                    {!isLarge && !isMed && (
                      <div style={{
                        position: 'absolute', top: 14, right: 14,
                        width: 7, height: 7, borderRadius: '50%',
                        background: hexToRgba(ac, 0.4),
                        boxShadow: `0 0 8px ${hexToRgba(ac, 0.5)}`,
                        pointerEvents: 'none',
                      }}/>
                    )}

                    {/* Card content */}
                    <div style={{ position: 'relative', zIndex: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                      <div style={{
                        width: isLarge ? 52 : 42,
                        height: isLarge ? 52 : 42,
                        borderRadius: isLarge ? 16 : 12,
                        background: hexToRgba(ac, 0.1),
                        border: `1px solid ${hexToRgba(ac, 0.2)}`,
                        display: 'flex', alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: isLarge ? 22 : 14, flexShrink: 0,
                      }}>
                        <Icon size={isLarge ? 24 : 19} color={ac}/>
                      </div>
                      <div style={{
                        fontSize: 10, fontWeight: 800, letterSpacing: '0.15em',
                        textTransform: 'uppercase' as const,
                        color: ac, marginBottom: 10,
                      }}>{f.tag}</div>
                      <h3 style={{
                        fontSize: isLarge ? 24 : isMed ? 18 : 14,
                        fontWeight: 700, color: '#fff',
                        marginBottom: isLarge ? 14 : 8, lineHeight: 1.2,
                      }}>{f.title}</h3>
                      <p style={{
                        fontSize: isLarge ? 14 : 13,
                        color: 'rgba(255,255,255,0.45)',
                        lineHeight: 1.75, margin: 0, flex: 1,
                      }}>{f.desc}</p>

                      {/* Bullets — large and medium only */}
                      {(isLarge || isMed) && f.bullets && (
                        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                          {f.bullets.map((b, bi) => (
                            <div key={bi} style={{
                              display: 'flex', alignItems: 'center',
                              gap: 8, fontSize: 12, color: 'rgba(255,255,255,0.4)',
                            }}>
                              <Check size={10} color={ac} style={{ flexShrink: 0 }}/>{b}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Extra UI — large cards */}
                      {isLarge && f.extra}
                    </div>
                  </ThreeDCard>
                )
              })}
            </div>
          )}
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          WHAT THE AI ACTUALLY SEES — split section, 3D code panel
      ════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: mobile ? '64px 24px' : '140px 60px',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* Subtle gradient band */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom,transparent,rgba(255,255,255,0.012),transparent)',
          pointerEvents: 'none',
        }}/>

        <div style={{
          maxWidth: 1100, margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: mobile ? 48 : 96,
          alignItems: 'center',
        }}>
          {/* Left — text */}
          <div className="sr">
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
              color: ac, textTransform: 'uppercase' as const, marginBottom: 20,
            }}>Context injection</p>
            <h2 style={{
              fontSize: mobile ? 32 : 60, fontWeight: 900,
              letterSpacing: '-0.04em', lineHeight: 0.95,
              color: '#fff', marginBottom: 24,
            }}>
              What the AI<br/>actually sees.
            </h2>
            <p style={{
              fontSize: mobile ? 15 : 18,
              color: 'rgba(255,255,255,0.45)',
              lineHeight: 1.75, marginBottom: 40, maxWidth: 440,
            }}>
              We don&apos;t just send a prompt. We orchestrate a multi-layered context
              injection that gives the model a perfect mental model of your project.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <FeaturePoint accent={ac} text="Project architecture & decisions" />
              <FeaturePoint accent={ac} text="Active feature branch state" />
              <FeaturePoint accent={ac} text="Editor integration files, injected automatically" />
              <FeaturePoint accent={ac} text="Global prompt templates" />
            </div>
          </div>

          {/* Right — 3D code panel */}
          <div className="sr d2" style={{
            perspective: 2000,
          }}>
            <div style={{
              position: 'relative',
              transform: mobile ? 'none' : 'rotateY(-8deg) rotateX(4deg)',
              transition: 'transform 0.6s ease',
            }}>
              {/* Glow behind the panel */}
              <div style={{
                position: 'absolute', inset: -40,
                background: `radial-gradient(ellipse,${hexToRgba(ac, 0.12)} 0%,transparent 70%)`,
                borderRadius: '50%', pointerEvents: 'none',
              }}/>

              <div style={{
                position: 'relative',
                background: 'rgba(8,8,20,0.9)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: `0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)`,
              }}>
                <ScanLine accent={ac} />

                {/* Terminal title bar */}
                <div style={{
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                  background: 'rgba(255,255,255,0.025)',
                }}>
                  <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(248,113,113,0.4)' }}/>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(245,158,11,0.4)' }}/>
                    <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(52,211,153,0.4)' }}/>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.2em',
                    textTransform: 'uppercase' as const,
                    color: 'rgba(255,255,255,0.2)',
                    fontFamily: 'ui-monospace,monospace',
                  }}>context_injection.md</span>
                  <div style={{ width: 50 }}/>
                </div>

                {/* Code content */}
                <div style={{
                  padding: mobile ? '20px' : '28px 32px',
                  fontFamily: 'ui-monospace,SFMono-Regular,monospace',
                  fontSize: mobile ? 11 : 12.5,
                  lineHeight: 1.8, color: 'rgba(255,255,255,0.7)',
                }}>
                  <div style={{ color: hexToRgba(ac, 0.55), marginBottom: 14 }}>{'# REMINISCE:SUMMARY'}</div>
                  <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[PROJECT] </span>Reminisce v2</div>
                  <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[STACK]   </span>Next.js · Supabase · TypeScript</div>
                  <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[BRANCH]  </span><span style={{ color: hexToRgba(ac, 0.9) }}>feat/auth-flow</span></div>
                  <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[COMMIT]  </span>Add JWT middleware and token refresh</div>
                  <div style={{ marginTop: 16, color: hexToRgba(ac, 0.5) }}>{'<context_files>'}</div>
                  <div style={{ paddingLeft: 20, borderLeft: '1px solid rgba(255,255,255,0.07)', marginLeft: 4 }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>— architecture.md</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>— auth_decisions.md</div>
                    <div style={{ color: 'rgba(255,255,255,0.5)' }}>— api_spec.md</div>
                  </div>
                  <div style={{ color: hexToRgba(ac, 0.5), marginTop: 4 }}>{'</context_files>'}</div>
                  <div style={{ marginTop: 16, color: hexToRgba(ac, 0.5) }}>{'<active_features>'}</div>
                  <div style={{ paddingLeft: 20, borderLeft: '1px solid rgba(255,255,255,0.07)', marginLeft: 4 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#34d399' }}>●</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Landing hero</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ color: '#60a5fa', animation: 'badge-float 2s ease-in-out infinite' }}>●</span>
                      <span style={{ color: 'rgba(255,255,255,0.5)' }}>Signup flow</span>
                    </div>
                  </div>
                  <div style={{ color: hexToRgba(ac, 0.5) }}>{'</active_features>'}</div>
                  <div style={{ marginTop: 16 }}>
                    <span style={{ color: 'rgba(255,255,255,0.28)' }}>[EDITOR]  </span>
                    <span style={{ color: '#34d399' }}>.cursorrules injected ✓</span>
                  </div>
                  <div style={{
                    marginTop: 20, paddingTop: 16,
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    display: 'flex', alignItems: 'center', gap: 8,
                    fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const, color: ac,
                  }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: ac, animation: 'badge-float 1.5s ease-in-out infinite',
                      boxShadow: `0 0 8px ${ac}`,
                    }}/>
                    INJECTED ✓ &lt; 50ms
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          HOW IT WORKS — scroll-activated steps
      ════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: mobile ? '64px 24px' : '140px 60px',
        maxWidth: 1100, margin: '0 auto',
      }}>
        <div className="sr" style={{ textAlign: 'center', marginBottom: mobile ? 48 : 80 }}>
          <p style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
            color: ac, textTransform: 'uppercase' as const, marginBottom: 16,
          }}>How it works</p>
          <h2 style={{
            fontSize: mobile ? 28 : 52, fontWeight: 800,
            letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.05,
          }}>
            Five steps. Fully automatic.
          </h2>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: mobile ? 40 : 96, alignItems: 'start',
        }}>
          {/* Steps */}
          <div ref={stepsRef} style={{ position: 'relative' }}>
            {!mobile && (
              <div style={{
                position: 'absolute', left: 5, top: 14,
                width: 2, bottom: 14, background: 'rgba(255,255,255,0.07)', zIndex: 0,
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {steps.map((s, i) => (
                <div
                  key={i}
                  data-step={i}
                  className={activeStep === i ? 'step-card-active' : ''}
                  style={{
                    display: 'flex', gap: 20, alignItems: 'flex-start',
                    padding: '20px 24px',
                    background: activeStep === i ? hexToRgba(ac, 0.06) : 'rgba(255,255,255,0.02)',
                    border: `1px solid ${activeStep === i ? hexToRgba(ac, 0.28) : 'rgba(255,255,255,0.06)'}`,
                    borderRadius: 16,
                    transition: 'border-color .25s,background .25s',
                    '--ac-border': hexToRgba(ac, 0.28),
                    '--ac-bg': hexToRgba(ac, 0.06),
                  } as React.CSSProperties}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, marginTop: 2, zIndex: 1, position: 'relative' }}>
                    <StepDot accent={ac} active={activeStep === i} />
                  </div>
                  <div>
                    <span style={{
                      fontSize: 9, fontWeight: 800, color: hexToRgba(ac, 0.55),
                      letterSpacing: '0.12em', textTransform: 'uppercase' as const,
                      display: 'block', marginBottom: 5,
                    }}>Step {s.num}</span>
                    <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 7 }}>{s.title}</h3>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.42)', lineHeight: 1.75, margin: 0 }}>{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context demo — live code preview */}
          <div className="sr d2" style={{
            position: 'relative', top: mobile ? 0 : 48,
            background: 'rgba(8,8,20,0.7)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20, padding: '24px',
            fontFamily: 'ui-monospace,monospace',
            fontSize: mobile ? 11 : 12.5,
            lineHeight: 1.7, color: 'rgba(255,255,255,0.7)',
            overflow: 'hidden',
          }}>
            <ScanLine accent={ac} />
            <div style={{
              position: 'absolute', inset: 0, borderRadius: 20,
              background: `radial-gradient(ellipse at 80% 20%,${hexToRgba(ac, 0.07)} 0%,transparent 60%)`,
              pointerEvents: 'none',
            }}/>
            <div style={{ color: hexToRgba(ac, 0.6), marginBottom: 12 }}>{'// Context header — injected automatically'}</div>
            <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[PROJECT] </span>Notebook App — Phase 2</div>
            <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[BRANCH]  </span><span style={{ color: hexToRgba(ac, 0.9) }}>feature/user-auth</span></div>
            <div><span style={{ color: 'rgba(255,255,255,0.28)' }}>[COMMIT]  </span>Add JWT middleware and token refresh</div>
            <div style={{ marginTop: 10, color: hexToRgba(ac, 0.55) }}>[ACTIVE_FEATURES]</div>
            <div style={{ paddingLeft: 16, color: 'rgba(255,255,255,0.45)' }}>
              <div>→ OAuth2 flow implementation</div>
              <div>→ Session token refresh</div>
              <div>→ Protected route middleware</div>
            </div>
            <div style={{ marginTop: 10 }}>
              <span style={{ color: 'rgba(255,255,255,0.28)' }}>[EDITOR]  </span>.cursorrules injected ✓
            </div>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.07)', margin: '14px 0' }}/>
            <div style={{ color: 'rgba(255,255,255,0.3)' }}>[YOUR_PROMPT]</div>
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

      {/* ════════════════════════════════════════════════════════════
          BUILT FOR BUILDERS — docs section (new, from AI Studio)
      ════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: mobile ? '64px 24px' : '140px 60px',
        background: 'rgba(255,255,255,0.01)',
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
            gap: mobile ? 48 : 96,
            alignItems: 'center',
          }}>
            {/* Left — doc cards grid */}
            <div className="sr" style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
            }}>
              {[
                { icon: FileText,  title: 'API Reference',  desc: 'Full context injection SDK documentation.' },
                { icon: Shield,    title: 'Security',        desc: 'How we protect your project data.' },
                { icon: Network,   title: 'Blueprints',      desc: 'Best practices for project architecture.' },
                { icon: Share2,    title: 'Collaboration',   desc: 'Working with teams in real-time.' },
              ].map((item, i) => {
                const Icon = item.icon
                return (
                  <ThreeDCard key={i} style={{
                    padding: '24px',
                    background: 'rgba(255,255,255,0.025)',
                    border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 20,
                  }}>
                    <Icon size={20} color={ac} style={{ marginBottom: 14, display: 'block' }}/>
                    <h4 style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{item.title}</h4>
                    <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.38)', lineHeight: 1.6, margin: 0 }}>{item.desc}</p>
                  </ThreeDCard>
                )
              })}
            </div>

            {/* Right — text */}
            <div className="sr d2">
              <p style={{
                fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
                color: ac, textTransform: 'uppercase' as const, marginBottom: 20,
              }}>Documentation</p>
              <h2 style={{
                fontSize: mobile ? 32 : 56, fontWeight: 900,
                letterSpacing: '-0.04em', lineHeight: 0.95,
                color: '#fff', marginBottom: 24,
              }}>
                Built for<br/>builders.
              </h2>
              <p style={{
                fontSize: mobile ? 15 : 18,
                color: 'rgba(255,255,255,0.42)',
                lineHeight: 1.75, marginBottom: 36, maxWidth: 420,
              }}>
                Comprehensive documentation, clear setup guides, and a growing library
                of project blueprints to get you from zero to context-injected in minutes.
              </p>
              <Link href="/docs" style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                fontSize: 15, fontWeight: 700, color: '#fff',
                textDecoration: 'none',
              }}
              onMouseEnter={e => { const svg = e.currentTarget.querySelector('svg') as SVGElement; if (svg?.style) svg.style.transform = 'translateX(6px)' }}
              onMouseLeave={e => { const svg = e.currentTarget.querySelector('svg') as SVGElement; if (svg?.style) svg.style.transform = 'translateX(0)' }}
              >
                Explore the docs
                <ArrowRight size={18} color={ac} style={{ transition: 'transform 0.25s ease' }}/>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          PRICING — full two-column cards (AI Studio style)
      ════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: mobile ? '64px 24px' : '140px 60px',
        textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        {/* Background glow */}
        <div style={{
          position: 'absolute', top: 0, left: '50%',
          transform: 'translateX(-50%)',
          width: 600, height: 300,
          background: `radial-gradient(ellipse,${hexToRgba(ac, 0.1)} 0%,transparent 70%)`,
          pointerEvents: 'none',
        }}/>

        <div style={{ maxWidth: 960, margin: '0 auto', position: 'relative', zIndex: 1 }}>
          <div className="sr">
            <p style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.22em',
              color: ac, textTransform: 'uppercase' as const, marginBottom: 16,
            }}>Pricing</p>
            <h2 style={{
              fontSize: mobile ? 36 : 72, fontWeight: 900,
              letterSpacing: '-0.04em', color: '#fff',
              marginBottom: 16, lineHeight: 0.95,
            }}>
              Start free.<br/>
              <span style={{ color: 'rgba(255,255,255,0.28)' }}>Upgrade later.</span>
            </h2>
            <p style={{
              fontSize: mobile ? 15 : 18,
              color: 'rgba(255,255,255,0.4)',
              marginBottom: 64, maxWidth: 520, margin: '0 auto 64px',
              lineHeight: 1.7,
            }}>
              Join developers building the future with persistent project intelligence.
            </p>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
            gap: 16, maxWidth: 800, margin: '0 auto',
          }}>
            {/* Free plan */}
            <ThreeDCard style={{
              padding: mobile ? '32px' : '40px',
              background: 'rgba(255,255,255,0.025)',
              border: '1px solid rgba(255,255,255,0.07)',
              borderRadius: 28, textAlign: 'left',
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Free</div>
              <div style={{ marginBottom: 32 }}>
                <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.04em', color: '#fff' }}>$0</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.3)', marginLeft: 4 }}>/mo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                {['2 Projects', 'Community AI models', 'Context Engine', 'Project Wizard', 'PAM & Agent'].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
                    <ArrowRight size={14} color={ac} style={{ flexShrink: 0 }}/>{f}
                  </div>
                ))}
              </div>
              <Link href="/signup" style={{
                display: 'block', width: '100%', padding: '14px',
                background: 'rgba(255,255,255,0.07)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 14, textDecoration: 'none',
                fontSize: 14, fontWeight: 700, color: '#fff',
                textAlign: 'center',
                boxSizing: 'border-box' as const,
              }}>
                Get started
              </Link>
            </ThreeDCard>

            {/* Pro plan */}
            <ThreeDCard style={{
              padding: mobile ? '32px' : '40px',
              background: hexToRgba(ac, 0.06),
              border: `1px solid ${hexToRgba(ac, 0.3)}`,
              borderRadius: 28, textAlign: 'left',
              position: 'relative',
            }}>
              {/* Recommended badge */}
              <div style={{
                position: 'absolute', top: 0, right: 0,
                padding: '6px 18px',
                background: 'rgba(255,255,255,0.08)',
                fontSize: 9, fontWeight: 800, letterSpacing: '0.2em',
                textTransform: 'uppercase' as const,
                color: 'rgba(255,255,255,0.55)',
                borderBottomLeftRadius: 14, borderTopRightRadius: 28,
              }}>Recommended</div>

              {/* Top glow */}
              <div style={{
                position: 'absolute', top: -40, left: '50%',
                transform: 'translateX(-50%)',
                width: 200, height: 100,
                background: `radial-gradient(ellipse,${hexToRgba(ac, 0.3)} 0%,transparent 70%)`,
                pointerEvents: 'none',
              }}/>

              <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 12 }}>Pro</div>
              <div style={{ marginBottom: 32 }}>
                <span style={{ fontSize: 56, fontWeight: 900, letterSpacing: '-0.04em', color: '#fff' }}>$12</span>
                <span style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', marginLeft: 4 }}>/mo</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 32 }}>
                {['Unlimited Projects', 'All AI Models (Gems)', 'Local Sync & Git Integration', 'Editor Files (.cursorrules etc.)', '5-member Team Collaboration'].map((f, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>
                    <ArrowRight size={14} color={ac} style={{ flexShrink: 0 }}/>{f}
                  </div>
                ))}
              </div>
              <Link href="/upgrade" style={{
                display: 'block', width: '100%', padding: '14px',
                background: ac, color: '#000',
                borderRadius: 14, textDecoration: 'none',
                fontSize: 14, fontWeight: 800,
                textAlign: 'center',
                boxSizing: 'border-box' as const,
                boxShadow: `0 0 32px ${hexToRgba(ac, 0.4)}`,
              }}>
                Upgrade now
              </Link>
            </ThreeDCard>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════════════════
          FOOTER — 4-column expanded (AI Studio style)
      ════════════════════════════════════════════════════════════ */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: mobile ? '48px 24px' : '80px 60px 48px',
        background: 'rgba(255,255,255,0.008)',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          {/* Top section */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : '2fr 1fr 1fr 1fr',
            gap: mobile ? 40 : 48, marginBottom: 64,
          }}>
            {/* Brand col */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <ReminisceLogo size={26} color="#ffffff"/>
                <span style={{
                  fontWeight: 800, fontSize: 16,
                  letterSpacing: '-0.01em', color: '#fff',
                }}>Reminisce</span>
              </div>
              <p style={{
                fontSize: 14, color: 'rgba(255,255,255,0.35)',
                lineHeight: 1.75, maxWidth: 280,
              }}>
                The context orchestration platform for modern engineering teams.
                Persistent project intelligence for every AI call.
              </p>
            </div>

            {/* Product links */}
            {[
              {
                heading: 'Product',
                links: [
                  ['Features',    '/capabilities'],
                  ['How it works','/engineering'],
                  ['Pricing',     '/upgrade'],
                  ['Docs',        '/docs'],
                ],
              },
              {
                heading: 'Platform',
                links: [
                  ['Dashboard',   '/dashboard'],
                  ['Wizard',      '/dashboard'],
                  ['PAM',         '/dashboard'],
                  ['API Lab',     '/dashboard'],
                ],
              },
              {
                heading: 'Account',
                links: [
                  ['Sign in',  '/login'],
                  ['Sign up',  '/signup'],
                  ['Upgrade',  '/upgrade'],
                ],
              },
            ].map(col => (
              <div key={col.heading}>
                <h5 style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '0.22em',
                  textTransform: 'uppercase' as const,
                  color: 'rgba(255,255,255,0.25)', marginBottom: 20,
                }}>{col.heading}</h5>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {col.links.map(([label, href]) => (
                    <Link key={label} href={href} style={{
                      fontSize: 13, color: 'rgba(255,255,255,0.45)',
                      textDecoration: 'none', transition: 'color 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.45)'}
                    >{label}</Link>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Bottom bar */}
          <div style={{
            paddingTop: 24,
            borderTop: '1px solid rgba(255,255,255,0.06)',
            display: 'flex',
            flexDirection: mobile ? 'column' : 'row',
            alignItems: mobile ? 'flex-start' : 'center',
            justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.18)', fontWeight: 500, letterSpacing: '0.04em' }}>
              © {new Date().getFullYear()} Reminisce. All rights reserved.
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              {[['Privacy Policy', '#'], ['Terms of Service', '#']].map(([label, href]) => (
                <Link key={label} href={href} style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.25)',
                  textDecoration: 'none', fontWeight: 500, letterSpacing: '0.04em',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.6)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'}
                >{label}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
