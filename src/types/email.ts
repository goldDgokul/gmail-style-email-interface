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
