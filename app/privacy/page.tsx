export const metadata = {
  title: 'Privacy Policy — Influencer PA',
}

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-bold">Privacy Policy</h1>
      <p className="mb-8 text-muted-foreground">Last updated: 2026</p>

      <p className="mb-4">
        Influencer PA (&quot;the App&quot;) is a personal productivity tool built and operated by a
        single individual creator for their own use, managing their own social media accounts,
        inbox, brand deals, and content scheduling. The App is not a public, multi-user service —
        access is restricted to its owner. This policy explains what data the App accesses, how
        it is used, and how it is protected.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Who operates this app</h2>
      <p className="mb-4">
        This App is operated by an individual creator. Contact: cambswaller7@gmail.com.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">What data the App accesses</h2>
      <p className="mb-2">
        With the owner&apos;s explicit authorization via OAuth, the App connects to and reads/writes
        data from the following platforms, solely for the owner&apos;s own connected accounts:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>
          <strong>Instagram (via Instagram API with Business Login):</strong> direct messages sent
          to and from the connected Instagram professional account, and comments, so the owner can
          view and reply to them in one place.
        </li>
        <li>
          <strong>Facebook (via a connected Facebook Page):</strong> Page messages, to view and
          reply to them, and to publish content to the Page.
        </li>
        <li>
          <strong>Threads:</strong> permission to publish content on the owner&apos;s behalf.
        </li>
        <li>
          <strong>X (Twitter):</strong> direct messages and the ability to post tweets on the
          owner&apos;s behalf.
        </li>
        <li>
          <strong>Gmail:</strong> email messages, to view and reply to brand inquiries.
        </li>
      </ul>
      <p className="mb-4">
        The App also stores business records the owner enters directly: brand-deal details,
        client/course-buyer profiles, scheduled posts, and basic engagement metrics (follower
        counts, post views/interactions) pulled from the connected accounts for the owner&apos;s own
        dashboard.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">How data is used</h2>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>Displaying messages from all connected platforms in a single inbox view.</li>
        <li>
          Using an AI language model (Anthropic Claude, or another provider the owner selects) to
          categorize incoming messages and draft suggested replies. Message content is sent to
          the selected AI provider&apos;s API solely to generate this categorization/draft; it is not
          used by the App to train any model.
        </li>
        <li>Sending replies back out to the originating platform, at the owner&apos;s explicit action.</li>
        <li>Scheduling and publishing content to connected platforms at the owner&apos;s direction.</li>
        <li>Displaying engagement/analytics data on the owner&apos;s own dashboard.</li>
      </ul>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Data storage and security</h2>
      <p className="mb-4">
        Data is stored in a Supabase (PostgreSQL) database with row-level security policies
        restricting all access to the App owner only. OAuth access and refresh tokens are
        encrypted at rest before storage. All connections to the App and to connected platform
        APIs use HTTPS/TLS. The App is not accessible to any user other than its owner — there is
        no public sign-up.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Data sharing</h2>
      <p className="mb-4">
        Data is not sold, rented, or shared with third parties for advertising or marketing
        purposes. Message content is shared only with the AI provider selected by the owner
        (e.g. Anthropic), solely to generate categorization and draft replies, and with the
        originating platform itself when a reply is sent.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Data retention and deletion</h2>
      <p className="mb-4">
        Data is retained for as long as the owner continues to operate the App. The owner can
        disconnect any platform at any time, which stops further data collection from that
        platform. See the{' '}
        <a href="/data-deletion" className="underline">
          Data Deletion Instructions
        </a>{' '}
        page for how to request deletion of stored data.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Changes to this policy</h2>
      <p className="mb-4">
        This policy may be updated as the App&apos;s functionality changes. Continued use of the App
        after a change constitutes acceptance of the updated policy.
      </p>
    </div>
  )
}
