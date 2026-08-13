import { createHmac, timingSafeEqual } from 'crypto'

export interface SignedRequestPayload {
  user_id?: string
  algorithm?: string
  issued_at?: number
}

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

// Meta's deauthorize and data-deletion callbacks POST a `signed_request` of the
// form "<base64url signature>.<base64url payload>". The signature is
// HMAC-SHA256 of the raw encoded payload string, keyed by the app secret. We
// try each configured app secret (Meta app and Instagram app) so a single
// endpoint can serve both products. Returns the decoded payload only if a
// signature matches, else null.
export function parseSignedRequest(
  signedRequest: string,
  secrets: Array<string | undefined>
): SignedRequestPayload | null {
  const [encodedSig, encodedPayload] = signedRequest.split('.')
  if (!encodedSig || !encodedPayload) return null

  const sig = base64UrlDecode(encodedSig)
  for (const secret of secrets) {
    if (!secret) continue
    const expected = createHmac('sha256', secret).update(encodedPayload).digest()
    if (expected.length === sig.length && timingSafeEqual(expected, sig)) {
      try {
        return JSON.parse(base64UrlDecode(encodedPayload).toString('utf8')) as SignedRequestPayload
      } catch {
        return null
      }
    }
  }
  return null
}
