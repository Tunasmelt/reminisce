'use client'

import { useEffect, useCallback } from 'react'

export interface ShortcutConfig {
  // Wizard page
  onWizardSend?:    () => void   // Enter to send message
  onWizardGenerate?:() => void   // Cmd/Ctrl+G to generate
  onWizardConfirm?: () => void   // Cmd/Ctrl+Enter to confirm stage
  // PAM / agent pages
  onPamSend?:       () => void   // Enter to send (when input focused)
  // General
  onEscape?:        () => void   // Esc to close modals / cancel
  onSearch?:        () => void   // Cmd/Ctrl+K for search/command
  onGoToDashboard?: () => void   // Cmd/Ctrl+H for home/dashboard
  onGoToWizard?:    () => void   // Cmd/Ctrl+W for wizard
  onGoToPam?:       () => void   // Cmd/Ctrl+P for PAM
  onGoToBoard?:     () => void   // Cmd/Ctrl+B for board
  onGoToHistory?:   () => void   // Cmd/Ctrl+Y for history
  onSave?:          () => void   // Cmd/Ctrl+S for save actions
  // Allow disabling specific shortcuts
  disabled?:        boolean
}

/**
 * Global keyboard shortcut hook.
 * Import and call in any page component. Pass only the handlers you need.
 * All shortcuts are automatically cleaned up on unmount.
 */
export function useKeyboardShortcuts(config: ShortcutConfig) {
  const handler = useCallback((e: KeyboardEvent) => {
    if (config.disabled) return

    const meta    = e.metaKey || e.ctrlKey
    const key     = e.key.toLowerCase()
    const tag     = (e.target as HTMLElement)?.tagName?.toLowerCase()
    const isInput = tag === 'input' || tag === 'textarea' || tag === 'select'
      || (e.target as HTMLElement)?.contentEditable === 'true'

    // ── Escape — always fires regardless of focus ──────────────────────────
    if (key === 'escape') {
      config.onEscape?.()
      return
    }

    // ── Cmd/Ctrl shortcuts — work everywhere ───────────────────────────────
    if (meta) {
      switch (key) {
        case 'k':
          e.preventDefault()
          config.onSearch?.()
          return
        case 'h':
          e.preventDefault()
          config.onGoToDashboard?.()
          return
        case 'g':
          e.preventDefault()
          config.onWizardGenerate?.()
          return
        case 'b':
          if (!isInput) {
            e.preventDefault()
            config.onGoToBoard?.()
          }
          return
        case 'p':
          if (!isInput) {
            e.preventDefault()
            config.onGoToPam?.()
          }
          return
        case 's':
          if (config.onSave) {
            e.preventDefault()
            config.onSave()
          }
          return
        case 'enter':
          e.preventDefault()
          config.onWizardConfirm?.()
          return
      }
    }

    // ── Enter — only fires when inside an input/textarea ──────────────────
    if (key === 'enter' && isInput && !meta) {
      // Shift+Enter = newline — don't intercept
      if (e.shiftKey) return
      // Only intercept if a handler is registered
      if (config.onWizardSend) {
        e.preventDefault()
        config.onWizardSend()
      } else if (config.onPamSend) {
        e.preventDefault()
        config.onPamSend()
      }
    }
  }, [config])

  useEffect(() => {
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handler])
}
