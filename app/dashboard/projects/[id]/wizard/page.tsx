'use client'

import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth'
import { useTheme } from '@/hooks/useTheme'
import { useFileSystem } from '@/hooks/useFileSystem'
import Link from 'next/link'
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts'
import { toast } from 'sonner'
import {
  Sparkles,
  Check,
  Plus,
  FolderOpen,
  FileText,
} from 'lucide-react'
import {
  STAGE_META,
  STAGE_ORDER,
  GENERATION_STEPS,
  ALL_WIZARD_MODELS as FALLBACK_MODELS,
  getStageIndex,
  stripSignals,
  type WizardStageKey,
  type ConfirmedFeature,
  type TechStackOption,
  type WizardError,
  classifyError,
} from '@/lib/wizard-stages'
import { getTimeUntilUTCReset } from '@/lib/wallet'
import { AIProvider } from '@/lib/ai-client'
import { readSSEStream } from '@/lib/stream-parser'
import { GenerationStepsPanel } from './BlueprintGenerationPanel'
import { WizardChatPanel } from './WizardChatPanel'
import { InjectModal } from './InjectModal'
import { StageProgress, TechStackCard, FeatureCard, ModelSelector } from './WizardComponents'
// ─────────────────────────────────────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────────────────────────────────────

type Message = { role: 'user' | 'assistant' | 'system'; content: string }

interface Blueprint {
  architecture?: string
  techStack?: Record<string, string>
  phases?: Array<{
    name: string
    description: string
    features?: Array<{ name: string; description: string; type?: string }>
  }>
  markdownFiles?: Record<string, string>
  masterPromptTitle?: string
}

interface GenerationEvent {
  type: 'wave_start' | 'step_start' | 'step_complete' | 'step_error'
      | 'step_skip' | 'saving' | 'complete' | 'error'
  wave?: number
  step?: number
  label?: string
  description?: string
  error?: string
  action?: string
  fatal?: boolean
  resumeStep?: number
  blueprint?: Blueprint
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────

function hexToRgba(hex: string, a: number) {
  if (!hex || hex.length < 7) return `rgba(245,158,11,${a})`
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r},${g},${b},${a})`
}

function glassCard(extra?: React.CSSProperties): React.CSSProperties {
  return {
    background: 'rgba(255,255,255,0.04)',
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.09)',
    borderRadius: 14,
    ...extra,
  }
}

// UI Components extracted to InjectModal.tsx and WizardComponents.tsx


// ─────────────────────────────────────────────────────────────────────────────
//  WizardPage — main export
// ─────────────────────────────────────────────────────────────────────────────

export default function WizardPage() {
  const params      = useParams()
  const { accent }  = useTheme()
  const ac          = accent || '#f59e0b'
  const projectId   = params.id as string
  const { session } = useAuthStore()

  // ── State ──────────────────────────────────────────────────────────────────
  const [project,            setProject]            = useState<{ name: string } | null>(null)
  const [loading,            setLoading]            = useState(true)
  const [messages,           setMessages]           = useState<Message[]>([])
  const [inputMsg,           setInputMsg]           = useState('')
  const [isTyping,           setIsTyping]           = useState(false)
  const [isGenerating,       setIsGenerating]       = useState(false)
  const [rightTab,           setRightTab]           = useState<'preview' | 'files'>('preview')
  const [currentStage,       setCurrentStage]       = useState<WizardStageKey>('idea')
  const [completedStages,    setCompletedStages]    = useState<WizardStageKey[]>([])
  const [generatedBlueprint, setGeneratedBlueprint] = useState<Blueprint | null>(null)
  const [pendingFeatures,    setPendingFeatures]    = useState<ConfirmedFeature[]>([])
  const [stackOptions,       setStackOptions]       = useState<TechStackOption[]>([])
  const [selectedStack,      setSelectedStack]      = useState<TechStackOption | null>(null)
  const [pendingStack,       setPendingStack]       = useState<TechStackOption | null>(null)
  const [genCurrentStep,     setGenCurrentStep]     = useState(-1)
  const [genCompletedSteps,  setGenCompletedSteps]  = useState<number[]>([])
  const [genErrorStep,       setGenErrorStep]       = useState<number | null>(null)
  const [resumeStep,         setResumeStep]         = useState(0)
  const [activeError,        setActiveError]        = useState<WizardError | null>(null)
  const [lastUserMessage,    setLastUserMessage]    = useState('')
  const [showInjectModal,    setShowInjectModal]    = useState(false)
  const [showRegenConfirm,   setShowRegenConfirm]   = useState(false)
  const [models, setModels] = useState(FALLBACK_MODELS)
  const [selectedModel, setSelectedModel] = useState<string>(() =>
    typeof window !== 'undefined' ? (localStorage.getItem('wizard_model') || 'llama-3.1-8b-instant') : 'llama-3.1-8b-instant'
  )
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(() =>
    typeof window !== 'undefined' ? ((localStorage.getItem('wizard_provider') as AIProvider) || 'groq') : 'groq'
  )
  const [leftWidth, setLeftWidth] = useState(50)

  // ── Guided next-steps ──────────────────────────────────────────────────────
  const [showGuide, setShowGuide] = useState(false)
  const [guideStep, setGuideStep] = useState<'connect' | 'inject' | 'done'>('connect')
  const [isRegeneration, setIsRegeneration] = useState(false)

  useKeyboardShortcuts({
    onWizardSend: () => {
      // Only send if we're in the chat stage and not generating
      if (currentStage !== 'generating' && !isTyping && inputMsg.trim()) {
        handleSendMessage(inputMsg)
      }
    },
    onWizardGenerate: () => {
      // Cmd+G triggers generation if stack is selected
      if (canGenerate && !isGenerating) {
        handleGenerate(0)
      }
    },
    onEscape: () => {
      // Close any open modals
      setShowRegenConfirm(false)
    },
    onSave: () => { /* wizard has no save action */ },
  })

  // ── Refs ───────────────────────────────────────────────────────────────────
  const containerRef    = useRef<HTMLDivElement>(null)
  const isDragging      = useRef(false)
  const isGeneratingRef = useRef(false)
  const initialized     = useRef(false)
  const sessionIdRef    = useRef<string | null>(null)
  const currentStageRef = useRef<WizardStageKey>('idea')
  const rightPanelRef   = useRef<HTMLDivElement>(null)
  const dragFrom        = useRef<number | null>(null)
  const MIN_LEFT = 30; const MAX_LEFT = 70

  const { isConnected, folderName, isSupported, openFolder, writeFile, initProject, pushToLocal } =
    useFileSystem(projectId)

  // ── Drag resize ────────────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
    const onMove = (ev: MouseEvent) => {
      if (!isDragging.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      setLeftWidth(Math.min(MAX_LEFT, Math.max(MIN_LEFT, ((ev.clientX - rect.left) / rect.width) * 100)))
    }
    const onUp = () => {
      isDragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }, [])

  // ── Auto-scroll ────────────────────────────────────────────────────────────
  useEffect(() => { if (rightPanelRef.current) rightPanelRef.current.scrollTop = 0 }, [rightTab, currentStage])

  // ── Session load ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const init = async () => {
      const [{ data: proj }, { data: sessions }] = await Promise.all([
        supabase.from('projects').select('name').eq('id', projectId).single(),
        supabase.from('wizard_sessions').select('*').eq('project_id', projectId)
          .order('created_at', { ascending: false }).limit(1),
      ])
      if (proj) setProject(proj)
      if (sessions && sessions.length > 0) {
        const sess = sessions[0]
        sessionIdRef.current    = sess.id
        const stage             = (sess.stage ?? 'idea') as WizardStageKey
        setCurrentStage(stage)
        currentStageRef.current = stage
        setCompletedStages(sess.completed_stages ?? [])
        setPendingFeatures(sess.confirmed_features ?? [])
        setStackOptions(sess.stack_options ?? [])
        if (sess.selected_stack?.id) { setSelectedStack(sess.selected_stack); setPendingStack(sess.selected_stack) }
        const chatMsgs = (sess.messages ?? [])
          .filter((m: Message) => m.role !== 'system')
          .map((m: Message) => ({ ...m, content: stripSignals(m.content) }))
        const seen = new Set<string>()
        setMessages(chatMsgs.filter((m: Message) => {
          const k = `${m.role}::${m.content}`; if (seen.has(k)) return false; seen.add(k); return true
        }))
        if (sess.stage === 'complete' || sess.generation_status === 'complete') {
          // Restore blueprint base from session row
          const restoredBlueprint: Blueprint = {
            architecture: sess.architecture?.description ?? '',
            techStack:    sess.workflow ?? {},
          }

          // Load markdownFiles from contexts table so the Files tab
          // and Inject modal work on returning sessions.
          // contexts were bulk-inserted by saveBlueprint in generate route.
          try {
            const { data: ctxRows } = await supabase
              .from('contexts')
              .select('file_path, content')
              .eq('project_id', projectId)

            if (ctxRows && ctxRows.length > 0) {
              const markdownFiles: Record<string, string> = {}
              for (const row of ctxRows) {
                if (row.file_path && typeof row.content === 'string') {
                  markdownFiles[row.file_path] = row.content
                }
              }
              restoredBlueprint.markdownFiles = markdownFiles
            }
          } catch { /* non-fatal — files tab will be empty but core blueprint still shows */ }

          setGeneratedBlueprint(restoredBlueprint)
          setIsGenerating(false)
        }
        if (sess.generation_status === 'generating') { setGenCurrentStep(sess.generation_step ?? 0); setResumeStep(sess.generation_step ?? 0) }
        if (sess.last_error) setActiveError(classifyError(new Error(sess.last_error)))
      }
      setSelectedModel(prev => {
        const known = models.some(m => m.model === prev)
        if (!known) { localStorage.setItem('wizard_model', 'llama-3.1-8b-instant'); localStorage.setItem('wizard_provider', 'groq'); setSelectedProvider('groq'); return 'llama-3.1-8b-instant' }
        return prev
      })
      setLoading(false)
    }
    init()
  }, [projectId, models])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return
      fetch('/api/keys/models', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(data => {
          if (Array.isArray(data.models) && data.models.length > 0) {
            setModels(data.models)
          }
        })
        .catch(() => { /* keep FALLBACK_MODELS */ })
    })
  }, [])

  // ── Send message ───────────────────────────────────────────────────────────
  const handleSendMessage = useCallback(async (overrideMsg?: string) => {
    const text = overrideMsg ?? inputMsg
    if (!text.trim() || isTyping || isGenerating) return
    const currentInput = text.trim()
    setInputMsg('')
    setLastUserMessage(currentInput)
    setActiveError(null)
    setMessages(prev => [...prev, { role: 'user', content: currentInput }])
    setIsTyping(true)
    try {
      const res = await fetch('/api/wizard/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ sessionId: sessionIdRef.current, projectId, message: currentInput, provider: selectedProvider, model: selectedModel }),
      })
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}))
        if (res.status === 402) {
          setActiveError({ type: 'rate_limit', message: `Out of coins. Resets ${getTimeUntilUTCReset()}.`, actionLabel: 'Change Model', action: 'change_model' })
          setMessages(prev => prev.slice(0, -1)); setInputMsg(currentInput); return
        }
        const wizError = classifyError(new Error(errBody?.message ?? 'Request failed'))
        setActiveError({ ...wizError, message: errBody?.message ?? wizError.message })
        setMessages(prev => prev.slice(0, -1)); setInputMsg(currentInput); return
      }
      const newId = res.headers.get('X-Session-Id')
      if (newId && !sessionIdRef.current) sessionIdRef.current = newId
      setMessages(prev => [...prev, { role: 'assistant', content: '' }])
      let assistantText = ''
      if (res.body) {
        for await (const chunk of readSSEStream(res.body)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const parsed = chunk.raw as any
          if (chunk.isMeta) {
            if (parsed.__wizard_meta) {
              if (typeof parsed.cleanedText === 'string' && parsed.cleanedText.length > 0) {
                assistantText = parsed.cleanedText
                setMessages(prev => {
                  const arr = [...prev]
                  if (arr.length > 0 && arr[arr.length - 1].role === 'assistant')
                    arr[arr.length - 1] = { role: 'assistant', content: parsed.cleanedText }
                  return arr
                })
              }
              if (parsed.stageAdvanced && parsed.nextStage) {
                setCurrentStage(parsed.nextStage); currentStageRef.current = parsed.nextStage
                const stageVal = parsed.stage as import('@/lib/wizard-stages').WizardStageKey
                if (stageVal) setCompletedStages(prev => prev.includes(stageVal) ? prev : [...prev, stageVal])
              }
              if (parsed.uiFeatures && Array.isArray(parsed.uiFeatures)) setPendingFeatures(parsed.uiFeatures)
              if (parsed.uiStacks && Array.isArray(parsed.uiStacks)) setStackOptions(parsed.uiStacks)
              if (parsed.stageData?.stack_options) setStackOptions(parsed.stageData.stack_options)
            }
            continue
          }
          if (chunk.delta) {
            assistantText += chunk.delta
            setMessages(prev => { const arr = [...prev]; arr[arr.length - 1] = { role: 'assistant', content: stripSignals(assistantText) }; return arr })
          }
          if (parsed?.choices?.[0]?.finish_reason === 'stream_error') { setActiveError(classifyError(new Error('stream died'))); setInputMsg(currentInput) }
        }
      }
      if (!assistantText.trim()) { setActiveError(classifyError(new Error('stream died'))); setInputMsg(currentInput) }
    } catch (err: unknown) {
      const wizError = classifyError(err); setActiveError(wizError)
      setMessages(prev => { const arr = [...prev]; if (arr[arr.length - 1]?.role === 'assistant') arr.pop(); if (arr[arr.length - 1]?.role === 'user') arr.pop(); return arr })
      setInputMsg(currentInput)
    } finally { setIsTyping(false) }
  }, [inputMsg, isTyping, isGenerating, projectId, session, selectedProvider, selectedModel])

  // ── Confirm features ───────────────────────────────────────────────────────
  const handleConfirmFeatures = useCallback(async () => {
    const toConfirm = pendingFeatures.filter(f => f.confirmed)
    if (toConfirm.length === 0) { toast.error('Select at least one feature.'); return }
    try {
      await fetch('/api/wizard/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ sessionId: sessionIdRef.current, confirmed_features: toConfirm, stage: 'stack' }),
      })
      setCurrentStage('stack'); currentStageRef.current = 'stack'
      setCompletedStages(prev => prev.includes('features') ? prev : [...prev, 'features'])
      toast.success(`${toConfirm.length} features confirmed`)
    } catch { toast.error('Failed to save features.') }
  }, [pendingFeatures, session])

  // ── Generate blueprint ─────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (fromResumeStep = 0, force = false) => {
    // EC-16: warn on regeneration
    if (generatedBlueprint && fromResumeStep === 0 && !force) {
      setShowRegenConfirm(true)
      return
    }

    if (isGeneratingRef.current) return
    const sid = sessionIdRef.current; if (!sid) return
    
    setIsRegeneration(!!generatedBlueprint && fromResumeStep === 0)
    isGeneratingRef.current = true; setIsGenerating(true)
    setCurrentStage('generating'); setGenCurrentStep(fromResumeStep)
    setGenCompletedSteps(Array.from({ length: fromResumeStep }, (_, i) => i))
    setGenErrorStep(null); setActiveError(null)
    try {
      const res = await fetch('/api/wizard/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ sessionId: sid, projectId, provider: selectedProvider, model: selectedModel, resumeStep: fromResumeStep }),
      })
      if (!res.ok) {
        if (res.status === 402) {
          setActiveError({ type: 'rate_limit', message: `Out of coins. Resets ${getTimeUntilUTCReset()}.`, actionLabel: 'Change Model', action: 'change_model' })
          setCurrentStage('stack'); return
        }
        const errBody = await res.json().catch(() => ({})); throw new Error(errBody?.error ?? 'Generation failed')
      }
      const reader = res.body?.getReader(); const decoder = new TextDecoder(); let buffer = ''
      if (reader) {
        while (true) {
          const { done, value } = await reader.read(); if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n'); buffer = lines.pop() ?? ''
          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data: ') || trimmed === 'data: [DONE]') continue
            try {
              const event: GenerationEvent = JSON.parse(trimmed.slice(6))
              switch (event.type) {
                case 'step_start':    setGenCurrentStep(event.step ?? 0); break
                case 'step_complete': setGenCompletedSteps(prev => [...prev, event.step ?? 0]); break
                case 'step_error':    setGenErrorStep(event.step ?? null); if (event.resumeStep !== undefined) setResumeStep(event.resumeStep); break
                case 'complete':
                  setGeneratedBlueprint(event.blueprint ?? null)
                  setCurrentStage('complete'); currentStageRef.current = 'complete'
                  setCompletedStages(['idea', 'features', 'stack', 'generating'])
                  toast.success('Blueprint generated! 🎉'); setRightTab('preview')
                  if (!isRegeneration) {
                    setShowGuide(true)
                  }
                  break
                case 'error':
                  if (event.error) {
                    setActiveError({ ...classifyError(new Error(event.error)), action: (event.action as WizardError['action']) ?? 'retry' })
                    if (event.resumeStep !== undefined) setResumeStep(event.resumeStep)
                  }; break
              }
            } catch { /* partial */ }
          }
        }
      }
    } catch (err: unknown) { setActiveError(classifyError(err)); setCurrentStage('stack') }
    finally { isGeneratingRef.current = false; setIsGenerating(false) }
  }, [projectId, session, selectedProvider, selectedModel, generatedBlueprint, setShowRegenConfirm, isRegeneration])

  // ── Select stack ───────────────────────────────────────────────────────────
  const handleSelectStack = useCallback(async (stack: TechStackOption) => {
    setPendingStack(stack)
    setSelectedStack(stack)

    // Persist stack selection and advance session stage
    if (sessionIdRef.current) {
      try {
        await supabase
          .from('wizard_sessions')
          .update({
            stage: 'generating',
            generation_status: 'idle',
            selected_stack: stack,
            completed_stages: ['idea', 'features', 'stack'],
          })
          .eq('id', sessionIdRef.current)
      } catch { /* non-fatal */ }
    }

    // Advance UI stage then immediately trigger generation
    setCurrentStage('generating')
    setCompletedStages(prev =>
      prev.includes('stack') ? prev : [...prev, 'stack'],
    )
    handleGenerate(0)
  }, [handleGenerate, sessionIdRef])

  // ── Export ZIP ─────────────────────────────────────────────────────────────
  const handleExportZip = useCallback(async () => {
    if (!generatedBlueprint?.markdownFiles) return
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${s?.access_token}` },
        body: JSON.stringify({ projectId, files: generatedBlueprint.markdownFiles }),
      })
      if (!res.ok) throw new Error('Export failed')
      const blob = await res.blob(); const url = URL.createObjectURL(blob)
      const a = document.createElement('a'); a.href = url; a.download = `reminisce-${projectId}.zip`; a.click(); URL.revokeObjectURL(url)
      toast.success('ZIP exported')
    } catch { toast.error('Export failed') }
  }, [projectId, generatedBlueprint])

  // ── Local file injection ───────────────────────────────────────────────────
  const handleInjectFiles = useCallback(async () => {
    if (!generatedBlueprint?.markdownFiles) return
    try {
      await initProject()
      let written = 0
      for (const [path, content] of Object.entries(generatedBlueprint.markdownFiles)) {
        try { await writeFile(path, content as string); written++ } catch { /* non-fatal */ }
      }
      if (written > 0) {
        toast.success(`${written} files written to folder`)
        // Persist sync timestamp — overview page reads this to show indicator
        const syncedAt = new Date().toISOString()
        localStorage.setItem(`blueprint_synced_${projectId}`, syncedAt)
      }
    } catch { toast.error('File injection failed') }
  }, [generatedBlueprint, initProject, writeFile, projectId])

  // ── Feature helpers ────────────────────────────────────────────────────────
  const handleFeatureToggle = useCallback((i: number) => {
    setPendingFeatures(prev => prev.map((f, idx) => idx === i ? { ...f, confirmed: !f.confirmed } : f))
  }, [])
  const handleFeatureEdit = useCallback((i: number, field: keyof ConfirmedFeature, value: string) => {
    setPendingFeatures(prev => prev.map((f, idx) => idx === i ? { ...f, [field]: value } : f))
  }, [])
  const handleFeatureRemove = useCallback((i: number) => {
    setPendingFeatures(prev => prev.filter((_, idx) => idx !== i))
  }, [])
  const handleFeatureAdd = useCallback(() => {
    setPendingFeatures(prev => [...prev, { name: 'New Feature', description: 'Describe this feature', type: 'frontend', priority: 'nice-to-have', confirmed: true }])
  }, [])
  const handleDragStart = useCallback((i: number) => { dragFrom.current = i }, [])
  const handleDragOver  = useCallback((e: React.DragEvent) => e.preventDefault(), [])
  const handleDrop      = useCallback((toIndex: number) => {
    if (dragFrom.current === null || dragFrom.current === toIndex) return
    setPendingFeatures(prev => {
      const arr = [...prev]; const [moved] = arr.splice(dragFrom.current!, 1); arr.splice(toIndex, 0, moved); dragFrom.current = null; return arr
    })
  }, [])

  // ── Quick-reply chips ──────────────────────────────────────────────────────
  const quickChips = useMemo(() => {
    if (currentStage === 'idea') return [
      'I want to add more context to my idea',
      'This looks good, let\'s continue',
      'Can you expand on the features?',
    ]
    if (currentStage === 'features') {
      const first = pendingFeatures[0]?.name
      return [
        first ? `Tell me more about "${first}"` : 'Tell me more about the core features',
        'Add a testing feature',
        'Add an authentication feature',
        'This looks good',
      ]
    }
    if (currentStage === 'stack') return [
      'Tell me more about Option A',
      'Tell me more about Option B',
      'Tell me more about Option C',
      'I want to see a cheaper option',
    ]
    return []
  }, [currentStage, pendingFeatures])

  // ── Derived ────────────────────────────────────────────────────────────────
  const stageIndex        = useMemo(() => getStageIndex(currentStage), [currentStage])
  const isComplete        = currentStage === 'complete'
  const isGeneratingStage = currentStage === 'generating' || isGenerating
  const canGenerate       = (currentStage === 'stack' || currentStage === 'generating') && selectedStack !== null && !isGenerating
  const confirmedCount    = pendingFeatures.filter(f => f.confirmed).length
  const rightPanelMode: 'features' | 'stacks' | 'generating' | 'complete' | 'hint' =
    currentStage === 'features'   ? 'features'
    : currentStage === 'stack'    ? 'stacks'
    : currentStage === 'generating' ? 'generating'
    : currentStage === 'complete' ? 'complete'
    : 'hint'

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ height: 'calc(100vh - 68px)', background: '#05050f', display: 'flex', flexDirection: 'column', gap: 12, padding: 24 }}>
      {[80, '100%', '100%'].map((h, i) => (
        <div key={i} style={{
          height: typeof h === 'number' ? h : undefined,
          flex: typeof h === 'string' ? 1 : undefined,
          background: 'rgba(255,255,255,0.04)', borderRadius: 12,
          animation: 'wPulse 1.5s ease infinite', animationDelay: `${i * 0.15}s`,
        }} />
      ))}
      <style>{`@keyframes wPulse { 0%,100%{opacity:1} 50%{opacity:0.4} }`}</style>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div ref={containerRef} style={{
      display: 'flex', height: 'calc(100vh - 68px)',
      background: '#05050f',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes wPulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes wBounce { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
      `}</style>

      {/* ══ LEFT PANEL — Chat ══════════════════════════════════════════════════ */}
      <div style={{
        width: `${leftWidth}%`, minWidth: 0, maxWidth: `${MAX_LEFT}%`,
        display: 'flex', flexDirection: 'column',
        borderRight: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.01)',
      }}>
        {/* Header */}
        <div style={{
          padding: '0 20px', height: 56,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          background: 'transparent',
          backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.35)' }}>Wizard</span>
          {project && (
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 999,
              background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.25)}`, color: ac, letterSpacing: '0.06em',
            }}>{project.name}</span>
          )}
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
            {STAGE_META[currentStage]?.label}
          </span>
          <div style={{ flex: 1 }} />
          <ModelSelector
            models={models}
            selectedModel={selectedModel}
            onSelect={(m, p) => {
              setSelectedModel(m); setSelectedProvider(p)
              localStorage.setItem('wizard_model', m); localStorage.setItem('wizard_provider', p)
              if (messages.length > 0)
                setMessages(prev => [...prev, { role: 'assistant', content: `↺ Switched to ${models.find(x => x.model === m)?.label ?? m}. I have full context of our conversation.` }])
            }}
            accent={ac}
          />
        </div>

        {/* Progress bar */}
        <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
          <div style={{
            height: '100%',
            width: `${Math.min((stageIndex / (STAGE_ORDER.length - 1)) * 100, 100)}%`,
            background: ac, transition: 'width 0.5s ease', borderRadius: '0 999px 999px 0',
          }} />
        </div>

        {/* Messages */}
        <WizardChatPanel
          messages={messages}
          streamText=""
          isStreaming={isTyping}
          inputMsg={inputMsg}
          setInputMsg={setInputMsg}
          onSend={handleSendMessage}
          accent={ac}
          currentStage={currentStage}
          activeError={activeError}
          onConfirmFeatures={handleConfirmFeatures}
          onGenerate={handleGenerate}
          onShowRegen={() => setShowRegenConfirm(true)}
          confirmedCount={confirmedCount}
          pendingFeatures={pendingFeatures}
          canGenerate={canGenerate}
          isComplete={isComplete}
          isGeneratingStage={isGeneratingStage}
          quickChips={quickChips}
          resumeStep={resumeStep}
          lastUserMessage={lastUserMessage}
          genCurrentStep={genCurrentStep}
        />
      </div>

      {/* ══ DRAG HANDLE ════════════════════════════════════════════════════════ */}
      <div onMouseDown={onDragStart} style={{
        width: 1, flexShrink: 0, cursor: 'col-resize',
        background: 'rgba(255,255,255,0.06)', position: 'relative', zIndex: 10, transition: 'background 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = ac }}
      onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'rgba(255,255,255,0.06)' }}
      >
        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0,1,2,3,4].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />)}
        </div>
      </div>

      {/* ══ RIGHT PANEL ════════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <StageProgress currentStage={currentStage} completedStages={completedStages} accent={ac} />

        {/* Tab bar — only on complete */}
        {rightPanelMode === 'complete' && (
          <div style={{
            height: 44, borderBottom: '1px solid rgba(255,255,255,0.06)',
            background: 'transparent', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', flexShrink: 0,
          }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {(['preview', 'files'] as const).map(tab => (
                <button key={tab} onClick={() => setRightTab(tab)} style={{
                  padding: '6px 14px', fontSize: 11, fontWeight: 600, border: 'none', background: 'transparent',
                  borderBottom: `2px solid ${rightTab === tab ? ac : 'transparent'}`,
                  color: rightTab === tab ? ac : 'rgba(255,255,255,0.35)', cursor: 'pointer', transition: 'all 0.15s',
                }}>{tab === 'preview' ? 'Preview' : 'Files'}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {isSupported && generatedBlueprint?.markdownFiles && (
                <button onClick={() => setShowInjectModal(true)} style={{
                  display: 'flex', alignItems: 'center', gap: 6, padding: '5px 12px',
                  background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.25)}`,
                  borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: ac, transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = hexToRgba(ac, 0.18) }}
                onMouseLeave={e => { e.currentTarget.style.background = hexToRgba(ac, 0.1) }}
                >
                  <FolderOpen size={12} /> Inject files
                </button>
              )}
              {generatedBlueprint?.markdownFiles && (
                <button onClick={handleExportZip} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 7, cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.4)', transition: 'all 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = ac; e.currentTarget.style.color = ac }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
                >
                  ↓ Export ZIP
                </button>
              )}
            </div>
          </div>
        )}

        {/* Right panel content */}
        <div ref={rightPanelRef} style={{ flex: 1, overflowY: 'auto', background: 'rgba(255,255,255,0.005)' }}>

          {/* Hint — idea stage */}
          {rightPanelMode === 'hint' && (
            <div style={{ padding: 20 }}>
              <div style={glassCard({ padding: '16px 18px' })}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: ac, textTransform: 'uppercase', marginBottom: 6 }}>
                  {STAGE_META[currentStage]?.label}
                </div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 600, marginBottom: 4 }}>Tell me about your project idea</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{STAGE_META[currentStage]?.description}</div>
              </div>
            </div>
          )}

          {/* Interactive features — features stage */}
          {rightPanelMode === 'features' && (
            <div style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 2 }}>
                    Feature Set
                  </div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
                    {confirmedCount} of {pendingFeatures.length} selected · Drag to reorder · Click to edit
                  </div>
                </div>
                <button onClick={handleFeatureAdd} style={{
                  display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px',
                  background: hexToRgba(ac, 0.1), border: `1px solid ${hexToRgba(ac, 0.22)}`,
                  borderRadius: 8, cursor: 'pointer', fontSize: 11, fontWeight: 700, color: ac,
                }}>
                  <Plus size={12} /> Add
                </button>
              </div>

              {pendingFeatures.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', fontSize: 13, color: 'rgba(255,255,255,0.25)', lineHeight: 1.6 }}>
                  No features yet.<br />Chat with the AI or click Add above.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {pendingFeatures.map((f, i) => (
                    <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragOver={handleDragOver} onDrop={() => handleDrop(i)}>
                      <FeatureCard
                        feature={f} accent={ac}
                        onToggle={() => handleFeatureToggle(i)}
                        onEdit={(field, value) => handleFeatureEdit(i, field, value)}
                        onRemove={() => handleFeatureRemove(i)}
                      />
                    </div>
                  ))}
                </div>
              )}

              {pendingFeatures.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={handleConfirmFeatures} style={{
                    width: '100%', padding: '11px', background: ac, border: 'none',
                    borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#000',
                    boxShadow: `0 0 20px ${hexToRgba(ac, 0.3)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Check size={14} /> Confirm Features →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Stack cards — stack stage */}
          {rightPanelMode === 'stacks' && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 4 }}>
                Choose Your Tech Stack
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', marginBottom: 16, lineHeight: 1.5 }}>
                {stackOptions.length > 0 ? 'Select an option — or ask about it in chat.' : 'Stack options appear here once the AI generates them.'}
              </div>
              {stackOptions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {stackOptions.map(opt => (
                    <TechStackCard key={opt.id} option={opt} selected={pendingStack?.id === opt.id} onSelect={() => handleSelectStack(opt)} accent={ac} />
                  ))}
                </div>
              ) : (
                <div style={{ ...glassCard({ padding: 24 }), textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 13 }}>
                  <div style={{ fontSize: 28, marginBottom: 8 }}>⟳</div>
                  Stack options loading via chat...
                </div>
              )}
              {pendingStack && !isGenerating && (
                <div style={{ marginTop: 16 }}>
                  <button onClick={() => handleGenerate(0)} style={{
                    width: '100%', padding: '11px', background: ac, border: 'none',
                    borderRadius: 10, cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#000',
                    boxShadow: `0 0 20px ${hexToRgba(ac, 0.3)}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <Sparkles size={14} /> Generate Blueprint
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Generation progress */}
          {rightPanelMode === 'generating' && (
            <GenerationStepsPanel steps={GENERATION_STEPS} currentStep={genCurrentStep} completedSteps={genCompletedSteps} errorStep={genErrorStep} accent={ac} />
          )}

          {/* Complete — preview tab */}
          {rightPanelMode === 'complete' && rightTab === 'preview' && generatedBlueprint && (
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={glassCard({ padding: '16px 18px' })}>
                <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: ac, textTransform: 'uppercase', marginBottom: 8 }}>Architecture Overview</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, maxHeight: 160, overflowY: 'auto' }}>
                  {generatedBlueprint.architecture?.slice(0, 500) ?? 'Architecture generated.'}
                  {(generatedBlueprint.architecture?.length ?? 0) > 500 ? '...' : ''}
                </div>
              </div>
              {generatedBlueprint.techStack && (
                <div style={glassCard({ padding: '14px 16px' })}>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.14em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>Tech Stack</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                    {Object.entries(generatedBlueprint.techStack).map(([k, v]) => (
                      <div key={k}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{k}</div>
                        <div style={{ fontSize: 11, color: '#fff', fontWeight: 500 }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {generatedBlueprint.phases && (
                <div>
                  <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 10 }}>
                    Phases ({generatedBlueprint.phases.length})
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {generatedBlueprint.phases.map((phase, i) => (
                      <div key={i} style={glassCard({ padding: '12px 14px' })}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{phase.name}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>{phase.description}</div>
                        {phase.features && <div style={{ marginTop: 8, fontSize: 10, color: ac, fontWeight: 600 }}>{phase.features.length} feature{phase.features.length !== 1 ? 's' : ''}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Complete — files tab */}
          {rightPanelMode === 'complete' && rightTab === 'files' && generatedBlueprint?.markdownFiles && (
            <div style={{ padding: 20 }}>
              <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', marginBottom: 12 }}>
                Generated Files ({Object.keys(generatedBlueprint.markdownFiles).length})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(generatedBlueprint.markdownFiles).map(([path, content]) => {
                  const sizeKb = (new TextEncoder().encode(content as string).length / 1024).toFixed(1)
                  return (
                    <div key={path} style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)',
                    }}>
                      <FileText size={12} color="rgba(255,255,255,0.3)" />
                      <span style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: 'rgba(255,255,255,0.6)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{path}</span>
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0 }}>{sizeKb}kb</span>
                    </div>
                  )
                })}
              </div>

              {/* Inject to local folder */}
              {isConnected && (
                <button
                  onClick={async () => {
                    if (!generatedBlueprint?.markdownFiles) return
                    try {
                      const written = await pushToLocal(generatedBlueprint.markdownFiles)
                      if (written > 0) {
                        localStorage.setItem(`blueprint_synced_${projectId}`, new Date().toISOString())
                        toast.success(`${written} files written to folder`)
                      }
                    } catch { toast.error('Inject failed') }
                  }}
                  style={{
                    marginTop: 12, width: '100%',
                    background: '#10b981', color: '#000',
                    border: 'none', borderRadius: 10,
                    padding: '11px',
                    fontSize: 11, fontWeight: 800,
                    letterSpacing: '0.1em', textTransform: 'uppercase',
                    cursor: 'pointer',
                  }}
                >
                  ↑ Inject to Local Folder
                </button>
              )}

              <button
                onClick={handleExportZip}
                style={{
                  marginTop: 8, width: '100%',
                  background: 'transparent', color: ac,
                  border: `1px solid ${hexToRgba(ac, 0.3)}`,
                  borderRadius: 10,
                  padding: '10px',
                  fontSize: 11, fontWeight: 800,
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                  cursor: 'pointer',
                }}
              >
                ↓ Export All as ZIP
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════════ */}
      {showInjectModal && generatedBlueprint?.markdownFiles && (
        <InjectModal
          files={generatedBlueprint.markdownFiles as Record<string, string>}
          folderName={folderName} isConnected={isConnected}
          onConnect={openFolder} onConfirm={handleInjectFiles}
          onClose={() => setShowInjectModal(false)} accent={ac}
        />
      )}
      {showRegenConfirm && (
        <div
          onClick={() => setShowRegenConfirm(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, background: 'rgba(10,10,24,0.98)', backdropFilter: 'blur(24px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Regenerate blueprint?</div>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.6 }}>
              This will replace all existing phases, features, and prompts for this project.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setShowRegenConfirm(false)} style={{ flex: 1, padding: '10px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, background: 'transparent', color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                onClick={() => { setShowRegenConfirm(false); handleGenerate(0, true) }}
                style={{ flex: 2, padding: '10px', background: ac, color: '#000', border: 'none', borderRadius: 8, fontSize: 11, fontWeight: 800, cursor: 'pointer' }}
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Guided next-steps modal ─────────────────────────────── */}
      {showGuide && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setShowGuide(false)}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.7)',
              backdropFilter: 'blur(8px)',
              zIndex: 200,
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%,-50%)',
            width: 480, maxWidth: 'calc(100vw - 32px)',
            background: 'rgba(8,8,22,0.98)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: '32px',
            zIndex: 201,
            boxShadow: '0 32px 80px rgba(0,0,0,0.8)',
          }}>
            {/* Close */}
            <button
              onClick={() => setShowGuide(false)}
              style={{ position: 'absolute', top: 16, right: 18, background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 20 }}
            >×</button>

            {/* Header */}
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '0.18em', textTransform: 'uppercase', color: ac, marginBottom: 12 }}>
              Blueprint ready
            </div>
            <h2 style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', margin: '0 0 8px', lineHeight: 1.2 }}>
              Two steps to make it live
            </h2>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', margin: '0 0 28px', lineHeight: 1.6 }}>
              Your blueprint is saved. Now connect your local folder and inject
              the context files so your editor and AI tools can read them.
            </p>

            {/* Step indicators */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
              {(['connect','inject','done'] as const).map((step, i) => (
                <div key={step} style={{
                  flex: 1, height: 3, borderRadius: 999,
                  background: i <= ['connect','inject','done'].indexOf(guideStep)
                    ? ac : 'rgba(255,255,255,0.1)',
                  transition: 'background 0.3s',
                }}/>
              ))}
            </div>

            {/* Step content */}
            {guideStep === 'connect' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                  Step 1 — Connect your project folder
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 20 }}>
                  Select the root folder of your local project. Reminisce will
                  read and write context files here directly.
                </p>
                {isConnected ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, marginBottom: 16 }}>
                    <span style={{ color: '#10b981', fontSize: 16 }}>✓</span>
                    <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>
                      {folderName ? `"${folderName}" connected` : 'Folder connected'}
                    </span>
                  </div>
                ) : (
                  <button
                    onClick={async () => { await openFolder(); }}
                    style={{
                      width: '100%', padding: '13px', marginBottom: 16,
                      background: ac, color: '#000', border: 'none',
                      borderRadius: 14, fontSize: 14, fontWeight: 800,
                      cursor: 'pointer', boxShadow: `0 0 28px ${hexToRgba(ac, 0.4)}`,
                    }}
                  >
                    Select project folder →
                  </button>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                    Skip for now
                  </button>
                  <button
                    onClick={() => setGuideStep('inject')}
                    disabled={!isConnected}
                    style={{
                      padding: '10px 24px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                      background: isConnected ? hexToRgba(ac, 0.15) : 'rgba(255,255,255,0.05)',
                      color: isConnected ? ac : 'rgba(255,255,255,0.25)',
                      cursor: isConnected ? 'pointer' : 'not-allowed',
                    }}
                  >
                    Next →
                  </button>
                </div>
              </div>
            )}

            {guideStep === 'inject' && (
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
                  Step 2 — Write context files to disk
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 20 }}>
                  This writes your blueprint, architecture, and editor integration
                  file to your project folder. Your AI editor will load them
                  automatically on next open.
                </p>
                <button
                  onClick={async () => {
                    if (!generatedBlueprint?.markdownFiles) return
                    try {
                      await pushToLocal(generatedBlueprint.markdownFiles)
                      setGuideStep('done')
                    } catch {
                      toast.error('Injection failed — check folder permissions')
                    }
                  }}
                  style={{
                    width: '100%', padding: '13px', marginBottom: 16,
                    background: ac, color: '#000', border: 'none',
                    borderRadius: 14, fontSize: 14, fontWeight: 800,
                    cursor: 'pointer', boxShadow: `0 0 28px ${hexToRgba(ac, 0.4)}`,
                  }}
                >
                  Write context files to disk →
                </button>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <button onClick={() => setGuideStep('connect')} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                    ← Back
                  </button>
                  <button onClick={() => setShowGuide(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
                    Skip
                  </button>
                </div>
              </div>
            )}

            {guideStep === 'done' && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
                  You&apos;re set up
                </div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, marginBottom: 24 }}>
                  Context files are on disk. Open your editor in this folder — your
                  AI tools will automatically have full project context. Open PAM
                  to start managing your project with AI.
                </p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <Link
                    href={`/dashboard/projects/${projectId}/agent`}
                    style={{
                      flex: 1, padding: '13px', background: ac, color: '#000',
                      borderRadius: 14, textDecoration: 'none', fontSize: 14,
                      fontWeight: 800, textAlign: 'center', boxShadow: `0 0 28px ${hexToRgba(ac, 0.4)}`,
                    }}
                  >
                    Open PAM →
                  </Link>
                  <button
                    onClick={() => setShowGuide(false)}
                    style={{
                      padding: '13px 20px', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)', borderRadius: 14,
                      color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

