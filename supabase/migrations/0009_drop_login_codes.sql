-- The six-digit code moved to Supabase Auth.
--
-- Migration 0007 added `login_codes` because this application issued, stored and
-- checked its own codes. It has no way to send email, so those codes could only
-- be read from a server log — which is a demonstration of a flow, not a second
-- factor a person can actually use.
--
-- Supabase's own mailer sends them now, using the branded templates in
-- `supabase/templates`, and Supabase verifies them. Expiry and the attempt
-- ceiling are enforced there, configured beside those templates in
-- `supabase/config.toml`, so the ten minutes the email promises is the ten
-- minutes applied.
--
-- Nothing reads or writes this table any more, and a table holding credential
-- material that nothing maintains is a liability rather than a spare part.

drop table if exists login_codes;
drop function if exists prune_login_codes();
