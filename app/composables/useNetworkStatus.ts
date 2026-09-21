/** Shared across the app via `useState` — one `online`/`offline` listener pair is enough. */
export function useNetworkStatus() {
  const isOnline = useState('network-online', () => true)

  function update() {
    isOnline.value = navigator.onLine
  }

  onMounted(() => {
    update()
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
  })

  onUnmounted(() => {
    window.removeEventListener('online', update)
    window.removeEventListener('offline', update)
  })

  return { isOnline }
}
