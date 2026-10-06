type TelegramWebApp = {
  initData?: string
  platform?: string
  colorScheme?: 'light' | 'dark'
  ready?: () => void
  expand?: () => void
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  disableVerticalSwipes?: () => void
  enableVerticalSwipes?: () => void
  BackButton?: {
    show: () => void
    hide: () => void
    onClick: (callback: () => void) => void
    offClick: (callback: () => void) => void
  }
  onEvent?: (event: string, callback: () => void) => void
  offEvent?: (event: string, callback: () => void) => void
  safeAreaInset?: { top: number; bottom: number; left: number; right: number }
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number }
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === 'undefined') return null
  return window.Telegram?.WebApp ?? null
}

export function isTelegramMiniApp(): boolean {
  const webApp = getTelegramWebApp()
  return Boolean(webApp?.initData)
}

function applySafeArea(webApp: TelegramWebApp) {
  const root = document.documentElement
  const safe = webApp.contentSafeAreaInset ?? webApp.safeAreaInset
  if (!safe) return

  root.style.setProperty('--tg-safe-top', `${safe.top || 0}px`)
  root.style.setProperty('--tg-safe-bottom', `${safe.bottom || 0}px`)
  root.style.setProperty('--tg-safe-left', `${safe.left || 0}px`)
  root.style.setProperty('--tg-safe-right', `${safe.right || 0}px`)
}

export function initTelegramMiniApp() {
  const webApp = getTelegramWebApp()
  if (!webApp?.initData) return null

  document.documentElement.classList.add('telegram-mini-app')
  document.body.classList.add('telegram-mini-app')

  webApp.ready?.()
  webApp.expand?.()
  webApp.setHeaderColor?.('#111216')
  webApp.setBackgroundColor?.('#111216')
  webApp.disableVerticalSwipes?.()
  applySafeArea(webApp)

  const refreshSafeArea = () => applySafeArea(webApp)
  webApp.onEvent?.('viewportChanged', refreshSafeArea)
  webApp.onEvent?.('safeAreaChanged', refreshSafeArea)
  webApp.onEvent?.('contentSafeAreaChanged', refreshSafeArea)

  return () => {
    webApp.offEvent?.('viewportChanged', refreshSafeArea)
    webApp.offEvent?.('safeAreaChanged', refreshSafeArea)
    webApp.offEvent?.('contentSafeAreaChanged', refreshSafeArea)
    webApp.enableVerticalSwipes?.()
  }
}

export {}
