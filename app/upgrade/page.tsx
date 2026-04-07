'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { toast } from 'sonner'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Check, X, Zap, Gem, Users, FolderSync, FileCode2, GitBranch } from 'lucide-react'
import LandingNav from '@/components/landing-nav'
import ReminisceLogo from '@/components/ReminisceLogo'
import { Inter } from 'next/font/google'

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

// Floating crystal — CSS 3D gem accent for the gem section
function CrystalOrb() {
  return (
    <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 24px' }}>
      {/* Outer ring */}
      <div style={{
        position: 'absolute', inset: -16,
        borderRadius: '50%',
        border: `1px solid ${hexToRgba('#a78bfa', 0.25)}`,
        animation: 'crystal-spin 8s linear infinite',
      }}/>
      {/* Middle ring */}
      <div style={{
        position: 'absolute', inset: -6,
        borderRadius: '50%',
        border: `1px solid ${hexToRgba('#a78bfa', 0.15)}`,
        animation: 'crystal-spin 5s linear infinite reverse',
      }}/>
      {/* Core glow */}
      <div style={{
        width: 80, height: 80, borderRadius: '50%',
        background: 'radial-gradient(ellipse at 35% 35%, rgba(167,139,250,0.6) 0%, rgba(100,60,200,0.8) 60%, rgba(30,10,80,0.9) 100%)',
        boxShadow: '0 0 32px rgba(167,139,250,0.5), inset 0 0 20px rgba(255,255,255,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 28,
        animation: 'crystal-float 4s ease-in-out infinite',
      }}>
        💎
      </div>
    </div>
  )
}

export default function UpgradePage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const router = useRouter()
  const [loading,    setLoading]    = useState(false)
  const [gemLoading, setGemLoading] = useState<string | null>(null)
  const [mobile,     setMobile]     = useState(false)

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

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

  const GEM_PACKS = [
    { id: 'gems_50',  gems: 50,  price: 5,  label: 'Starter',
      desc: '~16 Claude Sonnet runs' },
    { id: 'gems_150', gems: 150, price: 12, label: 'Builder',
      desc: '~50 Claude Sonnet runs', popular: true },
    { id: 'gems_400', gems: 400, price: 25, label: 'Power',
      desc: '~133 Claude Sonnet runs' },
  ]

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'subscription' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'Checkout failed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  const handleBuyGems = async (packId: string) => {
    setGemLoading(packId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ type: 'gems', packId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'Checkout failed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setGemLoading(null) }
  }

  // Pro card 3D orb canvas ref area
  const proOrbRef = useRef<HTMLDivElement>(null)

  const freeItems = [
    { text: '2 projects',                          ok: true  },
    { text: '50 coins / day',                      ok: true  },
    { text: 'Community models (Llama, Mistral, Kimi)', ok: true },
    { text: 'Project Wizard & blueprint generation', ok: true },
    { text: 'Local folder sync',                   ok: false },
    { text: 'Editor integration files',            ok: false },
    { text: 'Team collaboration',                  ok: false },
    { text: 'Premium models (Claude, GPT-4o)',     ok: false },
  ]

  const proItems = [
    { text: 'Unlimited projects',                                ok: true },
    { text: '200 coins / day',                                   ok: true },
    { text: '100 gems / month',                                  ok: true },
    { text: 'Claude Sonnet 4.6, GPT-4o, Gemini 2.5 Pro + more', ok: true },
    { text: 'Buy additional gems',                               ok: true },
    { text: 'Local project folder sync',                         ok: true },
    { text: 'Editor integration (.cursorrules, CLAUDE.md, Copilot)', ok: true },
    { text: '5-member team collaboration',                       ok: true },
    { text: 'Priority support',                                  ok: true },
  ]

  return (
    <div className={inter.className} style={{
      background: '#05050f', color: '#fff',
      minHeight: '100vh', overflowX: 'hidden',
    }}>
      <style>{`
        .sr{opacity:0;transform:translateY(28px);transition:opacity .7s ease,transform .7s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.08s}.d2{transition-delay:.18s}.d3{transition-delay:.28s}
        .plan-card{transition:transform .22s ease,box-shadow .22s ease}
        .plan-card:hover{transform:translateY(-5px)}
        .gem-card{transition:border-color .15s,background .15s}
        @keyframes crystal-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes crystal-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        @keyframes pro-glow-pulse{0%,100%{box-shadow:0 0 60px var(--ac-glow)}50%{box-shadow:0 0 100px var(--ac-glow)}}
      `}</style>

      {/* Fixed glow */}
      <div style={{
        position: 'fixed', top: -200, left: '50%',
        transform: 'translateX(-50%)',
        width: 800, height: 500,
        background: `radial-gradient(ellipse,${hexToRgba(ac, 0.12)} 0%,transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }}/>

      <LandingNav />

      <div style={{
        maxWidth: 920, margin: '0 auto',
        padding: mobile ? '110px 24px 100px' : '130px 40px 120px',
        position: 'relative', zIndex: 1,
      }}>

        {/* Hero */}
        <div className="sr" style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <ReminisceLogo size={36} color={ac} glowColor={hexToRgba(ac, 0.5)}/>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
            textTransform: 'uppercase' as const, color: ac, marginBottom: 16,
            padding: '5px 14px', borderRadius: 999,
            background: hexToRgba(ac, 0.08),
            border: `1px solid ${hexToRgba(ac, 0.2)}`,
          }}>
            <Zap size={9}/> Upgrade
          </div>
          <h1 style={{
            fontSize: 'clamp(32px,5vw,60px)', fontWeight: 900,
            color: '#fff', letterSpacing: '-0.03em',
            lineHeight: 1.05, margin: '0 0 18px',
          }}>
            Build without limits.
          </h1>
          <p style={{
            fontSize: 16, color: 'rgba(255,255,255,0.45)',
            maxWidth: 460, margin: '0 auto', lineHeight: 1.75,
          }}>
            Pro unlocks premium models, local sync, editor integration,
            team collaboration, and 100 gems every month.
          </p>
        </div>

        {/* Plan comparison */}
        <div className="sr" style={{
          display: 'grid',
          gridTemplateColumns: mobile ? '1fr' : '1fr 1fr',
          gap: 16, marginBottom: 80,
          alignItems: 'start',
        }}>

          {/* Free card */}
          <div className="plan-card d1" style={{
            background: 'rgba(255,255,255,0.03)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20, padding: '32px 28px',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Subtle corner glow */}
            <div style={{
              position: 'absolute', top: -40, right: -40,
              width: 120, height: 120, borderRadius: '50%',
              background: 'radial-gradient(ellipse,rgba(255,255,255,0.04) 0%,transparent 70%)',
              pointerEvents: 'none',
            }}/>
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.35)', marginBottom: 10,
            }}>Free</div>
            <div style={{
              fontSize: 36, fontWeight: 900, color: '#fff',
              marginBottom: 2, lineHeight: 1,
            }}>$0</div>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 28,
            }}>forever</div>
            {freeItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start',
                gap: 10, marginBottom: 10, fontSize: 13,
                color: item.ok ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.22)',
              }}>
                {item.ok
                  ? <Check size={13} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }}/>
                  : <X size={13} color="rgba(255,255,255,0.15)" style={{ flexShrink: 0, marginTop: 1 }}/>
                }
                {item.text}
              </div>
            ))}
            <div style={{
              marginTop: 28, padding: '11px',
              borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)',
              textAlign: 'center',
              fontSize: 12, fontWeight: 600,
              color: 'rgba(255,255,255,0.25)',
            }}>
              Current plan
            </div>
          </div>

          {/* Pro card — with 3D WebGL orb */}
          <div
            ref={proOrbRef}
            className="plan-card d2"
            style={{
              background: hexToRgba(ac, 0.05),
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: `2px solid ${hexToRgba(ac, 0.4)}`,
              borderRadius: 20, padding: '32px 28px',
              position: 'relative', overflow: 'hidden',
              boxShadow: `0 0 60px ${hexToRgba(ac, 0.12)}`,
              '--ac-glow': hexToRgba(ac, 0.12),
            } as React.CSSProperties}
          >
            {/* Recommended badge */}
            <div style={{
              position: 'absolute', top: -13, left: '50%',
              transform: 'translateX(-50%)',
              background: ac, color: '#000',
              fontSize: 9, fontWeight: 900,
              padding: '4px 16px', borderRadius: 999,
              letterSpacing: '0.1em',
              textTransform: 'uppercase' as const,
              whiteSpace: 'nowrap' as const,
              boxShadow: `0 4px 12px ${hexToRgba(ac, 0.4)}`,
            }}>
              Recommended
            </div>

            {/* 3D orb — WebGL BentoScene in corner */}
            <div style={{
              position: 'absolute', right: -50, top: -50,
              width: 180, height: 180, opacity: 0.35,
              pointerEvents: 'none',
            }}>
              <BentoScene accent={ac} />
            </div>

            {/* Small floating ring accent */}
            <div style={{
              position: 'absolute', right: 20, bottom: 80,
              width: 48, height: 48, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.2)}`,
              pointerEvents: 'none',
              animation: 'crystal-float 6s ease-in-out infinite',
            }}/>

            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: '0.1em',
              textTransform: 'uppercase' as const, color: ac, marginBottom: 10,
              position: 'relative',
            }}>Pro</div>
            <div style={{
              fontSize: 36, fontWeight: 900, color: '#fff',
              marginBottom: 2, lineHeight: 1, position: 'relative',
            }}>$12</div>
            <div style={{
              fontSize: 12, color: 'rgba(255,255,255,0.3)', marginBottom: 28,
            }}>per month</div>

            {/* Pro feature highlights — icon row */}
            <div style={{
              display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' as const,
            }}>
              {[
                { icon: FolderSync,  label: 'Local sync'   },
                { icon: FileCode2,   label: 'Editor files'  },
                { icon: Users,       label: '5 members'     },
                { icon: GitBranch,   label: 'Git-aware'     },
              ].map(({ icon: Icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '3px 8px', borderRadius: 999,
                  background: hexToRgba(ac, 0.1),
                  border: `1px solid ${hexToRgba(ac, 0.2)}`,
                  fontSize: 9, fontWeight: 700,
                  color: hexToRgba(ac, 0.85),
                  letterSpacing: '0.04em',
                }}>
                  <Icon size={9}/>{label}
                </div>
              ))}
            </div>

            {proItems.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start',
                gap: 10, marginBottom: 10, fontSize: 13,
                color: 'rgba(255,255,255,0.75)',
                position: 'relative',
              }}>
                <Check size={13} color="#10b981" style={{ flexShrink: 0, marginTop: 1 }}/>
                {item.text}
              </div>
            ))}

            <button
              onClick={handleSubscribe}
              disabled={loading}
              style={{
                marginTop: 28, width: '100%', padding: '14px',
                background: loading ? 'rgba(255,255,255,0.08)' : ac,
                color: loading ? 'rgba(255,255,255,0.3)' : '#000',
                border: 'none', borderRadius: 12,
                fontSize: 13, fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase' as const,
                cursor: loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', position: 'relative',
                boxShadow: loading ? 'none' : `0 0 24px ${hexToRgba(ac, 0.35)}`,
              }}
            >
              {loading ? 'Redirecting...' : 'Upgrade to Pro →'}
            </button>
          </div>
        </div>

        {/* What Pro unlocks — icon feature strip */}
        <div className="sr" style={{
          marginBottom: 80,
          padding: '28px 32px',
          background: hexToRgba(ac, 0.04),
          border: `1px solid ${hexToRgba(ac, 0.15)}`,
          borderRadius: 16,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 800, letterSpacing: '0.14em',
            textTransform: 'uppercase' as const,
            color: 'rgba(255,255,255,0.3)', marginBottom: 20,
          }}>
            What Pro unlocks
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr 1fr' : 'repeat(4,1fr)',
            gap: 16,
          }}>
            {[
              { icon: FolderSync,  title: 'Local Sync',         desc: 'Connect your project folder. Files sync bidirectionally on every return.' },
              { icon: FileCode2,   title: 'Editor Integration',  desc: 'Auto-generates .cursorrules, CLAUDE.md, or copilot-instructions.md.' },
              { icon: Users,       title: 'Team (5 members)',    desc: 'Invite colleagues. Everyone builds with the same live context.' },
              { icon: GitBranch,   title: 'Git-Aware Context',   desc: 'Branch and commit surface in every PAM message and AI injection.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} style={{
                padding: '16px 14px',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                borderRadius: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8,
                  background: hexToRgba(ac, 0.1),
                  border: `1px solid ${hexToRgba(ac, 0.2)}`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: 'center', marginBottom: 10,
                }}>
                  <Icon size={15} color={ac}/>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 5 }}>{title}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gem packs */}
        <div className="sr" style={{ marginBottom: 32 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <CrystalOrb />
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              fontSize: 9, fontWeight: 800, letterSpacing: '0.18em',
              textTransform: 'uppercase' as const, color: '#a78bfa',
              marginBottom: 14, padding: '5px 14px', borderRadius: 999,
              background: 'rgba(167,139,250,0.08)',
              border: '1px solid rgba(167,139,250,0.2)',
            }}>
              <Gem size={9}/> Gem Packs
            </div>
            <h2 style={{
              fontSize: 28, fontWeight: 900, color: '#fff',
              marginBottom: 8, letterSpacing: '-0.02em',
            }}>Top up gems</h2>
            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.35)',
            }}>
              Pro subscribers only. Gems never expire.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: mobile ? '1fr' : 'repeat(3,1fr)',
            gap: 14,
          }}>
            {GEM_PACKS.map(pack => (
              <div key={pack.id} className="gem-card" style={{
                background: pack.popular
                  ? 'rgba(167,139,250,0.07)'
                  : 'rgba(255,255,255,0.03)',
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
                border: `1px solid ${pack.popular
                  ? 'rgba(167,139,250,0.3)'
                  : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 16, padding: '24px 20px',
                position: 'relative',
                boxShadow: pack.popular
                  ? '0 0 40px rgba(167,139,250,0.08)' : 'none',
              }}>
                {pack.popular && (
                  <div style={{
                    position: 'absolute', top: -11, right: 16,
                    background: '#a78bfa', color: '#000',
                    fontSize: 8, fontWeight: 900,
                    padding: '3px 10px', borderRadius: 999,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase' as const,
                    boxShadow: '0 4px 12px rgba(167,139,250,0.4)',
                  }}>Best value</div>
                )}
                <div style={{ fontSize: 28, marginBottom: 8 }}>💎</div>
                <div style={{
                  fontSize: 11, fontWeight: 800,
                  color: 'rgba(255,255,255,0.4)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase' as const, marginBottom: 4,
                }}>{pack.label}</div>
                <div style={{
                  fontSize: 24, fontWeight: 900,
                  color: '#a78bfa', marginBottom: 2,
                  letterSpacing: '-0.01em',
                }}>{pack.gems} gems</div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.35)', marginBottom: 14,
                }}>{pack.desc}</div>
                <div style={{
                  fontSize: 22, fontWeight: 800,
                  color: '#fff', marginBottom: 18,
                }}>${pack.price}</div>
                <button
                  onClick={() => handleBuyGems(pack.id)}
                  disabled={gemLoading === pack.id}
                  style={{
                    width: '100%', padding: '10px',
                    background: gemLoading === pack.id
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(167,139,250,0.1)',
                    border: '1px solid rgba(167,139,250,0.3)',
                    borderRadius: 10, color: '#a78bfa',
                    fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const,
                    cursor: gemLoading === pack.id ? 'not-allowed' : 'pointer',
                    opacity: gemLoading === pack.id ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!gemLoading)
                      e.currentTarget.style.background = 'rgba(167,139,250,0.18)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = gemLoading === pack.id
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(167,139,250,0.1)'
                  }}
                >
                  {gemLoading === pack.id ? 'Loading...' : 'Buy now'}
                </button>
              </div>
            ))}
          </div>
        </div>

        <p style={{
          textAlign: 'center', fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          marginTop: 48, lineHeight: 1.6,
        }}>
          Payments processed securely by Stripe.
          Cancel anytime. Gem purchases are non-refundable.
        </p>
      </div>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid rgba(255,255,255,0.07)',
        padding: mobile ? '36px 24px' : '48px 60px',
        maxWidth: 920, margin: '0 auto',
      }}>
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', flexWrap: 'wrap' as const, gap: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ReminisceLogo size={18} color="rgba(255,255,255,0.3)"/>
            <span style={{
              fontSize: 11, color: 'rgba(255,255,255,0.2)',
              fontStyle: 'italic', textTransform: 'uppercase' as const,
            }}>Reminisce</span>
          </div>
          <Link href="/dashboard" style={{
            fontSize: 12, color: 'rgba(255,255,255,0.3)',
            textDecoration: 'none', transition: 'color .15s',
          }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#fff'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.3)'}
          >
            Launch Workspace →
          </Link>
        </div>
      </footer>
    </div>
  )
}
