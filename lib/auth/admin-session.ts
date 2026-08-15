import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'

/**
 * The admin session: one shared password, checked server-side, exchanged for a
 * signed cookie.
 *
 * The cookie carries nothing but its own expiry and a signature over it. There is
 * no session store to keep, and rotating ADMIN_SESSION_SECRET signs everyone out.
 */

const COOKIE_NAME = 'ds-quiz-admin'
const SESSION_HOURS = 12

function readSecret(): string {
  const secret = process.env.ADMIN_SESSION_SECRET
  if (!secret || secret.length < 32) {
    throw new Error(
      'ADMIN_SESSION_SECRET is missing or too short. Generate one with:\n' +
        '  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    )
  }
  return secret
}

function readPassword(): string {
  const password = process.env.ADMIN_PASSWORD
  if (!password) throw new Error('ADMIN_PASSWORD is not set, so /admin cannot be opened at all.')
  return password
}

function sign(payload: string): string {
  return createHmac('sha256', readSecret()).update(payload).digest('base64url')
}

/** Compares without leaking, through the length, how much of a guess was right. */
function constantTimeEquals(a: string, b: string): boolean {
  const left = createHmac('sha256', readSecret()).update(a).digest()
  const right = createHmac('sha256', readSecret()).update(b).digest()
  return timingSafeEqual(left, right)
}

function issueToken(): string {
  const expiresAt = Date.now() + SESSION_HOURS * 3_600_000
  // A nonce so two sessions issued in the same millisecond are still distinct.
  const payload = `${expiresAt}.${randomBytes(8).toString('base64url')}`
  return `${payload}.${sign(payload)}`
}

function verifyToken(token: string): boolean {
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const payload = `${parts[0]}.${parts[1]}`
  if (!constantTimeEquals(parts[2], sign(payload))) return false

  const expiresAt = Number(parts[0])
  return Number.isFinite(expiresAt) && expiresAt > Date.now()
}

/**
 * Best-effort brute force slowdown. Module state does not survive a cold start on
 * serverless, so this is a speed bump rather than a lock — enough to make guessing
 * a shared internal password over the network impractical, not enough to rely on
 * as the only defence.
 */
const attempts = new Map<string, { count: number; firstAt: number }>()
const ATTEMPT_WINDOW_MS = 10 * 60_000
const MAX_ATTEMPTS = 10

function tooManyAttempts(key: string): boolean {
  const record = attempts.get(key)
  if (!record) return false
  if (Date.now() - record.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(key)
    return false
  }
  return record.count >= MAX_ATTEMPTS
}

function recordAttempt(key: string): void {
  const record = attempts.get(key)
  if (!record || Date.now() - record.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() })
    return
  }
  record.count += 1
}

export type SignInResult = { ok: true } | { ok: false; reason: 'wrong' | 'throttled' }

export async function signIn(password: string, clientKey = 'shared'): Promise<SignInResult> {
  if (tooManyAttempts(clientKey)) return { ok: false, reason: 'throttled' }

  if (!constantTimeEquals(password, readPassword())) {
    recordAttempt(clientKey)
    return { ok: false, reason: 'wrong' }
  }

  attempts.delete(clientKey)
  const store = await cookies()
  store.set(COOKIE_NAME, issueToken(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_HOURS * 3_600,
  })
  return { ok: true }
}

export async function signOut(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}

export async function isSignedIn(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value
  return token ? verifyToken(token) : false
}
