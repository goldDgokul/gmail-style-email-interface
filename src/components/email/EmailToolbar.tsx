import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { EMAIL_QK } from '../../hooks/useEmails';
import { useUI } from '../../store/UIStoreContext';
import { useArchive, useMoveToSpam, useRestore, useMarkRead } from '../../hooks/useEmailMutations';
import { useDeleteRoute } from '../../hooks/useDeleteRoute';
import { PERMANENT_DELETE_CONTAINERS, type Email } from '../../types/email';
import { IconButton } from '../ui/IconButton';

export const EmailToolbar = ({ visibleIds }: { visibleIds: string[] }) => {
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

  const emails = qc.getQueryData<Email[]>(EMAIL_QK) ?? [];
  const emailById = (id: string) => emails.find(e => e.id === id);

  // Guardrail #20: act only on selected ∩ visible — never raw selectedIds
  const safeIds = [...ui.selectedIds].filter(id => visibleIds.includes(id));
  const selected = safeIds.map(emailById).filter((e): e is Email => !!e);
  const allPermanent = selected.length > 0 && selected.every(
    e => e.container !== null && PERMANENT_DELETE_CONTAINERS.has(e.container),
  );

  const pending = archive.isPending || moveToSpam.isPending || routeDelete.isPending
    || markRead.isPending || restore.isPending;
  const hasSelection = safeIds.length > 0;

  const handleDelete = () => {
    if (!safeIds.length) return;
    routeDelete.mutate(safeIds);   // partition happens inside the route
    ui.clearSelection();
  };

  if (!hasSelection) {
    return (
      <div className="toolbar">
        <IconButton label="Refresh" onClick={() => qc.invalidateQueries({ queryKey: EMAIL_QK })}>↺</IconButton>
        <span className="menu-wrap">
          <IconButton label="More actions" onClick={() => setMoreMenu(v => !v)} aria-expanded={moreMenu}>⋯</IconButton>
          {moreMenu && (
            <span className="menu" style={{ top: 44, left: 12 }}>
              <button
                type="button"
                className="menu__item"
                onClick={() => { ui.selectAll(visibleIds); setMoreMenu(false); }}
              >
                ☐ Select all
              </button>
              <button
                type="button"
                className="menu__item"
                disabled={markRead.isPending}
                onClick={() => { markRead.mutate({ ids: visibleIds, unread: false }); setMoreMenu(false); }}
              >
                ✔ Mark all as read
              </button>
            </span>
          )}
        </span>
      </div>
    );
  }

  return (
    <div className="toolbar" role="toolbar" aria-label="Bulk actions">
      <IconButton
        label="Clear selection"
        onClick={() => ui.clearSelection()}
      >
        ☐
      </IconButton>
      <span className="toolbar__spacer" />

      <IconButton label="Archive" disabled={pending} onClick={() => { archive.mutate(safeIds); ui.clearSelection(); }}>📥</IconButton>
      <IconButton label="Report spam" disabled={pending} onClick={() => { moveToSpam.mutate(safeIds); ui.clearSelection(); }}>⚠️</IconButton>
      <IconButton label={allPermanent ? 'Delete forever' : 'Delete'} danger disabled={pending} onClick={handleDelete}>🗑</IconButton>

      <span className="menu-wrap">
        <IconButton label="Mark read" disabled={pending} aria-expanded={markMenu} onClick={() => setMarkMenu(v => !v)}>✔</IconButton>
        {markMenu && (
          <span className="menu" style={{ top: 44, right: 0 }}>
            <button type="button" className="menu__item" disabled={markRead.isPending}
              onClick={() => { markRead.mutate({ ids: safeIds, unread: false }); ui.clearSelection(); setMarkMenu(false); }}>
              Mark as read
            </button>
            <button type="button" className="menu__item" disabled={markRead.isPending}
              onClick={() => { markRead.mutate({ ids: safeIds, unread: true }); ui.clearSelection(); setMarkMenu(false); }}>
              Mark as unread
            </button>
          </span>
        )}
      </span>

      <span className="menu-wrap">
        <IconButton label="Move to" disabled={pending} aria-expanded={moveMenu} onClick={() => setMoveMenu(v => !v)}>📂</IconButton>
        {moveMenu && (
          <span className="menu" style={{ top: 44, right: 0 }}>
            <button type="button" className="menu__item" disabled={restore.isPending}
              onClick={() => { restore.mutate(safeIds); ui.clearSelection(); setMoveMenu(false); }}>
              📥 Inbox
            </button>
            <button type="button" className="menu__item" disabled={moveToSpam.isPending}
              onClick={() => { moveToSpam.mutate(safeIds); ui.clearSelection(); setMoveMenu(false); }}>
              ⚠️ Spam
            </button>
            <button type="button" className="menu__item menu__item--danger" disabled={routeDelete.isPending}
              onClick={() => { routeDelete.mutate(safeIds); ui.clearSelection(); setMoveMenu(false); }}>
              🗑 Trash
            </button>
          </span>
        )}
      </span>
    </div>
  );
};
