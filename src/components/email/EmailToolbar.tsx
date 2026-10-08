import { useState, type CSSProperties } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EMAIL_QK } from '../../hooks/useEmails';
import { useUI } from '../../store/UIStoreContext';
import { useArchive, useMoveToSpam, useRestore, useMarkRead } from '../../hooks/useEmailMutations';
import { useDeleteRoute } from '../../hooks/useDeleteRoute';
import { PERMANENT_DELETE_CONTAINERS, type Email } from '../../types/email';
import { IconButton } from '../ui/IconButton';
import { Icon } from '../ui/Icon';

// The two idle-toolbar menus (selection caret + ⋯) hold the same items — one source.
const ListMenu = ({
  style,
  disabled,
  close,
  onSelectAll,
  onMarkAllRead,
}: {
  style: CSSProperties;
  disabled: boolean;
  close: () => void;
  onSelectAll: () => void;
  onMarkAllRead: () => void;
}) => (
  <span className="menu" style={style}>
    <button type="button" className="menu__item" onClick={() => { onSelectAll(); close(); }}>
      Select all
    </button>
    <button
      type="button"
      className="menu__item"
      disabled={disabled}
      onClick={() => { onMarkAllRead(); close(); }}
    >
      Mark all as read
    </button>
  </span>
);

export const EmailToolbar = ({ visibleIds, emails }: { visibleIds: string[]; emails: Email[] }) => {
  const ui = useUI();
  const qc = useQueryClient();

  const archive = useArchive();
  const moveToSpam = useMoveToSpam();
  const restore = useRestore();
  const markRead = useMarkRead();
  const routeDelete = useDeleteRoute();

  const [markMenu, setMarkMenu] = useState(false);
  const [moveMenu, setMoveMenu] = useState(false);
  const [moreMenu, setMoreMenu] = useState(false);
  const [selMenu, setSelMenu] = useState(false);

  const emailById = (id: string) => emails.find(e => e.id === id);

  // Guardrail #20: act only on selected ∩ visible — never raw selectedIds
  const targetIds = [...ui.selectedIds].filter(id => visibleIds.includes(id));
  const selected = targetIds.map(emailById).filter((e): e is Email => !!e);
  const allPermanent = selected.length > 0 && selected.every(
    e => e.container !== null && PERMANENT_DELETE_CONTAINERS.has(e.container),
  );
  const allSelected = visibleIds.length > 0 && visibleIds.every(id => ui.selectedIds.has(id));

  const pending = archive.isPending || moveToSpam.isPending || routeDelete.isPending
    || markRead.isPending || restore.isPending;
  const hasSelection = targetIds.length > 0;

  const handleDelete = () => {
    if (!targetIds.length) return;
    routeDelete.mutate(targetIds);   // partition happens inside the route
    ui.clearSelection();
  };

  if (!hasSelection) {
    return (
      <div className="toolbar">
        <IconButton
          label="Select all"
          disabled={visibleIds.length === 0}
          onClick={() => ui.selectAll(visibleIds)}
        >
          <Icon name="checkbox" />
        </IconButton>
        <span className="menu-wrap">
          <IconButton
            label="Selection options"
            aria-expanded={selMenu}
            disabled={visibleIds.length === 0}
            onClick={() => setSelMenu(v => !v)}
          >
            <Icon name="caret-down" />
          </IconButton>
          {selMenu && (
            <ListMenu
              style={{ left: 0 }}
              disabled={markRead.isPending}
              close={() => setSelMenu(false)}
              onSelectAll={() => ui.selectAll(visibleIds)}
              onMarkAllRead={() => markRead.mutate({ ids: visibleIds, unread: false })}
            />
          )}
        </span>
        <IconButton label="Refresh" onClick={() => qc.invalidateQueries({ queryKey: EMAIL_QK })}><Icon name="refresh" /></IconButton>
        <span className="menu-wrap">
          <IconButton label="More actions" onClick={() => setMoreMenu(v => !v)} aria-expanded={moreMenu}><Icon name="more" /></IconButton>
          {moreMenu && (
            <ListMenu
              style={{ left: 12 }}
              disabled={markRead.isPending}
              close={() => setMoreMenu(false)}
              onSelectAll={() => ui.selectAll(visibleIds)}
              onMarkAllRead={() => markRead.mutate({ ids: visibleIds, unread: false })}
            />
          )}
        </span>
        <span className="toolbar__spacer" />
        {visibleIds.length > 0 && (
          <span className="toolbar__count">
            {`1–${visibleIds.length} of ${visibleIds.length.toLocaleString('en-US')}`}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Bulk actions">
      <IconButton
        label={allSelected ? 'Clear selection' : 'Select all'}
        onClick={() => (allSelected ? ui.clearSelection() : ui.selectAll(visibleIds))}
      >
        <Icon name={allSelected ? 'checkbox-checked' : 'checkbox'} />
      </IconButton>
      <span className="toolbar__spacer" />

      <IconButton label="Archive" disabled={pending} onClick={() => { archive.mutate(targetIds); ui.clearSelection(); }}><Icon name="archive" /></IconButton>
      <IconButton label="Report spam" disabled={pending} onClick={() => { moveToSpam.mutate(targetIds); ui.clearSelection(); }}><Icon name="spam" /></IconButton>
      <IconButton label={allPermanent ? 'Delete forever' : 'Delete'} danger disabled={pending} onClick={handleDelete}><Icon name="trash" /></IconButton>

      <span className="menu-wrap">
        <IconButton label="Mark read" disabled={pending} aria-expanded={markMenu} onClick={() => setMarkMenu(v => !v)}><Icon name="envelope" /></IconButton>
        {markMenu && (
          <span className="menu" style={{ right: 0 }}>
            <button type="button" className="menu__item" disabled={markRead.isPending}
              onClick={() => { markRead.mutate({ ids: targetIds, unread: false }); ui.clearSelection(); setMarkMenu(false); }}>
              Mark as read
            </button>
            <button type="button" className="menu__item" disabled={markRead.isPending}
              onClick={() => { markRead.mutate({ ids: targetIds, unread: true }); ui.clearSelection(); setMarkMenu(false); }}>
              Mark as unread
            </button>
          </span>
        )}
      </span>

      <span className="menu-wrap">
        <IconButton label="Move to" disabled={pending} aria-expanded={moveMenu} onClick={() => setMoveMenu(v => !v)}><Icon name="drawer" /></IconButton>
        {moveMenu && (
          <span className="menu" style={{ right: 0 }}>
            <button type="button" className="menu__item" disabled={restore.isPending}
              onClick={() => { restore.mutate(targetIds); ui.clearSelection(); setMoveMenu(false); }}>
              Inbox
            </button>
            <button type="button" className="menu__item" disabled={moveToSpam.isPending}
              onClick={() => { moveToSpam.mutate(targetIds); ui.clearSelection(); setMoveMenu(false); }}>
              Spam
            </button>
            <button type="button" className="menu__item menu__item--danger" disabled={routeDelete.isPending}
              onClick={() => { routeDelete.mutate(targetIds); ui.clearSelection(); setMoveMenu(false); }}>
              Trash
            </button>
          </span>
        )}
      </span>
    </div>
  );
};
