# Gmail-Style Email Interface — Agent Build Plan (v4 — Final)

> **Stack**: React 19.3 · TypeScript 5.4+ · TanStack Query v5 · Vite · Vanilla CSS
> **Constraint**: 100% frontend. No backend. No auth. No external API. All data is in-memory mock.
> **Code density**: If something can be done in 10 lines, do NOT write 100.
> **Supersedes**: v3. Folded decisions: `docs/adr/0001-container-flag-split.md`, `docs/adr/0002-snooze-as-derivation.md`, vocabulary in `GLOSSARY.md`.

---

## 0. Core Mental Model — Read This Before Writing a Single Line

### 0.1 Label-based, not folder-based — and system labels come in two kinds

An email carries **at most one Container** (`INBOX | SENT | DRAFT | SPAM | TRASH | null`), a free set of **Flags** (`STARRED | IMPORTANT`), and **User Labels** (seed data, filterable, no CRUD). There is no folder field and no flat label array.

```
View        →  Predicate over emails (GLOSSARY.md: a View is a filter, not a location)
──────────────────────────────────────────────────────────────────────────────────────
inbox       →  container === 'INBOX'  AND  NOT snoozedIntoFuture
starred     →  container ∉ {TRASH,SPAM}  AND  'STARRED' ∈ flags
important   →  container ∉ {TRASH,SPAM}  AND  'IMPORTANT' ∈ flags
snoozed     →  snoozedIntoFuture            (only INBOX emails can hold a future snooze)
sent        →  container === 'SENT'
drafts      →  container === 'DRAFT'
spam        →  container === 'SPAM'
trash       →  container === 'TRASH'
all         →  container ∉ {TRASH, SPAM, DRAFT}
label       →  container ∉ {TRASH,SPAM}  AND  activeLabel ∈ userLabels
```

**Shared base filter** — every view except `spam` and `trash` starts from it, so no view can forget it:
```typescript
const visible = (e: Email) => e.container !== 'TRASH' && e.container !== 'SPAM';
```

### 0.2 Snooze is derived, never scheduled (ADR-0002)
```typescript
const snoozedIntoFuture = (e: Email) =>
  e.snoozedUntil !== null && new Date(e.snoozedUntil).getTime() > Date.now();
```
A past timestamp means "not snoozed" on the next render — nothing wakes anything. Snooze is legal **only** when `container === 'INBOX'`; the service no-ops otherwise. A snoozed email keeps its container and flags, so it still counts under Starred/Important while hidden from Inbox.

### 0.3 Delete is routed by the email's own container, never by the view

```typescript
const PERMANENT = new Set(['TRASH', 'SPAM', 'DRAFT']);
// email.container ∈ PERMANENT  →  permanentDelete
// otherwise                    →  moveToTrash
```
A data-keyed rule cannot be fooled by which view happens to be rendered (important once a label View or a search changes the screen). The button still says which branch: **"Delete forever"** when every selected container is in `PERMANENT`, **"Delete"** otherwise. Gmail's spam has no soft delete at all, and a draft is data, not mail (0.5).

**Trash / restore**: `moveToTrash` records `restoreTo = container` *before* changing it (`null` is a legitimate value — the email was archived). Restore: from SPAM → `INBOX` unconditionally; from TRASH → `restoreTo === undefined ? 'INBOX' : restoreTo`, then clear `restoreTo`.

### 0.4 Single source of truth
One query key: `['emails']`. Views, counts, selection targets all derive from this one cached array. No per-view keys, no `getById` query.

### 0.5 Drafts are data, not mail
Seed drafts ship with `recipients: []`; `saveDraft` **persists `to`/`cc`/`bcc`** so a re-edited draft keeps its recipients. Drafts are excluded from All Mail, are excluded from search results' "mail corpus" reasoning, and **bypass Trash when deleted** (`container ∈ PERMANENT`).

### 0.6 One compose window; it owns its identity from open
Only one `ComposeWindow` exists at a time (opening a second replaces the first, saving a draft if it has content). The compose is assigned `draftId = existingDraftId ?? crypto.randomUUID()` **at open**; the store row is materialized only on first save. Closing with no subject and no body writes nothing.

Replacement works by remount: the store keeps a `composeToken` bumped on every `setComposeData`, and `App.tsx` renders `<ComposeWindow key={ui.composeToken} />` so field state (and the stale-draftId hazard) can never leak between opens. A replaced compose saves its content on unmount unless it settled deliberately (✕ / Send / discard). A draft row re-opens the window via `setComposeData(draftComposeData(email))` — drafts never open the read-only EmailView from a row click.

### 0.7 No threading
Each email is an independent message. State this as a comment in `EmailList.tsx`.

---

## IMPLEMENTATION GUARDRAILS

Read and follow all 20 rules before touching any component:

1. **Model shape is non-negotiable.** `container` + `flags` + `userLabels` (+ optional `restoreTo`). Never `folder: string`, never a flat `labels: SystemLabel[]`.
2. **One query key.** `['emails']` is the only TanStack Query key. Views and counts are derived from the cached array.
3. **Event propagation.** Every interactive element inside `EmailRow` (checkbox, star, flag marker, hover icons, label chips, attachments) calls `event.stopPropagation()`.
4. **Keyboard shortcuts must not fire while typing.** If `document.activeElement` is `INPUT`, `TEXTAREA`, `SELECT`, or `[contenteditable]`, do nothing.
5. **Set mutation.** Always `setSelectedIds(prev => { const next = new Set(prev); ...; return next; })` — never mutate and re-set the same reference.
6. **Timer cleanup.** Every `setTimeout`/`setInterval` in a `useEffect` returns a cleanup function; the debounced autosave also clears on unmount.
7. **Autosave is debounced 2s, and `saveDraft` only ever updates a record whose `container === 'DRAFT'`.** A save in flight when Send is clicked finds `SENT` and no-ops. `saveDraft` creates only when the id is genuinely absent from the store *and* a draftId was supplied.
8. **Search is global (not view-scoped) and never touches badges.** Typing in search abandons the current View the same way `changeView` does; search scope is `visible(e)` (drafts included, Trash/Spam excluded).
9. **Responsive column priority.** At ≤768px, rows show `[checkbox · sender · subject]` only. Subject truncates, never disappears.
10. **Compose is full-width at ≤768px** (bottom-sheet: `bottom/left/right: 0`).
11. **Respect `prefers-reduced-motion`.** All transitions use `var(--dur)`; `@media (prefers-reduced-motion: reduce) { :root { --dur: 0ms } }`.
12. **No double-submit.** Every mutation-triggering control is `disabled={mutation.isPending}`.
13. **User labels have no CRUD UI.** They filter via the `'label'` pseudo-view (`activeLabel` in UIStore). Chips are clickable; nothing creates or renames a label.
14. **Unread counts are derived from the live `['emails']` cache**, rendered **only on Inbox and user-label Views**, and are computed with `search = ''` so typing can never change a badge.
15. **Delete routes on `container`** (0.3), partitioning a mixed bulk selection into two calls. Never branch on `view`.
16. **`staleTime: Infinity`** on the QueryClient — data refreshes only via `invalidateQueries` after a mutation.
17. **Run `npm run build` (zero TS errors) after steps 5, 9, 13, and 18.**
18. **Every service operation is total.** Inapplicable cells are silent no-ops; nothing throws. A bulk action spans a mixed selection, so a throw would fail the whole batch for a stray cell.
19. **Mark-read lives in `EmailView` on `[email.id]`, never in a row's click handler.** Row click, Enter, `j`, and `k` all converge on `openEmailId`, so one effect covers every route. Pressing `u` does not change `openEmailId`, so it isn't overridden.
20. **Bulk actions operate on `selected ∩ visibleIds`**, computed in the Toolbar handler. Clear selection on `changeView` only — never on a search keystroke.

---

## 1. Project Bootstrap

```bash
npx -y create-vite@latest ./ --template react-ts
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Delete everything in `src/` except `main.tsx` and `vite-env.d.ts`.

**`src/main.tsx`** (unchanged from v3):
```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import App from './App';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, gcTime: Infinity, retry: false,
      // Implementation note: prop-tracking notifications do not fire in this
      // React 19 + react-query 5.104 build — 'all' keeps subscribers rendering.
      notifyOnChangeProps: 'all',
    },
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  </StrictMode>
);
```

---

## 2. Folder Structure

```
src/
├── main.tsx
├── App.tsx
├── index.css
├── types/email.ts
├── data/mockEmails.ts
├── services/mockEmailService.ts
├── hooks/
│   ├── useEmails.ts            # useQuery + selectForView + badges
│   ├── useEmailMutations.ts    # all useMutation hooks
│   ├── useDeleteRoute.ts       # thin wrapper: emailService.deleteRoute
│   └── useKeyboardShortcuts.ts
├── store/
│   ├── useUIStore.ts
│   └── UIStoreContext.ts
├── utils/
│   ├── formatDate.ts           # relative / absolute row + view dates
│   ├── draftCompose.ts         # Email → ComposeData (draft re-open)
│   ├── snooze.ts               # SNOOZE_MENU + snoozedIntoFuture predicate
│   └── splitList.ts            # "a, b" → ['a','b'] (recipients, validation)
└── components/
    ├── layout/   AppShell.tsx  TopBar.tsx  Sidebar.tsx
    ├── email/    EmailList.tsx EmailRow.tsx EmailToolbar.tsx EmailView.tsx
    ├── compose/  ComposeWindow.tsx
    └── ui/       Avatar.tsx Badge.tsx IconButton.tsx LabelChip.tsx
                  Spinner.tsx EmptyState.tsx Toast.tsx
```

---

## 3. Types (`src/types/email.ts`)

```typescript
// INVARIANTS (read before editing):
// - container holds at most one value; null is reachable only by archiving INBOX.
// - flags are free: any subset of STARRED | IMPORTANT, no exclusivity.
// - restoreTo is set only when entering TRASH. undefined = "unknown" (restore → INBOX);
//   null = "was archived" (restore → stays null). It is cleared on restore.
// - snoozedUntil is only ever set when container === 'INBOX'; it does not move containers.
// - Trash and Spam are separate containers; a draft deleted is removed outright.
//   See ADR-0001, ADR-0002.

export type Container = 'INBOX' | 'SENT' | 'DRAFT' | 'SPAM' | 'TRASH';
export type Flag = 'STARRED' | 'IMPORTANT';

export type SidebarView =
  | 'inbox' | 'starred' | 'important' | 'snoozed'
  | 'sent'  | 'drafts'  | 'spam'      | 'trash' | 'all' | 'label';

export interface Attachment {
  name: string;
  size: string;  // human-readable: "2.4 MB"
  type: string;  // MIME type
}

export interface Email {
  id: string;
  container: Container | null;   // null = archived (All Mail only)
  flags: Flag[];
  userLabels: string[];
  restoreTo?: Container | null;  // where Restore from Trash returns this email
  snoozedUntil: string | null;   // ISO 8601; future value = hidden from Inbox

  sender: string;
  senderEmail: string;
  recipients: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  preview: string;       // first 120 chars of body
  body: string;
  timestamp: string;     // ISO 8601
  unread: boolean;
  attachments: Attachment[];
}

export interface ComposeData {
  draftId?: string;       // set when re-editing an existing draft
  replyToId?: string;     // set when replying; display only
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

export type SnoozePreset = 'tonight' | 'tomorrow' | 'next-week';

export const SNOOZE_PRESETS: Record<SnoozePreset, () => Date> = {
  'tonight':   () => { const d = new Date(); d.setHours(20,0,0,0); return d; },
  'tomorrow':  () => { const d = new Date(); d.setDate(d.getDate()+1); d.setHours(8,0,0,0); return d; },
  'next-week': () => { const d = new Date(); d.setDate(d.getDate()+7); d.setHours(8,0,0,0); return d; },
};

// Delete routing — data-keyed, never view-keyed (guardrail #15)
export const PERMANENT_DELETE_CONTAINERS: ReadonlySet<Container> =
  new Set<Container>(['TRASH', 'SPAM', 'DRAFT']);
```

---

## 4. Mock Data (`src/data/mockEmails.ts`)

**25 emails** — containers, flags, then the extras:

| Count | `container` | `flags` | Extras |
|---|---|---|---|
| 6 | `INBOX` | `[]` | 3 unread |
| 4 | `INBOX` | `['IMPORTANT']` | 2 unread |
| 3 | `INBOX` | `['STARRED']` | 1 unread |
| 2 | `INBOX` | `['STARRED','IMPORTANT']` | both read |
| 2 | `INBOX` | `[]` | `snoozedUntil` = tomorrow 08:00, unread |
| 3 | `SENT` | `[]` | read, `sender: 'Me'` |
| 2 | `DRAFT` | `[]` | `recipients: []`, partial subject/body, `unread: false` |
| 2 | `SPAM` | `[]` | generic spam content |
| 1 | `TRASH` | `[]` | `restoreTo: 'INBOX'`, newsletter |

- **No mock email has `container: null`** (guardrail/invariant: only `archive` creates it).
- No mock email has `restoreTo` other than the TRASH one.
- Realistic senders: GitHub, Stripe, LinkedIn, Google One, "Sarah Chen", "Marcus Webb".
- ≥3 INBOX emails with `userLabels: ['Work']`; ≥2 with `userLabels: ['Finance']`.
- ≥2 emails with `attachments: [{ name:'invoice.pdf', size:'1.2 MB', type:'application/pdf' }]`.

`export const MOCK_EMAILS: Email[] = [...]`

---

## 5. Service Layer (`src/services/mockEmailService.ts`)

No `nanoid` — `crypto.randomUUID()` throughout. Module-private `store`; nothing outside mutates it.

```typescript
import { MOCK_EMAILS } from '../data/mockEmails';
import type { Email, ComposeData, Container } from '../types/email';

let store: Email[] = structuredClone(MOCK_EMAILS);
const delay = (ms = 80) => new Promise<void>(r => setTimeout(r, ms));
const mutate = (fn: () => void): Email[] => { fn(); return [...store]; };
const find = (id: string) => store.find(e => e.id === id);

// Total operations: every guard is a silent return (guardrail #18). Nothing throws.

export const emailService = {

  getAll: async (): Promise<Email[]> => { await delay(); return [...store]; },

  // ── Send: in-place transition; the record is never deleted and recreated ──
  send: async (data: ComposeData): Promise<void> => {
    await delay(120);
    mutate(() => {
      const existing = data.draftId ? find(data.draftId) : undefined;
      if (existing && existing.container === 'DRAFT') {
        // fast path: draft was saved earlier → transition in place
        existing.container = 'SENT';
        existing.recipients = splitList(data.to);
        existing.cc = splitList(data.cc);
        existing.bcc = splitList(data.bcc);
        existing.subject = data.subject || '(no subject)';
        existing.preview = data.body.slice(0, 120);
        existing.body = data.body;
        existing.timestamp = new Date().toISOString();
        existing.unread = false;
        existing.snoozedUntil = null;
      } else if (!existing && data.draftId) {
        // under-2s send: no row yet → create it directly as SENT with the same id
        store.push({
          id: data.draftId, container: 'SENT', flags: [], userLabels: [],
          snoozedUntil: null, sender: 'Me', senderEmail: 'me@gmail.com',
          recipients: splitList(data.to), cc: splitList(data.cc), bcc: splitList(data.bcc),
          subject: data.subject || '(no subject)', preview: data.body.slice(0, 120),
          body: data.body, timestamp: new Date().toISOString(),
          unread: false, attachments: [],
        });
      }
      // existing && container !== 'DRAFT' → duplicate click on an already-sent compose: no-op
    });
  },

  // ── Drafts: materialize on first save; only ever update a DRAFT record ──
  saveDraft: async (data: ComposeData): Promise<string | null> => {
    await delay();
    if (!data.draftId) return null;              // compose always assigns one at open
    const id = data.draftId;
    mutate(() => {
      const existing = find(id);
      if (existing) {
        if (existing.container !== 'DRAFT') return;  // in-flight save vs Send → no-op
        Object.assign(existing, {
          subject: data.subject, preview: data.body.slice(0, 120),
          body: data.body, timestamp: new Date().toISOString(),
          recipients: splitList(data.to), cc: splitList(data.cc), bcc: splitList(data.bcc),
        });
        return;
      }
      store.push({
        id, container: 'DRAFT', flags: [], userLabels: [], restoreTo: undefined,
        snoozedUntil: null, sender: 'Me', senderEmail: 'me@gmail.com',
        recipients: splitList(data.to), cc: splitList(data.cc), bcc: splitList(data.bcc),
        subject: data.subject || '(no subject)', preview: data.body.slice(0, 120),
        body: data.body, timestamp: new Date().toISOString(),
        unread: false, attachments: [],
      });
    });
    return id;
  },

  // ── Flags and read state: total, independent of container ──────────────────
  toggleStar: async (id: string): Promise<void> => {
    await delay();
    mutate(() => { const e = find(id); if (!e) return;
      e.flags = e.flags.includes('STARRED') ? e.flags.filter(f => f !== 'STARRED') : [...e.flags, 'STARRED']; });
  },
  toggleImportant: async (id: string): Promise<void> => {
    await delay();
    mutate(() => { const e = find(id); if (!e) return;
      e.flags = e.flags.includes('IMPORTANT') ? e.flags.filter(f => f !== 'IMPORTANT') : [...e.flags, 'IMPORTANT']; });
  },
  markRead: async (ids: string[], unread: boolean): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => { const e = find(id); if (e) e.unread = unread; }));
  },

  // ── Container transitions (transition table, Q13) ──────────────────────────
  archive: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => { const e = find(id);
      if (e && e.container === 'INBOX') e.container = null; }));  // INBOX → null; all else no-op
  },

  // INBOX/SENT/null → TRASH (recording restoreTo); DRAFT → removed; TRASH/SPAM → no-op
  moveToTrash: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => {
      const e = find(id); if (!e) return;
      if (e.container === 'DRAFT') { store = store.filter(x => x.id !== id); return; }
      if (e.container === 'TRASH' || e.container === 'SPAM') return;
      e.restoreTo = e.container;   // null is a real value: it was archived
      e.container = 'TRASH';
      e.snoozedUntil = null;
    }));
  },

  permanentDelete: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => { store = store.filter(e => !ids.includes(e.id)); });
  },

  // only INBOX → SPAM; everything else no-op (no spam for sent/draft/archived)
  moveToSpam: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => { const e = find(id);
      if (e && e.container === 'INBOX') { e.container = 'SPAM'; e.snoozedUntil = null; } }));
  },

  // SPAM → INBOX unconditionally ("Not spam");
  // TRASH → restoreTo (undefined → INBOX, null → stays archived), then clear restoreTo
  restore: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => { const e = find(id); if (!e) return;
      if (e.container === 'SPAM') { e.container = 'INBOX'; return; }
      if (e.container === 'TRASH') {
        e.container = e.restoreTo === undefined ? 'INBOX' : e.restoreTo;
        e.restoreTo = undefined;
      } }));                                        // all other containers → no-op
  },

  // only INBOX can be snoozed (ADR-0002)
  snooze: async (id: string, until: string): Promise<void> => {
    await delay();
    mutate(() => { const e = find(id);
      if (e && e.container === 'INBOX') e.snoozedUntil = until; });
  },
  unsnooze: async (id: string): Promise<void> => {
    await delay();
    mutate(() => { const e = find(id); if (e) e.snoozedUntil = null; });
  },
};

const splitList = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);
```

---

## 6. TanStack Query Layer

### `src/hooks/useEmails.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import type { Email, SidebarView } from '../types/email';

export const EMAIL_QK = ['emails'] as const;

export const useEmails = () =>
  useQuery({ queryKey: EMAIL_QK, queryFn: emailService.getAll });

// ── Derivations ──────────────────────────────────────────────────────────────
const visible = (e: Email) => e.container !== 'TRASH' && e.container !== 'SPAM';

const snoozedIntoFuture = (e: Email) =>
  e.snoozedUntil !== null && new Date(e.snoozedUntil).getTime() > Date.now();

export const selectForView = (
  emails: Email[],
  view: SidebarView,
  search: string,
  activeLabel: string | null,
): Email[] => {
  const q = search.trim().toLowerCase();

  if (q) {
    // Search is global: it ignores the current View (guardrail #8).
    // Scope = visible(): drafts are findable, Trash/Spam are not.
    return emails
      .filter(e => visible(e) && (
        e.sender.toLowerCase().includes(q) ||
        e.senderEmail.toLowerCase().includes(q) ||
        e.subject.toLowerCase().includes(q) ||
        e.preview.toLowerCase().includes(q) ||
        e.body.toLowerCase().includes(q)))
      .sort(byNewest);
  }

  const base = (() => {
    switch (view) {
      case 'inbox':    return emails.filter(e => e.container === 'INBOX' && !snoozedIntoFuture(e));
      case 'starred':  return emails.filter(e => visible(e) && e.flags.includes('STARRED'));
      case 'important':return emails.filter(e => visible(e) && e.flags.includes('IMPORTANT'));
      case 'snoozed':  return emails.filter(snoozedIntoFuture);
      case 'sent':     return emails.filter(e => e.container === 'SENT');
      case 'drafts':   return emails.filter(e => e.container === 'DRAFT');
      case 'spam':     return emails.filter(e => e.container === 'SPAM');
      case 'trash':    return emails.filter(e => e.container === 'TRASH');
      case 'all':      return emails.filter(e => visible(e) && e.container !== 'DRAFT');
      case 'label':    return emails.filter(e => visible(e) &&
                            !!activeLabel && e.userLabels.includes(activeLabel));
    }
  })();

  return [...base].sort(byNewest);
};

const byNewest = (a: Email, b: Email) =>
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();

// Unread counts: same derivation, always with search = '' so badges never move (guardrail #14)
export const selectUnreadCount = (
  emails: Email[], view: SidebarView, activeLabel: string | null,
): number => selectForView(emails, view, '', activeLabel).filter(e => e.unread).length;
```

### `src/hooks/useEmailMutations.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import { EMAIL_QK } from './useEmails';

const useMut = <T>(fn: (arg: T) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => qc.invalidateQueries({ queryKey: EMAIL_QK }) });
};

export const useToggleStar      = () => useMut(emailService.toggleStar);
export const useToggleImportant = () => useMut(emailService.toggleImportant);
export const useArchive         = () => useMut(emailService.archive);
export const useMoveToTrash     = () => useMut(emailService.moveToTrash);
export const usePermanentDelete = () => useMut(emailService.permanentDelete);
export const useMoveToSpam      = () => useMut(emailService.moveToSpam);
export const useRestore         = () => useMut(emailService.restore);
export const useUnsnooze        = () => useMut(emailService.unsnooze);
export const useSendEmail       = () => useMut(emailService.send);
export const useMarkRead        = () => useMut(({ ids, unread }: { ids: string[]; unread: boolean }) => emailService.markRead(ids, unread));
export const useSnooze          = () => useMut(({ id, until }: { id: string; until: string }) => emailService.snooze(id, until));
export const useSaveDraft       = () => useMut(emailService.saveDraft);
```

Fire → mock store changes → invalidate `['emails']` → re-render. **No optimistic updates**: an 80ms delay is imperceptible and there is no rollback logic to get wrong.

---

## 7. UI State

### `src/store/useUIStore.ts`

```typescript
import { useState, useCallback } from 'react';
import type { SidebarView, ComposeData } from '../types/email';

export const useUIStore = () => {
  const [view, setView]               = useState<SidebarView>('inbox');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composeData, setComposeData] = useState<ComposeData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast]             = useState<string | null>(null);

  const toggleSelect = useCallback((id: string) =>
    setSelectedIds(prev => { const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id); return next; }), []);
  const selectAll      = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // A View change is a real context switch: clear ephemeral state (guardrail #20)
  const changeView = useCallback((v: SidebarView) => {
    setView(v); setActiveLabel(null);
    setOpenEmailId(null); setSelectedIds(new Set()); setSearch('');
  }, []);

  // A user label is a pseudo-view (Q17): same cleanup, one extra piece of state
  const changeLabel = useCallback((label: string) => {
    setView('label'); setActiveLabel(label);
    setOpenEmailId(null); setSelectedIds(new Set()); setSearch('');
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, []);

  return { view, changeView, activeLabel, changeLabel,
           search, setSearch, openEmailId, setOpenEmailId,
           selectedIds, toggleSelect, selectAll, clearSelection,
           composeData, setComposeData, sidebarOpen, setSidebarOpen,
           toast, showToast };
};
export type UIStore = ReturnType<typeof useUIStore>;
```

### `src/store/UIStoreContext.ts`
```typescript
import { createContext, useContext } from 'react';
import type { UIStore } from './useUIStore';

export const UIStoreContext = createContext<UIStore | null>(null);
export const useUI = () => {
  const ctx = useContext(UIStoreContext);
  if (!ctx) throw new Error('useUI must be inside UIStoreContext.Provider');
  return ctx;
};
```

---

## 8. Keyboard Shortcuts (`src/hooks/useKeyboardShortcuts.ts`)

```typescript
import { useEffect } from 'react';
import type { UIStore } from '../store/useUIStore';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const isTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  return TYPING_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable;
};

export const useKeyboardShortcuts = (
  ui: UIStore,
  visibleIds: string[],          // derived in App.tsx — same array the list renders
  actions: {                     // wired from App.tsx
    onArchive: (id: string) => void;
    onDelete:  (id: string) => void;
    onStar:    (id: string) => void;
    onMarkUnread: (id: string) => void;
  },
) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;                       // guardrail #4
      const open = ui.openEmailId;

      switch (e.key) {
        case 'c':
          ui.setComposeData({ to:'', cc:'', bcc:'', subject:'', body:'' }); break;
        case '/':
          e.preventDefault(); document.getElementById('search-input')?.focus(); break;
        case 'Escape':
          if (open) ui.setOpenEmailId(null); else if (ui.composeData) ui.setComposeData(null);
          break;
        case 'j': {                                 // down = older (list is newest-first)
          const i = open ? visibleIds.indexOf(open) : -1;
          const next = i === -1 ? visibleIds[0] : visibleIds[i + 1];
          if (next) ui.setOpenEmailId(next);        // read happens in EmailView, not here
          break;
        }
        case 'k': {                                 // up = newer; no-op when nothing is open
          const i = open ? visibleIds.indexOf(open) : -1;
          if (i > 0) ui.setOpenEmailId(visibleIds[i - 1]);
          break;
        }
        case 'e': if (open) actions.onArchive(open); break;
        case '#': if (open) actions.onDelete(open);  break;
        case 's': if (open) actions.onStar(open);    break;
        case 'u': if (open) actions.onMarkUnread(open); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui, visibleIds, actions]);
};
```
`j`/`k` only set `openEmailId` — **mark-read lives in `EmailView`** (guardrail #19), so keyboard navigation marks read through the same path as a click.

---

## 9. Design System (`src/index.css`)

Unchanged from v3: full token system (colors, typography, layout, elevation, spacing, radii) with `--dur: 140ms` and `@media (prefers-reduced-motion: reduce) { :root { --dur: 0ms } }`, `body { height: 100dvh; overflow: hidden }`. Fonts: Google Sans + Roboto via Google Fonts `@import`.

---

## 10. Component Specifications

### `AppShell.tsx`
```css
.shell { display: grid; grid-template-rows: var(--topbar-h) 1fr;
         grid-template-columns: var(--sidebar-w) 1fr; height: 100dvh; overflow: hidden; }
.shell[data-sidebar-closed] { grid-template-columns: 0 1fr; }
.sidebar { transition: width var(--dur) var(--ease); overflow: hidden; }
```
Grid shell only: TopBar (col-span 2), Sidebar, main = `EmailList` or `EmailView`; `ComposeWindow` and `Toast` are `position: fixed`.

### `TopBar.tsx`
`[☰] Gmail [search id="search-input"] [?] [⚙] [avatar]` — sticky, `grid-column: 1 / -1`, `z-index: 200`.
Search is debounced 200ms with cleanup, and a non-empty search **sets `search` in UIStore directly** (search abandons the current View the way `changeView` does — it is not an overlay on it). Clear `×` button inside the input when non-empty.

### `Sidebar.tsx`
Flex column: compose button (`flex-shrink: 0`, top of column — *not* sticky) then a `flex: 1; overflow-y: auto` nav. Active item: `background: var(--c-selected); color: var(--c-primary)`.

Items: Inbox, Starred, Important, Snoozed, Sent, Drafts, Spam, Trash, All Mail — then `── Labels ──` with `changeLabel(name)` chips.
Unread pill: **rendered only for Inbox and user-label items** (guardrail #14), value from `selectUnreadCount(emails, view, activeLabel)`. Inbox uses `'inbox'` + `null`; a label uses `'label'` + its name.
Compose button → `setComposeData({ ...EMPTY_COMPOSE })`.

### `EmailList.tsx`
`<EmailToolbar>` + scrollable list of `<EmailRow>` + `<EmptyState>` when empty + `<Spinner>` when loading. Emits `visibleIds` (the rendered ids, in order) to `App.tsx` for keyboard navigation and the selection intersection.

### `EmailRow.tsx`
Columns: `[☐ 40px] [★ 32px] [▶ 24px] [Sender 160px] [Subject+preview flex-1] [Date/actions 90px]`, row height `var(--row-h)`.
`@media (max-width: 768px)`: hide star/flag **and `.row__meta` (date/actions)** — grid becomes `40px 120px 1fr`, i.e. exactly `[checkbox · sender · subject]`; **subject always present**.

- Row click / Enter / Space → **drafts**: `setComposeData(draftComposeData(email))` (§0.6 re-edit); **everything else**: `setOpenEmailId(id)` **only** — no mark-read here (guardrail #19).
- Every inner control (`checkbox`, star, flag, hover archive/trash/snooze icons, label chips, attachment badges) → `e.stopPropagation()`; each is `disabled={mutation.isPending}` (snooze items gate on `snooze.isPending`, wake on `unsnooze.isPending`).
- Hover icons use the container-keyed handlers: archive → `archive([id])`; trash → delete route (0.3); snooze → preset menu (+ "↩ Wake up now" when snoozed).
- `aria-label` on every icon control; `aria-pressed` on star/flag.
- Carries a `// No threading — each Email is independent (§0.7)` comment (`EmailList.tsx` carries it too).

### `EmailToolbar.tsx`
**No selection:** `[↺ Refresh] [⋯ More]` (More menu: `☐ Select all`, `✔ Mark all as read`). **With selection:** `[☐ select all] [Archive] [Spam] [Delete] [Mark read ▾] [Move to ▾]`.
The leading `☐` **selects all visible**; once every visible row is selected it becomes `Clear selection` (toggles). The toolbar receives `emails` as a prop — it never reads query data itself (Refresh is the only `queryClient` use).

**No `Labels ▾` button.** User labels are seed-data filter chips with no tagging/CRUD UI in v1 (Q2, `GLOSSARY.md` "User Label") — a toolbar control that cannot act on a label would be dead UI. The service exposes no label-mutation operation; row/view label chips only open the `'label'` pseudo-view.

```typescript
const targetIds = [...selectedIds].filter(id => visibleIdSet.has(id));   // guardrail #20
routeDelete.mutate(targetIds);   // TRASH|SPAM|DRAFT partition lives in emailService.deleteRoute (0.3)
clearSelection();
```
Button label: `"Delete forever"` when **all** selected containers are in `PERMANENT_DELETE_CONTAINERS`, else `"Delete"`. Refresh = `invalidateQueries({ queryKey: EMAIL_QK })`.

### `EmailView.tsx`
Header bar: `[←] [archive] [spam] [delete] [mark unread] [snooze ▾] [⋯]` — Delete uses the same container route and label as the Toolbar.

```typescript
// guardrail #19 — one mark-read path for click, Enter, j and k
useEffect(() => {
  if (email) markRead.mutate({ ids: [email.id], unread: false });
}, [email?.id]);   // 'u' is unaffected: it never changes openEmailId
```

Body: `<h1>` subject → user-label chips → header row (avatar, sender, `senderEmail`, timestamp, expand caret) → `<pre style="white-space:pre-wrap">` body → attachments → `[↩ Reply] [↩↩ Reply all] [→ Forward]`.

Prefills (unchanged): Reply → `to: senderEmail`, `subject: Re: …`, quoted body; Reply all → recipients included; Forward → `Fwd: …`, empty `to`, forwarded-message header block.

**Snooze menu:** Tonight 8pm / Tomorrow 8am / Next week → `snooze.mutate({ id, until: SNOOZE_PRESETS[p]().toISOString() })` (service no-ops if not INBOX), plus **`↩ Wake up now`** when snoozed → `unsnooze.mutate(id)`. All menu items `disabled={mutation.isPending}`.

**Drafts:** a draft opened via j/k shows `[✎ Edit draft]` in place of Reply/Reply-all/Forward — it closes the view and opens ComposeWindow prefilled (`draftComposeData`). Reply/Forward never run against a draft (they would fabricate a second message).

### `ComposeWindow.tsx`
`position: fixed; bottom: 0; right: 24px; width: var(--compose-w)`; `@media (max-width: 768px)` → full-width bottom-sheet. Header `--c-compose-hd` with minimize / fullscreen / close.

```typescript
const [draftId] = useState(() => composeData.draftId ?? crypto.randomUUID());  // §0.6 — id at open
const [error, setError] = useState<string | null>(null);
const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);

// Debounced autosave, 2s, cleaned up on every change and on unmount (guardrails #6, #7)
useEffect(() => {
  if (!subject && !body) return;
  if (autosave.current) clearTimeout(autosave.current);
  autosave.current = setTimeout(() => {
    saveDraft.mutate({ draftId, to, cc, bcc, subject, body });
  }, 2000);
  return () => { if (autosave.current) clearTimeout(autosave.current); };
}, [subject, body, to, cc, bcc]);

const parseTokens = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);

const handleSend = () => {
  if ([...parseTokens(to), ...parseTokens(cc), ...parseTokens(bcc)].length === 0) {
    setError('Please specify at least one recipient');   // never fail silently (guardrail Q20)
    return;
  }
  setError(null);
  if (autosave.current) clearTimeout(autosave.current);
  if (!send.isPending) sendEmail.mutate({ draftId, to, cc, bcc, subject, body });
  setComposeData(null);
  showToast('Message sent');
};

const handleClose = () => {
  if (autosave.current) clearTimeout(autosave.current);
  if (subject || body) { saveDraft.mutate({ draftId, to, cc, bcc, subject, body });
                         showToast('Draft saved'); }
  setComposeData(null);   // empty compose → nothing written (§0.6)
};
```
Fields: `To` (with inline red error beneath), `Cc/Bcc` toggle, `Subject`, body textarea (`min-height: 200px`), footer `[Send ▾] [📎] [A] [⋯] [🗑]`. Reply prefills set `composeData.replyToId`.

Implementation notes (amendments to the snippet above):
- The window renders as `<ComposeWindow key={ui.composeToken} />`; the token remounts it on every open/replace (§0.6). Payload reads go through a `latest` ref so handlers never rebuild the `{draftId, to, cc, bcc, subject, body}` clump.
- Unmount saves the pending content **unless** `settled` was set (✕ / Send / 🗑) — that is the "replace saves its draft" path.
- **🗑 discards**: clears the autosave timer, `permanentDelete([draftId])` (no-op if never materialized), closes with no save and no toast.
- Recipient validation reuses the shared `splitList` from `utils/splitList.ts`.

### `ui/` atoms
`Avatar` (initials, deterministic pastel), `Badge`, `IconButton` (`aria-label` required), `LabelChip` (click → `changeLabel`, `stopPropagation`), `Spinner`, `Toast` (fixed bottom-center, auto-dismiss), `EmptyState`.

### `EmptyState.tsx` — per-View copy, never hardcoded globally
| View | Message |
|---|---|
| inbox | Your inbox is empty |
| starred / important / snoozed | No starred / important / snoozed messages |
| sent / drafts | No sent messages / No drafts |
| spam / trash | No spam messages / Trash is empty |
| all | No messages |
| label | No messages labelled "{activeLabel}" |
| search | No results for "{search}" |

---

## 11. Behavior Contract

| Interaction | Action |
|---|---|
| Click sidebar item | `changeView(v)` — clears openEmail, selection, search, activeLabel |
| Click user label chip | `changeLabel(name)` → view `'label'`, same cleanup |
| Search (debounced 200ms) | sets `search`; list becomes global matches; badges unchanged |
| Click star / flag in row | toggle mutation + `stopPropagation`, disabled while pending |
| Click row | `setOpenEmailId(id)` only |
| Open email (any route) | `EmailView` marks read on `[email.id]` |
| Hover archive / trash / snooze | container-keyed handler + `stopPropagation` |
| Toolbar delete | `selected ∩ visible`, partitioned by container → `permanentDelete` / `moveToTrash` → `clearSelection()` |
| Delete label | `"Delete forever"` if all selected ∈ `{TRASH, SPAM, DRAFT}`, else `"Delete"` |
| Archive | `INBOX → null`; all other containers no-op |
| Restore | SPAM → INBOX; TRASH → `restoreTo ?? INBOX` (absent→INBOX, null→stays archived), then clear `restoreTo` |
| Snooze preset | `snooze.mutate` — service no-ops unless `container === 'INBOX'` |
| Open email leaves view | `App` effect nulls `openEmailId` → back to list |
| Send compose | in-place `DRAFT → SENT`, or create as `SENT` with the open-assigned id → close → toast |
| Close compose with content | `saveDraft` (updates only `DRAFT`) → toast "Draft saved" |
| Close compose empty | nothing written |
| Send with 0 recipients | inline error, window stays open |
| Keyboard `c` `/` `Escape` | compose / focus search / close email → compose |
| Keyboard `j` `k` | open next/older, previous/newer in `visibleIds`; `j` opens first when none open; `k` no-op at top |
| Keyboard `e` `#` `s` `u` | archive / delete-route / star / mark-unread on the open email |
| Any shortcut while typing | ignored |

---

## 12. Implementation Order

Each step must compile before the next begins.

1. `index.html` — Google Fonts, `<title>Gmail</title>`, meta description
2. `src/index.css` — tokens, reset, `prefers-reduced-motion`
3. `src/types/email.ts` — §3 exactly
4. `src/data/mockEmails.ts` — 25 emails per §4
5. `src/services/mockEmailService.ts` — **`npm run build` checkpoint**
6. `src/main.tsx` — provider + devtools + `staleTime/gcTime: Infinity, retry: false` + `notifyOnChangeProps: 'all'`
7. `src/hooks/useEmails.ts` — `selectForView`, `selectUnreadCount`
8. `src/hooks/useEmailMutations.ts`
8b. `src/utils/` — `formatDate`, `snooze`, `splitList` (+ `draftCompose` with the compose step); `hooks/useDeleteRoute.ts`
9. `src/store/useUIStore.ts` + `UIStoreContext.ts` — **`npm run build` checkpoint**
10. `ui/` atoms
11. `layout/AppShell.tsx` — grid only; check 1440/1280/1024/768
12. `layout/TopBar.tsx` + `layout/Sidebar.tsx` — verify view switching, label pseudo-view, badges on Inbox + labels only, compose open
13. `email/EmailRow.tsx` + `email/EmailList.tsx` — verify stop-propagation, row click sets `openEmailId` only (drafts open compose), filtering, `visibleIds` emission
14. `email/EmailToolbar.tsx` — intersection + delete-route label — **`npm run build` checkpoint**
15. `email/EmailView.tsx` — mark-read effect, prefills, snooze menu, container-routed actions, draft **Edit draft**
16. `compose/ComposeWindow.tsx` — draftId-at-open, keyed remount, autosave debounce + `DRAFT`-only update, discard, send validation, mobile sheet
17. `hooks/useKeyboardShortcuts.ts` + wire actions
18. `App.tsx` — context provider, derived `visibleIds`, auto-close effect, keyboard, Toast — **final `npm run build` checkpoint**

---

## 13. Quality Checklist

**Data & logic**
- [ ] `npm run build` exits zero
- [ ] No console/React warnings
- [ ] Devtools show exactly one `['emails']` query key
- [ ] No `folder` field and no flat `labels` array anywhere in `src/`

**Views**
- [ ] Every sidebar item filters correctly; label chips open the `'label'` pseudo-view
- [ ] Inbox excludes future-snoozed; Snoozed includes only them
- [ ] All Mail excludes Trash, Spam **and** Drafts
- [ ] Search ignores the current View, returns matches from non-Trash/non-Spam only, and **does not change any badge**

**Container semantics**
- [ ] Archive: INBOX → `null`, email still in All Mail with flags intact; archive on SENT/DRAFT/`null` does nothing
- [ ] Starred email in Trash does **not** appear under Starred
- [ ] Delete from Inbox → Trash with `restoreTo = 'INBOX'`; Delete from Sent → `restoreTo = 'SENT'`; Delete from All Mail (archived) → `restoreTo = null`
- [ ] Restore from Trash returns to `restoreTo` (archived stays out of Inbox); Restore from Spam → Inbox
- [ ] Delete in Drafts removes the draft outright; no row in Trash
- [ ] Delete in Spam is permanent; button reads "Delete forever"
- [ ] Snooze only works on INBOX emails; past `snoozedUntil` re-enters Inbox on next render with no timer
- [ ] No service call ever throws; a mixed bulk selection completes

**Selection & bulk**
- [ ] Bulk action target = `selected ∩ visibleIds` (select 3 → search → only visible ones are acted on)
- [ ] Selection clears on `changeView`, survives a search keystroke
- [ ] Actions disabled while `isPending`; selection cleared after success

**Compose**
- [ ] `draftId` exists from open; empty close writes nothing; content close → "Draft saved" + row in Drafts
- [ ] Autosave fires 2s after last keystroke and cleans up on unmount
- [ ] Send <2s after open creates the record as `SENT` with the open-assigned id
- [ ] A save in flight across Send finds `SENT` and no-ops — no ghost draft appears
- [ ] Sending an existing draft transitions the same id `DRAFT → SENT`; the draft leaves Drafts
- [ ] A draft row (click or Enter) opens ComposeWindow prefilled with `draftId`/subject/body/recipients — never EmailView; EmailView opened via `j`/`k` shows **Edit draft** instead of Reply
- [ ] 🗑 discards without saving (any autosaved row is removed); a replaced compose (`c`/Reply while open) remounts fresh and saves its previous content
- [ ] Zero recipients → inline error, window stays open; Cc-only send succeeds
- [ ] Reply/Reply-all/Forward prefill correctly

**Keyboard & read state**
- [ ] `c` `/` `j` `k` `Escape` `e` `#` `s` `u` work; all silent while typing
- [ ] Rows activate with Enter **and** Space
- [ ] `j` opens the first email when none is open; `k` does nothing at the top
- [ ] Opening by click **or** keyboard marks read (one effect in `EmailView`)
- [ ] `u` marks unread while viewing and is not immediately overridden
- [ ] Acting on the open email returns to the list when it leaves the view

**A11y / responsive / motion**
- [ ] `aria-label` on all icon controls, `aria-pressed` on star/flag, checkbox labels, Tab + Enter/Space
- [ ] 1440/1280/1024/768 intact; ≤768px rows show checkbox·sender·subject; compose is a full-width sheet
- [ ] All transitions use `var(--dur)`; reduced-motion zeroes them

---

## 14. Anti-Patterns — Banned

| ❌ Never | ✅ Always |
|---|---|
| `email.folder = 'inbox'` or `email.labels.includes('INBOX')` | `email.container === 'INBOX'` |
| Flat `labels: SystemLabel[]` | `container` + `flags` + `userLabels` |
| Deleting a record outside Trash/Spam/Drafts | `moveToTrash`, recording `restoreTo` first |
| Routing delete on `view` | Routing on the email's own `container` |
| Throwing from a service operation | Silent no-op — operations are total |
| `saveDraft` creating a row for a stale id | Update only when `container === 'DRAFT'` |
| Send = delete draft + push a new record | In-place `DRAFT → SENT`, same id |
| `restore` fallback that ignores `restoreTo === null` | Absent → INBOX, null → stays archived |
| Mark-read in the row's `onClick` | `useEffect` in `EmailView` on `[email.id]` |
| Bulk action over raw `selectedIds` | `selected ∩ visibleIds`, then partition |
| Clearing selection on search keystroke | Clear on `changeView` only |
| Search scoped to the current View | Search is global (still excludes Trash/Spam) |
| Badge counts recomputed from search results | `selectForView(view, '', activeLabel)` only |
| Badge pill on Starred/All Mail | Inbox + user-label Views only |
| Snooze moving containers / a wake-up job | `snoozedUntil` timestamp predicate (ADR-0002) |
| Separate query keys per View | One `['emails']` |
| `setSelectedIds(sameRef)` | `setSelectedIds(prev => new Set(prev))` |
| `setTimeout` without cleanup | Always return `clearTimeout` |
| Shortcuts firing inside inputs | `isTyping()` guard |
| Hardcoded colors / durations in components | `var(--c-*)` / `var(--dur)` |
| Compose `width: 520px` at 768px | Full-width bottom-sheet |
| Row-internal clicks opening the email | `e.stopPropagation()` |
| Any `any` | Proper types or `unknown` + narrowing |
| Silent send failure | Inline recipient error |
