import { useEmails, selectUnreadCount } from '../../hooks/useEmails';
import { useUI } from '../../store/UIStoreContext';
import { EMPTY_COMPOSE, type SidebarView } from '../../types/email';
import { Icon, type IconName } from '../ui/Icon';

type Item = { view: SidebarView; label: string; icon: IconName };

const ITEMS: Item[] = [
  { view: 'inbox',    label: 'Inbox',   icon: 'inbox' },
  { view: 'starred',  label: 'Starred', icon: 'star' },
  { view: 'important',label: 'Important', icon: 'important' },
  { view: 'snoozed',  label: 'Snoozed', icon: 'clock' },
  { view: 'sent',     label: 'Sent',    icon: 'send' },
  { view: 'drafts',   label: 'Drafts',  icon: 'file' },
  { view: 'spam',     label: 'Spam',    icon: 'spam' },
  { view: 'trash',    label: 'Trash',   icon: 'trash' },
  { view: 'all',      label: 'All Mail', icon: 'folder' },
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
        <span aria-hidden="true"><Icon name="edit" /></span>
        Compose
      </button>

      <nav className="sidebar__nav" aria-label="Views">
        {ITEMS.map(item => {
          const active = ui.view === item.view;
          const count = item.view === 'inbox' ? inboxCount : 0;
          return (
            <button
              key={item.view}
              type="button"
              className={count > 0 ? 'nav-item nav-item--strong' : 'nav-item'}
              aria-current={active ? 'page' : undefined}
              onClick={() => ui.changeView(item.view)}
            >
              <span className="nav-item__icon" aria-hidden="true"><Icon name={item.icon} /></span>
              <span className="nav-item__label">{item.label}</span>
              {count > 0 && (
                <span className="nav-item__count">{count.toLocaleString('en-US')}</span>
              )}
            </button>
          );
        })}

        {labels.length > 0 && (
          <>
            <div className="sidebar__divider"><span>Labels</span></div>
            {labels.map(name => {
              const active = ui.view === 'label' && ui.activeLabel === name;
              const count = selectUnreadCount(emails, 'label', name);
              return (
                <button
                  key={name}
                  type="button"
                  className={count > 0 ? 'nav-item nav-item--strong' : 'nav-item'}
                  aria-current={active ? 'page' : undefined}
                  onClick={() => ui.changeLabel(name)}
                >
                  <span className="nav-item__icon" aria-hidden="true"><Icon name="tag" /></span>
                  <span className="nav-item__label">{name}</span>
                  {count > 0 && (
                    <span className="nav-item__count">{count.toLocaleString('en-US')}</span>
                  )}
                </button>
              );
            })}
          </>
        )}
      </nav>
    </aside>
  );
};
