import type { SidebarView } from '../../types/email';

const ICONS: Partial<Record<SidebarView, string>> = {
  starred: '⭐',
  important: '❗',
  snoozed: '⏰',
  spam: '⚠️',
  trash: '🗑️',
  drafts: '📝',
  sent: '📤',
  inbox: '📥',
  all: '📁',
};

export const EmptyState = ({
  view,
  search,
  activeLabel,
}: {
  view: SidebarView;
  search: string;
  activeLabel: string | null;
}) => {
  // Per-View copy — never a single global "No messages"
  const message = (() => {
    if (search) return `No results for "${search}"`;
    switch (view) {
      case 'inbox':    return 'Your inbox is empty';
      case 'starred':  return 'No starred messages';
      case 'important':return 'No important messages';
      case 'snoozed':  return 'No snoozed messages';
      case 'sent':     return 'No sent messages';
      case 'drafts':   return 'No drafts';
      case 'spam':     return 'No spam messages';
      case 'trash':    return 'Trash is empty';
      case 'all':      return 'No messages';
      case 'label':    return activeLabel ? `No messages labelled "${activeLabel}"` : 'No messages';
    }
  })();

  return (
    <div className="empty">
      <div className="empty__icon" aria-hidden="true">
        {search ? '🔍' : ICONS[view] ?? '📭'}
      </div>
      <div>{message}</div>
    </div>
  );
};
