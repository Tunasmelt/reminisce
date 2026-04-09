'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/hooks/useTheme'
import { toast } from 'sonner'
import Link from 'next/link'
import { Check, X, Zap } from 'lucide-react'
import LandingNav from '@/components/landing-nav'
import ReminisceLogo from '@/components/ReminisceLogo'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1,3),16)
  const g = parseInt(hex.slice(3,5),16)
  const b = parseInt(hex.slice(5,7),16)
  return `rgba(${r},${g},${b},${a})`
}

function useScrollReveal() {
  useEffect(() => {
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('sr-vis') }),
      { threshold: 0.06 }
    )
    document.querySelectorAll('.sr').forEach(el => io.observe(el))
    return () => io.disconnect()
  }, [])
}

function ThreeDCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hov, setHov] = useState(false)
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setTilt({ x:((e.clientY-rect.top-rect.height/2)/rect.height)*6, y:-((e.clientX-rect.left-rect.width/2)/rect.width)*6 })
  }, [])
  return (
    <div ref={ref} onMouseMove={onMove} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setTilt({x:0,y:0});setHov(false)}}
      style={{ transform:`perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition:hov?'transform 0.1s ease':'transform 0.5s cubic-bezier(0.23,1,0.32,1)', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,0.05) 0%,transparent 60%)', opacity:hov?1:0, transition:'opacity 0.3s', pointerEvents:'none', zIndex:1 }}/>
      <div style={{ position:'relative', zIndex:2, height:'100%' }}>{children}</div>
    </div>
  )
}

export default function UpgradePage() {
  const { accent } = useTheme()
  const router = useRouter()
  const ac = accent || '#f59e0b'
  const [mobile, setMobile] = useState(false)
  const [loading, setLoading] = useState(false)
  const [gemLoading, setGemLoading] = useState<string|null>(null)
  useScrollReveal()

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  const gemPacks = [
    { id:'gems_50',  gems:50,  price:5,  label:'Starter',  desc:'~17 Claude Sonnet runs',  popular:false },
    { id:'gems_150', gems:150, price:12, label:'Popular',   desc:'~50 Claude Sonnet runs',  popular:true  },
    { id:'gems_400', gems:400, price:25, label:'Power',     desc:'~133 Claude Sonnet runs', popular:false },
  ]

  const freeItems = [
    { text:'2 projects',                              ok:true  },
    { text:'50 coins / day',                          ok:true  },
    { text:'Community models (Llama, Mistral, Kimi)', ok:true  },
    { text:'Project Wizard & blueprint generation',   ok:true  },
    { text:'PAM & AI Agent',                          ok:true  },
    { text:'Local folder sync',                       ok:false },
    { text:'Editor integration files',                ok:false },
    { text:'Team collaboration (5 members)',          ok:false },
    { text:'Premium models (Claude, GPT-4o)',         ok:false },
  ]

  const proItems = [
    { text:'Unlimited projects',                                ok:true },
    { text:'200 coins / day',                                   ok:true },
    { text:'100 gems / month included',                         ok:true },
    { text:'Claude Sonnet 4.6, GPT-4o, Gemini 2.5 Pro + more', ok:true },
    { text:'Buy additional gems',                               ok:true },
    { text:'Local project folder sync',                         ok:true },
    { text:'Editor files (.cursorrules, CLAUDE.md, Copilot)',   ok:true },
    { text:'5-member team collaboration',                       ok:true },
    { text:'Priority support',                                  ok:true },
  ]

  const handleSubscribe = async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const res = await fetch('/api/stripe/checkout', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` },
        body: JSON.stringify({ type:'subscription' }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'Checkout failed')
    } catch(err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setLoading(false) }
  }

  const handleBuyGems = async (packId: string) => {
    setGemLoading(packId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      const res = await fetch('/api/stripe/checkout', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', 'Authorization':`Bearer ${session.access_token}` },
        body: JSON.stringify({ type:'gems', packId }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else throw new Error(data.error || 'Checkout failed')
    } catch(err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    } finally { setGemLoading(null) }
  }

  return (
    <div style={{ background:'#05050f', color:'#fff', minHeight:'100vh', overflowX:'hidden' }}>
      <style>{`
        .sr{opacity:0;transform:translateY(28px);transition:opacity .8s ease,transform .8s ease}
        .sr-vis{opacity:1;transform:translateY(0)}
        .d1{transition-delay:.06s}.d2{transition-delay:.14s}.d3{transition-delay:.22s}
        @keyframes gem-float{0%,100%{transform:translateY(0) rotate(0deg)}50%{transform:translateY(-8px) rotate(3deg)}}
        @keyframes crystal-spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ position:'fixed', top:-200, left:'50%', transform:'translateX(-50%)', width:800, height:500, background:`radial-gradient(ellipse,${hexToRgba(ac,0.12)} 0%,transparent 70%)`, pointerEvents:'none', zIndex:0 }}/>

      <LandingNav />

      {/* Hero */}
      <section style={{ padding: mobile?'130px 24px 64px':'160px 60px 80px', textAlign:'center', position:'relative', zIndex:1 }}>
        <div className="sr" style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
          <ReminisceLogo size={36} color={ac} glowColor={hexToRgba(ac,0.5)}/>
        </div>
        <div className="sr" style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:9, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase' as const, color:ac, marginBottom:20, padding:'5px 16px', borderRadius:999, background:hexToRgba(ac,0.08), border:`1px solid ${hexToRgba(ac,0.2)}` }}>
          <Zap size={9}/> Pricing
        </div>
        <h1 className="sr" style={{ fontSize: mobile?'clamp(32px,8vw,48px)':'clamp(40px,5vw,72px)', fontWeight:900, letterSpacing:'-0.04em', lineHeight:0.95, margin:'0 0 20px' }}>
          Build without limits.<br/>
          <span style={{ color:'rgba(255,255,255,0.25)' }}>Start for free.</span>
        </h1>
        <p className="sr" style={{ fontSize: mobile?14:18, color:'rgba(255,255,255,0.42)', maxWidth:480, margin:'0 auto', lineHeight:1.75 }}>
          Pro unlocks premium models, local sync, editor integration, team collaboration, and 100 gems every month.
        </p>
      </section>

      {/* Plan cards */}
      <section style={{ maxWidth:900, margin:'0 auto', padding: mobile?'0 24px 80px':'0 60px 100px', position:'relative', zIndex:1 }}>
        <div className="sr" style={{ display:'grid', gridTemplateColumns: mobile?'1fr':'1fr 1fr', gap:16, alignItems:'start' }}>

          {/* Free */}
          <ThreeDCard style={{ padding: mobile?'32px':'40px', background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:28 }}>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.3)', marginBottom:12 }}>Free</div>
            <div style={{ marginBottom:28 }}>
              <span style={{ fontSize:56, fontWeight:900, letterSpacing:'-0.04em', color:'#fff' }}>$0</span>
              <span style={{ fontSize:15, color:'rgba(255,255,255,0.25)', marginLeft:6 }}>forever</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:11, marginBottom:32 }}>
              {freeItems.map((item,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:13, color: item.ok?'rgba(255,255,255,0.6)':'rgba(255,255,255,0.2)' }}>
                  {item.ok ? <Check size={13} color="#10b981" style={{ flexShrink:0, marginTop:1 }}/> : <X size={13} color="rgba(255,255,255,0.15)" style={{ flexShrink:0, marginTop:1 }}/>}
                  {item.text}
                </div>
              ))}
            </div>
            <Link href="/signup" style={{ display:'block', width:'100%', boxSizing:'border-box' as const, padding:'13px', background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:14, textDecoration:'none', fontSize:14, fontWeight:700, color:'#fff', textAlign:'center' as const }}>
              Get started free
            </Link>
          </ThreeDCard>

          {/* Pro */}
          <ThreeDCard style={{ padding: mobile?'32px':'40px', background:hexToRgba(ac,0.06), border:`1px solid ${hexToRgba(ac,0.3)}`, borderRadius:28, position:'relative' }}>
            <div style={{ position:'absolute', top:0, right:0, padding:'7px 20px', background:'rgba(255,255,255,0.07)', fontSize:9, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.5)', borderBottomLeftRadius:16, borderTopRightRadius:28 }}>Recommended</div>
            <div style={{ position:'absolute', top:-50, left:'50%', transform:'translateX(-50%)', width:220, height:110, background:`radial-gradient(ellipse,${hexToRgba(ac,0.28)} 0%,transparent 70%)`, pointerEvents:'none' }}/>
            <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:hexToRgba(ac,0.8), marginBottom:12 }}>Pro</div>
            <div style={{ marginBottom:28 }}>
              <span style={{ fontSize:56, fontWeight:900, letterSpacing:'-0.04em', color:'#fff' }}>$12</span>
              <span style={{ fontSize:15, color:'rgba(255,255,255,0.35)', marginLeft:6 }}>/mo</span>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:11, marginBottom:32 }}>
              {proItems.map((item,i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, fontSize:13, color:'rgba(255,255,255,0.7)' }}>
                  <Check size={13} color={ac} style={{ flexShrink:0, marginTop:1 }}/>
                  {item.text}
                </div>
              ))}
            </div>
            <button onClick={handleSubscribe} disabled={loading} style={{ display:'block', width:'100%', padding:'13px', background:ac, color:'#000', border:'none', borderRadius:14, fontSize:14, fontWeight:800, cursor: loading?'not-allowed':'pointer', boxShadow:`0 0 32px ${hexToRgba(ac,0.4)}`, opacity: loading?0.7:1 }}>
              {loading ? 'Redirecting…' : 'Upgrade to Pro'}
            </button>
          </ThreeDCard>
        </div>
      </section>

      {/* Gems section */}
      <section style={{ maxWidth:900, margin:'0 auto', padding: mobile?'0 24px 80px':'0 60px 100px', position:'relative', zIndex:1 }}>
        <div className="sr" style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontSize:40, marginBottom:12, animation:'gem-float 4s ease-in-out infinite', display:'inline-block' }}>💎</div>
          <p style={{ fontSize:10, fontWeight:800, letterSpacing:'0.22em', color:'#a78bfa', textTransform:'uppercase' as const, marginBottom:14 }}>Gems</p>
          <h2 style={{ fontSize: mobile?24:40, fontWeight:900, letterSpacing:'-0.03em', color:'#fff', marginBottom:12 }}>Top up anytime.</h2>
          <p style={{ fontSize: mobile?14:16, color:'rgba(255,255,255,0.4)', maxWidth:400, margin:'0 auto', lineHeight:1.7 }}>
            Gems power premium model runs — Claude Sonnet, GPT-4o, Gemini Pro. They never expire.
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: mobile?'1fr':'repeat(3,1fr)', gap:14 }}>
          {gemPacks.map((pack) => (
            <ThreeDCard key={pack.id} style={{
              padding:'28px', borderRadius:20,
              background: pack.popular ? 'rgba(167,139,250,0.08)' : 'rgba(255,255,255,0.025)',
              border: pack.popular ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.07)',
              position:'relative',
            }}>
              {pack.popular && (
                <div style={{ position:'absolute', top:0, right:0, padding:'5px 14px', background:'rgba(167,139,250,0.15)', fontSize:8, fontWeight:800, letterSpacing:'0.18em', textTransform:'uppercase' as const, color:'#a78bfa', borderBottomLeftRadius:10, borderTopRightRadius:20 }}>Popular</div>
              )}
              <div style={{ fontSize:11, fontWeight:800, letterSpacing:'0.1em', textTransform:'uppercase' as const, color:'rgba(255,255,255,0.3)', marginBottom:10 }}>{pack.label}</div>
              <div style={{ fontSize:40, fontWeight:900, color:'#fff', marginBottom:4 }}>💎 {pack.gems}</div>
              <div style={{ fontSize:24, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:4 }}>${pack.price}</div>
              <div style={{ fontSize:12, color:'rgba(255,255,255,0.3)', marginBottom:24 }}>{pack.desc}</div>
              <button onClick={() => handleBuyGems(pack.id)} disabled={gemLoading===pack.id} style={{ width:'100%', padding:'11px', borderRadius:12, border:'none', background: pack.popular?'#a78bfa':'rgba(255,255,255,0.07)', color: pack.popular?'#000':'rgba(255,255,255,0.75)', fontSize:13, fontWeight:700, cursor: gemLoading===pack.id?'not-allowed':'pointer', opacity: gemLoading===pack.id?0.6:1 }}>
                {gemLoading===pack.id ? 'Redirecting…' : `Buy ${pack.gems} gems`}
              </button>
            </ThreeDCard>
          ))}
        </div>
      </section>

      {/* FAQ-style note */}
      <section style={{ maxWidth:640, margin:'0 auto', padding: mobile?'0 24px 80px':'0 60px 80px', textAlign:'center' }}>
        <p style={{ fontSize:13, color:'rgba(255,255,255,0.28)', lineHeight:1.8 }}>
          Free plan never expires. No credit card required to start.
          Pro can be cancelled anytime. Gems never expire and carry over month-to-month.
          All pricing in USD. Questions? <Link href="/docs" style={{ color:ac, textDecoration:'none' }}>Read the docs →</Link>
        </p>
      </section>
    </div>
  )
}
