'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Eye, EyeOff, ArrowRight, CheckCircle2, Mail, Lock, User } from 'lucide-react'
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

function PasswordStrength({ password }: { password: string }) {
  const strength = password.length === 0 ? 0 : password.length < 6 ? 1 : password.length < 10 ? 2 : password.length < 14 ? 3 : 4
  const colors = ['transparent','#f87171','#f59e0b','#60a5fa','#34d399']
  const labels = ['','Too short','Weak','Good','Strong']
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', gap:4, marginBottom:6 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ flex:1, height:3, borderRadius:999, background: i<=strength ? colors[strength] : 'rgba(255,255,255,0.08)', transition:'background .3s' }}/>
        ))}
      </div>
      {password.length > 0 && (
        <span style={{ fontSize:10, fontWeight:600, color: colors[strength] }}>{labels[strength]}</span>
      )}
    </div>
  )
}

export default function SignupPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
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
    if (!email || !password || !fullName) { toast.error('Please fill in all fields'); return }
    if (password !== confirmPassword) { toast.error('Passwords do not match'); return }
    if (password.length < 8) { toast.error('Password must be at least 8 characters'); return }
    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { data: { full_name: fullName } },
      })
      if (error) throw error
      toast.success('Account created! Check your email to verify.')
      router.push('/dashboard')
    } catch(err) {
      toast.error(err instanceof Error ? err.message : 'Sign up failed')
    } finally { setLoading(false) }
  }

  const inputStyle = (field: string): React.CSSProperties => ({
    width:'100%', boxSizing:'border-box' as const,
    paddingLeft:44, paddingRight:16, paddingTop:14, paddingBottom:14,
    background: focused===field ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.04)',
    border:`1px solid ${focused===field ? hexToRgba(ac,0.4) : 'rgba(255,255,255,0.1)'}`,
    borderRadius:14, color:'#fff', fontSize:14, outline:'none',
    transition:'border-color .2s,background .2s',
  })

  const benefits = [
    'Free forever — no credit card required',
    'Blueprint your project in 2 minutes',
    'AI Agent with full project context',
    'Git-aware, editor-integrated',
  ]

  return (
    <div style={{ minHeight:'100vh', background:'#05050f', display:'flex', flexDirection: isMobile?'column':'row', overflow:'hidden' }}>

      {/* Left panel — branding */}
      {!isMobile && (
        <div style={{ width:460, flexShrink:0, height:'100vh', borderRight:'1px solid rgba(255,255,255,0.07)', position:'relative', overflow:'hidden', background:'rgba(255,255,255,0.01)', display:'flex', flexDirection:'column', justifyContent:'space-between', padding:'40px 48px' }}>
          {/* BentoScene orb */}
          <div style={{ position:'absolute', inset:0, opacity:0.18, pointerEvents:'none' }}>
            <BentoScene accent={ac}/>
          </div>
          <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:400, height:400, borderRadius:'50%', background:hexToRgba(ac,0.07), filter:'blur(80px)', pointerEvents:'none' }}/>

          {/* Logo */}
          <div style={{ display:'flex', alignItems:'center', gap:10, position:'relative', zIndex:2 }}>
            <ReminisceLogo size={22} color="#fff"/>
            <span style={{ fontWeight:800, fontSize:14, letterSpacing:'0.14em', textTransform:'uppercase' as const }}>Reminisce</span>
          </div>

          {/* Headline + benefits */}
          <div style={{ position:'relative', zIndex:2 }}>
            <h2 style={{ fontSize:40, fontWeight:900, letterSpacing:'-0.04em', lineHeight:1.05, color:'#fff', marginBottom:16 }}>
              AI that remembers<br/>everything.
            </h2>
            <p style={{ fontSize:15, color:'rgba(255,255,255,0.45)', lineHeight:1.75, marginBottom:36, maxWidth:340 }}>
              The developer workspace for persistent project intelligence.
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {benefits.map((b,i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12, fontSize:14, color:'rgba(255,255,255,0.65)' }}>
                  <CheckCircle2 size={16} color={ac} style={{ flexShrink:0 }}/>
                  {b}
                </div>
              ))}
            </div>
          </div>

          <div style={{ position:'relative', zIndex:2 }}>
            <Link href="/login" style={{ fontSize:12, color:'rgba(255,255,255,0.25)', textDecoration:'none' }}>
              Already have an account? <span style={{ color:ac }}>Sign in →</span>
            </Link>
          </div>
        </div>
      )}

      {/* Right panel — form */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding: isMobile?'48px 28px':'48px 60px', position:'relative', overflow:'hidden auto' }}>
        {isMobile && (
          <div style={{ position:'absolute', top:'10%', left:'50%', transform:'translateX(-50%)', width:300, height:300, borderRadius:'50%', background:hexToRgba(ac,0.06), filter:'blur(80px)', pointerEvents:'none' }}/>
        )}
        <div style={{ width:'100%', maxWidth:400, position:'relative', zIndex:2 }}>
          {isMobile && (
            <div style={{ textAlign:'center', marginBottom:32 }}>
              <ReminisceLogo size={36} color={ac} glowColor={hexToRgba(ac,0.4)}/>
            </div>
          )}

          <div style={{ marginBottom:32 }}>
            <h1 style={{ fontSize:24, fontWeight:900, letterSpacing:'-0.02em', color:'#fff', marginBottom:8 }}>Create your account</h1>
            <p style={{ fontSize:14, color:'rgba(255,255,255,0.4)' }}>Free plan — no credit card required</p>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {/* Name */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>Full name</label>
              <div style={{ position:'relative' }}>
                <User size={16} color="rgba(255,255,255,0.3)" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input type="text" value={fullName} onChange={e=>setFullName(e.target.value)} onFocus={()=>setFocused('name')} onBlur={()=>setFocused(null)} placeholder="Your name" style={inputStyle('name')}/>
              </div>
            </div>

            {/* Email */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>Email</label>
              <div style={{ position:'relative' }}>
                <Mail size={16} color="rgba(255,255,255,0.3)" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} onFocus={()=>setFocused('email')} onBlur={()=>setFocused(null)} placeholder="you@company.com" style={inputStyle('email')}/>
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>Password</label>
              <div style={{ position:'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input type={showPassword?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} onFocus={()=>setFocused('password')} onBlur={()=>setFocused(null)} placeholder="Min 8 characters" style={{ ...inputStyle('password'), paddingRight:44 }}/>
                <button type="button" onClick={()=>setShowPassword(v=>!v)} style={{ position:'absolute', right:14, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.3)', display:'flex', alignItems:'center' }}>
                  {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <PasswordStrength password={password}/>
            </div>

            {/* Confirm password */}
            <div>
              <label style={{ display:'block', fontSize:10, fontWeight:800, letterSpacing:'0.12em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.35)', marginBottom:8 }}>Confirm password</label>
              <div style={{ position:'relative' }}>
                <Lock size={16} color="rgba(255,255,255,0.3)" style={{ position:'absolute', left:14, top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }}/>
                <input type={showPassword?'text':'password'} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} onFocus={()=>setFocused('confirm')} onBlur={()=>setFocused(null)} placeholder="Repeat password" style={inputStyle('confirm')}/>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <div style={{ marginTop:6, fontSize:11, color:'#f87171' }}>Passwords do not match</div>
              )}
            </div>

            {/* Submit */}
            <button onClick={()=>handleSubmit()} disabled={loading} style={{ width:'100%', padding:'15px', background:ac, color:'#000', border:'none', borderRadius:14, fontSize:14, fontWeight:800, cursor: loading?'not-allowed':'pointer', opacity: loading?0.7:1, boxShadow:`0 0 32px ${hexToRgba(ac,0.35)}`, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}>
              {loading ? 'Creating account…' : <><span>Create free account</span><ArrowRight size={15}/></>}
            </button>
          </div>

          <div style={{ textAlign:'center', marginTop:24 }}>
            <p style={{ fontSize:13, color:'rgba(255,255,255,0.35)' }}>
              Already have an account?{' '}
              <Link href="/login" style={{ color:ac, textDecoration:'none', fontWeight:600 }}>Sign in →</Link>
            </p>
            <Link href="/" style={{ display:'inline-block', marginTop:14, fontSize:12, color:'rgba(255,255,255,0.22)', textDecoration:'none' }}>
              ← Back to site
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
