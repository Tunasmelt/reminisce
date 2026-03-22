'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/hooks/useTheme'
import { Inter } from 'next/font/google'
import LandingNav from '@/components/landing-nav'

const inter = Inter({ subsets: ['latin'] })

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

export default function DocsPage() {
  const { accent } = useTheme()
  const [activeSection, setActiveSection] = useState('introduction')
  
  const [isMobile, setIsMobile] = useState(false)
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sectionsList = [
    { id: 'introduction', label: 'Introduction' },
    { id: 'quick-setup', label: 'Quick Setup' },
    { id: 'first-project', label: 'Your First Project' },
    { id: 'context-api', label: 'Context API' },
    { id: 'ai-routing', label: 'AI Routing' },
    { id: 'prompt-wizard', label: 'Prompt Wizard' },
    { id: 'memory-graphs', label: 'Memory Graphs' },
    { id: 'export', label: 'Export Engine' },
    { id: 'coming-soon', label: 'Coming Soon' },
  ]

  return (
    <div className={`min-h-screen bg-black text-white selection:bg-white/10 ${inter.className} page-enter`}>
      <LandingNav />

      <main style={{ 
        maxWidth: 1100, 
        margin: '0 auto', 
        padding: isMobile ? '0 20px' : '0 40px', 
        paddingTop: isMobile ? 120 : 140,
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 40 : 80,
        position: 'relative'
      }}>
        {/* Sidebar */}
        <aside style={{ 
          width: isMobile ? '100%' : 220, 
          position: isMobile ? 'static' : 'sticky', 
          top: 140, 
          height: 'fit-content',
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          {!isMobile && (
            <div style={{ fontSize: 10, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', fontWeight: 700 }}>
              DOCUMENTATION
            </div>
          )}
          <nav style={{ 
            display: 'flex', 
            flexDirection: isMobile ? 'row' : 'column', 
            gap: 4,
            overflowX: isMobile ? 'auto' : 'visible',
            paddingBottom: isMobile ? 12 : 0
          }} className="hide-scrollbar">
            {sectionsList.map(s => {
              const isActive = activeSection === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActiveSection(s.id)
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' })
                  }}
                  style={{
                    textAlign: 'left',
                    fontSize: 13,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: isActive ? `rgba(255,255,255,0.05)` : 'transparent',
                    color: isActive ? accent : 'rgba(255,255,255,0.4)',
                    border: 'none',
                    borderLeft: (!isMobile && isActive) ? `2px solid ${accent}` : '2px solid transparent',
                    cursor: 'pointer',
                    transition: 'all 150ms ease',
                    whiteSpace: isMobile ? 'nowrap' : 'normal'
                  }}
                >
                  {s.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, maxWidth: isMobile ? '100%' : 680, paddingBottom: 160 }}>
          {/* Introduction */}
          <section id="introduction" style={{ marginBottom: 80 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Introduction</h2>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p>
                Reminisce is an AI context orchestration platform built for engineering teams who need AI that actually remembers. By maintaining an immutable shared memory of your project documents, architectural decisions, and version history, we eliminate hallucination at the source.
              </p>
              <p>
                Whether you are building complex microservices or rapid prototypes, Reminisce ensures every prompt is grounded in your specific technical context, piping precision data into the world&apos;s most capable models in under 50ms.
              </p>
            </div>
          </section>

          {/* Quick Setup */}
          <section id="quick-setup" style={{ marginBottom: 80 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Quick Setup</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                "Create your account at reminisce.io",
                "Initialize your first project domain",
                "Connect your AI provider API keys",
                "Run the project wizard to generate your initial context document",
                "Start building with full context injection"
              ].map((step, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 900, color: accent }}>
                    0{i+1}
                  </div>
                  <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)' }}>{step}</div>
                </div>
              ))}
            </div>
          </section>

          {/* First Project */}
          <section id="first-project" style={{ marginBottom: 80 }}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Your First Project</h2>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, marginBottom: 24 }}>
              Your first project domain acts as the central knowledge base for all AI interactions. Use the CLI to push your architectural context directly to the platform.
            </p>
            <div style={{ 
              background: 'rgba(255,255,255,0.04)', 
              border: '1px solid rgba(255,255,255,0.08)', 
              borderRadius: 8, 
              padding: '16px 20px', 
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', 
              fontSize: 13, 
              color: 'rgba(255,255,255,0.8)',
              lineHeight: 1.6,
              overflowX: 'auto'
            }}>
              <div><span style={{ color: accent, opacity: 0.6 }}>$</span> reminisce init my-project</div>
              <div><span style={{ color: accent, opacity: 0.6 }}>$</span> reminisce wizard --interactive</div>
              <div><span style={{ color: accent, opacity: 0.6 }}>$</span> reminisce context --push</div>
            </div>
          </section>

          {/* Coming Soon Sections */}
          <div style={{ marginTop: 20 }}>
            {[
              'Context API Reference',
              'AI Routing Configuration',
              'Memory Graph Schema',
              'Export Format Spec',
            ].map(item => (
              <div key={item} style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '16px 20px',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 8, marginBottom: 8,
                cursor: 'default',
              }}>
                <span style={{
                  fontSize: 13, fontWeight: 500,
                  color: 'rgba(255,255,255,0.55)',
                }}>
                  {item}
                </span>
                <div style={{
                  display: 'flex', alignItems: 'center',
                  gap: 8,
                }}>
                  <span style={{
                    fontSize: 9, fontWeight: 700,
                    padding: '3px 8px', borderRadius: 999,
                    border: `1px solid ${hexToRgba(accent, 0.3)}`,
                    color: accent,
                    background: hexToRgba(accent, 0.08),
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                  }}>
                    Coming Soon
                  </span>
                  <span style={{
                    color: 'rgba(255,255,255,0.2)',
                    fontSize: 14,
                  }}>→</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer style={{ padding: '64px 0', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '0 20px' : '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
            © 2025 REMINISCE
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.1em' }}>
            DOCS V2.0
          </div>
        </div>
      </footer>
    </div>
  )
}
