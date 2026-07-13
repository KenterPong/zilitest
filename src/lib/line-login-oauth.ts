export function base64UrlEncodeUtf8(input: string): string {
  const bytes = new TextEncoder().encode(input)
  let bin = ''
  for (let i = 0; i < bytes.length; i += 1) {
    bin += String.fromCharCode(bytes[i]!)
  }
  const b64 = btoa(bin)
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function createLineOAuthState(): string {
  const arr = new Uint8Array(16)
  crypto.getRandomValues(arr)
  const hex = Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('')
  const nonce = hex + Date.now().toString(36)
  return base64UrlEncodeUtf8(JSON.stringify({ nonce }))
}

export function buildLineAuthorizeUrl(state: string): string {
  const clientId = process.env.NEXT_PUBLIC_LINE_CLIENT_ID
  const redirectUri = process.env.NEXT_PUBLIC_LINE_CALLBACK_URL
  if (!clientId || !redirectUri) {
    throw new Error('LINE OAuth env missing')
  }
  const lineParams = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: 'profile openid',
  })
  return `https://access.line.me/oauth2/v2.1/authorize?${lineParams.toString()}`
}

export function preferManualLineLoginNavigation(userAgent: string): boolean {
  const u = userAgent
  return (
    /\bLine\//i.test(u) ||
    /\bFBAN\b/i.test(u) ||
    /\bFBAV\b/i.test(u) ||
    /\bInstagram\b/i.test(u)
  )
}
