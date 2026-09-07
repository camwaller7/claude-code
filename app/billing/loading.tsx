export default function Loading() {
  return (
    <div className="mx-auto max-w-4xl py-10 animate-pulse flex flex-col gap-6">
      <div className="mx-auto h-8 w-56 rounded-lg bg-muted" />
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-80 rounded-2xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
