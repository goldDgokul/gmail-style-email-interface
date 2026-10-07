# Snooze is derived from a timestamp, not driven by a job

Snoozed mail is modelled as `snoozedUntil` on an inbox email, and every read derives "is this snoozed right now?" by comparing that timestamp to `Date.now()` — the moment passes and the email reappears in the Inbox on the next render. We rejected the alternative of moving the email out of INBOX on snooze and back in on wake, because an all-frontend application has no process that runs at 8am: the email would simply never return without adding a polling interval, a wake-up sweep on every focus, and a class of bugs that only reproduce after the tab has been closed. Snooze is therefore legal only from `container === 'INBOX'`, enforced as a silent no-op in the service, since a sent email vanishing from Sent at 8am tomorrow is not a behaviour anyone asked for.

## Considered Options

- **Add/remove INBOX on entry, wake job re-adds** — rejected: no scheduler exists in a browser-only app; correctness would depend on a sweep that may never run.
- **Timestamp predicate** — chosen.

## Consequences

- Inbox list and Inbox unread badge are automatically in sync: both come from `selectForView`, so a snoozed unread email is excluded from both or counted in neither. No separate "wakeup count" logic is possible.
- Nothing needs to run on a timer; a tab opened a week later shows correct state because the predicate reads the clock.
- A snoozed email keeps its container and flags, so it still appears under Starred/Important while hidden from the Inbox — intentional, and only the base filter keeps it out of Trash/Spam views like everything else.
