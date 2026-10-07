import { useEffect, useRef, useState } from 'react';
import type { ComposeData } from '../../types/email';
import { useUI } from '../../store/UIStoreContext';
import { useSendEmail, useSaveDraft } from '../../hooks/useEmailMutations';
import { IconButton } from '../ui/IconButton';

const parseTokens = (s: string) => s.split(',').map(t => t.trim()).filter(Boolean);

export const ComposeWindow = () => {
  const ui = useUI();
  const compose = ui.composeData as ComposeData;

  // §0.6 — id is assigned when the window opens, not on first save
  const [draftId] = useState(() => compose.draftId ?? crypto.randomUUID());
  const [to, setTo] = useState(compose.to);
  const [cc, setCc] = useState(compose.cc);
  const [bcc, setBcc] = useState(compose.bcc);
  const [subject, setSubject] = useState(compose.subject);
  const [body, setBody] = useState(compose.body);
  const [showCcBcc, setShowCcBcc] = useState(Boolean(compose.cc || compose.bcc));
  const [error, setError] = useState<string | null>(null);

  const autosave = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sendEmail = useSendEmail();
  const saveDraft = useSaveDraft();

  // Debounced autosave, 2s, cleaned up on every change and on unmount (guardrails #6, #7)
  useEffect(() => {
    if (!subject && !body) return;
    if (autosave.current) clearTimeout(autosave.current);
    autosave.current = setTimeout(() => {
      saveDraft.mutate({ draftId, to, cc, bcc, subject, body });
    }, 2000);
    return () => { if (autosave.current) clearTimeout(autosave.current); };
  }, [subject, body, to, cc, bcc]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleSend = () => {
    if ([...parseTokens(to), ...parseTokens(cc), ...parseTokens(bcc)].length === 0) {
      setError('Please specify at least one recipient');   // never fail silently (guardrail Q20)
      return;
    }
    setError(null);
    if (autosave.current) clearTimeout(autosave.current);
    if (!sendEmail.isPending) sendEmail.mutate({ draftId, to, cc, bcc, subject, body });
    ui.setComposeData(null);
    ui.showToast('Message sent');
  };

  const handleClose = () => {
    if (autosave.current) clearTimeout(autosave.current);
    if (subject || body) {
      saveDraft.mutate({ draftId, to, cc, bcc, subject, body });
      ui.showToast('Draft saved');
    }
    ui.setComposeData(null);   // empty compose → nothing written (§0.6)
  };

  return (
    <section className="compose" aria-label="New message">
      <div className="compose__header">
        <span>{compose.replyToId ? 'Reply' : 'New Message'}</span>
        <span>
          <IconButton label="Minimize compose">─</IconButton>
          <IconButton label="Close compose" onClick={handleClose}>✕</IconButton>
        </span>
      </div>

      <div className="compose__fields">
        <div className="compose__field">
          <label htmlFor="compose-to">To</label>
          <input
            id="compose-to"
            value={to}
            onChange={e => { setTo(e.target.value); setError(null); }}
            placeholder="recipients@example.com"
            autoComplete="off"
          />
          {!showCcBcc && (
            <button type="button" className="compose__toggle" onClick={() => setShowCcBcc(true)}>
              Cc Bcc
            </button>
          )}
        </div>

        {showCcBcc && (
          <div className="compose__field">
            <label htmlFor="compose-cc">Cc</label>
            <input id="compose-cc" value={cc} onChange={e => setCc(e.target.value)} autoComplete="off" />
          </div>
        )}
        {showCcBcc && (
          <div className="compose__field">
            <label htmlFor="compose-bcc">Bcc</label>
            <input id="compose-bcc" value={bcc} onChange={e => setBcc(e.target.value)} autoComplete="off" />
          </div>
        )}

        <div className="compose__field">
          <label htmlFor="compose-subject">Subject</label>
          <input id="compose-subject" value={subject} onChange={e => setSubject(e.target.value)} autoComplete="off" />
        </div>
      </div>

      {error && <p className="compose__error" role="alert">{error}</p>}

      <textarea
        className="compose__body"
        aria-label="Message body"
        value={body}
        onChange={e => setBody(e.target.value)}
        placeholder=""
      />

      <div className="compose__footer">
        <button
          type="button"
          className="compose__send"
          disabled={sendEmail.isPending}
          onClick={handleSend}
        >
          Send ▾
        </button>
        <IconButton label="Attach files">📎</IconButton>
        <IconButton label="Formatting options">A</IconButton>
        <IconButton label="More options">⋯</IconButton>
        <IconButton label="Discard draft" onClick={handleClose}>🗑</IconButton>
      </div>
    </section>
  );
};
