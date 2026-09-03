/**
 * A panic alarm is its own kind of case.
 *
 * The existing incident types all describe something a person observed. This
 * one the animal's own tag raised. Kept distinct rather than filed under
 * 'theft', because at the moment it fires nobody knows yet whether it is a
 * theft — and a case file should not assert what it cannot know.
 *
 * Alone in its own migration on purpose: Postgres refuses to use a new enum
 * value in the transaction that created it, and 0020 needs it in an index
 * predicate. This file must commit first.
 */
alter type incident_type add value if not exists 'panic';
