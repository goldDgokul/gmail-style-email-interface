import type { ComposeData, Email } from '../types/email';

// A draft opens in the compose window for editing (§3 draftId — "set when
// re-editing an existing draft"), never in the read-only EmailView.
export const draftComposeData = (email: Email): ComposeData => ({
  draftId: email.id,
  to: email.recipients.join(', '),
  cc: email.cc.join(', '),
  bcc: email.bcc.join(', '),
  subject: email.subject === '(no subject)' ? '' : email.subject,
  body: email.body,
});
