'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type DialogState =
  | {
      mode: 'alert'
      title?: string
      message: string
      resolve: () => void
    }
  | {
      mode: 'confirm'
      title?: string
      message: string
      resolve: (ok: boolean) => void
      confirmLabel?: string
      danger?: boolean
    }
  | null

interface AppDialogApi {
  alert: (message: string, title?: string) => Promise<void>
  confirm: (
    message: string,
    options?: { title?: string; confirmLabel?: string; danger?: boolean }
  ) => Promise<boolean>
}

const AppDialogContext = createContext<AppDialogApi | null>(null)

export function AppDialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null)
  const idRef = useRef(0)

  const alert = useCallback((message: string, title = '提示') => {
    return new Promise<void>((resolve) => {
      idRef.current += 1
      setDialog({ mode: 'alert', title, message, resolve })
    })
  }, [])

  const confirm = useCallback(
    (
      message: string,
      options?: { title?: string; confirmLabel?: string; danger?: boolean }
    ) => {
      return new Promise<boolean>((resolve) => {
        idRef.current += 1
        setDialog({
          mode: 'confirm',
          title: options?.title ?? '請確認',
          message,
          resolve,
          confirmLabel: options?.confirmLabel,
          danger: options?.danger,
        })
      })
    },
    []
  )

  const api = useMemo(() => ({ alert, confirm }), [alert, confirm])

  function closeAlert() {
    if (dialog?.mode === 'alert') {
      const r = dialog.resolve
      setDialog(null)
      r()
    }
  }

  function closeConfirm(ok: boolean) {
    if (dialog?.mode === 'confirm') {
      const r = dialog.resolve
      setDialog(null)
      r(ok)
    }
  }

  return (
    <AppDialogContext.Provider value={api}>
      {children}
      {dialog && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/45 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-cream border border-line rounded-lg shadow-2xl w-full max-w-sm overflow-hidden animate-in">
            <div className="px-5 pt-5 pb-2">
              <div className="font-mono text-[10px] tracking-widest text-stamp-red mb-2">
                字力測驗
              </div>
              <h2 className="font-serif font-bold text-lg text-ink mb-2">
                {dialog.title}
              </h2>
              <p className="text-sm text-ink-soft leading-relaxed whitespace-pre-wrap">
                {dialog.message}
              </p>
            </div>
            <div className="flex justify-end gap-2 px-5 py-4 bg-paper-deep/60 border-t border-line">
              {dialog.mode === 'confirm' && (
                <button
                  type="button"
                  onClick={() => closeConfirm(false)}
                  className="border border-line bg-cream text-sm px-4 py-2 rounded-sm hover:border-ink"
                >
                  取消
                </button>
              )}
              <button
                type="button"
                autoFocus
                onClick={() =>
                  dialog.mode === 'alert' ? closeAlert() : closeConfirm(true)
                }
                className={`text-sm font-semibold px-5 py-2 rounded-sm text-cream ${
                  dialog.mode === 'confirm' && dialog.danger
                    ? 'bg-stamp-red hover:bg-stamp-red-deep'
                    : 'bg-ink hover:bg-stamp-red-deep'
                }`}
              >
                {dialog.mode === 'alert'
                  ? '確定'
                  : dialog.confirmLabel ?? '確定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppDialogContext.Provider>
  )
}

export function useAppDialog(): AppDialogApi {
  const ctx = useContext(AppDialogContext)
  if (!ctx) {
    throw new Error('useAppDialog must be used within AppDialogProvider')
  }
  return ctx
}
