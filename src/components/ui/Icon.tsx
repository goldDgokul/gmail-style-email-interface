import type { ReactNode } from 'react';

// Monochrome line glyphs — Gmail's icon language (24px grid, 2px stroke).
// The filled variants (star) keep the same path and paint it with currentColor.
const GLYPHS = {
  menu: (<><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h 16" /></>),
  close: (<><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>),
  help: (<><circle cx="12" cy="12" r="9" /><path d="M9.2 9.3a3 3 0 1 1 4.3 2.7c-.8.4-1.4 1.1-1.4 2v.5" /><path d="M12 18h.01" /></>),
  settings: (<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" /></>),
  search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
  star: <path d="M12 3.6l2.47 5.6 5.63.62-4.11 4.08 1.02 5.98-5.01-2.88-5.01 2.88 1.02-5.98-4.11-4.08 5.63-.62z" />,
  important: (<><path d="M12 7v6" /><path d="M12 17h.01" /></>),
  clock: (<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 1.8" /></>),
  send: (<><path d="M21 3L10.5 13.5" /><path d="M21 3l-6.5 18-4-8-8-4z" /></>),
  file: (<><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /></>),
  spam: (<><path d="M12 4l9 16H3z" /><path d="M12 10v4" /><path d="M12 17h.01" /></>),
  trash: (<><path d="M4 7h16" /><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" /><path d="M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12" /><path d="M10 11v6" /><path d="M14 11v6" /></>),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  tag: (<><path d="M20.6 13.4L12 4.8A2 2 0 0 0 10.6 4H5a1 1 0 0 0-1 1v5.6a2 2 0 0 0 .6 1.4l8.6 8.6a2 2 0 0 0 2.8 0l4.6-4.6a2 2 0 0 0 0-2.6z" /><circle cx="8" cy="8" r="1.3" /></>),
  edit: (<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>),
  inbox: (<><path d="M3 12h5l1.5 2.5h5L16 12h5" /><path d="M5.6 5h12.8a2 2 0 0 1 1.9 1.3L22 12v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5l1.7-5.7A2 2 0 0 1 5.6 5z" /></>),
  archive: (<><rect x="3" y="4" width="18" height="4" rx="1" /><path d="M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /><path d="M10 12h4" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7.5l9 6 9-6" /></>),
  back: (<><path d="M19 12H5" /><path d="M12 19l-7-7 7-7" /></>),
  refresh: (<><path d="M20.5 12a8.5 8.5 0 1 1-2.5-6" /><path d="M20.5 4.5V10H15" /></>),
  more: (<><circle cx="6" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none" /><circle cx="18" cy="12" r="1.7" fill="currentColor" stroke="none" /></>),
  checkbox: <rect x="4.5" y="4.5" width="15" height="15" rx="2" />,
  'checkbox-checked': (<><rect x="4.5" y="4.5" width="15" height="15" rx="2" /><path d="M8.5 12.2l2.6 2.6 4.6-5.4" /></>),
  'caret-down': <path d="M7 10l5 5 5-5" />,
  attachment: <path d="M21.4 11.4l-8.5 8.5a5.5 5.5 0 0 1-7.8-7.8l8.5-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.5 8.5a1.8 1.8 0 0 1-2.6-2.6l7.8-7.8" />,
  maximize: (<><path d="M15 3h6v6" /><path d="M9 21H3v-6" /><path d="M21 3l-7 7" /><path d="M3 21l7-7" /></>),
  check: <path d="M5 13l4 4L19 7" />,
} satisfies Record<string, ReactNode>;

export type IconName = keyof typeof GLYPHS;

export const Icon = ({
  name,
  filled = false,
  className = '',
}: {
  name: IconName;
  filled?: boolean;
  className?: string;
}) => (
  <svg
    viewBox="0 0 24 24"
    aria-hidden="true"
    focusable="false"
    className={['icon', filled ? 'icon--filled' : '', className].filter(Boolean).join(' ')}
  >
    {GLYPHS[name]}
  </svg>
);
