/**
 * Remove a repair that was designed for the wrong diagnosis.
 *
 * 0025 added `devices.latitude_sign_fault` and `fixes.repaired`, to mirror the
 * latitude of a unit that was dropping the southern-hemisphere sign. It was
 * built on the belief that the tag's GPS was working and only the sign was
 * wrong — and while it was being written, the evidence turned.
 *
 * The tag was not tracking. Its "moving" coordinates were jitter of two or
 * three metres around the position it held before the vehicle set off, so
 * mirroring the sign would have placed the animal three hundred metres from
 * the tag she was travelling beside — a confidently wrong position rather than
 * an obviously missing one. The tag then began sending correct coordinates of
 * its own accord, which the repair would have inverted into the northern
 * hemisphere.
 *
 * Refusing an impossible position, which is what the gateway already does,
 * handles both states without needing to know which one the tag is in.
 *
 * The migration reached the database because it was swept up by an unrelated
 * commit rather than because anyone decided to apply it. Both columns are
 * unused, and `fixes` is partitioned and written to constantly, so an unused
 * column on it is not something to leave lying about.
 */

alter table devices drop column if exists latitude_sign_fault;
alter table fixes drop column if exists repaired;
