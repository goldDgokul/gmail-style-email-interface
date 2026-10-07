// No threading — each Email is independent (§0.7)
import { useEffect, useState } from 'react';
import {
  SNOOZE_PRESETS, PERMANENT_DELETE_CONTAINERS, EMPTY_COMPOSE,
  type Email, type ComposeData,
} from '../../types/email';
import { useUI } from '../../store/UIStoreContext';
import {
  useMarkRead, useArchive, useMoveToSpam, useSnooze,
} from '../../hooks/useEmailMutations';
import { useDeleteRoute } from '../../hooks/useDeleteRoute';
import { IconButton } from '../ui/IconButton';
import { Avatar } from '../ui/Avatar';
import { LabelChip } from '../ui/LabelChip';
import { Icon } from '../ui/Icon';
import { formatDate, formatDateFull } from '../../utils/formatDate';
import { draftComposeData } from '../../utils/draftCompose';
import { SNOOZE_MENU } from '../../utils/snooze';

const quote = (email: Email) =>
  `\n\nOn ${formatDate(email.timestamp)}, ${email.sender} <${email.senderEmail}> wrote:\n> ${email.body.replace(/\n/g, '\n> ')}`;

export const EmailView = ({ email }: { email: Email }) => {
  const ui = useUI();
  const [snoozeMenu, setSnoozeMenu] = useState(false);

  const markRead = useMarkRead();
  const archive = useArchive();
  const moveToSpam = useMoveToSpam();
  const routeDelete = useDeleteRoute();
  const snooze = useSnooze();

  // guardrail #19 — one mark-read path for click, Enter, j and k
  useEffect(() => {
    if (email) markRead.mutate({ ids: [email.id], unread: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email?.id]);   // 'u' is unaffected: it never changes openEmailId

  const close = () => ui.setOpenEmailId(null);
  const pending = archive.isPending || routeDelete.isPending || markRead.isPending
    || moveToSpam.isPending || snooze.isPending;

  const openCompose = (data: Partial<ComposeData>) =>
    ui.setComposeData({ ...EMPTY_COMPOSE, ...data });

  const isMine = email.senderEmail === 'gokul@example.com' || email.sender === 'Me';

  const replyTo = () => openCompose({
    replyToId: email.id,
    to: isMine ? email.recipients.join(', ') : email.senderEmail,
    subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
    body: quote(email),
  });

  const replyAll = () => openCompose({
    replyToId: email.id,
    to: isMine ? email.recipients.join(', ') : email.senderEmail,
    cc: email.cc.filter(a => !isMine || a !== 'gokul@example.com').join(', '),
    subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
    body: quote(email),
  });

  const forward = () => openCompose({
    replyToId: email.id,
    to: '',
    subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
    body: `\n\n---------- Forwarded message ----------\nFrom: ${email.sender} <${email.senderEmail}>\nSubject: ${email.subject}\nDate: ${formatDate(email.timestamp)}\n\n${email.body}`,
  });

  return (
    <div className="email-view">
      <div className="email-view__bar">
        <IconButton label="Back to list" onClick={close}><Icon name="back" /></IconButton>
        <IconButton label="Archive" disabled={pending} onClick={() => { archive.mutate([email.id]); close(); }}><Icon name="archive" /></IconButton>
        <IconButton label="Report spam" disabled={pending} onClick={() => { moveToSpam.mutate([email.id]); close(); }}><Icon name="spam" /></IconButton>
        <IconButton
          label={email.container !== null && PERMANENT_DELETE_CONTAINERS.has(email.container) ? 'Delete forever' : 'Delete'}
          danger
          disabled={pending}
          onClick={() => { routeDelete.mutate([email.id]); close(); }}
        >
          <Icon name="trash" />
        </IconButton>
        <IconButton
          label="Mark as unread"
          disabled={markRead.isPending}
          onClick={() => { markRead.mutate({ ids: [email.id], unread: true }); close(); }}
        >
          <Icon name="mail" />
        </IconButton>
        <span className="menu-wrap">
          <IconButton label="Snooze" aria-expanded={snoozeMenu} disabled={pending} onClick={() => setSnoozeMenu(v => !v)}><Icon name="clock" /></IconButton>
          {snoozeMenu && (
            <span className="menu" style={{ top: 44, left: 0 }}>
              {SNOOZE_MENU.map(p => (
                <button
                  key={p.key}
                  type="button"
                  className="menu__item"
                  disabled={snooze.isPending}
                  onClick={() => {
                    snooze.mutate({ id: email.id, until: SNOOZE_PRESETS[p.key]().toISOString() });
                    setSnoozeMenu(false);
                    close();
                  }}
                >
                  {p.label}
                </button>
              ))}
            </span>
          )}
        </span>
        <IconButton label="More actions"><Icon name="more" /></IconButton>
      </div>

      <div className="email-view__scroll">
        <div className="email-view__inner">
          <h1 className="email-view__subject">{email.subject || '(no subject)'}</h1>

          {email.userLabels.length > 0 && (
            <div className="email-view__labels">
              {email.userLabels.map(l => (
                <LabelChip key={l} label={l} onClick={() => { ui.changeLabel(l); close(); }} />
              ))}
            </div>
          )}

          <div className="email-view__header">
            <Avatar name={email.sender} large />
            <div className="email-view__who">
              <div className="email-view__name">{email.sender}</div>
              <div className="email-view__email">
                {email.senderEmail} → {email.recipients.join(', ') || 'me'}
                {email.cc.length > 0 && ` · cc: ${email.cc.join(', ')}`}
              </div>
            </div>
            <div className="email-view__date">{formatDateFull(email.timestamp)}</div>
          </div>

          <pre className="email-view__body">{email.body}</pre>

          {email.attachments.length > 0 && (
            <div className="email-view__attachments">
              {email.attachments.map(a => (
                <div key={a.name} className="attachment">
                  <Icon name="attachment" />
                  <span className="attachment__name">{a.name}</span>
                  <span className="attachment__size">({a.size})</span>
                </div>
              ))}
            </div>
          )}

          <div className="email-view__actions">
            {email.container === 'DRAFT' ? (
              // Reply/Forward on a draft would fabricate a second message —
              // the only sensible action is editing the draft itself (§3)
              <button
                type="button"
                className="btn btn--primary"
                onClick={() => { close(); ui.setComposeData(draftComposeData(email)); }}
              >
                <Icon name="edit" /> Edit draft
              </button>
            ) : (
              <>
                <button type="button" className="btn" onClick={replyTo}>Reply</button>
                <button type="button" className="btn" onClick={replyAll}>Reply all</button>
                <button type="button" className="btn" onClick={forward}>Forward</button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
