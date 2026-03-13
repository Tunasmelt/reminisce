'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
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

export default function CapabilitiesPage() {
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

  const modulesList = [
    { num: '01', title: 'Context Injection', desc: 'Pipe zero-loss project context into every AI call automatically.' },
    { num: '02', title: 'AI Router', desc: 'Select optimal model per task based on complexity and cost.' },
    { num: '03', title: 'Memory Graphs', desc: 'Build compound knowledge networks that evolve with your codebase.' },
    { num: '04', title: 'Prompt Wizard', desc: 'Structured prompt generation derived from technical specifications.' },
    { num: '05', title: 'Version Control', desc: 'Full immutable audit trail for every context mutation and AI agent run.' },
    { num: '06', title: 'API Laboratory', desc: 'Real-time testing environment for model behavioral auditing.' },
    { num: '07', title: 'Agent Mode', desc: 'Multi-step autonomous task execution with precision scope control.' },
    { num: '08', title: 'Export Engine', desc: 'One-click structured output in any format with contextual mapping.' },
    { num: '09', title: 'Prompt Shields', desc: 'Hallucination detection and context validation security layers.' }
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
        height: isMobile ? '70vh' : '60vh', 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        textAlign: 'center',
        padding: isMobile ? '120px 20px 0' : '0 40px',
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
          PLATFORM CAPABILITIES
        </div>

        <h1 style={{ 
          fontSize: 'clamp(36px, 6vw, 72px)', 
          fontWeight: 900, 
          letterSpacing: '-0.03em', 
          lineHeight: 1.1,
          margin: 0
        }}>
          Everything your AI<br />needs to remember.
        </h1>

        <p style={{ 
          maxWidth: 600, 
          margin: '24px auto 0',
          fontSize: isMobile ? 15 : 18,
          color: 'rgba(255,255,255,0.4)',
          lineHeight: 1.6
        }}>
          Nine precision modules. One unified context engine.
        </p>
      </section>

      {/* Module Grid */}
      <section style={{ 
        padding: isMobile ? '40px 20px 80px' : '80px 0 120px', 
        maxWidth: 1100, 
        margin: '0 auto', 
        paddingLeft: isMobile ? 20 : 40, 
        paddingRight: isMobile ? 20 : 40, 
        position: 'relative', 
        zIndex: 1 
      }}>
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', 
          gap: 24
        }}>
          {modulesList.map((m, i) => (
            <div 
              key={i} 
              style={{ 
                background: 'rgba(255,255,255,0.02)', 
                padding: '28px 24px',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: 12,
                transition: 'all 300ms cubic-bezier(0.19, 1, 0.22, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = hexToRgba(accent, 0.3)
                e.currentTarget.style.transform = 'translateY(-4px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ fontSize: 11, color: accent, fontWeight: 700, letterSpacing: '0.1em' }}>
                {m.num}
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, marginTop: 16, marginBottom: 8 }}>
                {m.title}
              </h3>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>
                {m.desc}
              </p>
            </div>
          ))}
        </div>

        {/* CTA Banner */}
        <div style={{
          marginTop: isMobile ? 80 : 120,
          background: hexToRgba(accent, 0.06),
          border: `1px solid ${hexToRgba(accent, 0.15)}`,
          borderRadius: 16,
          padding: isMobile ? '32px 24px' : 48,
          textAlign: 'center'
        }}>
          <h2 style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, margin: 0, color: '#fff' }}>
            Ready to build with precision?
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginTop: 8, marginBottom: 32 }}>
            Your first project is free.
          </p>
          <Link 
            href="/dashboard" 
            style={{
              background: accent,
              color: '#000',
              borderRadius: 999,
              padding: '12px 32px',
              fontSize: 14,
              fontWeight: 800,
              textDecoration: 'none',
              display: 'inline-block',
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
            Launch Workspace →
          </Link>
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
