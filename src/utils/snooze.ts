import type { Email, SnoozePreset } from '../types/email';

export const SNOOZE_MENU: { key: SnoozePreset; label: string }[] = [
  { key: 'tonight',   label: 'Tonight, 8:00 PM' },
  { key: 'tomorrow',  label: 'Tomorrow, 8:00 AM' },
  { key: 'next-week', label: 'Next week, 8:00 AM' },
];

export const snoozedIntoFuture = (email: Email) =>
  email.snoozedUntil !== null && new Date(email.snoozedUntil).getTime() > Date.now();
