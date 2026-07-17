export const metadata = {
  title: 'Privacy Policy — Corvelle',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-muted-foreground">Effective date: January 1, 2026 · Last updated: January 1, 2026</p>

      <p className="mb-4">
        This Privacy Policy explains how Corvelle (&quot;the App,&quot; &quot;we,&quot; &quot;us&quot;) collects,
        uses, stores, and protects information when the App is used to connect to and manage
        social media and email accounts. It applies to the App&apos;s owner and to any individual whose
        information passes through the App as a result of messaging or interacting with the
        owner&apos;s connected accounts (for example, someone who sends the owner a direct message).
      </p>
      <p className="mb-4">
        Corvelle is a single-owner application. It is not a public service, does not accept
        public account sign-up, and is not intended for use by anyone other than its owner.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">1. Who we are</h2>
      <p className="mb-4">
        Corvelle is operated by an individual creator. For any question about this policy or
        the data described in it, contact: <strong>cambswaller7@gmail.com</strong>.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">2. Information we collect</h2>
      <p className="mb-2">
        The App only accesses data from a platform after its owner explicitly authorizes the
        connection through that platform&apos;s own OAuth consent screen. The categories of data
        collected, by source, are:
      </p>
      <table className="mb-4 w-full border-collapse text-left text-xs">
        <thead>
          <tr className="border-b">
            <th className="py-2 pr-3 font-semibold">Source</th>
            <th className="py-2 pr-3 font-semibold">Data collected</th>
            <th className="py-2 font-semibold">Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b align-top">
            <td className="py-2 pr-3">Instagram (Business Login)</td>
            <td className="py-2 pr-3">Account ID/username; direct messages sent and received by the connected account; comments on the connected account&apos;s posts</td>
            <td className="py-2">Unified inbox, AI-assisted reply drafting, comment management</td>
          </tr>
          <tr className="border-b align-top">
            <td className="py-2 pr-3">Facebook Page</td>
            <td className="py-2 pr-3">Page ID; Page messages; basic Page engagement metrics (follower count, post views/interactions)</td>
            <td className="py-2">Unified inbox, content publishing, analytics dashboard</td>
          </tr>
          <tr className="border-b align-top">
            <td className="py-2 pr-3">Threads</td>
            <td className="py-2 pr-3">Account ID/username; publishing authorization (no message data — Threads has no direct-message API)</td>
            <td className="py-2">Content publishing</td>
          </tr>
          <tr className="border-b align-top">
            <td className="py-2 pr-3">X (Twitter)</td>
            <td className="py-2 pr-3">Account ID; direct messages sent and received; tweet publishing authorization</td>
            <td className="py-2">Unified inbox, content publishing</td>
          </tr>
          <tr className="border-b align-top">
            <td className="py-2 pr-3">Gmail</td>
            <td className="py-2 pr-3">Email messages relevant to brand inquiries</td>
            <td className="py-2">Unified inbox, AI-assisted reply drafting</td>
          </tr>
          <tr className="align-top">
            <td className="py-2 pr-3">Entered directly by the owner</td>
            <td className="py-2 pr-3">Brand-deal records, client/course-buyer profiles, scheduled post content, account credentials</td>
            <td className="py-2">CRM, content scheduling, authentication</td>
          </tr>
        </tbody>
      </table>
      <p className="mb-4">
        We do not collect information from any Meta or other platform account beyond what is
        described above, and we do not collect data about people who have not interacted with the
        owner&apos;s connected accounts.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">3. How we use information</h2>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>To display messages and comments from all connected platforms in a single inbox.</li>
        <li>
          To generate suggested message categorizations and draft replies using an AI language
          model (Anthropic Claude, or another provider the owner selects). Message content sent
          to the AI provider is used solely to produce that suggestion for the current message —
          it is not used to train any model, and no message content is retained by the AI
          provider beyond what is necessary to generate the response.
        </li>
        <li>
          To send replies back to the originating platform. Every outgoing message requires the
          owner&apos;s explicit review and action — the App never sends a message automatically
          without the owner initiating the send.
        </li>
        <li>To schedule and publish content to connected platforms at the owner&apos;s direction.</li>
        <li>To display engagement and audience analytics on the owner&apos;s dashboard.</li>
        <li>To maintain a security audit log of sign-ins and sensitive account actions.</li>
      </ul>

      <h2 className="mb-2 mt-10 text-lg font-semibold">4. How we store and protect information</h2>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>All data is stored in a Supabase (PostgreSQL) database with row-level security restricting every table to the App owner only.</li>
        <li>OAuth access and refresh tokens are encrypted at rest (AES-256-GCM) before storage, using an encryption key held separately from the database credentials.</li>
        <li>All network traffic between the App, its database, and connected platform APIs is encrypted in transit via TLS/HTTPS.</li>
        <li>The App enforces a single authorized owner account at both the application and database layer; no other account can read or write App data.</li>
        <li>Sensitive account actions (sign-ins, password changes, platform connections) are recorded in a security audit log visible only to the owner.</li>
      </ul>

      <h2 className="mb-2 mt-10 text-lg font-semibold">5. How we share information</h2>
      <p className="mb-4">
        We do not sell, rent, or share personal information with third parties for advertising or
        marketing purposes. Information is shared only in the following limited circumstances:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>With the AI provider selected by the owner, solely to generate message categorization and draft replies, as described in Section 3.</li>
        <li>With the originating platform (Instagram, Facebook, Threads, X, or Gmail) when the owner sends a reply or publishes content, as an inherent function of that action.</li>
        <li>Where required to comply with a legal obligation, or to protect the rights, property, or safety of the App owner or others.</li>
      </ul>
      <p className="mb-4">We do not use data obtained through Meta&apos;s Platform for any purpose other than to provide and improve the App&apos;s own features, and we do not sell data obtained from Meta&apos;s Platform.</p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">6. Data retention</h2>
      <p className="mb-4">
        Data is retained for as long as the associated platform connection remains active and the
        App continues to operate. Disconnecting a platform (see Section 8) stops further data
        collection from it; previously synced data is deleted on request as described in the{' '}
        <a href="/data-deletion" className="underline">Data Deletion Instructions</a>.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">7. Children&apos;s privacy</h2>
      <p className="mb-4">
        The App is not directed to, and does not knowingly collect information from, anyone under
        the age of 16. It is a single-owner tool operated by an adult creator for their own
        business use.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">8. Your rights and choices</h2>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>The App owner can disconnect any connected platform at any time from the App&apos;s settings, which immediately stops further data access from that platform.</li>
        <li>Anyone can revoke the App&apos;s access directly from the connected platform&apos;s own account settings (see the Data Deletion Instructions page for exact steps per platform).</li>
        <li>Requests for access to, correction of, or deletion of data described in this policy can be made at any time — see Section 9.</li>
      </ul>

      <h2 className="mb-2 mt-10 text-lg font-semibold">9. Requesting deletion</h2>
      <p className="mb-4">
        See the <a href="/data-deletion" className="underline">Data Deletion Instructions</a> page
        for how to revoke platform access or request full deletion of stored data.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">10. Changes to this policy</h2>
      <p className="mb-4">
        We may update this policy as the App&apos;s functionality changes. Material changes will
        update the &quot;Last updated&quot; date above. Continued use of the App after a change constitutes
        acceptance of the updated policy.
      </p>

      <h2 className="mb-2 mt-10 text-lg font-semibold">11. Contact</h2>
      <p className="mb-4">
        Questions about this policy or how information is handled: cambswaller7@gmail.com.
      </p>
    </div>
  )
}
