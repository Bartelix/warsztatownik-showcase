const DISMISSED_KEY = 'warsztatownik:install-prompt-dismissed'

/** iOS Safari has no `beforeinstallprompt` — the only way to reach "Add to Home Screen" is the Share sheet, so we point to it ourselves. */
export function useIosInstallPrompt() {
  const visible = useState('ios-install-prompt-visible', () => false)

  onMounted(() => {
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent) && !('MSStream' in window)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
      || (navigator as Navigator & { standalone?: boolean }).standalone === true
    const dismissed = localStorage.getItem(DISMISSED_KEY) === '1'

    visible.value = isIos && !isStandalone && !dismissed
  })

  function dismiss() {
    visible.value = false
    localStorage.setItem(DISMISSED_KEY, '1')
  }

  return { visible, dismiss }
}
