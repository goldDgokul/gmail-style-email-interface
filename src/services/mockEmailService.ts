import { MOCK_EMAILS } from '../data/mockEmails';
import { PERMANENT_DELETE_CONTAINERS, type Email, type ComposeData } from '../types/email';
import { splitList } from '../utils/splitList';

let store: Email[] = structuredClone(MOCK_EMAILS);
const delay = (ms = 80) => new Promise<void>(r => setTimeout(r, ms));
const mutate = (fn: () => void): void => { fn(); };
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

  // One route for every Delete button (guardrail #15 / Q9 / Q14), partitioned
  // here where the store lives — callers never reach into query data (0.3)
  deleteRoute: async (ids: string[]): Promise<void> => {
    const permanent: string[] = [];
    const soft: string[] = [];
    for (const id of ids) {
      const c = find(id)?.container;
      (c !== null && c !== undefined && PERMANENT_DELETE_CONTAINERS.has(c) ? permanent : soft).push(id);
    }
    if (permanent.length) await emailService.permanentDelete(permanent);
    if (soft.length) await emailService.moveToTrash(soft);
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
