export const metadata = {
  title: 'Terms of Service — Influencer PA',
}

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-bold">Terms of Service</h1>
      <p className="mb-8 text-muted-foreground">Effective date: January 1, 2026 · Last updated: January 1, 2026</p>

      <p className="mb-4">
        These Terms of Service (&quot;Terms&quot;) govern access to and use of Influencer PA (&quot;the App&quot;).
        By accessing or using the App, you agree to be bound by these Terms and by the{' '}
        <a href="/privacy" className="underline">Privacy Policy</a>, which is incorporated by
        reference. If you do not agree, do not use the App.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">1. About the App</h2>
      <p className="mb-4">
        Influencer PA is a private productivity tool built and operated by its owner for personal
        use managing their own social media accounts, inbox, brand deals, client relationships,
        and content scheduling. The App is not offered as a public service, does not accept
        public account sign-up, and access is restricted to its owner.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">2. Eligibility and access</h2>
      <p className="mb-4">
        Access to the App is restricted to a single authorized owner account, enforced at both
        the application and database level. Any attempt to access the App from an unauthorized
        account is denied and logged. The App owner is responsible for maintaining the
        confidentiality of their login credentials.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">3. Connected platforms</h2>
      <p className="mb-4">
        The App connects to third-party platforms (Instagram, Facebook, Threads, X, Gmail) using
        each platform&apos;s official API and the owner&apos;s own OAuth authorization. Use of the App is
        also subject to the terms of service, developer policies, and platform terms of each
        connected platform, including Meta&apos;s Platform Terms and Developer Policies where
        applicable. The App owner is responsible for complying with those third-party terms when
        using the App to interact with a connected platform.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">4. Acceptable use</h2>
      <p className="mb-2">The App may not be used to:</p>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>Send unsolicited bulk messages, spam, or messages outside the messaging policies of a connected platform.</li>
        <li>Attempt to access, connect, or authenticate an account that does not belong to the App owner.</li>
        <li>Circumvent, disable, or interfere with the App&apos;s security features or access controls.</li>
        <li>Violate any applicable law or the terms of service of a connected platform.</li>
      </ul>

      <h2 className="mb-2 mt-10 text-lg font-semibold">5. AI-generated content</h2>
      <p className="mb-4">
        The App uses an AI language model to suggest message categorizations and draft replies.
        These are suggestions only. The App owner reviews and explicitly approves every outgoing
        message before it is sent — the App does not send AI-generated content automatically. The
        App owner is responsible for the content of any message they choose to send.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">6. Intellectual property</h2>
      <p className="mb-4">
        The App and its underlying software are the property of its owner/developer. Content the
        owner creates or uploads through the App (captions, images, business records) remains
        their property.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">7. Disclaimer of warranty</h2>
      <p className="mb-4">
        The App is provided &quot;as is&quot; and &quot;as available,&quot; without warranty of any kind, express or
        implied, including without limitation warranties of merchantability, fitness for a
        particular purpose, or non-infringement. The App is under active development and its
        features may change.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">8. Limitation of liability</h2>
      <p className="mb-4">
        To the maximum extent permitted by law, in no event will the App&apos;s owner/developer be
        liable for any indirect, incidental, special, consequential, or punitive damages arising
        from or related to use of the App, including damages resulting from a connected
        platform&apos;s own action (such as suspending an account or rejecting a message) beyond the
        App&apos;s control.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">9. Termination</h2>
      <p className="mb-4">
        The App owner may disconnect any platform, delete data, or discontinue the App at any
        time. Access may be suspended immediately (via the Maintenance Mode control) if a
        security issue is suspected.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">10. Changes to these Terms</h2>
      <p className="mb-4">
        These Terms may be updated as the App&apos;s functionality changes. Material changes will
        update the &quot;Last updated&quot; date above and require re-acceptance before continued use.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">11. Contact</h2>
      <p className="mb-4">Questions about these Terms: cambswaller7@gmail.com.</p>
    </div>
  )
}
