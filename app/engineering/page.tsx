'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme, THEME_COLORS } from '@/hooks/useTheme'
import { Inter } from 'next/font/google'
import LandingNav from '@/components/landing-nav'

const inter = Inter({ subsets: ['latin'] })

function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

export default function EngineeringPage() {
  const { accent } = useTheme()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Canvas Particle System
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    let animationId: number
    let mounted = true

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'solar-flare'
    const canvasAccent = THEME_COLORS[currentTheme] || '#f59e0b'

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()

    const particles: Array<{
      x: number; y: number
      vx: number; vy: number
      size: number; opacity: number
      color: string
    }> = []

    const particleCount = isMobile ? 40 : 80
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.4 + 0.1,
        color: Math.random() > 0.7 ? canvasAccent : '#ffffff'
      })
    }

    const animate = () => {
      if (!mounted) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x
          const dy = particles[i].y - particles[j].y
          const dist = Math.sqrt(dx * dx + dy * dy)
          const limit = isMobile ? 80 : 120
          if (dist < limit) {
            const opacity = (1 - dist / limit) * 0.08
            const r = parseInt(canvasAccent.slice(1, 3), 16) || 245
            const g = parseInt(canvasAccent.slice(3, 5), 16) || 158
            const b = parseInt(canvasAccent.slice(5, 7), 16) || 11
            ctx.strokeStyle = `rgba(${r},${g},${b},${opacity})`
            ctx.lineWidth = 0.5
            ctx.beginPath()
            ctx.moveTo(particles[i].x, particles[i].y)
            ctx.lineTo(particles[j].x, particles[j].y)
            ctx.stroke()
          }
        }
      }

      particles.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
        ctx.fillStyle = p.color === '#ffffff'
          ? `rgba(255,255,255,${p.opacity})`
          : (() => {
              const r = parseInt(canvasAccent.slice(1,3), 16) || 245
              const g = parseInt(canvasAccent.slice(3,5), 16) || 158
              const b = parseInt(canvasAccent.slice(5,7), 16) || 11
              return `rgba(${r},${g},${b},${p.opacity})`
            })()
        ctx.fill()

        p.x += p.vx
        p.y += p.vy
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()
    window.addEventListener('resize', resize)
    return () => {
      mounted = false
      cancelAnimationFrame(animationId)
      window.removeEventListener('resize', resize)
    }
  }, [accent, isMobile])

  const stagesList = [
    { num: '01', name: 'INGEST', desc: 'Project documents, codebases, and specifications loaded into context buffer.' },
    { num: '02', name: 'PARSE', desc: 'Structured extraction of key phases, functional features, and domain dependencies.' },
    { num: '03', name: 'ROUTE', desc: 'Task complexity analysis automatically selects the optimal backend model.' },
    { num: '04', name: 'INJECT', desc: 'Zero-loss context piped into every system prompt with precision metadata headers.' },
    { num: '05', name: 'OUTPUT', desc: 'Structured, auditable responses written back to project version history.' }
  ]

  const modelsList = [
    { provider: 'Anthropic', name: 'Claude 4 Opus', for: 'Deep reasoning & logic', speed: [1, 1, 0.5] },
    { provider: 'Anthropic', name: 'Claude 4 Sonnet', for: 'Balanced complex tasks', speed: [1, 1, 0.5] },
    { provider: 'Google', name: 'Gemini 2.5 Pro', for: 'Multimodal execution', speed: [1, 1, 0.5] },
    { provider: 'Mistral', name: 'Mistral Large', for: 'Code generation & RAG', speed: [1, 1, 0.5] },
    { provider: 'OpenAI', name: 'GPT-4o', for: 'General high-speed tasks', speed: [1, 0.5, 0] },
    { provider: 'MiniMax', name: 'MiniMax-01', for: 'Cost efficient inference', speed: [0.5, 0.5, 0.5] }
  ]

  return (
    <div className={`min-h-screen bg-black text-white selection:bg-white/10 ${inter.className} page-enter`}>
      <canvas
        ref={canvasRef}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 0,
          pointerEvents: 'none',
          width: '100%',
          height: '100%',
        }}
        aria-hidden="true"
      />
      
      <LandingNav />

      {/* Hero Section */}
      <section style={{ 
        paddingTop: isMobile ? 120 : 160, 
        paddingBottom: isMobile ? 40 : 80,
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        textAlign: 'center',
        paddingLeft: isMobile ? 20 : 40,
        paddingRight: isMobile ? 20 : 40,
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          border: `1px solid ${accent}`,
          background: hexToRgba(accent, 0.05),
          borderRadius: 999,
          padding: '6px 18px',
          fontSize: 10,
          letterSpacing: '0.2em',
          color: accent,
          fontWeight: 900,
          marginBottom: 32,
          textTransform: 'uppercase'
        }}>
          ENGINEERING ARCHITECTURE
        </div>

        <h1 style={{ 
          fontSize: 'clamp(32px, 6vw, 72px)', 
          fontWeight: 900, 
          letterSpacing: '-0.03em', 
          lineHeight: 1.1,
          margin: 0
        }}>
           Precision routing.<br />Zero hallucinations.
        </h1>

        <p style={{ 
          maxWidth: 540, 
          margin: '24px auto 0',
          fontSize: isMobile ? 15 : 18,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6
        }}>
          How Reminisce orchestrates AI models across your engineering lifecycle.
        </p>
      </section>

      {/* Pipeline Section */}
      <section style={{ 
        padding: isMobile ? '20px 20px 60px' : '40px 0 120px', 
        maxWidth: 1100, 
        margin: '0 auto', 
        paddingLeft: isMobile ? 20 : 40, 
        paddingRight: isMobile ? 20 : 40, 
        position: 'relative', 
        zIndex: 1 
      }}>
        <div style={{ 
          display: 'flex', 
          flexDirection: isMobile ? 'column' : 'row',
          border: '1px solid rgba(255,255,255,0.06)', 
          borderRadius: 12, 
          overflow: 'hidden',
          background: 'rgba(0,0,0,0.5)',
          backdropFilter: 'blur(10px)'
        }}>
          {stagesList.map((s, i) => (
            <div 
              key={i} 
              style={{ 
                flex: 1, 
                padding: '32px 20px',
                borderRight: (i < stagesList.length - 1 && !isMobile) ? '1px solid rgba(255,255,255,0.06)' : 'none',
                borderBottom: (i < stagesList.length - 1 && isMobile) ? '1px solid rgba(255,255,255,0.06)' : 'none',
                transition: 'background 200ms ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <div style={{ fontSize: 10, color: accent, fontWeight: 700, letterSpacing: '0.1em' }}>{s.num}</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.name}</div>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, marginTop: 8 }}>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Model Matrix Section */}
      <section style={{ 
        padding: isMobile ? '40px 20px 80px' : '80px 0 120px', 
        maxWidth: 1100, 
        margin: '0 auto', 
        paddingLeft: isMobile ? 20 : 40, 
        paddingRight: isMobile ? 20 : 40, 
        position: 'relative', 
        zIndex: 1 
      }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Model Selection Matrix</h2>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Automatically matched to task complexity and domain expertise.</p>
        </div>

        <div style={{ 
          border: '1px solid rgba(255,255,255,0.06)', 
          borderRadius: 12, 
          overflowX: 'auto',
          background: 'rgba(255,255,255,0.01)',
          width: '100%'
        }} className="hide-scrollbar">
          <div style={{ minWidth: 600 }}>
            {/* Header */}
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: '1.2fr 1.5fr 1.5fr 1fr', 
              padding: '16px 24px', 
              background: 'rgba(255,255,255,0.04)',
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '0.1em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase'
            }}>
              <div>PROVIDER</div>
              <div>MODEL</div>
              <div>BEST FOR</div>
              <div>SPEED</div>
            </div>
            {/* Rows */}
            {modelsList.map((m, i) => (
              <div 
                key={i} 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '1.2fr 1.5fr 1.5fr 1fr', 
                  padding: '16px 24px', 
                  background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                  fontSize: 13,
                  alignItems: 'center',
                  borderTop: '1px solid rgba(255,255,255,0.04)'
                }}
              >
                <div style={{ color: 'rgba(255,255,255,0.5)' }}>{m.provider}</div>
                <div style={{ fontWeight: 600, color: '#fff' }}>{m.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.4)' }}>{m.for}</div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {m.speed.map((s, si) => (
                    <div key={si} style={{ color: accent, fontSize: 14 }}>
                      {s === 1 ? '●' : s === 0.5 ? '◐' : '○'}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Explainer Section */}
      <section style={{ 
        padding: isMobile ? '40px 20px 120px' : '80px 0 160px', 
        maxWidth: 1100, 
        margin: '0 auto', 
        paddingLeft: isMobile ? 20 : 40, 
        paddingRight: isMobile ? 20 : 40, 
        position: 'relative', 
        zIndex: 1 
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : '1.2fr 0.8fr', 
          gap: isMobile ? 48 : 80, 
          alignItems: 'center' 
        }}>
          <div>
            <h2 style={{ fontSize: isMobile ? 28 : 32, fontWeight: 800, lineHeight: 1.2 }}>Context injection,<br />visualised</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7, marginTop: 24 }}>
              Every prompt sent through Reminisce carries a precision header: your project phase, active features, architectural decisions, and version history — all assembled and injected in under 50ms.
            </p>
          </div>

          <div style={{ 
            background: 'rgba(255,255,255,0.03)', 
            border: '1px solid rgba(255,255,255,0.08)', 
            borderRadius: 12, 
            padding: 24,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: isMobile ? 11 : 12,
            lineHeight: 1.6,
            color: 'rgba(255,255,255,0.8)',
            position: 'relative',
            overflowX: 'auto'
          }}>
            <div style={{ color: accent, opacity: 0.6, marginBottom: 8, whiteSpace: 'nowrap' }}>{'// REMINISCE CONTEXT HEADER v2.0'}</div>
            <div style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>[PROJECT]</span> Engineering Audit — Phase 3</div>
            <div style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>[STACK]</span> Next.js 14 · Supabase · TypeScript</div>
            <div style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>[PHASE]</span> API Integration & Testing</div>
            <div style={{ color: accent, opacity: 0.6, marginTop: 12 }}>[ACTIVE_FEATURES]</div>
            <div style={{ paddingLeft: 12 }}>
              <div style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>→ Payment gateway integration</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>→ OAuth2 flow implementation</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', whiteSpace: 'nowrap' }}>→ Rate limiting middleware</div>
            </div>
            <div style={{ marginTop: 12, whiteSpace: 'nowrap' }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>[CONTEXT_VERSION]</span> sha:4a7f2d1</div>
            <div style={{ whiteSpace: 'nowrap' }}><span style={{ color: 'rgba(255,255,255,0.3)' }}>[INJECTED_AT]</span> 2025-03-13T09:41:22Z</div>
            <div style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', margin: '16px 0' }} />
            <div style={{ color: accent, opacity: 0.8 }}>[USER_PROMPT]</div>
            <div style={{ marginTop: 4 }}>Review the OAuth implementation for security vulnerabilities...</div>
          </div>
        </div>
      </section>

      <footer style={{ padding: '48px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ 
          maxWidth: 1100, 
          margin: '0 auto', 
          padding: isMobile ? '0 20px' : '0 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            © 2025 REMINISCE
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.1em' }}>
            ENGINEERED WITH PRECISION
          </div>
        </div>
      </footer>
    </div>
  )
}
