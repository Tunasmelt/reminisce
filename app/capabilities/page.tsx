'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import {
  Database, Bot, Sparkles, GitBranch, FolderSync,
  FileCode2, Network, FlaskConical, Users, Zap,
  BookOpen, ArrowRight, Check,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import LandingNav from '@/components/landing-nav'

const BentoScene = dynamic(() => import('@/components/BentoScene'), {
  ssr: false, loading: () => null,
})

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sr-vis') }),
      { threshold: 0.06 }
    )
    document.querySelectorAll('.sr').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function ThreeDCard({ children, style, className }: { children: React.ReactNode; style?: React.CSSProperties; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hov, setHov] = useState(false)
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setTilt({
      x: ((e.clientY - rect.top - rect.height/2) / rect.height) * 7,
      y: -((e.clientX - rect.left - rect.width/2) / rect.width) * 7,
    })
  }, [])
  return (
    <div ref={ref} onMouseMove={onMove} className={className}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => { setTilt({ x:0, y:0 }); setHov(false) }}
      style={{
        transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
        transition: hov ? 'transform 0.1s ease' : 'transform 0.5s cubic-bezier(0.23,1,0.32,1)',
        position: 'relative', overflow: 'hidden', ...style,
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)',
        opacity: hov ? 1 : 0, transition: 'opacity 0.3s', pointerEvents: 'none', zIndex: 1,
      }}/>
      <div style={{ position: 'relative', zIndex: 2, height: '100%' }}>{children}</div>
    </div>
  )
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
      icon: Sparkles, tag: 'Start here', size: 'large',
      title: 'Project Wizard',
      desc: 'A four-stage conversation that generates your entire project blueprint. Reminisce reads your repo URL, detects your tech stack, then produces context documents, phase breakdowns, feature prompts, and editor integration files — all in one parallel generation run.',
      bullets: ['Idea → features → stack → generate','GitHub repo enrichment (public repos, no auth)','Parallel wave generation across 5 documents','Auto-generates editor integration files'],
    },
    {
      icon: Database, tag: 'Memory layer', size: 'large',
      title: 'Context Engine',
      desc: 'The authoritative store for everything about your project. Architecture decisions, tech stack, coding conventions, product scope, and version history are all saved as versioned markdown. Every AI call reads from this automatically before executing.',
      bullets: ['File tree grouped by folder (context/, workflow/, editor/, logs/)','Ownership model: Reminisce-managed vs developer-owned','REMINISCE:SUMMARY tags for fast tiered injection','Version history with side-by-side diff'],
    },
    {
      icon: FolderSync, tag: 'Local first', size: 'medium',
      title: 'Local Folder Sync',
      desc: 'Connect your project\'s local folder. Reminisce writes context files to disk on push. When you edit them in Cursor or VS Code and switch back, changes sync automatically. Conflicts are detected and surfaced with a review diff before overwriting.',
      bullets: ['Pull: local files → Reminisce database','Push: Reminisce database → local disk','Conflict detection on focus return','File-level ownership — developer files are never overwritten'],
    },
    {
      icon: GitBranch, tag: 'Repository aware', size: 'medium',
      title: 'Git Integration',
      desc: 'Reads your local .git/ directory directly — no API calls, no authentication, works offline. Branch name and last commit surface in every PAM message, every context injection, and the project overview.',
      bullets: ['Reads branch, last commit, remote URL','Branch shown in PAM system prompt','Changelog entries tagged with branch name','Works with GitHub, GitLab, Bitbucket, or any git remote'],
    },
    {
      icon: FileCode2, tag: 'Editor integration', size: 'medium',
      title: 'Editor Files',
      desc: 'After blueprint generation, Reminisce creates a context file tailored to your AI coding tool. Set your editor preference once in Settings — every regeneration updates the file automatically.',
      bullets: ['Cursor → .cursorrules','Claude Code → CLAUDE.md','GitHub Copilot → .github/copilot-instructions.md','Windsurf → .windsurfrules'],
    },
    {
      icon: Bot, tag: 'AI execution', size: 'medium',
      title: 'AI Agent',
      desc: 'Pick a feature from your board, select a model, and hit Run. The agent reads your full project context — architecture, tech stack, coding guidelines — and generates complete, accurate code. Every run is logged to agent-runs.md automatically.',
      bullets: ['15+ models across Anthropic, OpenAI, Google, Groq, Cerebras, SambaNova','Full project context per run','Run history appended to agent-runs.md','BYOK supported for all providers'],
    },
    {
      icon: Zap, tag: 'Project intelligence', size: 'small',
      title: 'PAM',
      desc: 'Project Action Manager — the embedded AI assistant that knows your project inside out. Ask for a status briefing, mark features done, add features to phases, create prompts, or set reminders.',
      bullets: ['/status, /done, /block, /prompt, /add, /remind commands','Scope alert: warns when requests diverge from blueprint','Auto-appends to changes.md on every confirmed action'],
    },
    {
      icon: BookOpen, tag: 'Prompt management', size: 'small',
      title: 'Prompt Library',
      desc: 'Three-tab archive of every prompt in your project. Blueprint tab shows the wizard-generated prompts with usage counts. Custom tab for user-created prompts. Changelog tab renders agent-runs.md automatically.',
      bullets: ['Blueprint: master + phase + feature prompts','Custom: user-created and PAM-generated prompts','Changelog: auto-populated agent run and change logs'],
    },
    {
      icon: Network, tag: 'Visualise', size: 'small',
      title: 'Graph View',
      desc: 'A visual map of every phase, feature, and their relationships. Track what\'s planned, in progress, and done. Full canvas engine with pan, zoom, drag, annotations, and minimap.',
      bullets: ['Drag and drop layout','Status tracking per feature','Canvas annotations (Note, Bug, TODO, Comment)'],
    },
    {
      icon: FlaskConical, tag: 'Testing', size: 'small',
      title: 'API Lab',
      desc: 'Built-in HTTP client for testing API endpoints as you build them. Send requests, inspect responses, and catch issues without leaving the platform.',
      bullets: ['GET POST PUT DELETE PATCH','Headers and body editor','Response inspector with timing'],
    },
    {
      icon: Users, tag: 'Team', size: 'small',
      title: 'Collaboration',
      desc: 'Invite up to 5 members. Everyone works from the same live context — same blueprint, same prompt library, same PAM. Owner controls wizard, settings, and invites.',
      bullets: ['Owner and member roles','Shared blueprint and context access','Real-time collaborative board'],
    },
  ]

  const large  = features.filter(f => f.size === 'large')
  const medium = features.filter(f => f.size === 'medium')
  const small  = features.filter(f => f.size === 'small')

  const cardBase = (highlight = false): React.CSSProperties => ({
    background: highlight ? hexToRgba(ac, 0.04) : 'rgba(255,255,255,0.025)',
    border: `1px solid ${highlight ? hexToRgba(ac, 0.2) : 'rgba(255,255,255,0.07)'}`,
    borderRadius: 24,
  })

  return (
    <div style={{ background: '#05050f', color: '#fff', minHeight: '100vh', overflowX: 'hidden' }}>
      <style>{`
        .sr{opacity:0;transform:translateY(28px);transition:opacity .8s ease,transform .8s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.06s}.d2{transition-delay:.14s}.d3{transition-delay:.22s}
        .d4{transition-delay:.30s}.d5{transition-delay:.38s}
        @keyframes ring-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-10px) rotate(5deg)}}
        @keyframes sync-bar{0%{transform:translateX(-100%)}100%{transform:translateX(400%)}}
      `}</style>

      <div style={{
        position: 'fixed', top: -200, left: '50%', transform: 'translateX(-50%)',
        width: 800, height: 500,
        background: `radial-gradient(ellipse,${hexToRgba(ac,0.12)} 0%,transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }}/>

      <LandingNav />

      {/* Hero */}
      <section style={{ padding: mobile ? '130px 24px 64px' : '160px 60px 80px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {!mobile && (
          <>
            <div style={{ position:'absolute', top:100, left:'8%', width:100, height:100, borderRadius:'50%', border:`1px solid ${hexToRgba(ac,0.1)}`, animation:'ring-float 7s ease-in-out infinite', pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:160, right:'9%', width:60, height:60, borderRadius:'50%', border:`1px solid ${hexToRgba(ac,0.07)}`, animation:'ring-float 5s ease-in-out 2s infinite', pointerEvents:'none' }}/>
          </>
        )}
        <div className="sr" style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: hexToRgba(ac,0.08), border: `1px solid ${hexToRgba(ac,0.25)}`,
          borderRadius: 999, padding: '6px 18px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.18em',
          color: ac, textTransform: 'uppercase' as const, marginBottom: 28,
        }}>
          <Sparkles size={10}/> Features
        </div>
        <h1 className="sr" style={{
          fontSize: mobile ? 'clamp(30px,9vw,46px)' : 'clamp(40px,5vw,68px)',
          fontWeight: 900, letterSpacing: '-0.04em', lineHeight: 1.0,
          maxWidth: 760, margin: '0 auto 20px',
        }}>
          Everything you need.<br/>
          <span style={{ background: `linear-gradient(135deg,${ac},#fff)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            Nothing you don&apos;t.
          </span>
        </h1>
        <p className="sr" style={{
          maxWidth: 520, margin: '0 auto 48px',
          fontSize: mobile ? 15 : 18, color: 'rgba(255,255,255,0.45)', lineHeight: 1.75,
        }}>
          Eleven tools, one platform. From first idea to shipped code — context stored, git-aware,
          editor-integrated, and always in sync.
        </p>
        <div className="sr" style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
          <Link href="/signup" style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background: ac, color:'#000', padding:'13px 36px',
            borderRadius:999, fontSize:14, fontWeight:800,
            textDecoration:'none', boxShadow:`0 0 40px ${hexToRgba(ac,0.4)}`,
          }}>Start free <ArrowRight size={14}/></Link>
          <Link href="/docs" style={{
            display:'inline-flex', alignItems:'center', gap:8,
            background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
            color:'rgba(255,255,255,0.8)', padding:'13px 36px',
            borderRadius:999, fontSize:14, fontWeight:600, textDecoration:'none',
          }}>Read the docs</Link>
        </div>
      </section>

      {/* Large feature cards — 2 col */}
      <section style={{ maxWidth:1200, margin:'0 auto', padding: mobile?'0 24px 64px':'0 60px 80px' }}>
        <div style={{ display:'grid', gridTemplateColumns: mobile?'1fr':'1fr 1fr', gap:16, marginBottom:16 }}>
          {large.map((f,i) => {
            const Icon = f.icon
            return (
              <ThreeDCard key={i} style={{ ...cardBase(true), padding: mobile?'32px':'40px', minHeight:340 }}>
                <div style={{ position:'absolute', right:-30, bottom:-30, width:120, height:120, opacity:0.3, pointerEvents:'none' }}>
                  <BentoScene accent={ac}/>
                </div>
                <div style={{ position:'relative', zIndex:3 }}>
                  <div style={{
                    width:52, height:52, borderRadius:16,
                    background:hexToRgba(ac,0.1), border:`1px solid ${hexToRgba(ac,0.2)}`,
                    display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20,
                  }}><Icon size={24} color={ac}/></div>
                  <div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:hexToRgba(ac,0.65), marginBottom:8 }}>{f.tag}</div>
                  <h2 style={{ fontSize:mobile?20:26, fontWeight:800, color:'#fff', marginBottom:12, lineHeight:1.15 }}>{f.title}</h2>
                  <p style={{ fontSize:14, color:'rgba(255,255,255,0.5)', lineHeight:1.8, marginBottom:20 }}>{f.desc}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {f.bullets.map((b,bi) => (
                      <div key={bi} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'rgba(255,255,255,0.45)' }}>
                        <Check size={11} color={ac} style={{ flexShrink:0 }}/>{b}
                      </div>
                    ))}
                  </div>
                </div>
              </ThreeDCard>
            )
          })}
        </div>

        {/* Medium feature cards — 2 col */}
        <div style={{ display:'grid', gridTemplateColumns: mobile?'1fr':medium.length===4?'1fr 1fr':'repeat(3,1fr)', gap:16, marginBottom:16 }}>
          {medium.map((f,i) => {
            const Icon = f.icon
            return (
              <ThreeDCard key={i} className={`sr d${i+1}`} style={{ ...cardBase(), padding: mobile?'28px':'32px' }}>
                <div style={{ position:'absolute', right:-16, bottom:-16, width:80, height:80, borderRadius:'50%', background:`radial-gradient(ellipse,${hexToRgba(ac,0.2)} 0%,transparent 70%)`, animation:'sync-bar 8s ease-in-out infinite', pointerEvents:'none' }}/>
                <div style={{ position:'relative', zIndex:2 }}>
                  <div style={{ width:44, height:44, borderRadius:12, background:hexToRgba(ac,0.1), border:`1px solid ${hexToRgba(ac,0.2)}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:16 }}>
                    <Icon size={20} color={ac}/>
                  </div>
                  <div style={{ fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:hexToRgba(ac,0.65), marginBottom:6 }}>{f.tag}</div>
                  <h3 style={{ fontSize:mobile?16:18, fontWeight:700, color:'#fff', marginBottom:10 }}>{f.title}</h3>
                  <p style={{ fontSize:13, color:'rgba(255,255,255,0.45)', lineHeight:1.75, marginBottom:16 }}>{f.desc}</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
                    {f.bullets.map((b,bi) => (
                      <div key={bi} style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'rgba(255,255,255,0.4)' }}>
                        <Check size={10} color={ac} style={{ flexShrink:0 }}/>{b}
                      </div>
                    ))}
                  </div>
                </div>
              </ThreeDCard>
            )
          })}
        </div>

        {/* Small feature cards — 3 col (or 2 on mobile) */}
        <div style={{ display:'grid', gridTemplateColumns: mobile?'1fr 1fr':'repeat(5,1fr)', gap:14 }}>
          {small.map((f,i) => {
            const Icon = f.icon
            return (
              <ThreeDCard key={i} className={`sr d${(i%3)+1}`} style={{ ...cardBase(), padding:'22px' }}>
                <div style={{ position:'absolute', top:12, right:12, width:7, height:7, borderRadius:'50%', background:hexToRgba(ac,0.4), boxShadow:`0 0 8px ${hexToRgba(ac,0.5)}`, pointerEvents:'none' }}/>
                <div style={{ position:'relative', zIndex:2 }}>
                  <div style={{ width:38, height:38, borderRadius:10, background:hexToRgba(ac,0.1), border:`1px solid ${hexToRgba(ac,0.18)}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
                    <Icon size={17} color={ac}/>
                  </div>
                  <div style={{ fontSize:8, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:hexToRgba(ac,0.6), marginBottom:5 }}>{f.tag}</div>
                  <h4 style={{ fontSize:13, fontWeight:700, color:'#fff', marginBottom:7 }}>{f.title}</h4>
                  <p style={{ fontSize:11, color:'rgba(255,255,255,0.4)', lineHeight:1.7, margin:0 }}>{f.desc}</p>
                </div>
              </ThreeDCard>
            )
          })}
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth:720, margin:'0 auto', padding: mobile?'40px 24px 80px':'40px 60px 120px', textAlign:'center' }}>
        <div className="sr" style={{
          padding: mobile?'48px 28px':'64px 56px', borderRadius:24,
          background:hexToRgba(ac,0.05), border:`1px solid ${hexToRgba(ac,0.2)}`,
          position:'relative', overflow:'hidden',
        }}>
          <div style={{ position:'absolute', top:-60, left:'50%', transform:'translateX(-50%)', width:320, height:160, background:`radial-gradient(ellipse,${hexToRgba(ac,0.2)} 0%,transparent 70%)`, pointerEvents:'none' }}/>
          <h2 style={{ fontSize:mobile?24:40, fontWeight:900, color:'#fff', letterSpacing:'-0.03em', marginBottom:14 }}>
            Ready to build?
          </h2>
          <p style={{ fontSize:mobile?14:16, color:'rgba(255,255,255,0.45)', marginBottom:32, lineHeight:1.7 }}>
            No credit card required. Free plan includes the wizard, agent, PAM, and community models.
          </p>
          <div style={{ display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
            <Link href="/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 36px', background:ac, color:'#000', borderRadius:999, textDecoration:'none', fontSize:14, fontWeight:800, boxShadow:`0 0 32px ${hexToRgba(ac,0.4)}` }}>
              Start free <ArrowRight size={14}/>
            </Link>
            <Link href="/upgrade" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 36px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.8)', borderRadius:999, textDecoration:'none', fontSize:14, fontWeight:600 }}>
              See pricing →
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
