"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { I } from "@/components/ui/icon";
import { Markdown } from "@/components/ai/markdown";

type Role = "user" | "assistant";

type ToolEvent = {
  id: string;
  name: string;
  status: "running" | "done" | "error";
  error?: string;
};

type ChatTurn = {
  role: Role;
  text: string;
  /** Tool events that fired while generating this assistant turn. */
  tools?: ToolEvent[];
  /** Navigation suggestions Claude emitted during this turn. */
  navs?: { href: string; label: string }[];
};

const toolLabels: Record<string, string> = {
  search_animals: "Searching livestock registry",
  get_animal: "Loading animal record",
  search_owners: "Searching owners",
  get_owner: "Loading owner profile",
  list_geofences: "Listing geofences",
  get_geofence: "Loading geofence",
  list_incidents: "Listing incidents",
  get_incident: "Loading incident",
  platform_overview: "Computing platform overview",
  navigate: "Preparing navigation",
};

const SUGGESTIONS: { icon: React.ReactNode; text: string }[] = [
  { icon: <I.Alert size={14} />, text: "Which animals need attention right now?" },
  { icon: <I.Map size={14} />,   text: "What's happening in Kuwadzana today?" },
  { icon: <I.Cow size={14} />,   text: "Show me HRE-CTL-00184" },
  { icon: <I.Activity size={14} />, text: "Give me a 30-second platform overview" },
];

export function AskHerdwise() {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [pending, setPending] = useState(false);
  const [thinking, setThinking] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Body scroll lock when open on mobile
  useEffect(() => {
    if (!open) return;
    const original = document.body.style.overflow;
    if (window.innerWidth < 768) document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // Open with Cmd/Ctrl-J
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Auto-scroll to bottom on new content
  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, pending]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || pending) return;

    const next: ChatTurn[] = [
      ...turns,
      { role: "user", text: trimmed },
      { role: "assistant", text: "", tools: [], navs: [] },
    ];
    setTurns(next);
    setInput("");
    setPending(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          currentPath: pathname,
          messages: next.slice(0, -1).map((t) => ({ role: t.role, content: t.text })),
        }),
      });

      if (!resp.body) throw new Error("No response body");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // SSE parse: split on blank lines
        const chunks = buffer.split("\n\n");
        buffer = chunks.pop() ?? "";

        for (const chunk of chunks) {
          if (!chunk.startsWith("data:")) continue;
          const payload = chunk.slice(5).trim();
          if (!payload) continue;

          try {
            const evt = JSON.parse(payload) as Record<string, unknown>;
            applyEvent(evt);
          } catch {
            // ignore malformed
          }
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        // user cancelled — leave existing partial in place
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setTurns((prev) => {
          const copy = [...prev];
          const last = copy[copy.length - 1];
          if (last && last.role === "assistant") {
            last.text =
              (last.text ? last.text + "\n\n" : "") +
              `_Sorry — I hit an error: ${msg}_`;
          }
          return copy;
        });
      }
    } finally {
      setPending(false);
      setThinking(false);
      abortRef.current = null;
    }
  };

  const applyEvent = (evt: Record<string, unknown>) => {
    const type = evt.type as string;

    if (type === "text") {
      const delta = String(evt.delta ?? "");
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.text = last.text + delta;
        }
        return copy;
      });
    } else if (type === "thinking_start") {
      setThinking(true);
    } else if (type === "thinking_stop") {
      setThinking(false);
    } else if (type === "tool_use_start") {
      const tool: ToolEvent = {
        id: String(evt.id ?? ""),
        name: String(evt.name ?? ""),
        status: "running",
      };
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.tools = [...(last.tools ?? []), tool];
        }
        return copy;
      });
    } else if (type === "tool_use_end") {
      const id = String(evt.id ?? "");
      const ok = Boolean(evt.ok);
      const errorMsg = evt.error ? String(evt.error) : undefined;
      const nav = evt.navigate as { href?: string; label?: string } | undefined;
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.tools = (last.tools ?? []).map((t) =>
            t.id === id
              ? { ...t, status: ok ? "done" : "error", error: errorMsg }
              : t
          );
          if (nav && typeof nav.href === "string" && typeof nav.label === "string") {
            last.navs = [...(last.navs ?? []), { href: nav.href, label: nav.label }];
          }
        }
        return copy;
      });
    } else if (type === "error") {
      const errorMsg = evt.error ? String(evt.error) : "Unknown error";
      setTurns((prev) => {
        const copy = [...prev];
        const last = copy[copy.length - 1];
        if (last && last.role === "assistant") {
          last.text =
            (last.text ? last.text + "\n\n" : "") +
            `_Sorry — ${errorMsg}_`;
        }
        return copy;
      });
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const reset = () => {
    abortRef.current?.abort();
    setTurns([]);
    setInput("");
    setPending(false);
    setThinking(false);
  };

  // Hide on the landing page — only show inside the dashboard
  if (pathname === "/" || pathname === "") return null;

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          aria-label="Open Herdwise AI"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 group"
        >
          <span className="absolute inset-0 rounded-full bg-emerald-400/30 blur-2xl animate-glow" />
          <span className="relative inline-flex items-center gap-2 h-14 px-5 rounded-full
            bg-[linear-gradient(135deg,#00f5a0_0%,#5be7ff_100%)] text-emerald-950
            shadow-[0_18px_40px_-10px_rgba(0,245,160,0.6)] font-semibold
            transition-transform duration-300 group-hover:-translate-y-0.5">
            <I.Sparkle size={18} />
            <span className="hidden sm:inline">Ask Herdwise</span>
            <kbd className="hidden md:inline ml-1 text-[10px] font-mono bg-emerald-950/20 rounded px-1.5 py-0.5">
              ⌘J
            </kbd>
          </span>
        </button>
      )}

      {/* Backdrop on mobile */}
      <div
        onClick={() => setOpen(false)}
        aria-hidden
        className={`md:hidden fixed inset-0 z-40 bg-black/55 backdrop-blur-sm transition-opacity duration-300
          ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Panel */}
      <aside
        role="dialog"
        aria-label="Ask Herdwise"
        className={`fixed z-50 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]
          bottom-3 right-3 top-3 sm:top-5 sm:bottom-5 sm:right-5
          w-[calc(100vw-1.5rem)] sm:w-[440px] md:w-[480px] lg:w-[520px] max-w-[560px]
          ${open ? "translate-x-0 opacity-100" : "translate-x-[120%] opacity-0 pointer-events-none"}`}
      >
        <div className="glass-heavy rounded-3xl h-full flex flex-col overflow-hidden">
          {/* Header */}
          <header className="px-4 sm:px-5 py-4 flex items-center gap-3 border-b border-white/8">
            <div className="relative h-10 w-10 rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] grid place-items-center text-emerald-950 shadow-[0_8px_24px_-8px_rgba(0,245,160,0.6)] shrink-0">
              <I.Sparkle size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-semibold tracking-tight">Ask Herdwise</h2>
                <span className="chip">Claude · Opus 4.7</span>
              </div>
              <p className="text-[11px] text-white/55 truncate mt-0.5">
                Live answers across animals, owners, zones and incidents.
              </p>
            </div>
            {turns.length > 0 && (
              <button
                onClick={reset}
                className="h-9 w-9 grid place-items-center rounded-xl text-white/65 hover:text-white hover:bg-white/8 transition-colors"
                aria-label="New conversation"
                title="New conversation"
              >
                <I.Plus size={16} />
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="h-9 w-9 grid place-items-center rounded-xl text-white/65 hover:text-white hover:bg-white/8 transition-colors"
              aria-label="Close"
            >
              <I.X size={16} />
            </button>
          </header>

          {/* Body */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto pretty-scroll px-4 sm:px-5 py-5 space-y-4">
            {turns.length === 0 ? (
              <Welcome onPick={(t) => send(t)} />
            ) : (
              turns.map((t, i) => (
                <Turn
                  key={i}
                  turn={t}
                  thinking={i === turns.length - 1 && pending && thinking}
                  streaming={i === turns.length - 1 && pending}
                  onNavigate={(href) => {
                    router.push(href);
                    setOpen(false);
                  }}
                />
              ))
            )}
          </div>

          {/* Composer */}
          <footer className="p-3 sm:p-4 border-t border-white/8">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="flex items-end gap-2"
            >
              <div className={`flex-1 flex items-end glass-thin rounded-2xl transition-all duration-300
                focus-within:bg-white/8 focus-within:ring-2 focus-within:ring-emerald-400/40 focus-within:shadow-[0_0_24px_-12px_rgba(0,245,160,0.6)]`}>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      send(input);
                    }
                  }}
                  rows={1}
                  placeholder="Ask about animals, owners, zones, incidents…"
                  className="flex-1 bg-transparent outline-none text-sm placeholder:text-white/40 px-3.5 py-3 min-h-[44px] max-h-32 resize-none"
                  disabled={false}
                />
              </div>
              {pending ? (
                <button
                  type="button"
                  onClick={stop}
                  className="h-11 w-11 grid place-items-center rounded-2xl bg-white/10 hover:bg-white/15 text-white/85 transition-colors"
                  aria-label="Stop"
                  title="Stop"
                >
                  <span className="h-3 w-3 rounded-sm bg-rose-300" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="h-11 w-11 grid place-items-center rounded-2xl bg-[linear-gradient(135deg,#00f5a0,#5be7ff)] text-emerald-950 shadow-[0_8px_24px_-10px_rgba(0,245,160,0.6)] hover:brightness-110 transition-all disabled:opacity-40 disabled:pointer-events-none"
                  aria-label="Send"
                >
                  <I.ArrowRight size={18} />
                </button>
              )}
            </form>
            <div className="mt-2 text-[10px] text-white/40 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <I.Shield size={10} className="text-emerald-300" />
                Read-only — Herdwise can&rsquo;t modify your data.
              </span>
              <span className="font-mono">⌘J to toggle · Enter to send</span>
            </div>
          </footer>
        </div>
      </aside>
    </>
  );
}

/* ---------- Welcome / Suggestions ---------- */

function Welcome({ onPick }: { onPick: (t: string) => void }) {
  return (
    <div className="space-y-5 py-2 page-enter">
      <div className="glass-thin rounded-3xl p-5 relative overflow-hidden">
        <div className="absolute -top-20 -right-20 h-40 w-40 rounded-full bg-emerald-400/30 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2">
            <span className="chip" style={{ borderColor: "rgba(0,245,160,0.35)", color: "#c8ffe9" }}>
              Hello, Inspector
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            What would you like to know about your herd today?
          </h3>
          <p className="mt-2 text-sm text-white/65 leading-snug">
            I have read access to every animal, owner, zone and incident on the platform. Ask in plain English — I&rsquo;ll fetch what I need.
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] uppercase tracking-[0.14em] text-white/45 px-1">
          Try one of these
        </div>
        {SUGGESTIONS.map((s, i) => (
          <button
            key={i}
            onClick={() => onPick(s.text)}
            className="w-full text-left p-3 rounded-2xl glass-thin hover:bg-white/6 transition-colors flex items-center gap-3 group"
          >
            <span className="h-8 w-8 rounded-xl glass-thin grid place-items-center text-emerald-300 group-hover:scale-105 transition-transform">
              {s.icon}
            </span>
            <span className="text-sm text-white/85 flex-1">{s.text}</span>
            <I.ArrowRight size={14} className="text-white/40 group-hover:text-white/70 transition-colors" />
          </button>
        ))}
      </div>
    </div>
  );
}

/* ---------- One turn ---------- */

function Turn({
  turn,
  thinking,
  streaming,
  onNavigate,
}: {
  turn: ChatTurn;
  thinking: boolean;
  streaming: boolean;
  onNavigate: (href: string) => void;
}) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] glass rounded-2xl px-4 py-3 text-sm leading-relaxed">
          {turn.text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Tool / thinking pills */}
      {(thinking || (turn.tools && turn.tools.length > 0)) && (
        <div className="flex flex-wrap gap-1.5">
          {thinking && (
            <span className="chip" style={{ borderColor: "rgba(91,231,255,0.35)", color: "#bbf2ff" }}>
              <Dots /> Thinking
            </span>
          )}
          {turn.tools?.map((t) => (
            <span
              key={t.id}
              className="chip"
              style={
                t.status === "running"
                  ? { borderColor: "rgba(255,181,71,0.35)", color: "#ffe1ad" }
                  : t.status === "done"
                    ? { borderColor: "rgba(0,245,160,0.35)", color: "#c8ffe9" }
                    : { borderColor: "rgba(255,107,107,0.35)", color: "#ffd0d0" }
              }
              title={t.error}
            >
              {t.status === "running" ? <Dots /> : t.status === "done" ? <I.Check size={11} /> : <I.Alert size={11} />}
              {toolLabels[t.name] ?? t.name}
            </span>
          ))}
        </div>
      )}

      {/* Streaming response */}
      {turn.text ? (
        <div className="text-white/90">
          <Markdown source={turn.text} />
          {streaming && <Cursor />}
        </div>
      ) : (
        streaming && !thinking && (
          <div className="flex items-center gap-2 text-sm text-white/55">
            <Dots /> Preparing
          </div>
        )
      )}

      {/* Navigation suggestions */}
      {turn.navs && turn.navs.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {turn.navs.map((n, i) => (
            <button
              key={i}
              onClick={() => onNavigate(n.href)}
              className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl glass-veld text-sm font-medium hover:brightness-110 transition-all"
            >
              <I.ArrowRight size={13} />
              {n.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1 w-1 rounded-full bg-current animate-pulse" />
      <span className="h-1 w-1 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.2s" }} />
      <span className="h-1 w-1 rounded-full bg-current animate-pulse" style={{ animationDelay: "0.4s" }} />
    </span>
  );
}

function Cursor() {
  return (
    <span
      className="inline-block w-[2px] h-4 bg-emerald-300 align-middle ml-0.5"
      style={{ animation: "blink 1s steps(2) infinite" }}
    />
  );
}
