'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useTheme } from '@/hooks/useTheme'
import LandingNav from '@/components/landing-nav'
import {
  BookOpen, ArrowRight, Zap, Database, Bot,
  GitBranch, Clock, FolderSync, FileCode2,
  Users, MessageSquare,
} from 'lucide-react'

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function ThreeDCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null)
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const [hov, setHov] = useState(false)
  const onMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return
    const rect = ref.current.getBoundingClientRect()
    setTilt({ x:((e.clientY-rect.top-rect.height/2)/rect.height)*5, y:-((e.clientX-rect.left-rect.width/2)/rect.width)*5 })
  }, [])
  return (
    <div ref={ref} onMouseMove={onMove} onMouseEnter={()=>setHov(true)} onMouseLeave={()=>{setTilt({x:0,y:0});setHov(false)}}
      style={{ transform:`perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`, transition:hov?'transform 0.1s ease':'transform 0.5s cubic-bezier(0.23,1,0.32,1)', position:'relative', overflow:'hidden', ...style }}>
      <div style={{ position:'absolute', inset:0, background:'linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%)', opacity:hov?1:0, transition:'opacity 0.3s', pointerEvents:'none', zIndex:1 }}/>
      <div style={{ position:'relative', zIndex:2, height:'100%' }}>{children}</div>
    </div>
  )
}

// Inline code block
function Code({ children }: { children: string }) {
  return (
    <code style={{
      fontFamily: 'ui-monospace,monospace',
      fontSize: 12, background: 'rgba(255,255,255,0.07)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 4, padding: '2px 6px',
      color: 'rgba(255,255,255,0.8)',
    }}>{children}</code>
  )
}

export default function DocsPage() {
  const { accent } = useTheme()
  const ac = accent || '#f59e0b'
  const [active, setActive] = useState('introduction')
  const [mobile, setMobile] = useState(false)

  useEffect(() => {
    const r = () => setMobile(window.innerWidth < 768)
    r(); window.addEventListener('resize', r)
    return () => window.removeEventListener('resize', r)
  }, [])

  useEffect(() => {
    const sections = document.querySelectorAll('section[id]')
    const io = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) setActive(e.target.id) }),
      { rootMargin: '-20% 0px -60% 0px' }
    )
    sections.forEach(s => io.observe(s))
    return () => io.disconnect()
  }, [])

  const navSections = [
    { id: 'introduction',    label: 'Introduction'       },
    { id: 'quick-setup',     label: 'Quick Setup'        },
    { id: 'first-project',   label: 'Your First Project' },
    { id: 'wizard',          label: 'Project Wizard'     },
    { id: 'context-engine',  label: 'Context Engine'     },
    { id: 'local-sync',      label: 'Local Folder Sync'  },
    { id: 'git-integration', label: 'Git Integration'    },
    { id: 'editor-files',    label: 'Editor Files'       },
    { id: 'ai-agent',        label: 'AI Agent'           },
    { id: 'pam',             label: 'PAM'                },
    { id: 'prompt-library',  label: 'Prompt Library'     },
    { id: 'team',            label: 'Team'               },
    { id: 'coming-soon',     label: 'Coming Soon'        },
  ]

  const setupSteps = [
    'Create your account at reminisce.app',
    'Create a Group (workspace) to organise your projects',
    'Create your first project inside the group',
    'Run the Wizard — answer questions about what you\'re building',
    'Go to Settings → Workspace and set your AI coding editor preference',
    'In the project Overview, click "Connect Folder" and select your local project root',
    'Click "Push to local" in the Context page — context files and your editor file appear on disk',
    'Open your editor in that folder — every session now starts with full project context',
  ]

  const comingSoon = [
    { label: 'Context REST API',       desc: 'Programmatic read/write of project context files.' },
    { label: 'Webhook Integrations',   desc: 'Trigger context updates from your CI/CD pipeline.' },
    { label: 'BYOK Setup Guide',       desc: 'Step-by-step for connecting your own provider API keys.' },
    { label: 'Team Invite Flow',       desc: 'Full walkthrough of inviting members and role management.' },
  ]

  const SectionHeader = ({ icon: Icon, title }: { icon: React.ElementType; title: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: hexToRgba(ac, 0.1),
        border: `1px solid ${hexToRgba(ac, 0.22)}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={16} color={ac}/>
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>{title}</h2>
    </div>
  )

  const Note = ({ children }: { children: React.ReactNode }) => (
    <div style={{
      background: hexToRgba(ac, 0.06),
      border: `1px solid ${hexToRgba(ac, 0.18)}`,
      borderRadius: 12, padding: '14px 18px',
      fontSize: 14, color: hexToRgba(ac, 0.85), lineHeight: 1.65,
      marginTop: 16,
    }}>
      {children}
    </div>
  )

  const FileBlock = ({ files }: { files: string[] }) => (
    <ThreeDCard style={{
      background: 'rgba(4,4,16,0.8)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 12, padding: '18px 22px',
      fontFamily: 'ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace',
      fontSize: 13, color: 'rgba(255,255,255,0.75)',
      lineHeight: 1.7, marginTop: 16, overflowX: 'auto',
    }}>
      <div style={{ color: hexToRgba(ac, 0.6), marginBottom: 8 }}>
        {'// Generated by the Wizard — all paths relative to project root'}
      </div>
      {files.map(f => (
        <div key={f}>
          <span style={{ color: hexToRgba(ac, 0.7) }}>→ </span>
          {f}
        </div>
      ))}
    </ThreeDCard>
  )

  const prose: React.CSSProperties = { fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }
  const sectionGap: React.CSSProperties = { marginBottom: 72 }

  return (
    <div style={{
      background: '#05050f', color: '#fff', minHeight: '100vh',
    }}>
      <style>{`
        @keyframes ring-float{
          0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}
        }
      `}</style>

      {/* Fixed top glow */}
      <div style={{
        position: 'fixed', top: -200, left: '50%',
        transform: 'translateX(-50%)',
        width: 800, height: 500,
        background: `radial-gradient(ellipse,${hexToRgba(ac,0.12)} 0%,transparent 70%)`,
        pointerEvents: 'none', zIndex: 0,
      }}/>

      <LandingNav />

      {/* Page header — with floating ring 3D accent */}
      <div style={{
        padding: mobile ? '130px 24px 64px' : '160px 60px 80px',
        textAlign: 'center', position: 'relative', zIndex: 1,
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        overflow: 'hidden',
      }}>
        {/* Floating rings behind header */}
        {!mobile && (
          <>
            <div style={{
              position: 'absolute', top: 40, left: '15%',
              width: 80, height: 80, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.1)}`,
              animation: 'ring-float 6s ease-in-out infinite',
              pointerEvents: 'none',
            }}/>
            <div style={{
              position: 'absolute', top: 70, right: '14%',
              width: 48, height: 48, borderRadius: '50%',
              border: `1px solid ${hexToRgba(ac, 0.07)}`,
              animation: 'ring-float 4s ease-in-out 2s infinite',
              pointerEvents: 'none',
            }}/>
          </>
        )}

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: hexToRgba(ac, 0.1),
          border: `1px solid ${hexToRgba(ac, 0.28)}`,
          borderRadius: 999, padding: '5px 16px',
          fontSize: 10, fontWeight: 800, letterSpacing: '0.16em',
          color: ac, textTransform: 'uppercase' as const, marginBottom: 20,
        }}>
          <BookOpen size={10}/> Documentation
        </div>
        <h1 style={{
          fontSize: mobile ? 28 : 48, fontWeight: 900,
          letterSpacing: '-0.04em', margin: '0 auto 14px', maxWidth: 640,
        }}>
          Everything you need to know
        </h1>
        <p style={{
          fontSize: mobile ? 15 : 18,
          color: 'rgba(255,255,255,0.45)',
          maxWidth: 480, margin: '0 auto',
        }}>
          Guides, references, and examples for building with Reminisce.
        </p>
      </div>

      <main style={{
        maxWidth: 1100, margin: '0 auto',
        padding: mobile ? '32px 20px 100px' : '48px 60px 120px',
        display: 'flex',
        flexDirection: mobile ? 'column' : 'row',
        gap: mobile ? 32 : 72,
        position: 'relative', zIndex: 1,
      }}>
        {/* Sticky sidebar */}
        <aside style={{
          width: mobile ? '100%' : 210, flexShrink: 0,
          position: mobile ? 'static' : 'sticky',
          top: 120, height: 'fit-content',
        }}>
          {!mobile && (
            <div style={{
              fontSize: 9, fontWeight: 800, letterSpacing: '0.15em',
              textTransform: 'uppercase' as const,
              color: 'rgba(255,255,255,0.22)', marginBottom: 16,
            }}>
              On this page
            </div>
          )}
          <nav style={{
            display: 'flex',
            flexDirection: mobile ? 'row' : 'column',
            gap: mobile ? 4 : 2,
            overflowX: mobile ? 'auto' : 'visible',
          }} className="hide-scrollbar">
            {navSections.map(s => {
              const isAct = active === s.id
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    setActive(s.id)
                    document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  style={{
                    textAlign: 'left', fontSize: 13,
                    padding: '9px 14px', borderRadius: 8, border: 'none',
                    borderLeft: !mobile ? `2px solid ${isAct ? ac : 'transparent'}` : 'none',
                    background: isAct ? hexToRgba(ac, 0.07) : 'transparent',
                    color: isAct ? ac : 'rgba(255,255,255,0.4)',
                    cursor: 'pointer', transition: 'all .15s',
                    whiteSpace: mobile ? 'nowrap' : 'normal',
                    fontWeight: isAct ? 600 : 400,
                  }}
                  onMouseEnter={e => { if (!isAct) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.75)' }}
                  onMouseLeave={e => { if (!isAct) (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.4)' }}
                >
                  {s.label}
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Content */}
        <div style={{ flex: 1, maxWidth: mobile ? '100%' : 780 }}>

          {/* Introduction */}
          <section id="introduction" style={sectionGap}>
            <SectionHeader icon={BookOpen} title="Introduction"/>
            <div style={{ ...prose, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <p style={{ margin: 0 }}>
                Reminisce is an AI context platform for developers. It solves one problem: AI models forget everything between sessions. Reminisce doesn&apos;t. It stores your project context permanently, syncs it to your local folder, and injects it into every AI call automatically.
              </p>
              <p style={{ margin: 0 }}>
                Define your project once — stack, architecture, goals — and every AI interaction from that point forward is grounded in your real project. Your editor reads a generated integration file. PAM knows your phases and git branch. The agent carries your full context on every run.
              </p>
              <Note>
                <strong>Core idea:</strong> Define once. Sync to disk. Every AI call, every editor session, every teammate — all working from the same ground truth.
              </Note>
            </div>
          </section>

          {/* Quick setup */}
          <section id="quick-setup" style={sectionGap}>
            <SectionHeader icon={Zap} title="Quick Setup"/>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {setupSteps.map((step, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 16,
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '16px 20px',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%',
                    background: hexToRgba(ac, 0.1),
                    border: `1px solid ${hexToRgba(ac, 0.22)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 900, color: ac, flexShrink: 0,
                    marginTop: 1,
                  }}>
                    {String(i + 1).padStart(2, '0')}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6 }}>{step}</div>
                </div>
              ))}
            </div>
          </section>

          {/* First project */}
          <section id="first-project" style={sectionGap}>
            <SectionHeader icon={Bot} title="Your First Project"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              After creating a project, open the Wizard. It walks you through four stages: idea confirmation, feature selection, tech stack, and generation. When the Wizard completes, your project folder on disk will contain:
            </p>
            <FileBlock files={[
              'reminisce/context/architecture.md',
              'reminisce/context/tech-stack.md',
              'reminisce/context/coding-guidelines.md',
              'reminisce/context/product-scope.md',
              'reminisce/workflow/phases.md',
              'reminisce/workflow/features.md',
              'reminisce/prompts/master-prompt.md',
              'reminisce/editor/.cursorrules  (or CLAUDE.md / copilot-instructions.md)',
              'reminisce/logs/agent-runs.md',
              'reminisce/logs/changes.md',
            ]}/>
            <Note>
              The editor file (e.g. <Code>.cursorrules</Code>) is placed in your project root by the Push step. Your editor reads it automatically on every session.
            </Note>
          </section>

          {/* Wizard */}
          <section id="wizard" style={sectionGap}>
            <SectionHeader icon={Zap} title="Project Wizard"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              The Wizard is a four-stage conversation that builds your entire project blueprint. Each stage confirms one dimension of your project before moving to the next.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                { num: '01', label: 'Idea',      desc: 'Describe what you\'re building. PAM summarises and confirms.' },
                { num: '02', label: 'Features',   desc: 'Select or edit the core features for your project.' },
                { num: '03', label: 'Stack',       desc: 'Choose your tech stack from generated options or enter your own.' },
                { num: '04', label: 'Generate',    desc: 'Five parallel generation calls produce all context files at once.' },
              ].map(s => (
                <div key={s.num} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    fontSize: 10, fontWeight: 900, color: ac,
                    letterSpacing: '0.08em', flexShrink: 0, marginTop: 1,
                  }}>
                    {s.num}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{s.label}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ ...prose, margin: 0 }}>
              If you have a public GitHub repo linked in Settings, the Wizard reads your <Code>package.json</Code> (or equivalent) and enriches the architecture prompt with your actual tech stack before generating.
            </p>
          </section>

          {/* Context Engine */}
          <section id="context-engine" style={sectionGap}>
            <SectionHeader icon={Database} title="Context Engine"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              Every context file is stored as versioned markdown in the <Code>contexts</Code> table. Files are grouped by ownership:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                { colour: '#6b7280', label: 'Reminisce-owned', desc: 'context/, workflow/, prompts/, editor/ — overwritten on every blueprint regeneration.' },
                { colour: '#10b981', label: 'Developer-owned', desc: 'logs/ — appended automatically, never overwritten. Yours to edit freely.' },
                { colour: '#f59e0b', label: 'Shared',          desc: 'Files both sides write. Reminisce creates the base; you extend it.' },
              ].map(o => (
                <div key={o.label} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: o.colour, flexShrink: 0, marginTop: 5,
                    boxShadow: `0 0 6px ${o.colour}`,
                  }}/>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{o.label}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>{o.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ ...prose, margin: 0 }}>
              Each file has a version history with side-by-side diff. Click any version in the Context page to preview it, or save it as the current version.
            </p>
          </section>

          {/* Local Folder Sync */}
          <section id="local-sync" style={sectionGap}>
            <SectionHeader icon={FolderSync} title="Local Folder Sync"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              Connect your local project folder from the Overview page or the Context page. Once connected, two operations are available:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                { op: 'Push (DB → local)', desc: 'Writes all Reminisce-owned files to your local folder. Use this after generating a new blueprint or regenerating.' },
                { op: 'Pull (local → DB)', desc: 'Reads all context files from your local folder and syncs them to the database. Detects conflicts before writing — you review a diff and choose to keep local or keep DB.' },
              ].map(o => (
                <div key={o.op} style={{
                  padding: '14px 18px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ac, marginBottom: 5 }}>{o.op}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.55 }}>{o.desc}</div>
                </div>
              ))}
            </div>
            <Note>
              Reminisce reads your git state on focus return (when you switch back to the browser tab) and flags any files that changed locally since your last sync.
            </Note>
          </section>

          {/* Git Integration */}
          <section id="git-integration" style={sectionGap}>
            <SectionHeader icon={GitBranch} title="Git Integration"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              When your local folder is connected, Reminisce reads three things from your <Code>.git/</Code> directory on every focus return:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {[
                { file: '.git/HEAD',             reads: 'Current branch name' },
                { file: '.git/logs/HEAD',         reads: 'Last commit message' },
                { file: '.git/config',            reads: 'Remote URL (GitHub, GitLab, Bitbucket)' },
              ].map(g => (
                <div key={g.file} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, gap: 16,
                }}>
                  <Code>{g.file}</Code>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', textAlign: 'right' }}>{g.reads}</div>
                </div>
              ))}
            </div>
            <p style={{ ...prose, margin: 0 }}>
              The branch and last commit appear in the project Overview banner, in every PAM message, and in every changelog entry. No GitHub API key required — everything is read locally.
            </p>
          </section>

          {/* Editor Files */}
          <section id="editor-files" style={sectionGap}>
            <SectionHeader icon={FileCode2} title="Editor Files"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              Set your editor preference in <strong>Settings → Workspace</strong>. After your next blueprint generation, Reminisce writes the corresponding file to <Code>reminisce/editor/</Code> in the database. Push to local and the file appears in your project root.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              {[
                { editor: 'Cursor',          file: '.cursorrules' },
                { editor: 'Claude Code',     file: 'CLAUDE.md' },
                { editor: 'GitHub Copilot',  file: '.github/copilot-instructions.md' },
                { editor: 'Windsurf',        file: '.windsurfrules' },
                { editor: 'Other / Generic', file: 'reminisce-context.md' },
              ].map(e => (
                <div key={e.editor} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 8, gap: 16,
                }}>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{e.editor}</div>
                  <Code>{e.file}</Code>
                </div>
              ))}
            </div>
            <Note>
              The editor file includes a <Code>REMINISCE:SUMMARY</Code> tag with a short paragraph describing your project. This is what PAM injects as a summary when full context isn&apos;t needed.
            </Note>
          </section>

          {/* AI Agent */}
          <section id="ai-agent" style={sectionGap}>
            <SectionHeader icon={Bot} title="AI Agent"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              The Agent tab runs a single-turn AI call with your full project context attached. Select a feature from your board, choose a model, and hit Run. The agent sees your architecture, tech stack, coding guidelines, and the feature&apos;s structured prompt.
            </p>
            <p style={{ ...prose, margin: 0 }}>
              Every completed run is appended to <Code>reminisce/logs/agent-runs.md</Code> with a timestamp and the active git branch. This gives you a complete history of every AI implementation attempt across the project.
            </p>
          </section>

          {/* PAM */}
          <section id="pam" style={sectionGap}>
            <SectionHeader icon={MessageSquare} title="PAM — Project Action Manager"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              PAM is the conversational AI layer inside Reminisce. It knows your phases, features, git state, and context files. Use it for status updates, generating prompts, or getting architectural opinions.
            </p>
            <ThreeDCard style={{
              background: 'rgba(4,4,16,0.8)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 12, padding: '18px 22px', marginBottom: 16,
              fontFamily: 'ui-monospace,monospace', fontSize: 12,
              color: 'rgba(255,255,255,0.65)', lineHeight: 1.8,
            }}>
              <div style={{ color: hexToRgba(ac, 0.6), marginBottom: 8 }}>{'// Available commands'}</div>
              {[
                ['/status',                         'Full project status briefing'],
                ['/done @feature:[name]',            'Mark a feature as done'],
                ['/block @feature:[name]',           'Mark a feature as blocked'],
                ['/prompt @feature:[name]',          'Generate a build prompt for a feature'],
                ['/add [feature] to @phase:[name]',  'Add a new feature to a phase'],
                ['/remind [text] on [date]',         'Create a project reminder'],
              ].map(([cmd, desc]) => (
                <div key={cmd} style={{ display: 'flex', gap: 16 }}>
                  <span style={{ color: ac, minWidth: 240, flexShrink: 0 }}>{cmd}</span>
                  <span style={{ color: 'rgba(255,255,255,0.4)' }}>{desc}</span>
                </div>
              ))}
            </ThreeDCard>
            <Note>
              <strong>Scope alerts:</strong> PAM monitors your <Code>product-scope.md</Code> and warns when a request diverges from the original blueprint — before it becomes scope creep.
            </Note>
          </section>

          {/* Prompt Library */}
          <section id="prompt-library" style={sectionGap}>
            <SectionHeader icon={BookOpen} title="Prompt Library"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              The Prompt Library has three tabs, each surfacing a different dimension of your project&apos;s development history:
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {[
                { tab: 'Blueprint',  desc: 'All wizard-generated prompts — master prompt, phase overviews, and feature build prompts. Grouped by phase. Shows run count and model suggestion per prompt. Read-only (regenerated by the Wizard).' },
                { tab: 'Custom',     desc: 'User-created and PAM-generated prompts. Create new ones with the "+ New prompt" button. The AI structures your raw prompt automatically. Fully editable.' },
                { tab: 'Changelog',  desc: 'Auto-populated logs from agent-runs.md and changes.md. Updated after every agent run and every confirmed PAM action. No manual input required.' },
              ].map(t => (
                <div key={t.tab} style={{
                  padding: '14px 18px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: ac, marginBottom: 5 }}>{t.tab}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', lineHeight: 1.6 }}>{t.desc}</div>
                </div>
              ))}
            </div>
            <p style={{ ...prose, margin: 0 }}>
              &quot;Copy for editor&quot; appends a list of context files to the prompt — paste it directly into Cursor or Claude Code with full file references.
            </p>
          </section>

          {/* Team */}
          <section id="team" style={sectionGap}>
            <SectionHeader icon={Users} title="Team"/>
            <p style={{ ...prose, margin: '0 0 16px' }}>
              Pro plan projects support up to 5 members. Go to <strong>Settings → Team</strong> and enter a colleague&apos;s email. They must have a Reminisce account — the invite is instant with no email required.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { role: 'Owner',  can: 'Everything: wizard, settings, member management, all tools' },
                { role: 'Member', can: 'PAM, agent, prompt library, context view, feature status updates' },
              ].map(r => (
                <div key={r.role} style={{
                  display: 'flex', gap: 14, alignItems: 'flex-start',
                  padding: '12px 16px',
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 10,
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 800, color: ac,
                    letterSpacing: '0.06em', flexShrink: 0,
                    textTransform: 'uppercase' as const, marginTop: 1,
                  }}>{r.role}</div>
                  <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{r.can}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Coming soon */}
          <section id="coming-soon" style={sectionGap}>
            <SectionHeader icon={Clock} title="Coming Soon"/>
            <p style={{
              fontSize: 14, color: 'rgba(255,255,255,0.35)', marginBottom: 20,
            }}>
              More detailed reference docs are in progress.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {comingSoon.map(item => (
                <div key={item.label} style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.07)',
                  borderRadius: 12, padding: '16px 20px',
                  display: 'flex', justifyContent: 'space-between',
                  alignItems: 'flex-start', gap: 20,
                }}>
                  <div>
                    <div style={{
                      fontSize: 14, fontWeight: 600,
                      color: 'rgba(255,255,255,0.65)', marginBottom: 4,
                    }}>{item.label}</div>
                    <div style={{
                      fontSize: 12, color: 'rgba(255,255,255,0.3)', lineHeight: 1.5,
                    }}>{item.desc}</div>
                  </div>
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    padding: '3px 8px', borderRadius: 999,
                    border: `1px solid ${hexToRgba(ac, 0.3)}`,
                    color: ac, background: hexToRgba(ac, 0.07),
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase' as const, flexShrink: 0,
                  }}>
                    Soon
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* CTA */}
          <div style={{
            background: hexToRgba(ac, 0.06),
            border: `1px solid ${hexToRgba(ac, 0.2)}`,
            borderRadius: 16, padding: '28px 28px',
            display: 'flex',
            flexDirection: mobile ? 'column' : 'row',
            alignItems: mobile ? 'flex-start' : 'center',
            justifyContent: 'space-between', gap: 20,
          }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                Ready to start building?
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                Free to use. No credit card required.
              </div>
            </div>
            <Link href="/signup" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '11px 24px', background: ac, color: '#000',
              borderRadius: 999, textDecoration: 'none',
              fontSize: 12, fontWeight: 800, letterSpacing: '0.06em',
              textTransform: 'uppercase' as const, flexShrink: 0,
              boxShadow: `0 0 28px ${hexToRgba(ac, 0.35)}`,
            }}>
              Launch App <ArrowRight size={13}/>
            </Link>
          </div>
        </div>
      </main>

      <footer style={{
        padding: '48px 60px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'center', maxWidth: 1120, margin: '0 auto',
      }}>
        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11 }}>
          © {new Date().getFullYear()} Reminisce
        </div>
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.1em' }}>
          DOCS V2.0
        </div>
      </footer>
    </div>
  )
}
