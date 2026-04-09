'use client'

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import ReminisceLogo from '@/components/ReminisceLogo'
import { User } from '@supabase/supabase-js'
import { toast } from 'sonner'
import { getTimeUntilUTCReset } from '@/lib/wallet'
import ThemeToggle from '@/components/theme-toggle'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { accent } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<{ gems: number, coins: number } | null>(null)
  const [resetLabel, setResetLabel] = useState<string>(getTimeUntilUTCReset())
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free')
  const [isMobile, setIsMobile] = useState(false)

  // Update the reset time label every 60 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setResetLabel(getTimeUntilUTCReset())
    }, 60_000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        setUser(data.user)
        // Fetch wallet
        supabase
          .from('user_wallets')
          .select('gems, coins')
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: walletData }) => {
            if (walletData) {
              setWallet(walletData)
            }
          })
        
        // Fetch plan
        supabase
          .from('user_plans')
          .select('plan')
          .eq('user_id', data.user.id)
          .single()
          .then(({ data: planData }) => {
            if (planData) {
              setUserPlan(planData.plan as 'free'|'pro')
            }
          })
        
        // Fire daily login reward silently
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session?.access_token) {
            fetch('/api/rewards/daily-login', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${session.access_token}`,
              },
            })
            .then(r => r.json())
            .then(result => {
              if (result.awarded && result.amount > 0) {
                toast.success(`+${result.amount} coins — daily login reward 🪙`, {
                  duration: 3000,
                  position: 'bottom-right',
                })
                // Refresh wallet display to show new coins
                supabase
                  .from('user_wallets')
                  .select('gems, coins')
                  .eq('user_id', data.user!.id)
                  .single()
                  .then(({ data: w }) => {
                    if (w) setWallet(w)
                  })
              }
            })
            .catch(() => {
              // Non-fatal — silent fail
            })
          }
        })
      }
    })
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const userInitial = user?.email?.[0]?.toUpperCase() || '?'

  return (
    <ProtectedRoute>
      <div style={{ minHeight: '100vh', background: '#07070f', color: '#fff', overflowX: 'hidden' }}>
        <header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: 68,
          background: 'rgba(8,8,20,0.75)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.07), 0 4px 24px rgba(0,0,0,0.3)',
          borderBottom: '1px solid rgba(255,255,255,0.07)',
          padding: isMobile ? '0 20px' : '0 40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Left: Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <ReminisceLogo size={20} color="#ffffff" glowColor={hexToRgba(accent, 0.4)}/>
              {!isMobile && (
                <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.01em', color: '#fff' }}>
                  Reminisce
                </span>
              )}
            </Link>
            
            {!isMobile && (
              <Link
                href="/"
                style={{
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.25)',
                  textDecoration: 'none',
                  letterSpacing: '0.08em',
                  transition: 'color 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  marginLeft: 0,
                  whiteSpace: 'nowrap' as const,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.7)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.25)'}
              >
                ↗ Site
              </Link>
            )}

            {!isMobile && (
              <Link href="/dashboard/templates" style={{ 
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.01em',
                color: 'rgba(255,255,255,0.4)',
                transition: 'color 0.2s',
              }}
              onMouseEnter={e => e.currentTarget.style.color = accent}
              onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.4)'}
              >
                Templates
                <span style={{
                  fontSize: 8,
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: 999,
                  background: 'rgba(245,158,11,0.1)',
                  border: '1px solid rgba(245,158,11,0.25)',
                  color: '#f59e0b',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase',
                }}>
                  Beta
                </span>
              </Link>
            )}
          </div>

          {/* Right: Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 12 : 16 }}>
            {wallet !== null && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                {/* Plan badge */}
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: 999,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  background: userPlan === 'pro'
                    ? 'rgba(139,92,246,0.15)'
                    : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${userPlan === 'pro'
                    ? 'rgba(139,92,246,0.35)'
                    : 'rgba(255,255,255,0.1)'}`,
                  color: userPlan === 'pro'
                    ? '#a78bfa'
                    : 'rgba(255,255,255,0.4)',
                }}>
                  {userPlan === 'pro' ? '⚡ Pro' : 'Free'}
                </span>
                {/* Wallet */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 14px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 999, cursor: 'default',
                  }}
                  title={`${wallet.coins} coins — resets ${resetLabel} · ${wallet.gems} gems`}
                >
                  <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color:'rgba(255,255,255,0.55)' }}>
                    🪙 <span style={{ color:'#fff' }}>{wallet.coins}</span>
                  </span>
                  <div style={{ width:1, height:12, background:'rgba(255,255,255,0.1)' }}/>
                  <span style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:700, color: userPlan === 'pro' ? '#a78bfa' : 'rgba(255,255,255,0.35)' }}>
                    💎 <span>{wallet.gems}</span>
                  </span>
                </div>
                {/* Upgrade button for free users */}
                {userPlan === 'free' && (
                  <button
                    onClick={() => 
                      window.location.href = '/upgrade'
                    }
                    style={{
                      fontSize: 10, fontWeight: 700,
                      padding: '4px 10px',
                      borderRadius: 999,
                      border: `1px solid ${hexToRgba(accent, 0.35)}`,
                      background: hexToRgba(accent, 0.1),
                      color: accent,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 
                        hexToRgba(accent, 0.2)
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 
                        hexToRgba(accent, 0.1)
                    }}
                  >
                    Upgrade →
                  </button>
                )}
              </div>
            )}
            
            <ThemeToggle />

            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: hexToRgba(accent, 0.15),
              border: `1px solid ${hexToRgba(accent, 0.3)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 700,
              color: accent
            }}>
              {userInitial}
            </div>

            <button 
              onClick={handleLogout}
              style={{
                background: 'transparent',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: isMobile ? '6px' : '6px 12px',
                fontSize: 12,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#fff'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = 'rgba(255,255,255,0.4)'
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
              }}
            >
              {isMobile ? <LogOut size={14} /> : 'Sign out'}
            </button>
          </div>
        </header>
        
        <main style={{ paddingTop: 68 }}>
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
