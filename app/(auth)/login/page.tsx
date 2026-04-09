'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Eye, EyeOff, ArrowRight, Mail, Lock } from 'lucide-react'
import { useTheme } from '@/hooks/useTheme'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import ReminisceLogo from '@/components/ReminisceLogo'

const BentoScene = dynamic(() => import('@/components/BentoScene'), {
  ssr: false, loading: () => null,
})

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

export default function LoginPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [focused, setFocused] = useState<string|null>(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check(); window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!email || !password) { toast.error('Please fill in all fields'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      router.push('/dashboard')
    } catch(err) {
      toast.error(err instanceof Error ? err.message : 'Sign in failed')
    } finally { setLoading(false) }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit()
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width: '100%', boxSizing: 'border-box' as const,
    paddingLeft: 44, paddingRight: 16, paddingTop: 14, paddingBottom: 14,
    background: focused===field ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
    border: `1px solid ${focused===field ? hexToRgba(ac,0.4) : 'rgba(255,255,255,0.1)'}`,
    borderRadius: 14, color: '#fff', fontSize: 14, outline: 'none',
    transition: 'border-color .2s, background .2s',
  })

  return (
    <div style={{ height:'100vh', width:'100vw', background:'#05050f', display:'flex', overflow:'hidden' }}>
      <style>{`@keyframes blink{0%,100%{opacity:1}50%{opacity:0}}`}</style>

      {/* Left panel — branding + BentoScene orb */}
      {!isMobile && (
        <div style={{ flex:1, height:'100%', borderRight:'1px solid rgba(255,255,255,0.07)', position:'relative', overflow:'hidden', background:'rgba(255,255,255,0.01)' }}>
          {/* BentoScene decorative orb */}
          <div style={{ position:'absolute', inset:0, opacity:0.2, pointerEvents:'none' }}>
            <BentoScene accent={ac}/>
          </div>

          {/* Radial glow */}
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:400, borderRadius:'50%', background:hexToRgba(ac,0.07), filter:'blur(80px)', pointerEvents:'none' }}/>

          {/* Logo */}
          <div style={{ position:'absolute', top:36, left:36, display:'flex', alignItems:'center', gap:10, zIndex:10 }}>
            <ReminisceLogo size={22} color="#ffffff"/>
            <span style={{ color:'#fff', fontWeight:800, fontSize:14, letterSpacing:'0.14em', textTransform:'uppercase' as const }}>Reminisce</span>
          </div>

          {/* Terminal card */}
          <div style={{ position:'relative', zIndex:2, height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <div style={{ width:300, background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', borderRadius:16, overflow:'hidden' }}>
              <div style={{ height:32, background:'rgba(255,255,255,0.04)', padding:'0 14px', display:'flex', alignItems:'center', gap:6 }}>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'rgba(248,113,113,0.5)' }}/>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'rgba(245,158,11,0.5)' }}/>
                <div style={{ width:9, height:9, borderRadius:'50%', background:'rgba(52,211,153,0.5)' }}/>
              </div>
              <div style={{ padding:'20px', fontFamily:'ui-monospace,monospace', fontSize:12, lineHeight:1.85 }}>
                <div style={{ color:'rgba(255,255,255,0.3)' }}>$ reminisce auth --verify</div>
                <div style={{ color:ac }}>✓ Context engine online</div>
                <div style={{ color:'rgba(255,255,255,0.3)' }}>✓ Memory graphs loaded</div>
                <div style={{ color:'rgba(255,255,255,0.3)' }}>✓ AI routing active</div>
                <br/>
                <div style={{ color:'rgba(255,255,255,0.45)', display:'flex', alignItems:'center' }}>
                  → Awaiting auth…
                  <span style={{ display:'inline-block', width:7, height:13, background:ac, marginLeft:6, animation:'blink 1s step-end infinite' }}/>
                </div>
              </div>
            </div>
            <p style={{ marginTop:28, fontSize:12, color:'rgba(255,255,255,0.25)', fontStyle:'italic', textAlign:'center', maxWidth:240, lineHeight:1.7 }}>
              &quot;The best AI is the one that remembers everything.&quot;
            </p>
          </div>
        </div>
      )}

      {/* Right panel — login form */}
      <div style={{ width: isMobile?'100%':480, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: isMobile?'48px 28px':'48px 52px', position:'relative', overflow:'hidden', background: isMobile?'#05050f':'transparent' }}>
        {isMobile && (
          <div style={{ position:'absolute', top:'20%', left:'50%', transform:'translate(-50%,-50%)', width:300, height:300, borderRadius:'50%', background:hexToRgba(ac,0.06), filter:'blur(80px)', pointerEvents:'none' }}/>
        )}
        <div style={{ width:'100%', maxWidth:380, position:'relative', zIndex:2 }}>
          {/* Header */}
          <div style={{ textAlign:'center', marginBottom:40 }}>
            <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
              <ReminisceLogo size={44} color={ac} glowColor={hexToRgba(ac,0.4)}/>
            </div>
            <h1 style={{ fontSize:26, fontWeight:900, letterSpacing:'-0.02em', color:'#fff', marginBottom:8 }}>Welcome back</h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)', lineHeight:1.6 }}>Sign in to your project workspace</p>
          </div>

          {/* Form */}
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Email */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>Email</label>
              <div style={{ position:'relative' }}>
                <Mail size={16} color="rgba(255,255,255,0.3)" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input
                  type="email" value={email} onChange={e=>setEmail(e.target.value)}
                  onFocus={()=>setFocused('email')} onBlur={()=>setFocused(null)}
                  onKeyDown={handleKeyDown}
                  placeholder="you@company.com"
                  style={inputStyle('email')}
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input
                  type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)}
                  onFocus={()=>setFocused('password')} onBlur={()=>setFocused(null)}
                  onKeyDown={handleKeyDown}
                  placeholder="••••••••"
                  style={{ ...inputStyle('password'), paddingRight:44 }}
                />
                <button type="button" onClick={()=>setShowPassword(v=>!v)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', display:'flex', alignItems:'center' }}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button onClick={()=>handleSubmit()} disabled={loading} style={{ width:'100%', padding:'15px', background:ac, color:'#000', border:'none', borderRadius:14, fontSize:14, fontWeight:800, cursor: loading?'not-allowed':'pointer', opacity: loading?0.7:1, boxShadow:`0 0 32px ${hexToRgba(ac,0.35)}`, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}>
              {loading ? 'Signing in…' : <><span>Sign in</span><ArrowRight size={15}/></>}
            </button>
          </div>

          {/* Footer links */}
          <div style={{ textAlign:'center', marginTop:28 }}>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>
              No account?{' '}
              <Link href="/signup" style={{ color:ac, textDecoration:'none', fontWeight:600 }}>Create one free →</Link>
            </p>
            <Link href="/" style={{ display:'inline-block', marginTop:16, fontSize:12, color:'rgba(255,255,255,0.25)', textDecoration:'none' }}>
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
