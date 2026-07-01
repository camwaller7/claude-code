export default function Loading() {
  return (
    <div className="flex flex-col gap-3 animate-pulse p-1">
      <div className="h-8 w-48 rounded-lg bg-muted" />
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-16 rounded-lg bg-muted" />
      ))}
    </div>
  )
}
