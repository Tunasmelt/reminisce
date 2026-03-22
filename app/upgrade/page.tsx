'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { toast } from 'sonner'
import Link from 'next/link'

function hexToRgba(hex: string, a: number) {
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function UpgradePage() {
  const { accent } = useTheme()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [gemLoading, setGemLoading] = 
    useState<string | null>(null)

  const GEM_PACKS = [
    { id: 'gems_50',  gems: 50,  price: 5,  
      label: 'Starter',  
      desc: '~16 Claude Sonnet runs' },
    { id: 'gems_150', gems: 150, price: 12, 
      label: 'Builder',  
      desc: '~50 Claude Sonnet runs',
      popular: true },
    { id: 'gems_400', gems: 400, price: 25, 
      label: 'Power',    
      desc: '~133 Claude Sonnet runs' },
  ]

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const { data: { session } } = 
        await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const res = await fetch(
        '/api/stripe/checkout', 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ type: 'subscription' }),
        }
      )
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Checkout failed')
      }
    } catch (err) {
      toast.error(
        err instanceof Error 
          ? err.message : 'Something went wrong'
      )
    } finally {
      setLoading(false)
    }
  }

  const handleBuyGems = async (packId: string) => {
    setGemLoading(packId)
    try {
      const { data: { session } } = 
        await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }
      const res = await fetch(
        '/api/stripe/checkout',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 
              `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ 
            type: 'gems', 
            packId 
          }),
        }
      )
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Checkout failed')
      }
    } catch (err) {
      toast.error(
        err instanceof Error 
          ? err.message : 'Something went wrong'
      )
    } finally {
      setGemLoading(null)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      padding: '80px 24px',
    }}>
      <div style={{
        maxWidth: 900,
        margin: '0 auto',
      }}>
        
        {/* Back link */}
        <Link
          href="/dashboard"
          style={{
            fontSize: 12,
            color: 'rgba(255,255,255,0.3)',
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginBottom: 48,
            transition: 'color 0.15s',
          }}
          onMouseEnter={e => 
            e.currentTarget.style.color = '#fff'
          }
          onMouseLeave={e => 
            e.currentTarget.style.color = 
              'rgba(255,255,255,0.3)'
          }
        >
          ← Back to workspace
        </Link>

        {/* Hero */}
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{
            fontSize: 10, fontWeight: 700,
            letterSpacing: '0.2em',
            textTransform: 'uppercase',
            color: accent, marginBottom: 14,
          }}>
            Upgrade
          </div>
          <h1 style={{
            fontSize: 'clamp(32px, 5vw, 56px)',
            fontWeight: 900, color: '#fff',
            letterSpacing: '-0.02em',
            lineHeight: 1.1, margin: '0 0 16px',
          }}>
            Build without limits.
          </h1>
          <p style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.45)',
            maxWidth: 480,
            margin: '0 auto',
            lineHeight: 1.7,
          }}>
            Pro gives you premium models, unlimited 
            projects, and 100 gems every month.
          </p>
        </div>

        {/* Tier comparison */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16, marginBottom: 64,
        }}>
          {/* Free */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 16, padding: '28px 28px',
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 8,
            }}>
              Free
            </div>
            <div style={{
              fontSize: 32, fontWeight: 900,
              color: '#fff', marginBottom: 4,
            }}>
              $0
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 28,
            }}>
              forever
            </div>
            {[
              '2 projects',
              '50 coins / day',
              'Free-tier models only',
              'No gems',
              'No premium models',
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10, marginBottom: 10,
                fontSize: 13,
                color: i < 2
                  ? 'rgba(255,255,255,0.6)'
                  : 'rgba(255,255,255,0.25)',
              }}>
                <span style={{
                  color: i < 2 
                    ? '#10b981' 
                    : 'rgba(255,255,255,0.15)',
                }}>
                  {i < 2 ? '✓' : '✗'}
                </span>
                {item}
              </div>
            ))}
            <div style={{
              marginTop: 24,
              padding: '10px',
              borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              textAlign: 'center',
              fontSize: 12,
              color: 'rgba(255,255,255,0.25)',
            }}>
              Current plan
            </div>
          </div>

          {/* Pro */}
          <div style={{
            background: hexToRgba(accent, 0.04),
            border: `2px solid ${hexToRgba(accent, 0.35)}`,
            borderRadius: 16, padding: '28px 28px',
            position: 'relative',
          }}>
            <div style={{
              position: 'absolute',
              top: -12, left: '50%',
              transform: 'translateX(-50%)',
              background: accent, color: '#000',
              fontSize: 9, fontWeight: 900,
              padding: '4px 14px',
              borderRadius: 999,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
            }}>
              Recommended
            </div>
            <div style={{
              fontSize: 11, fontWeight: 700,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: accent, marginBottom: 8,
            }}>
              Pro
            </div>
            <div style={{
              fontSize: 32, fontWeight: 900,
              color: '#fff', marginBottom: 4,
            }}>
              $12
            </div>
            <div style={{
              fontSize: 12,
              color: 'rgba(255,255,255,0.3)',
              marginBottom: 28,
            }}>
              per month
            </div>
            {[
              'Unlimited projects',
              '200 coins / day',
              '100 gems / month',
              'All models incl. Claude & GPT-4o',
              'Buy additional gems',
              'Context limit: 128k tokens',
              'Priority support',
            ].map((item, i) => (
              <div key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10, marginBottom: 10,
                fontSize: 13,
                color: 'rgba(255,255,255,0.7)',
              }}>
                <span style={{ color: '#10b981' }}>
                  ✓
                </span>
                {item}
              </div>
            ))}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              style={{
                marginTop: 24,
                width: '100%',
                padding: '12px',
                background: loading
                  ? 'rgba(255,255,255,0.1)'
                  : accent,
                color: loading
                  ? 'rgba(255,255,255,0.3)'
                  : '#000',
                border: 'none',
                borderRadius: 10,
                fontSize: 13, fontWeight: 800,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                cursor: loading
                  ? 'not-allowed'
                  : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {loading
                ? 'Redirecting...'
                : 'Upgrade to Pro →'}
            </button>
          </div>
        </div>

        {/* Gem packs */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            textAlign: 'center', marginBottom: 32,
          }}>
            <h2 style={{
              fontSize: 24, fontWeight: 800,
              color: '#fff', marginBottom: 8,
            }}>
              Top up gems
            </h2>
            <p style={{
              fontSize: 13,
              color: 'rgba(255,255,255,0.35)',
            }}>
              Pro subscribers only. Gems never expire.
            </p>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
          }}>
            {GEM_PACKS.map(pack => (
              <div
                key={pack.id}
                style={{
                  background: pack.popular
                    ? 'rgba(167,139,250,0.06)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${pack.popular
                    ? 'rgba(167,139,250,0.3)'
                    : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12,
                  padding: '20px',
                  position: 'relative',
                }}
              >
                {pack.popular && (
                  <div style={{
                    position: 'absolute',
                    top: -10, right: 14,
                    background: '#a78bfa',
                    color: '#000',
                    fontSize: 8, fontWeight: 900,
                    padding: '3px 10px',
                    borderRadius: 999,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                  }}>
                    Best value
                  </div>
                )}
                <div style={{
                  fontSize: 24, marginBottom: 6,
                }}>
                  💎
                </div>
                <div style={{
                  fontSize: 22, fontWeight: 800,
                  color: '#a78bfa', marginBottom: 2,
                }}>
                  {pack.gems} gems
                </div>
                <div style={{
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.35)',
                  marginBottom: 12,
                }}>
                  {pack.desc}
                </div>
                <div style={{
                  fontSize: 20, fontWeight: 700,
                  color: '#fff', marginBottom: 14,
                }}>
                  ${pack.price}
                </div>
                <button
                  onClick={() => 
                    handleBuyGems(pack.id)
                  }
                  disabled={gemLoading === pack.id}
                  style={{
                    width: '100%',
                    padding: '9px',
                    background: 'transparent',
                    border: '1px solid rgba(167,139,250,0.3)',
                    borderRadius: 8,
                    color: '#a78bfa',
                    fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    cursor: gemLoading === pack.id
                      ? 'not-allowed'
                      : 'pointer',
                    opacity: gemLoading === pack.id
                      ? 0.5 : 1,
                    transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => {
                    if (!gemLoading) {
                      e.currentTarget.style.background =
                        'rgba(167,139,250,0.1)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background =
                      'transparent'
                  }}
                >
                  {gemLoading === pack.id
                    ? 'Loading...'
                    : 'Buy now'}
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer note */}
        <p style={{
          textAlign: 'center',
          fontSize: 11,
          color: 'rgba(255,255,255,0.2)',
          marginTop: 40,
        }}>
          Payments processed securely by Stripe.
          Cancel anytime from your account settings.
          Gem purchases are non-refundable.
        </p>
      </div>
    </div>
  )
}
