export const LINE_OAUTH_STATE_COOKIE_NAME = 'line_oauth_state'
const MAX_AGE_SEC = 600

export function lineOAuthStateCookieDomain(hostname: string): string | undefined {
  const host = hostname.split(':')[0].toLowerCase()
  const fromEnv = process.env.NEXT_PUBLIC_AUTH_COOKIE_DOMAIN?.trim()
  if (fromEnv) return fromEnv

  if (host === 'lvh.me' || host.endsWith('.lvh.me')) return '.lvh.me'

  const root = process.env.NEXT_PUBLIC_ROOT_DOMAIN?.trim().toLowerCase()
  if (root && host !== 'localhost' && host !== '127.0.0.1' && !host.endsWith('.vercel.app')) {
    const onThisRoot =
      host === root || host === `www.${root}` || host.endsWith(`.${root}`)
    if (onThisRoot) return `.${root}`
  }

  return undefined
}

function cookieDomainAttr(): string {
  if (typeof window === 'undefined') return ''
  const d = lineOAuthStateCookieDomain(window.location.hostname)
  return d ? `; domain=${d}` : ''
}

export function persistLineOAuthState(state: string) {
  if (typeof window === 'undefined') return
  sessionStorage.setItem('line_oauth_state', state)
  const domain = cookieDomainAttr()
  document.cookie = `${LINE_OAUTH_STATE_COOKIE_NAME}=${encodeURIComponent(state)}; path=/; max-age=${MAX_AGE_SEC}; SameSite=Lax${domain}`
}

export function readLineOAuthState(): string | null {
  if (typeof document === 'undefined') return null
  const m = document.cookie.match(
    new RegExp(`(?:^|; )${LINE_OAUTH_STATE_COOKIE_NAME}=([^;]*)`),
  )
  const fromCookie = m ? decodeURIComponent(m[1]) : null
  if (fromCookie) return fromCookie
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem('line_oauth_state')
  }
  return null
}

export function clearLineOAuthState() {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem('line_oauth_state')
  const domain = cookieDomainAttr()
  document.cookie = `${LINE_OAUTH_STATE_COOKIE_NAME}=; path=/; max-age=0${domain}`
}
