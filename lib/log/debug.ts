// Gated diagnostic logging for the Meta integration.
//
// The webhook and reply paths need verbose logging while we debug delivery and
// the Dev-Mode capability gate — but those lines print Meta USER DATA (raw
// webhook payloads, message text, contact names, sender IDs). Writing that to
// server logs by default is a data-handling concern under Meta's Platform
// Terms and a likely App Review flag. Route all such logging through here so it
// is OFF unless META_DEBUG_LOGGING is explicitly set to 'true' in the env.
export function metaDebug(...args: unknown[]): void {
  if (process.env.META_DEBUG_LOGGING === 'true') {
    console.log(...args)
  }
}
