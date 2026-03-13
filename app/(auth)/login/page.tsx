'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, Star, Github } from 'lucide-react'
import { useTheme, THEME_COLORS } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'

export default function LoginPage() {
  const { accent } = useTheme()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focusedField, setFocusedField] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Canvas Particle System (same as landing pages)
  useEffect(() => {
    if (isMobile) return
    const canvas = canvasRef.current
    if (!canvas) return

    let animationId: number
    let mounted = true
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const currentTheme = document.documentElement.getAttribute('data-theme') || 'solar-flare'
    const canvasAccent = THEME_COLORS[currentTheme] || '#f59e0b'

    const resize = () => {
      if (canvas.parentElement) {
        canvas.width = canvas.parentElement.clientWidth
        canvas.height = canvas.parentElement.clientHeight
      }
    }
    resize()

    const particles: Array<{
      x: number; y: number
      vx: number; vy: number
      size: number; opacity: number
      color: string
    }> = []

    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.2,
        vy: (Math.random() - 0.5) * 0.2,
        size: Math.random() * 1.5 + 0.5,
        opacity: Math.random() * 0.3 + 0.1,
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
          if (dist < 100) {
            const opacity = (1 - dist / 100) * 0.05
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
  }, [isMobile, accent])

  const handleLogin = async () => {
    if (!email || !password) {
      toast.error('Please enter both email and password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      toast.error(error.message)
      setLoading(false)
    } else {
      toast.success('Logged in successfully!')
      router.push('/dashboard')
    }
  }

  return (
    <div style={{ height: '100vh', width: '100vw', background: '#000', display: 'flex', overflow: 'hidden' }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}} />

      {/* LEFT PANEL */}
      {!isMobile && (
        <div style={{ 
          flex: 1, 
          height: '100%', 
          background: '#000', 
          borderRight: '1px solid rgba(255,255,255,0.06)', 
          position: 'relative', 
          overflow: 'hidden' 
        }}>
          <canvas
            ref={canvasRef}
            style={{ position: 'absolute', inset: 0, zIndex: 0 }}
          />
          
          <div style={{ position: 'absolute', top: 32, left: 32, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
            <Star size={16} fill={accent} stroke={accent} />
            <span style={{ color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              REMINISCE
            </span>
          </div>

          <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              width: 300,
              height: 300,
              borderRadius: '50%',
              background: accent,
              opacity: 0.06,
              filter: 'blur(80px)',
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none'
            }} />

            {/* Terminal Window */}
            <div style={{
              width: 320,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12,
              overflow: 'hidden',
              position: 'relative',
              zIndex: 2
            }}>
              <div style={{ 
                height: 32, 
                background: 'rgba(255,255,255,0.05)', 
                padding: '0 12px', 
                display: 'flex', 
                alignItems: 'center', 
                gap: 6 
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ff5f57' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#febc2e' }} />
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#28c840' }} />
              </div>
              <div style={{ 
                padding: 20, 
                fontFamily: 'monospace', 
                fontSize: 12, 
                lineHeight: 1.8,
                textAlign: 'left'
              }}>
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>$ reminisce auth --verify</div>
                <div style={{ color: accent }}>✓ Context engine online</div>
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>✓ Memory graphs loaded</div>
                <div style={{ color: 'rgba(255,255,255,0.3)' }}>✓ AI routing active</div>
                <br/>
                <div style={{ color: 'rgba(255,255,255,0.5)', display: 'flex', alignItems: 'center' }}>
                  → Awaiting authentication...
                  <span style={{
                    display: 'inline-block',
                    width: 8,
                    height: 14,
                    background: accent,
                    marginLeft: 4,
                    animation: 'blink 1s step-end infinite'
                  }} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 32, textAlign: 'center', maxWidth: 280 }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)', fontStyle: 'italic', lineHeight: 1.6 }}>
                &quot;The best AI is the one that remembers everything.&quot;
              </p>
            </div>
          </div>
        </div>
      )}

      {/* RIGHT PANEL */}
      <div style={{ 
        flex: 1, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center', 
        padding: '0 48px' 
      }}>
        <div style={{ maxWidth: 420, width: '100%', margin: '0 auto' }}>
          <header style={{ marginBottom: 48 }}>
            <h1 style={{ fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em', color: '#fff', marginBottom: 8 }}>
              Welcome back.
            </h1>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
              Sign in to your workspace.
            </p>
          </header>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            {/* Email Field */}
            <div>
              <label style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                letterSpacing: '0.1em', 
                textTransform: 'uppercase', 
                color: focusedField === 'email' ? accent : 'rgba(255,255,255,0.5)', 
                marginBottom: 8, 
                display: 'block',
                transition: 'color 0.2s'
              }}>
                Email Address
              </label>
              <input
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.04)',
                  border: `1px solid ${focusedField === 'email' ? accent : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8,
                  padding: '12px 16px',
                  fontSize: 14,
                  color: '#fff',
                  outline: 'none',
                  transition: 'all 0.2s'
                }}
              />
            </div>

            {/* Password Field */}
            <div>
              <label style={{ 
                fontSize: 11, 
                fontWeight: 700, 
                letterSpacing: '0.1em', 
                textTransform: 'uppercase', 
                color: focusedField === 'password' ? accent : 'rgba(255,255,255,0.5)', 
                marginBottom: 8, 
                display: 'block',
                transition: 'color 0.2s'
              }}>
                Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: `1px solid ${focusedField === 'password' ? accent : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 8,
                    padding: '12px 16px',
                    paddingRight: 48,
                    fontSize: 14,
                    color: '#fff',
                    outline: 'none',
                    transition: 'all 0.2s'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: 'rgba(255,255,255,0.3)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <div style={{ textAlign: 'right', marginTop: 8 }}>
                <Link href="/reset-password" style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = accent} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.3)'}>
                  Forgot password?
                </Link>
              </div>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleLogin}
              disabled={loading}
              style={{
                width: '100%',
                background: accent,
                color: '#000',
                borderRadius: 8,
                padding: '14px',
                fontSize: 13,
                fontWeight: 800,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginTop: 8,
                opacity: loading ? 0.4 : 1,
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { if (!loading) { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(1.01)' } }}
              onMouseLeave={(e) => { if (!loading) { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)' } }}
            >
              {loading ? 'SIGNING IN...' : 'SIGN IN →'}
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, margin: '32px 0' }}>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                or continue with
              </div>
              <div style={{ height: 1, flex: 1, background: 'rgba(255,255,255,0.08)' }} />
            </div>

            {/* OAuth Buttons */}
            <div style={{ display: 'flex', gap: 12 }}>
              <button style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '11px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                <svg width="18" height="18" viewBox="0 0 18 18">
                  <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                  <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
                  <path fill="#FBBC05" d="M3.964 10.712c-.18-.54-.282-1.117-.282-1.712s.102-1.173.282-1.712V4.956H.957a8.996 8.996 0 000 8.088l3.007-2.332z" />
                  <path fill="#EA4335" d="M9 3.579c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.391 2.038.957 4.956l3.007 2.332c.708-2.127 2.692-3.711 5.036-3.711z" />
                </svg>
                Google
              </button>
              <button style={{
                flex: 1,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                padding: '11px',
                color: 'rgba(255,255,255,0.7)',
                fontSize: 13,
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                cursor: 'pointer',
                transition: 'background 0.2s'
              }} onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'} onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}>
                <Github size={18} />
                GitHub
              </button>
            </div>

            <div style={{ marginTop: 32, textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                Don&apos;t have an account?{' '}
                <Link href="/signup" style={{ color: accent, fontWeight: 600, textDecoration: 'none' }}>
                  Create one →
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
