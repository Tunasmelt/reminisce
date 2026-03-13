'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { 
  Zap, 
  Network, 
  Sparkles, 
  FlaskConical, 
  Database, 
  ShieldCheck,
  Star
} from 'lucide-react'
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

export default function Home() {
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
    const canvasAccent = THEME_COLORS[currentTheme] ||'#f59e0b'

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

  const featuresList = [
    { icon: Zap, title: "Context Injection", desc: "Zero-loss context piping across all AI interactions." },
    { icon: Network, title: "AI Routing", desc: "Intelligent model selection based on task complexity." },
    { icon: Sparkles, title: "Memory Graphs", desc: "Persistent knowledge networks that compound over time." },
    { icon: FlaskConical, title: "API Laboratory", desc: "Test prompts and model configurations in real-time." },
    { icon: Database, title: "Version Control", desc: "Full audit trail for every context mutation." },
    { icon: ShieldCheck, title: "Prompt Shields", desc: "Hallucination detection and context validation layers." }
  ]

  const statsList = [
    { value: '10×', label: 'FASTER RECALL' },
    { value: '99.2%', label: 'REDUCTION' },
    { value: '<50ms', label: 'LATENCY' },
    { value: '∞', label: 'CAPACITY' }
  ]

  return (
    <div className={`min-h-screen bg-black text-white selection:bg-white/10 ${inter.className} page-enter`} style={{ scrollBehavior: 'smooth' }}>
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
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        textAlign: 'center',
        padding: isMobile ? '120px 20px 60px' : '0 40px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          border: `1px solid ${accent}`,
          background: hexToRgba(accent, 0.06),
          borderRadius: 999,
          padding: '6px 18px',
          fontSize: isMobile ? 8 : 10,
          letterSpacing: '0.2em',
          color: accent,
          fontWeight: 900,
          marginBottom: 32,
          textTransform: 'uppercase'
        }}>
          ⚡ PRECISION ENGINEERING CONTEXT ENGINE
        </div>

        <h1 style={{ 
          fontSize: 'clamp(40px, 8vw, 96px)', 
          fontWeight: 900, 
          letterSpacing: '-0.04em', 
          lineHeight: 0.95,
          margin: 0
        }}>
          <div style={{ color: '#fff' }}>AI WITH A</div>
          <div style={{ color: accent, fontStyle: 'italic' }}>PHOTOGRAPHIC</div>
          <div style={{ color: '#fff' }}>MEMORY</div>
        </h1>

        <p style={{ 
          maxWidth: 480, 
          margin: '32px auto 0',
          fontSize: isMobile ? 14 : 16,
          color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.7
        }}>
          Eliminate prompt hallucinations. Ground your engineering lifecycle in immutable project documents.
        </p>

        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', gap: 12, marginTop: 40, width: isMobile ? '100%' : 'auto' }}>
          <Link 
            href="/dashboard" 
            style={{
              background: accent,
              color: '#000',
              borderRadius: 999,
              padding: '14px 32px',
              fontSize: 13,
              fontWeight: 800,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              textDecoration: 'none',
              transition: 'all 0.2s cubic-bezier(0.19, 1, 0.22, 1)'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.opacity = '0.88'
              e.currentTarget.style.transform = 'scale(1.02)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.opacity = '1'
              e.currentTarget.style.transform = 'scale(1)'
            }}
          >
            Start Building →
          </Link>
          <button style={{
            border: '1px solid rgba(255,255,255,0.15)',
            color: 'rgba(255,255,255,0.7)',
            borderRadius: 999,
            padding: '14px 32px',
            fontSize: 13,
            fontWeight: 600,
            background: 'transparent',
            cursor: 'pointer',
            transition: 'all 0.2s cubic-bezier(0.19, 1, 0.22, 1)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.borderColor = accent
            e.currentTarget.style.color = '#fff'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'
            e.currentTarget.style.color = 'rgba(255,255,255,0.7)'
          }}
          >
            Read Specs
          </button>
        </div>

        {/* Browser Mockup */}
        {!isMobile && (
          <div style={{
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.03)',
            borderRadius: 16,
            maxWidth: 720,
            width: '100%',
            margin: '64px auto 0',
            overflow: 'hidden'
          }}>
            <div style={{ 
              height: 36, 
              background: 'rgba(255,255,255,0.04)', 
              display: 'flex', 
              alignItems: 'center', 
              padding: '0 16px',
              gap: 16
            }}>
              <div style={{ display: 'flex', gap: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <div style={{ 
                background: 'rgba(255,255,255,0.06)', 
                borderRadius: 999, 
                padding: '4px 12px', 
                fontSize: 10, 
                color: 'rgba(255,255,255,0.3)',
                fontFamily: 'monospace'
              }}>
                reminisce.io/lab/engineering-audit
              </div>
            </div>
            <div style={{ height: 240, padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ width: 80, height: 28, borderRadius: 999, background: accent }} />
                <div style={{ width: 120, height: 28, borderRadius: 999, background: accent }} />
              </div>
              <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                 <div style={{ width: 40, height: 40, borderRadius: 8, background: hexToRgba(accent, 0.1) }} />
                 <div style={{ flex: 1, height: 60, background: hexToRgba(accent, 0.05), borderRadius: 8 }} />
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1, height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
                <div style={{ flex: 1, height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
                <div style={{ flex: 1, height: 40, background: 'rgba(255,255,255,0.03)', borderRadius: 8 }} />
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Features Grid */}
      <section style={{ padding: isMobile ? '80px 20px' : '120px 0', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>
            PLATFORM MODULES
          </div>
        </div>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
          gap: 1, 
          outline: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(255,255,255,0.06)'
        }}>
          {featuresList.map((f, i) => (
            <div 
              key={i} 
              style={{ 
                background: '#000', 
                padding: '32px 28px',
                border: '1px solid rgba(255,255,255,0.04)',
                transition: 'background 200ms ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
              onMouseLeave={(e) => e.currentTarget.style.background = '#000'}
            >
              <f.icon size={28} color={accent} />
              <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 16 }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6, marginTop: 8 }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Stats Band */}
      <section style={{ 
        background: 'rgba(255,255,255,0.02)', 
        borderTop: '1px solid rgba(255,255,255,0.06)', 
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '64px 0'
      }}>
        <div style={{ 
          maxWidth: 1100, 
          margin: '0 auto', 
          display: 'grid', 
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', 
          textAlign: 'center',
          gap: isMobile ? '40px 0' : 0
        }}>
          {statsList.map(s => (
            <div key={s.label}>
              <div style={{ fontSize: isMobile ? 32 : 'clamp(36px, 5vw, 52px)', fontWeight: 900, color: accent }}>
                {s.value}
              </div>
              <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: '48px 0', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: 120 }}>
        <div style={{ 
          maxWidth: 1100, 
          margin: '0 auto', 
          padding: isMobile ? '0 20px' : '0 40px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={14} fill={accent} stroke={accent} />
            <span style={{ fontWeight: 800, fontStyle: 'italic', fontSize: 16, letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
              REMINISCE
            </span>
          </div>
          <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            © 2025 REMINISCE
          </div>
        </div>
      </footer>
    </div>
  )
}
