/**
 * A device's last fix time must never go backwards.
 *
 * `record_fix` set `last_fix_at = p_recorded_at` on every call, which is right
 * only while the device clock is monotonic. On 3 September two tags' clocks
 * jumped sixteen hours backwards mid-stream, so each new fix dragged
 * `last_fix_at` back to two in the morning — and every screen reading that
 * column reported a travelling animal as sixteen hours stale while it was
 * moving across Harare.
 *
 * The gateway now refuses a device time that far in the past, but the column
 * still has to be defended: a denormalised "latest" that can move backwards is
 * a bug waiting for the next unreliable clock, and there will be one.
 *
 * `last_seen_at` is unaffected — it is set from `now()` and was always correct,
 * which is exactly why "reporting now" and "16 h old" appeared side by side.
 */
create or replace function record_fix_last_fix_at_guard() returns void language sql as $$
  select 1;
$$;
drop function if exists record_fix_last_fix_at_guard();

do $$
declare v_src text;
begin
  select pg_get_functiondef(oid) into v_src from pg_proc where proname = 'record_fix';
  if v_src is null then
    raise notice 'record_fix not present — nothing to patch';
    return;
  end if;

  -- Replace the assignment in place rather than restating the whole function,
  -- so this migration cannot silently revert unrelated changes made to it.
  if position('last_fix_at   = p_recorded_at' in v_src) = 0 then
    raise notice 'record_fix does not assign last_fix_at as expected — leaving it alone';
    return;
  end if;

  v_src := replace(
    v_src,
    'last_fix_at   = p_recorded_at',
    'last_fix_at   = greatest(coalesce(v_device.last_fix_at, p_recorded_at), p_recorded_at)');
  execute v_src;
  raise notice 'record_fix patched: last_fix_at can no longer regress';
end $$;

-- Repair the rows the regression already corrupted. The truth is in `fixes`,
-- which kept every position; only the cached column went backwards.
update devices d
   set last_fix_at = f.newest
  from (select device_id, max(recorded_at) as newest from fixes group by device_id) f
 where f.device_id = d.id
   and (d.last_fix_at is null or d.last_fix_at < f.newest);
