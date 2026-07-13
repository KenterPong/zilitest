import 'server-only'
import { Buffer } from 'node:buffer'
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceRoleKeyRaw = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url) {
  throw new Error('Missing env: NEXT_PUBLIC_SUPABASE_URL')
}

function jwtPayloadRole(key: string): string | null {
  try {
    const parts = key.trim().split('.')
    if (parts.length < 2) return null
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4))
    b64 += pad
    const json = Buffer.from(b64, 'base64').toString('utf8')
    const p = JSON.parse(json) as { role?: string }
    return typeof p.role === 'string' ? p.role : null
  } catch {
    return null
  }
}

function isPlausibleServiceRoleKey(key: string): boolean {
  const t = key.trim()
  if (t.startsWith('sb_secret_')) return true
  if (!t.startsWith('eyJ')) return false
  return jwtPayloadRole(t) === 'service_role'
}

const serviceRoleKey = (serviceRoleKeyRaw ?? '').trim()
if (!isPlausibleServiceRoleKey(serviceRoleKey)) {
  const r = serviceRoleKey.startsWith('eyJ') ? jwtPayloadRole(serviceRoleKey) : null
  const hint =
    r === 'anon' || r === 'authenticated'
      ? '偵測到 JWT 的 role 為 anon／authenticated，請改放 service_role 金鑰。'
      : '請設定有效的 SUPABASE_SERVICE_ROLE_KEY。'
  throw new Error(`Missing/invalid env: SUPABASE_SERVICE_ROLE_KEY。${hint}`)
}

export const supabaseAdmin = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
