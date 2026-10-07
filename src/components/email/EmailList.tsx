// No threading — each Email is independent (§0.7)
import { useEffect } from 'react';
import type { Email } from '../../types/email';
import { useUI } from '../../store/UIStoreContext';
import { EmailRow } from './EmailRow';
import { EmailToolbar } from './EmailToolbar';
import { EmptyState } from '../ui/EmptyState';
import { Spinner } from '../ui/Spinner';

export const EmailList = ({
  emails,
  loading,
  onVisibleIds,
}: {
  emails: Email[];
  loading: boolean;
  onVisibleIds: (ids: string[]) => void;
}) => {
  const ui = useUI();
  const ids = emails.map(e => e.id);

  // The list is the single source of "what is on screen"
  useEffect(() => { onVisibleIds(ids); }, [ids.join(','), onVisibleIds]);  // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <Spinner />;

  return (
    <div className="list">
      <EmailToolbar visibleIds={ids} emails={emails} />
      <div className="list__scroll">
        {emails.length === 0 ? (
          <EmptyState view={ui.view} search={ui.search} activeLabel={ui.activeLabel} />
        ) : (
          emails.map(email => (
            <EmailRow key={email.id} email={email} checked={ui.selectedIds.has(email.id)} />
          ))
        )}
      </div>
    </div>
  );
};
