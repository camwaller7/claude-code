export const metadata = {
  title: 'Terms of Service — Influencer PA',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-muted-foreground">Last updated: 2026</p>

      <p className="mb-4">
        Influencer PA (&quot;the App&quot;) is a private productivity tool built and operated by its
        owner for personal use managing their own social media accounts, inbox, brand deals, and
        content scheduling. The App is not offered as a public service and does not accept public
        sign-ups.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Access</h2>
      <p className="mb-4">
        Access to the App is restricted to its owner. Any request to access the App from any
        other account is denied at both the application and database level.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Use of connected platforms</h2>
      <p className="mb-4">
        The App connects to third-party platforms (Instagram, Facebook, Threads, X, Gmail) via
        each platform&apos;s official API and the owner&apos;s own OAuth authorization. Use of the App is
        also subject to the terms of service of each connected platform, including Meta&apos;s
        Platform Terms and Developer Policies.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">AI-generated content</h2>
      <p className="mb-4">
        The App uses AI language models to suggest message categorizations and draft replies.
        These are suggestions only — the owner reviews and approves all outgoing messages before
        they are sent. The App does not send AI-generated content automatically without the
        owner&apos;s action.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">No warranty</h2>
      <p className="mb-4">
        The App is provided as-is, without warranty of any kind, and is under active development.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Contact</h2>
      <p className="mb-4">Questions about these terms: cambswaller7@gmail.com.</p>
    </div>
  )
}
