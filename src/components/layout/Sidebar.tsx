import { useEmails, selectUnreadCount } from '../../hooks/useEmails';
import { useUI } from '../../store/UIStoreContext';
import { EMPTY_COMPOSE, type SidebarView } from '../../types/email';
import { Badge } from '../ui/Badge';

type Item = { view: SidebarView; label: string; icon: string };

const ITEMS: Item[] = [
  { view: 'inbox',    label: 'Inbox',   icon: '📥' },
  { view: 'starred',  label: 'Starred', icon: '⭐' },
  { view: 'important',label: 'Important', icon: '❗' },
  { view: 'snoozed',  label: 'Snoozed', icon: '⏰' },
  { view: 'sent',     label: 'Sent',    icon: '📤' },
  { view: 'drafts',   label: 'Drafts',  icon: '📝' },
  { view: 'spam',     label: 'Spam',    icon: '⚠️' },
  { view: 'trash',    label: 'Trash',   icon: '🗑️' },
  { view: 'all',      label: 'All Mail', icon: '📁' },
];

export const Sidebar = () => {
  const ui = useUI();
  const { data: emails = [] } = useEmails();

  // Labels discovered from the data — no label CRUD anywhere (spec §0)
  const labels = [...new Set(emails.flatMap(e => e.userLabels))].sort();
  const inboxCount = selectUnreadCount(emails, 'inbox', null);

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar__compose"
        onClick={() => ui.setComposeData({ ...EMPTY_COMPOSE })}
      >
        <span aria-hidden="true">✎</span>
        Compose
      </button>

      <nav className="sidebar__nav" aria-label="Views">
        {ITEMS.map(item => {
          const active = ui.view === item.view;
          return (
            <button
              key={item.view}
              type="button"
              className="nav-item"
              aria-current={active ? 'page' : undefined}
              onClick={() => ui.changeView(item.view)}
            >
              <span className="nav-item__icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-item__label">{item.label}</span>
              {item.view === 'inbox' && <Badge count={inboxCount} />}
            </button>
          );
        })}

        {labels.length > 0 && (
          <>
            <div className="sidebar__divider"><span>── Labels ──</span></div>
            {labels.map(name => {
              const active = ui.view === 'label' && ui.activeLabel === name;
              return (
                <button
                  key={name}
                  type="button"
                  className="nav-item"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => ui.changeLabel(name)}
                >
                  <span className="nav-item__icon" aria-hidden="true">🏷</span>
                  <span className="nav-item__label">{name}</span>
                  <Badge count={selectUnreadCount(emails, 'label', name)} />
                </button>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
};
