import { useCallback, useEffect, useState } from 'react';
import { UIStoreContext } from './store/UIStoreContext';
import { useUIStore } from './store/useUIStore';
import { useEmails, selectForView } from './hooks/useEmails';
import { useArchive, useToggleStar, useMarkRead } from './hooks/useEmailMutations';
import { useDeleteRoute } from './hooks/useDeleteRoute';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { AppShell } from './components/layout/AppShell';
import { TopBar } from './components/layout/TopBar';
import { Sidebar } from './components/layout/Sidebar';
import { EmailList } from './components/email/EmailList';
import { EmailView } from './components/email/EmailView';
import { ComposeWindow } from './components/compose/ComposeWindow';
import { Toast } from './components/ui/Toast';

export default function App() {
  const ui = useUIStore();
  const { data: emails = [], isLoading } = useEmails();

  const [visibleIds, setVisibleIds] = useState<string[]>([]);

  const visibleEmails = selectForView(emails, ui.view, ui.search, ui.activeLabel);

  const archive = useArchive();
  const toggleStar = useToggleStar();
  const markRead = useMarkRead();
  const routeDelete = useDeleteRoute();

  // The open email leaving the visible set drops you back to the list
  useEffect(() => {
    if (ui.openEmailId && !visibleEmails.some(e => e.id === ui.openEmailId)) {
      ui.setOpenEmailId(null);
    }
  }, [visibleEmails, ui.openEmailId]);  // eslint-disable-line react-hooks/exhaustive-deps

  const onVisibleIds = useCallback((ids: string[]) => setVisibleIds(ids), []);

  useKeyboardShortcuts(ui, visibleIds, {
    onArchive: id => archive.mutate([id]),
    onDelete: id => routeDelete.mutate([id]),
    onStar: id => toggleStar.mutate(id),
    onMarkUnread: id => markRead.mutate({ ids: [id], unread: true }),
  });

  const open = ui.openEmailId ? visibleEmails.find(e => e.id === ui.openEmailId) : undefined;

  return (
    <UIStoreContext.Provider value={ui}>
      <AppShell closed={!ui.sidebarOpen}>
        <TopBar onToggleSidebar={() => ui.setSidebarOpen(!ui.sidebarOpen)} />
        <Sidebar />
        <main className="shell__main">
          {open ? (
            <EmailView email={open} />
          ) : (
            <EmailList emails={visibleEmails} loading={isLoading} onVisibleIds={onVisibleIds} />
          )}
        </main>
      </AppShell>

      {ui.composeData && <ComposeWindow key={ui.composeToken} />}
      <Toast message={ui.toast} onDismiss={ui.dismissToast} />
    </UIStoreContext.Provider>
  );
}
