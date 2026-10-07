# Gmail-Style Email Interface — Agent Build Plan (v3 — Final)

> **Superseded by [gmail-interface-v4.md](./gmail-interface-v4.md).** Kept for history only — v4 folds the 21 decisions from the grilling session (container/flag split, container-keyed delete routing, compose identity, selection intersection) and reflects `GLOSSARY.md` + ADR-0001/0002. Do not build from this file.

> **Stack**: React 19.3 · TypeScript 5.4+ · TanStack Query v5 · Vite · Vanilla CSS
> **Constraint**: 100% frontend. No backend. No auth. No external API. All data is in-memory mock.
> **Code density**: If something can be done in 10 lines, do NOT write 100.

---

## 0. Core Mental Model — Read This Before Writing a Single Line

### 0.1 Label-based, not folder-based

Gmail messages carry **sets of labels**. The same message can have:
```
INBOX + STARRED + IMPORTANT + "Work"
```
There is no single "folder." Sidebar views are just filter predicates over one flat list.

```
Sidebar view   →  Predicate on email.labels / email.snoozedUntil
───────────────────────────────────────────────────────────────────
Inbox          →  'INBOX' ∈ labels  AND  NOT snoozed-and-future
Starred        →  'STARRED' ∈ labels
Important      →  'IMPORTANT' ∈ labels
Snoozed        →  snoozedUntil != null AND new Date(snoozedUntil) > now
Sent           →  'SENT' ∈ labels
Drafts         →  'DRAFT' ∈ labels
Spam           →  'SPAM' ∈ labels
Trash          →  'TRASH' ∈ labels
All Mail       →  'SPAM' ∉ labels  AND  'TRASH' ∉ labels
```

### 0.2 Snooze re-entry rule
A snoozed email with `snoozedUntil` in the **past** is treated as un-snoozed — it reappears in Inbox.
```typescript
const isSnoozedAndFuture = (e: Email) =>
  !!e.snoozedUntil && new Date(e.snoozedUntil).getTime() > Date.now();

// Inbox predicate:
e.labels.includes('INBOX') && !isSnoozedAndFuture(e)
// Snoozed predicate:
isSnoozedAndFuture(e)
```

### 0.3 Delete semantics (critical)
```
Context               Action          Label change
──────────────────────────────────────────────────────────────────
Inbox / Any view  →  "Delete"    →   remove INBOX/SPAM, add TRASH
Trash view        →  "Delete"    →   permanentDelete (remove from store)
Spam view         →  "Delete"    →   permanentDelete (remove from store)
Any view          →  "Archive"   →   remove INBOX only
Any view          →  "Restore"   →   remove TRASH/SPAM, add INBOX
```
The toolbar and email-view action buttons must check the current view and route accordingly.

### 0.4 Single source of truth
There is **one query key**: `['emails']`. All views, all counts, all derived lists come from this one cached array. There are **no** additional query keys per view.

### 0.5 No threading
Each email is an independent message. No thread grouping. State this as a comment in `EmailList.tsx`.

### 0.6 One compose window at a time
Only one `ComposeWindow` can exist simultaneously. Opening compose while one is already open replaces the existing compose (prompts save-draft first if content exists).

---

## IMPLEMENTATION GUARDRAILS

Read and follow all 17 rules before touching any component:

1. **Label model is non-negotiable.** Never store `folder` as a single string field on `Email`.
2. **One query key.** `['emails']` is the only TanStack Query key in the entire app. `getById` is derived from the cached list — not a separate query.
3. **Event propagation.** Every interactive element inside `EmailRow` (checkbox, star, important marker, hover action icons, label chips, attachment links) must call `event.stopPropagation()` to prevent opening the email.
4. **Keyboard shortcuts must not fire while typing.** Guard ALL `keydown` handlers: if `document.activeElement` is `INPUT`, `TEXTAREA`, `SELECT`, or `[contenteditable]`, do nothing.
5. **Set mutation pattern.** Never mutate and re-set the same `Set` reference. Always: `setSelectedIds(prev => { const next = new Set(prev); next.add/delete(id); return next; })`.
6. **Timer cleanup.** Every `setTimeout` or `setInterval` inside a `useEffect` must return a cleanup function. Debounced autosave must also clean up on unmount.
7. **Compose autosave is debounced, not immediate.** Fire `saveDraft` 2 seconds after the last keystroke, not on every change. Clear the timer on unmount.
8. **Search is global.** Searching while in a specific view searches across ALL emails (not just the current view). The search bar moves focus to the global search, and results show `All Mail` filtered by the query.
9. **Responsive column priority.** At ≤768px, email rows show only: [checkbox · sender · subject]. Preview, date, labels, and action icons collapse. The subject truncates but never disappears.
10. **Compose is full-width at ≤768px.** The fixed-position compose window becomes a bottom-sheet (full width, `bottom: 0; left: 0; right: 0`) on mobile.
11. **Respect `prefers-reduced-motion`.** All CSS transitions reference `--dur`. Set `--dur: 0ms` in a `@media (prefers-reduced-motion: reduce)` block. No JS animation logic needed.
12. **No double-submit.** Disable the Send button and all mutation-triggering buttons while `mutation.isPending === true`. Use `disabled={mutation.isPending}` or an equivalent guard.
13. **User labels are display-only in this prototype.** `userLabels: string[]` is populated in mock data and rendered as chips. There is no CRUD UI for creating or deleting user labels.
14. **Unread counts are always derived from the live `['emails']` cache.** Never maintain a separate counter state.
15. **Delete from Toolbar is context-aware.** Check `view` from UI state: if `view === 'trash' || view === 'spam'`, call `permanentDelete`; otherwise call `moveToTrash`.
16. **`staleTime: Infinity` on QueryClient.** Data never becomes stale on its own — it only refreshes when `invalidateQueries` is called after a mutation.
17. **Run `npm run build` (zero TS errors) after steps 5, 9, 13, and 18.** Fix errors before proceeding.

---

## 1. Project Bootstrap

```bash
# workspace root: c:\Users\gokul\OneDrive\Desktop\email interface
npx -y create-vite@latest ./ --template react-ts
npm install @tanstack/react-query @tanstack/react-query-devtools
```

Delete everything in `src/` except `main.tsx` and `vite-env.d.ts`.

**`src/main.tsx`**:
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
      staleTime: Infinity,   // in-memory data never goes stale on its own
      gcTime: Infinity,      // never garbage-collect while app is open
      retry: false,          // mock never fails, retries would just hide bugs
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
│
├── types/
│   └── email.ts
│
├── data/
│   └── mockEmails.ts
│
├── services/
│   └── mockEmailService.ts
│
├── hooks/
│   ├── useEmails.ts           # useQuery + selectors + selectForView
│   ├── useEmailMutations.ts   # all useMutation hooks
│   └── useKeyboardShortcuts.ts
│
├── store/
│   └── useUIStore.ts
│
└── components/
    ├── layout/
    │   ├── AppShell.tsx
    │   ├── TopBar.tsx
    │   └── Sidebar.tsx
    ├── email/
    │   ├── EmailList.tsx
    │   ├── EmailRow.tsx
    │   ├── EmailToolbar.tsx
    │   └── EmailView.tsx
    ├── compose/
    │   └── ComposeWindow.tsx
    └── ui/
        ├── Avatar.tsx
        ├── Badge.tsx
        ├── IconButton.tsx
        ├── LabelChip.tsx
        ├── Spinner.tsx
        ├── EmptyState.tsx
        └── Toast.tsx
```

---

## 3. Types (`src/types/email.ts`)

```typescript
// INVARIANTS (read before editing):
// - SPAM and TRASH are mutually exclusive with INBOX.
// - A message in TRASH still exists in the store. permanentDelete removes it.
// - DRAFT messages have recipients: [] until sent.
// - snoozedUntil does not add/remove labels; the sidebar filter handles re-entry.

export type SystemLabel =
  | 'INBOX'
  | 'SENT'
  | 'DRAFT'
  | 'SPAM'
  | 'TRASH'
  | 'STARRED'
  | 'IMPORTANT';

export type SidebarView =
  | 'inbox' | 'starred' | 'important' | 'snoozed'
  | 'sent'  | 'drafts'  | 'spam'      | 'trash' | 'all';

export interface Attachment {
  name: string;
  size: string;  // human-readable: "2.4 MB"
  type: string;  // MIME type
}

export interface Email {
  id: string;
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
  labels: SystemLabel[]; // many-to-many; a message can carry multiple
  userLabels: string[];  // display-only: ["Work", "Finance"] — no CRUD UI
  attachments: Attachment[];
  snoozedUntil: string | null; // ISO 8601 or null
}

export interface ComposeData {
  draftId?: string;   // set when re-editing a saved draft
  replyToId?: string; // set when replying; for display only
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

export const USER_LABEL_COLORS: Record<string, string> = {
  'Work':    '#0b8043',
  'Finance': '#c0392b',
  'Personal':'#1565c0',
};
```

---

## 4. Mock Data (`src/data/mockEmails.ts`)

Create **25 realistic emails**:

| Count | Labels | Notes |
|---|---|---|
| 6 | `['INBOX']` | Mix read/unread (3 each) |
| 4 | `['INBOX','IMPORTANT']` | 2 unread |
| 3 | `['INBOX','STARRED']` | 1 unread |
| 2 | `['INBOX','STARRED','IMPORTANT']` | both read |
| 2 | `['INBOX']` | `snoozedUntil` = tomorrow 8am |
| 3 | `['SENT']` | all read, sender = "Me" |
| 2 | `['DRAFT']` | `recipients: []`, partial subject/body |
| 2 | `['SPAM']` | generic spam content |
| 1 | `['TRASH']` | deleted newsletter |

Realistic senders: GitHub (`noreply@github.com`), Stripe (`receipts@stripe.com`), LinkedIn, Google One, a human colleague named "Sarah Chen", another named "Marcus Webb".

At least 3 inbox emails: `userLabels: ['Work']`
At least 2 inbox emails: `userLabels: ['Finance']`
At least 2 emails: `attachments: [{ name: 'invoice.pdf', size: '1.2 MB', type: 'application/pdf' }]`

Export: `export const MOCK_EMAILS: Email[] = [...]`

---

## 5. Service Layer (`src/services/mockEmailService.ts`)

> **No `nanoid` dependency.** Use `crypto.randomUUID()` throughout.

```typescript
import { MOCK_EMAILS } from '../data/mockEmails';
import type { Email, ComposeData } from '../types/email';

let store: Email[] = structuredClone(MOCK_EMAILS);
const delay = (ms = 80) => new Promise<void>(r => setTimeout(r, ms));
const mutate = (fn: () => void): Email[] => { fn(); return [...store]; };

export const emailService = {

  // The ONLY read method — derive everything else from this list
  getAll: async (): Promise<Email[]> => {
    await delay();
    return [...store];
  },

  send: async (data: ComposeData): Promise<void> => {
    await delay(120);
    mutate(() => {
      if (data.draftId) store = store.filter(e => e.id !== data.draftId);
      store.push({
        id: crypto.randomUUID(),
        sender: 'Me', senderEmail: 'me@gmail.com',
        recipients: data.to.split(',').map(s => s.trim()).filter(Boolean),
        cc: data.cc.split(',').map(s => s.trim()).filter(Boolean),
        bcc: data.bcc.split(',').map(s => s.trim()).filter(Boolean),
        subject: data.subject || '(no subject)',
        preview: data.body.slice(0, 120),
        body: data.body,
        timestamp: new Date().toISOString(),
        unread: false, labels: ['SENT'], userLabels: [], attachments: [], snoozedUntil: null,
      });
    });
  },

  // Returns the saved draft's id (new or existing)
  saveDraft: async (data: ComposeData): Promise<string> => {
    await delay();
    const existing = data.draftId ? store.find(e => e.id === data.draftId) : null;
    if (existing) {
      mutate(() => Object.assign(existing, {
        subject: data.subject, preview: data.body.slice(0, 120),
        body: data.body, timestamp: new Date().toISOString(),
      }));
      return existing.id;
    }
    const id = crypto.randomUUID();
    mutate(() => store.push({
      id, sender: 'Me', senderEmail: 'me@gmail.com',
      recipients: [], cc: [], bcc: [],
      subject: data.subject || '(no subject)',
      preview: data.body.slice(0, 120), body: data.body,
      timestamp: new Date().toISOString(),
      unread: false, labels: ['DRAFT'], userLabels: [], attachments: [], snoozedUntil: null,
    }));
    return id;
  },

  toggleStar: async (id: string): Promise<void> => {
    await delay();
    mutate(() => {
      const e = store.find(m => m.id === id)!;
      e.labels = e.labels.includes('STARRED')
        ? e.labels.filter(l => l !== 'STARRED')
        : [...e.labels, 'STARRED'];
    });
  },

  toggleImportant: async (id: string): Promise<void> => {
    await delay();
    mutate(() => {
      const e = store.find(m => m.id === id)!;
      e.labels = e.labels.includes('IMPORTANT')
        ? e.labels.filter(l => l !== 'IMPORTANT')
        : [...e.labels, 'IMPORTANT'];
    });
  },

  markRead: async (ids: string[], unread: boolean): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => {
      const e = store.find(m => m.id === id);
      if (e) e.unread = unread;
    }));
  },

  // Archive: remove INBOX only. Message stays in All Mail + other labels.
  archive: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => {
      const e = store.find(m => m.id === id);
      if (e) e.labels = e.labels.filter(l => l !== 'INBOX');
    }));
  },

  // Move to Trash: remove INBOX/SPAM, add TRASH. NOT a permanent delete.
  moveToTrash: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => {
      const e = store.find(m => m.id === id);
      if (!e) return;
      e.labels = e.labels.filter(l => l !== 'INBOX' && l !== 'SPAM');
      if (!e.labels.includes('TRASH')) e.labels.push('TRASH');
    }));
  },

  // Permanent delete: only called from Trash/Spam view. Actually removes.
  permanentDelete: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => { store = store.filter(e => !ids.includes(e.id)); });
  },

  moveToSpam: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => {
      const e = store.find(m => m.id === id);
      if (!e) return;
      e.labels = e.labels.filter(l => l !== 'INBOX' && l !== 'TRASH');
      if (!e.labels.includes('SPAM')) e.labels.push('SPAM');
    }));
  },

  restore: async (ids: string[]): Promise<void> => {
    await delay();
    mutate(() => ids.forEach(id => {
      const e = store.find(m => m.id === id);
      if (!e) return;
      e.labels = e.labels.filter(l => l !== 'TRASH' && l !== 'SPAM');
      if (!e.labels.includes('INBOX')) e.labels.push('INBOX');
    }));
  },

  snooze: async (id: string, until: string): Promise<void> => {
    await delay();
    mutate(() => {
      const e = store.find(m => m.id === id);
      if (e) e.snoozedUntil = until;
    });
  },

  unsnooze: async (id: string): Promise<void> => {
    await delay();
    mutate(() => {
      const e = store.find(m => m.id === id);
      if (e) e.snoozedUntil = null;
    });
  },
};
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

// ── Helpers ──────────────────────────────────────────────────────────────────

const isSnoozedAndFuture = (e: Email) =>
  !!e.snoozedUntil && new Date(e.snoozedUntil).getTime() > Date.now();

export const selectForView = (
  emails: Email[],
  view: SidebarView,
  // search is GLOBAL — not scoped to view (see guardrail #8)
  search: string,
): Email[] => {
  let base: Email[];

  if (search.trim()) {
    // Global search: ignore the current view filter
    const q = search.toLowerCase();
    base = emails.filter(e =>
      e.sender.toLowerCase().includes(q) ||
      e.senderEmail.toLowerCase().includes(q) ||
      e.subject.toLowerCase().includes(q) ||
      e.preview.toLowerCase().includes(q) ||
      e.body.toLowerCase().includes(q)
    );
  } else {
    switch (view) {
      case 'inbox':     base = emails.filter(e => e.labels.includes('INBOX') && !isSnoozedAndFuture(e)); break;
      case 'starred':   base = emails.filter(e => e.labels.includes('STARRED')); break;
      case 'important': base = emails.filter(e => e.labels.includes('IMPORTANT')); break;
      case 'snoozed':   base = emails.filter(isSnoozedAndFuture); break;
      case 'sent':      base = emails.filter(e => e.labels.includes('SENT')); break;
      case 'drafts':    base = emails.filter(e => e.labels.includes('DRAFT')); break;
      case 'spam':      base = emails.filter(e => e.labels.includes('SPAM')); break;
      case 'trash':     base = emails.filter(e => e.labels.includes('TRASH')); break;
      case 'all':       base = emails.filter(e => !e.labels.includes('SPAM') && !e.labels.includes('TRASH')); break;
    }
  }

  return base.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// Unread badge counts — always derived from live cache, never separate state
export const selectUnreadCount = (emails: Email[], view: SidebarView): number =>
  selectForView(emails, view, '').filter(e => e.unread).length;
```

### `src/hooks/useEmailMutations.ts`

All mutations: `fire → mock store changes → invalidate ['emails'] → re-render`.
No optimistic updates — 80ms delay is imperceptible, no rollback complexity needed.

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import { EMAIL_QK } from './useEmails';

// Factory: single-argument mutations
const useMut = <T>(fn: (arg: T) => Promise<unknown>) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => qc.invalidateQueries({ queryKey: EMAIL_QK }),
  });
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

// Multi-argument mutations — wrap to single object arg
export const useMarkRead = () =>
  useMut(({ ids, unread }: { ids: string[]; unread: boolean }) =>
    emailService.markRead(ids, unread));

export const useSnooze = () =>
  useMut(({ id, until }: { id: string; until: string }) =>
    emailService.snooze(id, until));

export const useSaveDraft = () =>
  useMut(emailService.saveDraft);
```

---

## 7. UI State (`src/store/useUIStore.ts`)

```typescript
import { useState, useCallback } from 'react';
import type { SidebarView, ComposeData } from '../types/email';

export const useUIStore = () => {
  const [view, setView]               = useState<SidebarView>('inbox');
  const [search, setSearch]           = useState('');
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composeData, setComposeData] = useState<ComposeData | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast]             = useState<string | null>(null);

  // ── Selection — ALWAYS create a new Set (React uses reference equality) ──
  const toggleSelect = useCallback((id: string) =>
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    }), []);

  const selectAll     = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // ── View change resets all ephemeral state ────────────────────────────────
  const changeView = useCallback((v: SidebarView) => {
    setView(v);
    setOpenEmailId(null);
    setSelectedIds(new Set());
    setSearch('');
  }, []);

  // ── Toast — auto-dismiss after 4s; cleanup prevents memory leaks ─────────
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);  // caller can ignore; cleanup fires on next showToast
  }, []);

  return {
    view, changeView,
    search, setSearch,
    openEmailId, setOpenEmailId,
    selectedIds, toggleSelect, selectAll, clearSelection,
    composeData, setComposeData,
    sidebarOpen, setSidebarOpen,
    toast, showToast,
  };
};

export type UIStore = ReturnType<typeof useUIStore>;
```

Pass the entire `UIStore` object via a single React Context (`UIStoreContext`). Do not split into multiple contexts.

```typescript
// src/store/UIStoreContext.ts
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

> **Guardrail #4**: shortcuts must be silent when focus is inside a form field.

```typescript
import { useEffect } from 'react';
import type { UIStore } from '../store/useUIStore';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const isTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  return TYPING_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable;
};

export const useKeyboardShortcuts = (ui: UIStore, visibleIds: string[]) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;
      switch (e.key) {
        case 'c': ui.setComposeData({ to:'', cc:'', bcc:'', subject:'', body:'' }); break;
        case '/': e.preventDefault(); document.getElementById('search-input')?.focus(); break;
        case 'Escape':
          if (ui.openEmailId) ui.setOpenEmailId(null);
          else if (ui.composeData) {/* handled by ComposeWindow */}
          break;
        case 'j': {
          // Move to next email in visible list
          const idx = visibleIds.indexOf(ui.openEmailId ?? '');
          const next = visibleIds[idx + 1];
          if (next) ui.setOpenEmailId(next);
          break;
        }
        case 'k': {
          const idx = visibleIds.indexOf(ui.openEmailId ?? '');
          const prev = visibleIds[idx - 1];
          if (prev !== undefined) ui.setOpenEmailId(prev);
          break;
        }
        case 'e': if (ui.openEmailId) {/* trigger archive via ref/callback */} break;
        case '#': if (ui.openEmailId) {/* trigger delete via ref/callback */} break;
        case 's': if (ui.openEmailId) {/* trigger star toggle */} break;
        case 'u': if (ui.openEmailId) {/* trigger mark unread */} break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui, visibleIds]);
};
```

Wire `e`, `#`, `s`, `u` by passing mutation callbacks into the hook from `App.tsx`.

---

## 9. Design System (`src/index.css`)

```css
@import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600&family=Roboto:wght@300;400;500&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

:root {
  /* Colors */
  --c-bg:           #f6f8fc;
  --c-surface:      #ffffff;
  --c-border:       #e0e0e0;
  --c-primary:      #1a73e8;
  --c-primary-dark: #1557b0;
  --c-danger:       #d93025;
  --c-text:         #202124;
  --c-muted:        #5f6368;
  --c-hover:        #f1f3f4;
  --c-selected:     #e8f0fe;
  --c-unread-row:   #ffffff;
  --c-read-row:     #f2f6fc;
  --c-compose-hd:   #404040;
  --c-star-fill:    #f4b400;
  --c-important:    #e37400;

  /* Typography */
  --font:       'Google Sans', 'Roboto', system-ui, sans-serif;
  --text-xs:    11px;   --text-sm: 13px;
  --text-base:  14px;   --text-lg: 16px;
  --fw-normal:  400;    --fw-medium: 500;  --fw-bold: 600;

  /* Layout */
  --topbar-h:   64px;   --sidebar-w: 256px;
  --row-h:      52px;   --compose-w: 520px;

  /* Elevation */
  --shadow-sm: 0 1px 2px rgba(0,0,0,.10);
  --shadow-md: 0 2px 6px rgba(0,0,0,.14);
  --shadow-lg: 0 4px 16px rgba(0,0,0,.18);

  /* Spacing */
  --sp-1:4px; --sp-2:8px; --sp-3:12px; --sp-4:16px; --sp-6:24px; --sp-8:32px;

  /* Radii */
  --r-sm: 4px;  --r-md: 8px;  --r-pill: 9999px;

  /* Motion — override to 0ms for reduced-motion users */
  --dur:  140ms;
  --ease: cubic-bezier(.2,0,0,1);
}

/* Guardrail #11: respect system motion preference */
@media (prefers-reduced-motion: reduce) {
  :root { --dur: 0ms; }
}

body {
  font-family: var(--font);
  font-size: var(--text-base);
  color: var(--c-text);
  background: var(--c-bg);
  -webkit-font-smoothing: antialiased;
  height: 100dvh;
  overflow: hidden;
}
```

All component CSS must use `transition: ... var(--dur) var(--ease)` so `prefers-reduced-motion` zeroes them automatically.

---

## 10. Component Specifications

### `AppShell.tsx`
```css
.shell {
  display: grid;
  grid-template-rows: var(--topbar-h) 1fr;
  grid-template-columns: var(--sidebar-w) 1fr;
  height: 100dvh;
  overflow: hidden;
}
.shell[data-sidebar-closed] { grid-template-columns: 0 1fr; }

/* Sidebar transitions */
.sidebar { transition: width var(--dur) var(--ease); overflow: hidden; }
```
Renders: `<TopBar>` (col-span 2), `<Sidebar>`, `<EmailList>` or `<EmailView>`.
`<ComposeWindow>` and `<Toast>` are `position: fixed`.

---

### `TopBar.tsx`
```
[☰]  Gmail  [───────── search (id="search-input") ─────────]  [?] [⚙] [avatar]
```
- Search: controlled input, **debounce 200ms** before updating `search` in UIStore.
- Cleanup pattern (MUST follow):
  ```typescript
  useEffect(() => {
    const id = setTimeout(() => setSearch(localValue), 200);
    return () => clearTimeout(id); // cleanup prevents stale updates
  }, [localValue]);
  ```
- When search is non-empty, show a clear `×` button inside the input.
- `position: sticky; top: 0; z-index: 200; grid-column: 1 / -1`

---

### `Sidebar.tsx`

Structure:
```
┌─────────────────────┐
│  [+ Compose]        │  ← pill button, always visible
├─────────────────────┤
│  scrollable nav     │  ← overflow-y: auto; flex: 1
│  Inbox       (12)   │
│  Starred            │
│  ...                │
│  ── Labels ──       │
│  ● Work             │
│  ● Finance          │
└─────────────────────┘
```
**Critical**: the compose button and nav items live inside a flex column. Only the nav section scrolls. The compose button is NOT sticky — it sits at the top of the flex column above the scroll area, preventing overlap.

```css
.sidebar { display: flex; flex-direction: column; height: 100%; overflow: hidden; }
.sidebar__compose { flex-shrink: 0; padding: var(--sp-2) var(--sp-3); }
.sidebar__nav { flex: 1; overflow-y: auto; }
```

Active item: `background: var(--c-selected); color: var(--c-primary)`.
Unread badge: pill, `--c-primary` bg, white, `font-size: var(--text-xs)`, `max content: 99+`.
Compose button: fires `setComposeData({ to:'', cc:'', bcc:'', subject:'', body:'' })`.

---

### `EmailList.tsx`
```
<EmailToolbar>
<div class="email-list__scroll">          ← overflow-y: scroll
  <EmailRow> × N
  <EmptyState> when N === 0
  <Spinner> when isLoading
</div>
```
Passes `email.id[]` (visible IDs) up to `App.tsx` for keyboard navigation.

---

### `EmailRow.tsx`

Single-line, height `var(--row-h)`. **Column layout with explicit flex widths**:

```
[☐ 40px] [★ 32px] [▶ 24px] [Sender 160px] [Subject+preview flex-1] [Date/actions 90px]
```

**At `≤768px`**: hide preview, hide date column, collapse star+important to 48px total.
```css
@media (max-width: 768px) {
  .row__star, .row__important { display: none; }
  .row__sender { width: 120px; }
  .row__date { display: none; }
}
```

**Interaction rules (Guardrail #3 — stop propagation on every inner control)**:
```typescript
// Every inner interactive element:
<button onClick={e => { e.stopPropagation(); toggleStar.mutate(id); }}
        aria-label={starred ? 'Unstar' : 'Star'}
        aria-pressed={starred} />

<input type="checkbox"
       onClick={e => e.stopPropagation()}
       onChange={() => toggleSelect(id)}
       aria-label={`Select email from ${sender}`} />

// Label chips inside row:
<button onClick={e => e.stopPropagation()} /* label filter — future */ />

// Attachment badges inside row:
<span onClick={e => e.stopPropagation()} />
```

**Hover action icons** (`[archive] [trash] [snooze]`) appear absolutely positioned on the right:
```typescript
<button onClick={e => { e.stopPropagation(); archive.mutate([id]); }}
        aria-label="Archive" />
```

**Row click → open email** (the row `<div>` itself):
```typescript
<div role="button" tabIndex={0}
     onClick={() => { setOpenEmailId(id); markRead.mutate({ ids:[id], unread:false }); }}
     onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { ... } }}
/>
```

**Disable interactions while `isPending`** (Guardrail #12):
```typescript
<button disabled={toggleStar.isPending} onClick={...} />
```

---

### `EmailToolbar.tsx`

Two states based on `selectedIds.size`:

**Selection active**:
```
[☐ select-all]  [Archive]  [Spam]  [Delete]  [Mark read ▾]  [Move to ▾]  [Labels ▾]
```

**No selection**:
```
[↺ Refresh]  [⋯ More]
```

Delete routing (Guardrail #15):
```typescript
const handleDelete = () => {
  const ids = [...selectedIds];
  if (view === 'trash' || view === 'spam') permanentDelete.mutate(ids);
  else moveToTrash.mutate(ids);
  clearSelection();
};
```

Refresh: `queryClient.invalidateQueries({ queryKey: EMAIL_QK })`.

After every bulk action: `clearSelection()`.

---

### `EmailView.tsx`

**Header bar**:
```
[← back]  [archive]  [spam]  [delete]  [mark unread]  [snooze ▾]  [⋯ more]
```

Snooze button opens a small dropdown with `SNOOZE_PRESETS` options:
```
Tonight 8pm
Tomorrow 8am
Next week
```
Fires `snooze.mutate({ id, until: SNOOZE_PRESETS[preset]().toISOString() })`.

**Body**:
```
<h1>{subject}</h1>
<LabelChip> × userLabels
────────────────────────────────────
<Avatar initials /> | sender name <email> | timestamp | [▾ expand]
────────────────────────────────────
<pre style="white-space:pre-wrap">{body}</pre>
{attachments.length > 0 && <AttachmentList />}
────────────────────────────────────
[↩ Reply]  [↩↩ Reply All]  [→ Forward]
```

On mount: `markRead.mutate({ ids:[id], unread:false })`.

**Reply** → opens compose pre-filled:
```typescript
setComposeData({
  to: email.senderEmail,
  cc: '', bcc: '',
  subject: `Re: ${email.subject.replace(/^Re:\s*/i, '')}`,
  body: `\n\nOn ${email.timestamp}, ${email.sender} wrote:\n> ${email.body.split('\n').join('\n> ')}`,
});
```

**Reply All** → same as Reply but `to: [senderEmail, ...recipients].join(', ')`.

**Forward** → opens compose pre-filled:
```typescript
setComposeData({
  to: '', cc: '', bcc: '',
  subject: `Fwd: ${email.subject.replace(/^Fwd:\s*/i, '')}`,
  body: `\n\n---------- Forwarded message ----------\nFrom: ${email.sender}\n\n${email.body}`,
});
```

Delete from email view: same context-aware routing as toolbar (check `view`).

---

### `ComposeWindow.tsx`

`position: fixed; bottom: 0; right: 24px; width: var(--compose-w)`

**At `≤768px`** (Guardrail #10):
```css
@media (max-width: 768px) {
  .compose { left: 0; right: 0; width: 100%; bottom: 0; }
}
```

**Header** (`background: var(--c-compose-hd)`, white text):
```
[New Message / Re: … / Fwd: …]    [– minimize]  [⤢ fullscreen]  [× close]
```

**Fields**:
```
To: [input, comma-separated]
─────
Cc Bcc [show on click]
─────
Subject: [input]
─────────────────────────────────────
[textarea — body, min-height 200px]
─────────────────────────────────────
[Send ▶]  [📎]  [A]  [⋯]  [🗑]
```

**Autosave** (Guardrail #6 + #7):
```typescript
useEffect(() => {
  if (!subject && !body) return;
  const timer = setTimeout(() => {
    saveDraft.mutate({ draftId, to, cc, bcc, subject, body });
  }, 2000);
  return () => clearTimeout(timer); // ← cleanup on every change AND on unmount
}, [subject, body, to, cc, bcc]);
```

**Close behavior**:
```typescript
const handleClose = () => {
  clearTimeout(autosaveTimer.current);  // cancel pending autosave
  if (subject || body) {
    saveDraft.mutate({ draftId, to, cc, bcc, subject, body });
    showToast('Draft saved');
  }
  setComposeData(null);
};
```

**Send behavior**:
```typescript
const handleSend = () => {
  if (!to.trim()) return; // basic validation
  clearTimeout(autosaveTimer.current);
  sendEmail.mutate({ draftId, to, cc, bcc, subject, body });
  setComposeData(null);
  showToast('Message sent');
};
```

**Minimize**: toggle CSS class to `height: 48px; overflow: hidden`.
**Fullscreen**: `position: fixed; inset: var(--topbar-h) 0 0 var(--sidebar-w)`.

---

### `Toast.tsx`

```typescript
// position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)
// auto-dismissed after 4s by useUIStore.showToast
// transition: opacity var(--dur) var(--ease)
```

---

### `EmptyState.tsx`

Per-view messages (Guardrail — never hardcode):

| View | Message |
|---|---|
| inbox | "Your inbox is empty" |
| starred | "No starred messages" |
| important | "No important messages" |
| snoozed | "No snoozed messages" |
| sent | "No sent messages" |
| drafts | "No drafts" |
| spam | "No spam messages" |
| trash | "Trash is empty" |
| all | "No messages" |
| search | `No results for "${search}"` |

Render an inline SVG illustration (keep it under 20 lines) or a single large emoji as a placeholder.

---

## 11. Behavior Contract

| Interaction | Action |
|---|---|
| Click sidebar view | `changeView(v)` — clears openEmail, selection, search |
| Search (debounced 200ms) | `selectForView` is called with `search`; filter is GLOBAL across all emails |
| Click star (row) | `toggleStar.mutate(id)`, `e.stopPropagation()` |
| Click important marker | `toggleImportant.mutate(id)`, `e.stopPropagation()` |
| Click checkbox | `toggleSelect(id)`, `e.stopPropagation()` |
| Click row | `setOpenEmailId(id)` + `markRead.mutate({ids:[id], unread:false})` |
| Click hover archive icon | `archive.mutate([id])`, `e.stopPropagation()` |
| Bulk delete (non-trash view) | `moveToTrash.mutate([...selectedIds])` → `clearSelection()` |
| Bulk delete (trash/spam view) | `permanentDelete.mutate([...selectedIds])` → `clearSelection()` |
| Archive | `archive.mutate(ids)` — removes INBOX only |
| Restore | `restore.mutate(ids)` — removes TRASH/SPAM, adds INBOX |
| Send compose | `sendEmail.mutate(data)` → close → toast "Message sent" |
| Close compose (with content) | `saveDraft.mutate(data)` → toast "Draft saved" → close |
| Open draft from Drafts view | `setComposeData({ draftId: email.id, ...email fields })` |
| Snooze email | Preset dropdown → `snooze.mutate({ id, until })` → email leaves Inbox |
| Unsnooze | `unsnooze.mutate(id)` → email re-enters Inbox |
| Keyboard `c` | Open blank compose (if not typing) |
| Keyboard `/` | Focus search input (if not already typing in it) |
| Keyboard `j`/`k` | Navigate next/prev email in visible list (if not typing) |
| Keyboard `Escape` | Close email view → back to list |
| Any keyboard shortcut while typing | **Ignored** (focus guard) |

---

## 12. Implementation Order

Execute strictly. Each numbered step must compile before the next.

1. `index.html` — Google Fonts link, `<title>Gmail</title>`, `<meta>` description
2. `src/index.css` — full token system + reset + `prefers-reduced-motion` block
3. `src/types/email.ts` — all interfaces
4. `src/data/mockEmails.ts` — 25 realistic emails
5. `src/services/mockEmailService.ts` — **`npm run build` checkpoint**
6. `src/main.tsx` — QueryClientProvider + DevTools + `staleTime: Infinity`
7. `src/hooks/useEmails.ts` — `useEmails`, `selectForView`, `selectUnreadCount`
8. `src/hooks/useEmailMutations.ts` — all mutations
9. `src/store/useUIStore.ts` + `UIStoreContext.ts` — **`npm run build` checkpoint**
10. `ui/` atoms: `Avatar`, `Badge`, `IconButton`, `LabelChip`, `Spinner`, `EmptyState`, `Toast`
11. `layout/AppShell.tsx` — grid shell only (verify CSS grid at all breakpoints)
12. `layout/TopBar.tsx` + `layout/Sidebar.tsx` (verify view switching, unread counts, compose open)
13. `email/EmailRow.tsx` + `email/EmailList.tsx` (verify all stop-propagation, filtering, selection)
14. `email/EmailToolbar.tsx` (verify context-aware delete, bulk actions) — **`npm run build` checkpoint**
15. `email/EmailView.tsx` (verify Reply/Forward prefill, mark-read on mount, delete routing)
16. `compose/ComposeWindow.tsx` (verify autosave debounce, send, draft lifecycle, mobile layout)
17. `hooks/useKeyboardShortcuts.ts` + wire into `App.tsx`
18. `App.tsx` — full wiring: UIStoreContext.Provider, keyboard shortcuts, Toast — **final `npm run build` checkpoint**

---

## 13. Quality Checklist (all must pass before done)

**Data & Logic**
- [ ] `npm run build` exits zero with no TypeScript errors or warnings
- [ ] No `console.error` or React warnings in browser dev tools
- [ ] TanStack Query Devtools shows exactly one `['emails']` query key

**Views**
- [ ] Every sidebar item shows correctly filtered emails
- [ ] Inbox does NOT show snoozed emails
- [ ] Snoozed view DOES show those emails
- [ ] All Mail excludes Spam and Trash
- [ ] Search shows results from ALL emails (not just current view)

**Label semantics**
- [ ] Archive removes from Inbox but email appears in All Mail + retains STARRED/IMPORTANT
- [ ] Delete from Inbox → email appears in Trash (NOT gone)
- [ ] Delete from Trash → email is permanently removed
- [ ] Restore from Trash → email reappears in Inbox
- [ ] Star / Unstar persists when switching views

**Selection & Bulk**
- [ ] Selecting individual emails adds to Set (no stale reference bug)
- [ ] Select-all fills with visible email IDs
- [ ] Bulk actions disable the Send/action button while `isPending`
- [ ] `clearSelection()` fires after every bulk action

**Compose**
- [ ] Compose opens blank on "New Message"
- [ ] Compose pre-fills correctly on Reply, Reply All, Forward
- [ ] Autosave fires 2 seconds after last keystroke (not on every keypress)
- [ ] Autosave timer is cleared on unmount
- [ ] Close with content → "Draft saved" toast → Draft appears in Drafts view
- [ ] Send → "Message sent" toast → email appears in Sent view
- [ ] Opening a draft opens ComposeWindow pre-filled with correct `draftId`
- [ ] Sending a draft removes the original draft from the Drafts view

**Keyboard**
- [ ] `c` opens compose when NOT in a text field
- [ ] `/` focuses search when NOT already focused
- [ ] `j`/`k` navigate emails in the list when an email is open
- [ ] `Escape` closes email view
- [ ] All shortcuts are silent when focus is in input/textarea/search

**Event propagation**
- [ ] Clicking star inside a row does NOT open the email
- [ ] Clicking checkbox inside a row does NOT open the email
- [ ] Clicking important marker does NOT open the email
- [ ] Clicking hover-action icons (archive/trash/snooze) does NOT open the email

**Accessibility**
- [ ] Every icon button has `aria-label`
- [ ] Star and important marker buttons have `aria-pressed`
- [ ] Checkboxes have `aria-label`
- [ ] All interactive elements reachable by Tab, activated by Enter/Space

**Responsive**
- [ ] Layout intact at 1440px, 1280px, 1024px, 768px
- [ ] At 768px: email row shows checkbox · sender · subject (no preview, no date)
- [ ] At 768px: compose is full-width bottom-sheet
- [ ] At 768px: sidebar collapses via hamburger toggle

**Motion**
- [ ] All CSS transitions reference `var(--dur)` — not hardcoded values
- [ ] With `prefers-reduced-motion: reduce`, all transitions are instant

---

## 14. Anti-Patterns — Banned

| ❌ Never | ✅ Always |
|---|---|
| `email.folder = 'inbox'` | `email.labels.includes('INBOX')` |
| Delete that removes from store (non-trash context) | `moveToTrash` adds TRASH label |
| `getById` as a separate TanStack Query | Find from `emails` array in cached `['emails']` query |
| Multiple query keys (`['inbox']`, `['starred']`, etc.) | One `['emails']`, derive with `selectForView` |
| `setSelectedIds(selectedIds)` (same reference) | `setSelectedIds(prev => new Set(prev))` |
| `setTimeout` inside `useEffect` without `return () => clearTimeout(id)` | Always return cleanup |
| Autosave firing on every keystroke | 2-second debounce with cleanup |
| Shortcuts firing while focus is inside form inputs | `isTyping()` guard |
| Hardcoded color hex in component CSS | Always `var(--c-*)` |
| Inline `style={{...}}` for layout | CSS classes |
| Any `any` type | Proper types or `unknown` + type narrowing |
| Compose `width: 520px` at 768px | Full-width bottom-sheet via media query |
| Transitions with hardcoded `140ms` | `var(--dur)` so reduced-motion zeroes it |
| Clicking row-internal controls opening email | `e.stopPropagation()` on every inner interactive element |
| `permanentDelete` called from Inbox toolbar | Only from Trash/Spam view |

---

*This plan is architecturally complete, internally consistent, and production-ready to hand to a coding agent without modification.*
