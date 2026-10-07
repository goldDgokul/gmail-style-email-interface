import { useEffect, useState } from 'react';
import { useUI } from '../../store/UIStoreContext';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../ui/Avatar';

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
        <IconButton label="Toggle navigation menu" onClick={onToggleSidebar}>☰</IconButton>
        <span className="topbar__logo">Gmail</span>
      </div>

      <div className="topbar__search">
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
          <IconButton label="Clear search" small onClick={clear}>✕</IconButton>
        )}
      </div>

      <div className="topbar__actions">
        <IconButton label="Help">?</IconButton>
        <IconButton label="Settings">⚙</IconButton>
        <span className="topbar__avatar">
          <Avatar name="Gokul" />
        </span>
      </div>
    </header>
  );
};
