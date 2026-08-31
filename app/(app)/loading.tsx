/**
 * Shown while a page waits on the database.
 *
 * Every page here reads live data from Supabase in Ireland, so a navigation
 * could sit for a second or more with nothing on screen changing — the old page
 * simply stayed put until the new one was ready, which reads as a dead click.
 *
 * Deliberately a shape, not a spinner: the skeleton occupies the same geometry
 * the real page will, so arriving content settles into place rather than
 * shifting the layout under a reader. `animate-pulse` is the only motion, and
 * the reduced-motion rule in globals.css stops even that.
 */
export default function Loading() {
  return (
    <div className="space-y-4 sm:space-y-5 lg:space-y-6 animate-pulse" aria-hidden>
      {/* Topbar */}
      <div className="glass rounded-3xl h-[76px] sm:h-[84px]" />

      {/* Metric strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="glass rounded-3xl h-[180px] sm:h-[210px]" />
        ))}
      </div>

      {/* Main panel beside a rail */}
      <div className="grid lg:grid-cols-3 gap-4 lg:gap-5">
        <div className="glass rounded-3xl lg:col-span-2 h-[420px]" />
        <div className="space-y-4 lg:space-y-5">
          <div className="glass rounded-3xl h-[200px]" />
          <div className="glass rounded-3xl h-[204px]" />
        </div>
      </div>

      <span className="sr-only" aria-live="polite">Loading</span>
    </div>
  );
}
