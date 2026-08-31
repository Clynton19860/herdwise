import Link from "next/link";
import { I } from "@/components/ui/icon";

/**
 * Page navigation for the registers.
 *
 * Links rather than buttons, carrying the page in the URL, so the pages stay
 * server-rendered and a particular page can be shared or bookmarked — and the
 * back button does what it looks like it does.
 *
 * Renders nothing at all when everything fits on one page, which is the state
 * this pilot is in and probably will be for a while.
 */
export function Pager({
  page,
  pageSize,
  total,
  basePath,
  params = {},
}: {
  page: number;
  pageSize: number;
  total: number;
  basePath: string;
  params?: Record<string, string | undefined>;
}) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;

  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) q.set(k, v);
    if (p > 0) q.set("page", String(p + 1));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };

  const first = page * pageSize + 1;
  const last = Math.min((page + 1) * pageSize, total);

  return (
    <nav className="flex items-center justify-between gap-3 px-1" aria-label="Pagination">
      <span className="text-xs text-white/50 tabular-nums">
        {first}–{last} of {total.toLocaleString()}
      </span>
      <span className="flex items-center gap-2">
        {page > 0 ? (
          <Link
            href={href(page - 1)}
            rel="prev"
            className="h-9 px-3 rounded-2xl glass-thin text-sm inline-flex items-center gap-1.5 hover:bg-white/6 transition-colors"
          >
            <I.ArrowRight size={13} className="rotate-180" />
            Previous
          </Link>
        ) : (
          <span className="h-9 px-3 rounded-2xl text-sm inline-flex items-center gap-1.5 text-white/25">
            <I.ArrowRight size={13} className="rotate-180" />
            Previous
          </span>
        )}
        <span className="text-xs text-white/45 tabular-nums px-1">
          {page + 1} / {pages}
        </span>
        {page + 1 < pages ? (
          <Link
            href={href(page + 1)}
            rel="next"
            className="h-9 px-3 rounded-2xl glass-thin text-sm inline-flex items-center gap-1.5 hover:bg-white/6 transition-colors"
          >
            Next
            <I.ArrowRight size={13} />
          </Link>
        ) : (
          <span className="h-9 px-3 rounded-2xl text-sm inline-flex items-center gap-1.5 text-white/25">
            Next
            <I.ArrowRight size={13} />
          </span>
        )}
      </span>
    </nav>
  );
}
