import { NextResponse } from 'next/server'
import { getServiceSupabase, supabase as clientSupabase, verifyProjectAccess } from '@/lib/supabase'
import type { ConfirmedFeature, TechStackOption } from '@/lib/wizard-stages'

// PATCH /api/wizard/session
// The single authoritative write point for user-confirmed wizard data.
// Called by the wizard page ONLY when the user explicitly confirms
// features (clicks Confirm Features button) or selects a stack (clicks a card).
// The chat route NEVER writes confirmed_features or selected_stack — only this endpoint does.

export async function PATCH(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (!authHeader)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } =
      await clientSupabase.auth.getUser(token)
    if (!user || authError)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body: {
      sessionId: string
      confirmed_features?: ConfirmedFeature[]
      selected_stack?: TechStackOption
      stage?: string
    } = await req.json()

    const { sessionId, confirmed_features, selected_stack, stage } = body

    if (!sessionId)
      return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 })

    const supabase = getServiceSupabase()

    // Verify session belongs to a project this user owns
    const { data: session } = await supabase
      .from('wizard_sessions')
      .select('id, project_id')
      .eq('id', sessionId)
      .single()

    if (!session)
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })

    if (!await verifyProjectAccess(user.id, session.project_id))
      return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // Build update — only write fields that were explicitly passed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const update: Record<string, any> = {}

    if (confirmed_features !== undefined) {
      update.confirmed_features = confirmed_features
      // When features are confirmed, advance stage to stack if still on features
      if (stage === 'features') {
        update.stage = 'stack'
        update.completed_stages = supabase
          // We'll handle this client-side — just update stage
      }
    }

    if (selected_stack !== undefined) {
      update.selected_stack = selected_stack
    }

    if (stage !== undefined) {
      update.stage = stage
    }

    // Remove the supabase reference that slipped in above
    if ('completed_stages' in update && typeof update.completed_stages !== 'string') {
      delete update.completed_stages
    }

    const { error } = await supabase
      .from('wizard_sessions')
      .update(update)
      .eq('id', sessionId)

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
