// No threading — each Email is independent (§0.7)
import { useState, type MouseEvent } from 'react';
import type { Email } from '../../types/email';
import { SNOOZE_PRESETS, type SnoozePreset } from '../../types/email';
import { useUI } from '../../store/UIStoreContext';
import {
  useToggleStar, useToggleImportant, useArchive, useSnooze, useUnsnooze,
} from '../../hooks/useEmailMutations';
import { useDeleteRoute } from '../../hooks/useDeleteRoute';
import { LabelChip } from '../ui/LabelChip';
import { formatDate } from '../../utils/formatDate';

const SNOOZE_MENU: { key: SnoozePreset; label: string }[] = [
  { key: 'tonight',   label: 'Tonight, 8:00 PM' },
  { key: 'tomorrow',  label: 'Tomorrow, 8:00 AM' },
  { key: 'next-week', label: 'Next week, 8:00 AM' },
];

const snoozedIntoFuture = (email: Email) =>
  email.snoozedUntil !== null && new Date(email.snoozedUntil).getTime() > Date.now();

export const EmailRow = ({ email, checked }: { email: Email; checked: boolean }) => {
  const ui = useUI();
  const [snoozeMenu, setSnoozeMenu] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);

  const openSnoozeMenu = (e: MouseEvent<HTMLButtonElement>) => {
    if (snoozeMenu) { setSnoozeMenu(false); return; }
    const r = e.currentTarget.getBoundingClientRect();
    const H = 170;
    const top = r.bottom + 4 + H > window.innerHeight ? r.top - H - 4 : r.bottom + 4;
    const left = Math.min(Math.max(8, r.left - 168), window.innerWidth - 212);
    setMenuPos({ top, left });
    setSnoozeMenu(true);
  };

  const toggleStar = useToggleStar();
  const toggleImportant = useToggleImportant();
  const archive = useArchive();
  const snooze = useSnooze();
  const unsnooze = useUnsnooze();
  const routeDelete = useDeleteRoute();

  const pending = toggleStar.isPending || archive.isPending || routeDelete.isPending;
  const starOn = email.flags.includes('STARRED');
  const importantOn = email.flags.includes('IMPORTANT');
  const snoozed = snoozedIntoFuture(email);

  // Row click opens the email — and only that (guardrail #19)
  const open = () => ui.setOpenEmailId(email.id);

  const stop = (e: MouseEvent) => e.stopPropagation();

  return (
    <div
      className={email.unread ? 'row row--unread' : 'row'}
      data-checked={checked || undefined}
      onClick={open}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') open(); }}
    >
      <span className="row__check" onClick={stop}>
        <input
          type="checkbox"
          checked={checked}
          aria-label={`Select email from ${email.sender}`}
          onChange={() => ui.toggleSelect(email.id)}
          disabled={pending}
        />
      </span>

      <span className="row__star" onClick={stop}>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label={starOn ? 'Unstar' : 'Star'}
          aria-pressed={starOn}
          disabled={toggleStar.isPending}
          onClick={() => toggleStar.mutate(email.id)}
        >
          {starOn ? '★' : '☆'}
        </button>
      </span>

      <span className="row__flag" data-on={importantOn} onClick={stop}>
        <button
          type="button"
          className="icon-btn icon-btn--sm"
          aria-label={importantOn ? 'Remove important marker' : 'Mark as important'}
          aria-pressed={importantOn}
          disabled={toggleImportant.isPending}
          onClick={() => toggleImportant.mutate(email.id)}
        >
          ❗
        </button>
      </span>

      <span className="row__sender">{email.sender}</span>

      <span className="row__content">
        <span className="row__subject">{email.subject || '(no subject)'}</span>
        <span className="row__preview">— {email.preview}</span>
        {email.userLabels.map(l => (
          <span key={l} className="row__labels" onClick={stop}>
            <LabelChip label={l} onClick={() => ui.changeLabel(l)} />
          </span>
        ))}
        {snoozed && <span className="snooze-badge">⏰ snoozed</span>}
      </span>

      <span className="row__meta" onClick={stop}>
        <span className="row__date">{formatDate(email.timestamp)}</span>
        <span className="row__hover">
          <button
            type="button"
            className="icon-btn icon-btn--sm"
            aria-label="Archive"
            title="Archive"
            disabled={pending}
            onClick={() => archive.mutate([email.id])}
          >
            📥
          </button>
          <span className="menu-wrap">
            <button
              type="button"
              className="icon-btn icon-btn--sm"
              aria-label="Snooze"
              title="Snooze"
              disabled={pending}
              aria-expanded={snoozeMenu}
              onClick={openSnoozeMenu}
            >
              ⏰
            </button>
            {snoozeMenu && menuPos && (
              <span
                className="menu"
                style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
                onClick={stop}
              >
                {SNOOZE_MENU.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    className="menu__item"
                    onClick={() => {
                      snooze.mutate({ id: email.id, until: SNOOZE_PRESETS[p.key]().toISOString() });
                      setSnoozeMenu(false);
                    }}
                  >
                    ⏰ {p.label}
                  </button>
                ))}
                {snoozed && (
                  <button
                    type="button"
                    className="menu__item"
                    onClick={() => { unsnooze.mutate(email.id); setSnoozeMenu(false); }}
                  >
                    ↩ Wake up now
                  </button>
                )}
              </span>
            )}
          </span>
          <button
            type="button"
            className="icon-btn icon-btn--sm icon-btn--danger"
            aria-label="Delete"
            title="Delete"
            disabled={routeDelete.isPending}
            onClick={() => routeDelete.mutate([email.id])}
          >
            🗑
          </button>
        </span>
      </span>
    </div>
  );
};
