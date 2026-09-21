const UNDO_DELAY_MS = 5000

export interface UndoableDeleteOptions {
  /** Shown in the toast while the undo window is open, e.g. "Auto zostanie usunięte." */
  message: string
  /** Performs the actual deletion once the undo window has passed without being cancelled. */
  onCommit: () => Promise<void>
  /** Runs when the delete is cancelled — by "Cofnij" or because onCommit threw — to roll back any optimistic UI change. */
  onCancel?: () => void
}

/**
 * Delays a delete behind a toast offering "Cofnij", so a confirmed-but-accidental
 * click can still be undone before it reaches the database. Closing the toast
 * without clicking "Cofnij" lets the delete go through as scheduled.
 */
export function useUndoableDelete() {
  const toast = useToast()

  function scheduleDelete({ message, onCommit, onCancel }: UndoableDeleteOptions) {
    let cancelled = false

    const timer = setTimeout(async () => {
      if (cancelled) return
      try {
        await onCommit()
      } catch {
        onCancel?.()
        toast.add({
          title: 'Nie udało się usunąć. Spróbuj ponownie.',
          color: 'error',
          icon: 'i-lucide-triangle-alert'
        })
      }
    }, UNDO_DELAY_MS)

    toast.add({
      title: message,
      icon: 'i-lucide-trash-2',
      duration: UNDO_DELAY_MS,
      actions: [{
        label: 'Cofnij',
        color: 'neutral',
        variant: 'outline',
        onClick: () => {
          cancelled = true
          clearTimeout(timer)
          onCancel?.()
        }
      }]
    })
  }

  return { scheduleDelete }
}
