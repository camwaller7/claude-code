export const metadata = {
  title: 'Data Deletion Instructions — Corvelle',
}

export default function DataDeletionPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-16 text-sm leading-relaxed text-foreground">
      <h1 className="mb-2 text-2xl font-bold">Data Deletion Instructions</h1>
      <p className="mb-8 text-muted-foreground">Last updated: 2026</p>

      <p className="mb-4">
        Corvelle is a single-owner application with no public sign-up — the only account
        with access to the App, and the only data it stores, belongs to its owner. If you are the
        owner and want to delete data associated with a connected platform account, or if you
        believe your data was connected to this App in error, use either method below.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Option 1 — Revoke access from the platform directly</h2>
      <p className="mb-4">
        You can immediately revoke the App&apos;s access to your account from the connected
        platform&apos;s own settings:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-6">
        <li>
          <strong>Instagram / Facebook:</strong> Facebook Settings → Apps and Websites → find
          &quot;Corvelle&quot; → Remove.
        </li>
        <li>
          <strong>Threads:</strong> Threads Settings → Apps and Websites → find &quot;Corvelle&quot; →
          Remove.
        </li>
        <li>
          <strong>X (Twitter):</strong> X Settings → Security and account access → Apps and
          sessions → find &quot;Corvelle&quot; → Revoke access.
        </li>
        <li>
          <strong>Gmail:</strong> Google Account → Security → Third-party apps with account
          access → find &quot;Corvelle&quot; → Remove access.
        </li>
      </ul>
      <p className="mb-4">
        Revoking access this way immediately invalidates the App&apos;s stored access token for that
        platform, preventing any further access.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">Option 2 — Request deletion directly</h2>
      <p className="mb-4">
        Email cambswaller7@gmail.com with the subject line &quot;Data Deletion Request&quot; and specify
        which platform&apos;s data you want deleted (or &quot;all&quot;). All corresponding stored data —
        including cached messages, access tokens, and associated business records — will be
        permanently deleted within 30 days, and you will receive email confirmation once
        complete.
      </p>

      <h2 className="mb-2 mt-8 text-lg font-semibold">What gets deleted</h2>
      <p className="mb-4">
        Deletion removes the stored OAuth token for the specified platform, any messages/
        conversations synced from that platform, and any engagement metrics pulled from it.
        Business records the owner created manually (e.g. brand deal notes) that reference but do
        not contain platform data are not automatically deleted unless specifically requested.
      </p>
    </div>
  )
}
