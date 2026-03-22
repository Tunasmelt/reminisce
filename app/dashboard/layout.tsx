'use client'

import { useState, useEffect } from 'react'
import { ProtectedRoute } from '@/components/protected-route'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Star, LogOut } from 'lucide-react'
import ThemeToggle from '@/components/theme-toggle'
import { useTheme } from '@/hooks/useTheme'
import { User } from '@supabase/supabase-js'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { accent } = useTheme()
  const [user, setUser] = useState<User | null>(null)
  const [wallet, setWallet] = useState<{ gems: number, coins: number } | null>(null)
  const [userPlan, setUserPlan] = useState<'free' | 'pro'>('free')
  const [isMobile, setIsMobile] = useState(false)

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
      <div style={{ minHeight: '100vh', background: '#000', color: '#fff' }}>
        <header style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 40,
          height: 56,
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(20px)',
          boxShadow: '0 1px 0 rgba(255,255,255,0.04)',
          padding: isMobile ? '0 16px' : '0 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          {/* Left: Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
            <Link href="/dashboard" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Star size={14} fill={accent} stroke={accent} />
              <span style={{ 
                fontSize: 14, 
                fontWeight: 700, 
                letterSpacing: '0.01em', 
                color: '#fff' 
              }}>
                {isMobile ? '★' : 'Reminisce'}
              </span>
            </Link>

            {!isMobile && (
              <Link href="/dashboard/templates" style={{ 
                textDecoration: 'none',
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
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6, padding: '5px 10px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    fontSize: 12, cursor: 'default',
                  }}
                  title={`${wallet.coins} coins (daily: resets at midnight UTC) · ${wallet.gems} gems (premium)`}
                >
                  <span style={{
                    display: 'flex',
                    alignItems: 'center', gap: 3,
                    color: 'rgba(255,255,255,0.5)',
                    fontWeight: 600,
                  }}>
                    🪙 {wallet.coins}
                  </span>
                  {userPlan === 'pro' && (
                    <>
                      <span style={{
                        color: 'rgba(255,255,255,0.15)',
                        fontSize: 10,
                      }}>·</span>
                      <span style={{
                        display: 'flex',
                        alignItems: 'center', gap: 3,
                        color: '#a78bfa', fontWeight: 600,
                      }}>
                        💎 {wallet.gems}
                      </span>
                    </>
                  )}
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
                      border: `1px solid ${accent}60`,
                      background: `${accent}15`,
                      color: accent,
                      cursor: 'pointer',
                      letterSpacing: '0.04em',
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 
                        `${accent}25`
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 
                        `${accent}15`
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
              background: `rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.15)`,
              border: `1px solid rgba(${parseInt(accent.slice(1,3),16)},${parseInt(accent.slice(3,5),16)},${parseInt(accent.slice(5,7),16)}, 0.3)`,
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
        
        <main style={{ paddingTop: 56, minHeight: '100vh' }}>
          {children}
        </main>
      </div>
    </ProtectedRoute>
  )
}
