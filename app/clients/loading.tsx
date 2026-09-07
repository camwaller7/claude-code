export default function Loading() {
  return (
    <div className="animate-pulse flex flex-col gap-3">
      <div className="h-8 w-40 rounded-lg bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-20 rounded-lg bg-muted" />
      ))}
    </div>
  )
}
