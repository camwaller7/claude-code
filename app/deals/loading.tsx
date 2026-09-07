export default function Loading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-8 w-48 rounded-lg bg-muted" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="h-24 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  )
}
