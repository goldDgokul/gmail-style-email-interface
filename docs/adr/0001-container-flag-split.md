# Split system labels into containers and flags

The label model began as one flat `SystemLabel[]` union in which every invariant — at most one of INBOX/SENT/DRAFT/SPAM/TRASH, "not in trash", "archive means leaving the inbox" — was a comment the service layer had to honour by hand, so a filter-then-push could produce `['INBOX', 'TRASH']`. We split it: `container` holds at most one of INBOX/SENT/DRAFT/SPAM/TRASH (or `null`, meaning archived), and `flags` holds STARRED/IMPORTANT as a freely combining set. The split was chosen over keeping one flat set with discipline, and over a single `labels` collection carrying a `kind` discriminator: the two halves have different laws, only one of them needs mutual exclusion, and a discriminator buys nothing while user labels are immutable seed data with no CRUD.

## Considered Options

- **Flat `SystemLabel[]` with discipline** — rejected: illegal states are representable, and every predicate re-implements the exclusivity rule.
- **One tagged collection** (`{ id, kind: 'system' | 'user' }[]`) — rejected: system labels are created and destroyed by the service while user labels are seed data, so a shared lifecycle buys nothing and the extra indirection is paid on every read.
- **Container/flags split** — chosen.

## Consequences

- View predicates become single-field comparisons (`container === 'INBOX'`), and "shared base filter" logic is one expression no view can forget.
- Restore from Trash needs to know where an email came from, so trashing records `restoreTo` — a field that exists only because the container is exclusive rather than additive.
- A trashed email keeps its flags, so a starred email in Trash must still not appear under Starred: the base filter, not the flags, is what guarantees it.
