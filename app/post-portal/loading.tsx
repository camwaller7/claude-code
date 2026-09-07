export default function Loading() {
  return (
    <div className="animate-pulse flex flex-col gap-3">
      <div className="h-8 w-44 rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  )
}
