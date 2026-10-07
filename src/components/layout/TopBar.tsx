import { useEffect, useState } from 'react';
import { useUI } from '../../store/UIStoreContext';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../ui/Avatar';
import { Icon } from '../ui/Icon';

export const TopBar = ({ onToggleSidebar }: { onToggleSidebar: () => void }) => {
  const { search, setSearch } = useUI();
  const [draft, setDraft] = useState(search);
  const [lastSearch, setLastSearch] = useState(search);

  // Store cleared search (changeView) → mirror it into the box during render
  if (search !== lastSearch) {
    setLastSearch(search);
    if (!search) setDraft('');
  }

  // 200ms debounce with cleanup; search is set directly (it abandons the current View)
  useEffect(() => {
    const id = setTimeout(() => setSearch(draft), 200);
    return () => clearTimeout(id);
  }, [draft, setSearch]);

  const clear = () => { setDraft(''); setSearch(''); };

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <IconButton label="Toggle navigation menu" onClick={onToggleSidebar}><Icon name="menu" /></IconButton>
        <span className="topbar__logo">
          <svg className="topbar__logo-mark" viewBox="52 42 88 66" aria-hidden="true">
            <path fill="#4285f4" d="M58 108h14V74L52 59v43c0 3.32 2.69 6 6 6" />
            <path fill="#34a853" d="M120 108h14c3.32 0 6-2.69 6-6V59l-20 15" />
            <path fill="#fbbc04" d="M120 48v26l20-15v-8c0-7.42-8.47-11.65-14.4-7.2" />
            <path fill="#ea4335" d="M72 74V48l24 18 24-18v26L96 92" />
            <path fill="#c5221f" d="M52 51v8l20 15V48l-5.6-4.2c-5.94-4.45-14.4-.22-14.4 7.2" />
          </svg>
          Gmail
        </span>
      </div>

      <div className="topbar__search">
        <Icon name="search" />
        <input
          id="search-input"
          type="search"
          placeholder="Search mail"
          aria-label="Search mail"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); clear(); } }}
        />
        {draft && (
          <IconButton label="Clear search" small onClick={clear}><Icon name="close" /></IconButton>
        )}
      </div>

      <div className="topbar__actions">
        <IconButton label="Help"><Icon name="help" /></IconButton>
        <IconButton label="Settings"><Icon name="settings" /></IconButton>
        <span className="topbar__avatar">
          <Avatar name="Gokul" large />
        </span>
      </div>
    </header>
  );
};
