export default function Loading() {
  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-8 animate-pulse">
      <div className="h-8 w-32 rounded-lg bg-muted" />
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="h-40 rounded-2xl bg-muted" />
      ))}
    </div>
  )
}
