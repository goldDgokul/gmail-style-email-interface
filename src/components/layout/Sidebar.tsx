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
  { view: 'all',      label: 'All Mail', icon: 'drawer' },
];

const NavItem = ({
  icon,
  label,
  count,
  active,
  collapsed = false,
  onClick,
}: {
  icon: IconName;
  label: string;
  count: number;
  active: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) => (
  <button
    type="button"
    className={count > 0 ? 'nav-item nav-item--strong' : 'nav-item'}
    aria-current={active ? 'page' : undefined}
    // only while collapsed: then display:none drops the visible text (count too)
    aria-label={collapsed ? (count > 0 ? `${label}, ${count} unread` : label) : undefined}
    title={collapsed ? label : undefined}
    onClick={onClick}
  >
    <span className="nav-item__icon" aria-hidden="true"><Icon name={icon} /></span>
    <span className="nav-item__label">{label}</span>
    {count > 0 && (collapsed
      ? <span className="nav-item__dot" aria-hidden="true" />
      : <span className="nav-item__count">{count.toLocaleString('en-US')}</span>
    )}
  </button>
);

export const Sidebar = () => {
  const ui = useUI();
  const { data: emails = [] } = useEmails();

  // Labels discovered from the data — no label CRUD anywhere (spec §0)
  const labels = [...new Set(emails.flatMap(e => e.userLabels))].sort();
  const inboxCount = selectUnreadCount(emails, 'inbox', null);
  const collapsed = !ui.sidebarOpen;   // Gmail keeps an icon rail, not an empty column
  const activeLabel = ui.activeLabel;

  return (
    <aside className="sidebar">
      <button
        type="button"
        className="sidebar__compose"
        aria-label={collapsed ? 'Compose' : undefined}
        title={collapsed ? 'Compose' : undefined}
        onClick={() => ui.setComposeData({ ...EMPTY_COMPOSE })}
      >
        <span aria-hidden="true"><Icon name="edit" /></span>
        <span className="sidebar__compose-text">Compose</span>
      </button>

      <nav className="sidebar__nav" aria-label="Views">
        {ITEMS.map(item => (
          <NavItem
            key={item.view}
            icon={item.icon}
            label={item.label}
            count={item.view === 'inbox' ? inboxCount : 0}
            active={ui.view === item.view}
            collapsed={collapsed}
            onClick={() => ui.changeView(item.view)}
          />
        ))}

        {!collapsed && labels.length > 0 && (
          <>
            <div className="sidebar__divider"><span>Labels</span></div>
            {labels.map(name => (
              <NavItem
                key={name}
                icon="tag"
                label={name}
                count={selectUnreadCount(emails, 'label', name)}
                active={ui.view === 'label' && activeLabel === name}
                onClick={() => ui.changeLabel(name)}
              />
            ))}
          </>
        )}

        {/* labels are dropped in the rail, except the one we're standing on */}
        {collapsed && ui.view === 'label' && activeLabel && (
          <NavItem
            key={activeLabel}
            icon="tag"
            label={activeLabel}
            count={selectUnreadCount(emails, 'label', activeLabel)}
            active
            collapsed
            onClick={() => ui.changeLabel(activeLabel)}
          />
        )}
      </nav>
    </aside>
  );
};
