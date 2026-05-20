/** Merge class strings — lightweight alternative to clsx */
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ')
}

/** Anonymous session ID — persists for the browser tab lifetime */
export function getSessionId(): string {
  const KEY = 'ss_sid'
  let id = sessionStorage.getItem(KEY)
  if (!id) {
    id = crypto.randomUUID()
    sessionStorage.setItem(KEY, id)
  }
  return id
}

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit',
  }).format(new Date(iso))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
  }).format(amount)
}
