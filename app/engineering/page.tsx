'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ArrowRight, GitBranch, Layers, Zap,
  Database, Bot, FolderSync, FileCode2,
} from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import LandingNav from '@/components/landing-nav'

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

function ThreeDCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hov, setHov] = useState(false)
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setTilt({ x:((e.clientY-rect.top-rect.height/2)/rect.height)*6, y:-((e.clientX-rect.left-rect.width/2)/rect.width)*6 })
  }, [])
  return (
    <div ref={ref} onMouseMove={onMove} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setTilt({x:0,y:0});setHov(false)}}
      style={{ transform:`perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition:hov?'transform 0.1s ease':'transform 0.5s cubic-bezier(0.23,1,0.32,1)', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)', opacity:hov?1:0, transition:'opacity 0.3s', pointerEvents:'none', zIndex:1 }}/>
      <div style={{ position:'relative', zIndex:2, height:'100%' }}>{children}</div>
    </div>
  )
}

function StepDot({ accent, active }: { accent: string; active: boolean }) {
  return (
    <div style={{
      width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
      background: active ? accent : 'rgba(255,255,255,0.12)',
      border: `2px solid ${active ? accent : 'rgba(255,255,255,0.2)'}`,
      boxShadow: active ? `0 0 12px ${hexToRgba(accent,0.6)}` : 'none',
      transition: 'all 0.4s ease',
    }}/>
  )
}

function PipelineConnector({ accent, active }: { accent: string; active: boolean }) {
  return (
    <div style={{
      width: 2, height: 24,
      background: active
        ? `linear-gradient(to bottom, ${accent}, ${hexToRgba(accent, 0.2)})`
        : 'rgba(255,255,255,0.07)',
      boxShadow: active ? `0 0 6px ${hexToRgba(accent, 0.4)}` : 'none',
      borderRadius: 2,
      transition: 'background 0.4s ease, box-shadow 0.4s ease',
    }}/>
  )
}

export default function EngineeringPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const [mobile, setMobile] = useState(false)
  const [activeStep, setActiveStep] = useState(0)
  useScrollReveal()

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) setActiveStep(parseInt((e.target as HTMLElement).dataset.step||'0')) })
    }, { threshold: 0.35, rootMargin: '-10% 0px -40% 0px' })
    const t = setTimeout(() => { document.querySelectorAll('[data-step]').forEach(el => io.observe(el)) }, 600)
    return () => { clearTimeout(t); io.disconnect() }
  }, [])

  const steps = [
    { icon: Database,   num: '01', title: 'Run the Wizard',                  desc: 'Answer four questions about your project — idea, features, tech stack, and scope. Reminisce fires five parallel generation calls and builds your complete project blueprint in one run.',                          detail: 'Generates: architecture.md · tech-stack.md · coding-guidelines.md · product-scope.md · phases.md · master-prompt.md · editor integration file' },
    { icon: FolderSync, num: '02', title: 'Connect your local folder',        desc: 'Point Reminisce at your project root. Context files are written to disk immediately. Your git branch and last commit are read from .git/ — no API calls, no auth required.',                                    detail: 'Reads: .git/HEAD · .git/logs/HEAD · package.json · go.mod · requirements.txt' },
    { icon: FileCode2,  num: '03', title: 'Editor integration activates',     desc: 'Your chosen editor file (.cursorrules, CLAUDE.md, or copilot-instructions.md) is in your project root. Every time you open your editor in that folder, full project context is loaded automatically.',           detail: 'Supports: Cursor · Claude Code · GitHub Copilot · Windsurf · Generic (reminisce-context.md)' },
    { icon: Zap,        num: '04', title: 'Context injected in <50ms',        desc: 'Before every AI call — agent run or PAM message — Reminisce assembles your full project header. Git branch, active phase, feature list, and summaries from every context file, tiered by relevance.',           detail: 'Always injected: summaries + workflow files + git state. Smart-loaded: full file content on keyword match.' },
    { icon: Bot,        num: '05', title: 'Output logged automatically',       desc: 'Every agent run appends a timestamped entry to agent-runs.md. Every PAM action appends to changes.md. Both files are git-branch-tagged so you can trace every change back to where it happened.',              detail: 'Logs: reminisce/logs/agent-runs.md · reminisce/logs/changes.md (both auto-synced to local folder on push)' },
    { icon: Layers,     num: '06', title: 'Team stays in sync',               desc: 'Up to five members share the same live context — same blueprint, same prompt library, same PAM. Any member can mark features done, create prompts, or run agent tasks. Context is always the ground truth.',   detail: 'Owner manages: wizard · settings · member invites. Members access: PAM · agent · prompts · context view.' },
  ]

  const models = [
    { provider:'Anthropic', name:'Claude Sonnet 4.6', use:'Architecture, complex reasoning, long context', tier:'Pro'  },
    { provider:'Anthropic', name:'Claude Haiku 4.5',  use:'Fast responses, light tasks',                  tier:'Pro'  },
    { provider:'OpenAI',    name:'GPT-4o',            use:'General coding, multimodal',                   tier:'Pro'  },
    { provider:'Google',    name:'Gemini 2.5 Pro',    use:'Long context, data analysis',                  tier:'Pro'  },
    { provider:'Mistral',   name:'Mistral Large',     use:'Code generation, long documents',              tier:'Pro'  },
    { provider:'Mistral',   name:'Codestral',         use:'Code-specific generation',                     tier:'Pro'  },
    { provider:'Groq',      name:'Llama 3.3 70B',    use:'General tasks — fast, no cost',                tier:'Free' },
    { provider:'Groq',      name:'Llama 4 Scout',    use:'Capable generalist, no cost',                  tier:'Free' },
    { provider:'Groq',      name:'Kimi K2',          use:'Long context reasoning, no cost',              tier:'Free' },
    { provider:'Groq',      name:'Qwen3 32B',        use:'Multilingual reasoning, no cost',              tier:'Free' },
    { provider:'Cerebras',  name:'Llama 3.3 70B',    use:'Ultra-fast inference, no cost',                tier:'Free' },
    { provider:'SambaNova', name:'Llama 405B',       use:'Large model quality, no cost',                 tier:'Free' },
    { provider:'Mistral',   name:'Mistral Small',    use:'Lightweight, no cost',                         tier:'Free' },
  ]

  return (
    <div style={{ background:'#05050f', color:'#fff', minHeight:'100vh', overflowX:'hidden' }}>
      <style>{`
        .sr{opacity:0;transform:translateY(28px);transition:opacity .8s ease,transform .8s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.06s}.d2{transition-delay:.14s}.d3{transition-delay:.22s}
        @keyframes ring-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
        .model-row{transition:background .15s}
        .model-row:hover{background:rgba(255,255,255,0.04)!important}
      `}</style>

      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:800, height:500, background:`radial-gradient(ellipse,${hexToRgba(ac,0.12)} 0%,transparent 70%)`, pointerEvents:'none', zIndex:0 }}/>

      <LandingNav />

      {/* Hero */}
      <section style={{ padding: mobile?'130px 24px 64px':'160px 60px 80px', textAlign:'center', position:'relative', zIndex:1 }}>
        {!mobile && (
          <>
            <div style={{ position:'absolute', top:100, left:'8%', width:90, height:90, borderRadius:'50%', border:`1px solid ${hexToRgba(ac,0.1)}`, animation:'ring-float 7s ease-in-out infinite', pointerEvents:'none' }}/>
            <div style={{ position:'absolute', top:160, right:'9%', width:56, height:56, borderRadius:'50%', border:`1px solid ${hexToRgba(ac,0.07)}`, animation:'ring-float 5s ease-in-out 2s infinite', pointerEvents:'none' }}/>
          </>
        )}
        <div className="sr" style={{ display:'inline-flex', alignItems:'center', gap:8, background:hexToRgba(ac,0.08), border:`1px solid ${hexToRgba(ac,0.25)}`, borderRadius:999, padding:'6px 18px', fontSize:10, fontWeight:800, letterSpacing:'0.18em', color:ac, textTransform:'uppercase' as const, marginBottom:28 }}>
          <GitBranch size={10}/> How It Works
        </div>
        <h1 className="sr" style={{ fontSize: mobile?'clamp(30px,8vw,46px)':'clamp(40px,5vw,68px)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:1.0, maxWidth:780, margin:'0 auto 20px' }}>
          Simple to use.{' '}
          <span style={{ background:`linear-gradient(135deg,${ac},#fff)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent', backgroundClip:'text' }}>
            Precise under the hood.
          </span>
        </h1>
        <p className="sr" style={{ maxWidth:540, margin:'0 auto', fontSize: mobile?14:18, color:'rgba(255,255,255,0.45)', lineHeight:1.75 }}>
          Six steps from first idea to a fully context-aware, git-integrated, editor-connected development environment.
        </p>
      </section>

      {/* Pipeline steps */}
      <section style={{ maxWidth:940, margin:'0 auto', padding: mobile?'0 24px 80px':'0 60px 100px', position:'relative', zIndex:1 }}>


        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {steps.map((s, i) => {
            const Icon = s.icon
            const isActive = activeStep === i
            return (
              <React.Fragment key={i}>
                <div data-step={i} style={{
                  display:'flex', gap: mobile?16:24, alignItems:'flex-start',
                  padding:'24px 28px',
                  background: isActive ? hexToRgba(ac,0.06) : 'rgba(255,255,255,0.02)',
                  border:`1px solid ${isActive ? hexToRgba(ac,0.28) : 'rgba(255,255,255,0.06)'}`,
                  borderRadius:18, transition:'border-color .25s,background .25s',
                }}>
                  {/* Step number + icon */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, flexShrink:0, minWidth:36 }}>
                    <div style={{ width:36, height:36, borderRadius:10, background: isActive?hexToRgba(ac,0.15):'rgba(255,255,255,0.05)', border:`1px solid ${isActive?hexToRgba(ac,0.3):'rgba(255,255,255,0.08)'}`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <Icon size={16} color={isActive?ac:'rgba(255,255,255,0.4)'}/>
                    </div>
                    {!mobile && <StepDot accent={ac} active={isActive}/>}
                  </div>
                  <div style={{ flex:1 }}>
                    <span style={{ fontSize:9, fontWeight:800, color:hexToRgba(ac,0.55), letterSpacing:'0.12em', textTransform:'uppercase' as const, display:'block', marginBottom:5 }}>Step {s.num}</span>
                    <h3 style={{ fontSize:mobile?15:17, fontWeight:700, color:'#fff', marginBottom:8 }}>{s.title}</h3>
                    <p style={{ fontSize:13, color:'rgba(255,255,255,0.45)', lineHeight:1.75, marginBottom:10 }}>{s.desc}</p>
                    <div style={{ fontSize:11, fontFamily:'ui-monospace,monospace', color: isActive?hexToRgba(ac,0.6):'rgba(255,255,255,0.22)', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:8, padding:'8px 12px', lineHeight:1.7 }}>
                      {s.detail}
                    </div>
                  </div>
                </div>
                {i < steps.length - 1 && (
                  <div style={{ display:'flex', justifyContent:'center', padding:'0' }}>
                    <PipelineConnector accent={ac} active={activeStep > i} />
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      </section>

      {/* Model table */}
      <section style={{ maxWidth:940, margin:'0 auto', padding: mobile?'0 24px 100px':'0 60px 120px', position:'relative', zIndex:1 }}>
        <div className="sr" style={{ textAlign:'center', marginBottom:48 }}>
          <p style={{ fontSize:10, fontWeight:800, letterSpacing:'0.22em', color:ac, textTransform:'uppercase' as const, marginBottom:16 }}>AI Models</p>
          <h2 style={{ fontSize: mobile?28:48, fontWeight:900, letterSpacing:'-0.03em', color:'#fff', lineHeight:1.05 }}>15+ models. One platform.</h2>
          <p style={{ fontSize:mobile?14:17, color:'rgba(255,255,255,0.4)', marginTop:12, maxWidth:480, margin:'12px auto 0' }}>
            All free-tier models cost coins only. Pro models use gems.
          </p>
        </div>

        <ThreeDCard style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:20, overflow:'hidden' }}>
          {/* Table header */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1.8fr 80px', gap:0, background:'rgba(255,255,255,0.04)', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
            {['Provider','Model','Best for','Tier'].map(h => (
              <div key={h} style={{ padding:'12px 18px', fontSize:9, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.3)' }}>{h}</div>
            ))}
          </div>

          {/* Free section header */}
          <div style={{ padding:'10px 18px', background:`${hexToRgba(ac,0.04)}`, borderBottom:'1px solid rgba(255,255,255,0.05)', fontSize:9, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:hexToRgba(ac,0.6) }}>
            🪙 Free tier — costs coins only
          </div>
          {models.filter(m=>m.tier==='Free').map((m,i) => (
            <div key={i} className="model-row" style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1.8fr 80px', borderBottom:'1px solid rgba(255,255,255,0.04)', background:'transparent' }}>
              <div style={{ padding:'13px 18px', fontSize:12, color:'rgba(255,255,255,0.4)' }}>{m.provider}</div>
              <div style={{ padding:'13px 18px', fontSize:13, fontWeight:600, color:'#fff' }}>{m.name}</div>
              <div style={{ padding:'13px 18px', fontSize:12, color:'rgba(255,255,255,0.4)' }}>{m.use}</div>
              <div style={{ padding:'13px 18px' }}>
                <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:999, background:hexToRgba(ac,0.1), border:`1px solid ${hexToRgba(ac,0.25)}`, color:ac }}>FREE</span>
              </div>
            </div>
          ))}

          {/* Pro section header */}
          <div style={{ padding:'10px 18px', background:'rgba(167,139,250,0.04)', borderBottom:'1px solid rgba(255,255,255,0.05)', borderTop:'1px solid rgba(255,255,255,0.06)', fontSize:9, fontWeight:800, letterSpacing:'0.14em', textTransform:'uppercase' as const, color:'rgba(167,139,250,0.7)' }}>
            💎 Pro tier — costs gems
          </div>
          {models.filter(m=>m.tier==='Pro').map((m,i,arr) => (
            <div key={i} className="model-row" style={{ display:'grid', gridTemplateColumns:'1fr 1.4fr 1.8fr 80px', borderBottom: i<arr.length-1?'1px solid rgba(255,255,255,0.04)':'none', background:'transparent' }}>
              <div style={{ padding:'13px 18px', fontSize:12, color:'rgba(255,255,255,0.4)' }}>{m.provider}</div>
              <div style={{ padding:'13px 18px', fontSize:13, fontWeight:600, color:'#fff' }}>{m.name}</div>
              <div style={{ padding:'13px 18px', fontSize:12, color:'rgba(255,255,255,0.4)' }}>{m.use}</div>
              <div style={{ padding:'13px 18px' }}>
                <span style={{ fontSize:9, fontWeight:800, padding:'3px 8px', borderRadius:999, background:'rgba(167,139,250,0.1)', border:'1px solid rgba(167,139,250,0.3)', color:'#a78bfa' }}>PRO</span>
              </div>
            </div>
          ))}
        </ThreeDCard>

        {/* CTA row */}
        <div className="sr" style={{ marginTop:40, display:'flex', gap:12, justifyContent:'center', flexWrap:'wrap' as const }}>
          <Link href="/signup" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 36px', background:ac, color:'#000', borderRadius:999, textDecoration:'none', fontSize:14, fontWeight:800, boxShadow:`0 0 32px ${hexToRgba(ac,0.4)}` }}>
            Start building free <ArrowRight size={14}/>
          </Link>
          <Link href="/upgrade" style={{ display:'inline-flex', alignItems:'center', gap:8, padding:'13px 36px', background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', color:'rgba(255,255,255,0.8)', borderRadius:999, textDecoration:'none', fontSize:14, fontWeight:600 }}>
            See Pro features →
          </Link>
        </div>
      </section>
    </div>
  )
}
