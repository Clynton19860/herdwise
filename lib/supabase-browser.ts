"use client";

import { createClient } from "@supabase/supabase-js";

/**
 * Browser Supabase client, used only for Realtime.
 *
 * Page data still comes from server components over the pooled `pg` connection;
 * this exists so the map can follow changes without polling. It subscribes to
 * `devices` rather than `fixes` — `record_fix()` updates `devices.last_position`
 * on every report, so one row per animal changes in place instead of streaming
 * the entire history to every browser.
 *
 * The anon key is public by design. Until auth exists it can read the map
 * tables (see migration 0005), which is why that migration is marked temporary.
 */
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const realtimeEnabled = Boolean(url && anonKey);

export const supabase = realtimeEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: false },
      realtime: { params: { eventsPerSecond: 5 } },
    })
  : null;
