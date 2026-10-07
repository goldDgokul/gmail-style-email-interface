import { useQuery } from '@tanstack/react-query';
import { emailService } from '../services/mockEmailService';
import { snoozedIntoFuture } from '../utils/snooze';
import type { Email, SidebarView } from '../types/email';

export const EMAIL_QK = ['emails'] as const;

export const useEmails = () =>
  useQuery({ queryKey: EMAIL_QK, queryFn: emailService.getAll });

// ── Derivations ──────────────────────────────────────────────────────────────
const visible = (e: Email) => e.container !== 'TRASH' && e.container !== 'SPAM';

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
