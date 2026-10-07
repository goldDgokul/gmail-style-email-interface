import { useEffect } from 'react';
import type { UIStore } from '../store/useUIStore';

const TYPING_TAGS = new Set(['INPUT', 'TEXTAREA', 'SELECT']);
const isTyping = () => {
  const el = document.activeElement;
  if (!el) return false;
  return TYPING_TAGS.has(el.tagName) || (el as HTMLElement).isContentEditable;
};

export const useKeyboardShortcuts = (
  ui: UIStore,
  visibleIds: string[],          // derived in App.tsx — same array the list renders
  actions: {                     // wired from App.tsx
    onArchive: (id: string) => void;
    onDelete:  (id: string) => void;
    onStar:    (id: string) => void;
    onMarkUnread: (id: string) => void;
  },
) => {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping()) return;                       // guardrail #4
      const open = ui.openEmailId;
      switch (e.key) {
        case 'c':
          ui.setComposeData({ to:'', cc:'', bcc:'', subject:'', body:'' }); break;
        case '/':
          e.preventDefault(); document.getElementById('search-input')?.focus(); break;
        case 'Escape':
          if (open) ui.setOpenEmailId(null); else if (ui.composeData) ui.setComposeData(null);
          break;
        case 'j': {                                 // down = older (list is newest-first)
          const i = open ? visibleIds.indexOf(open) : -1;
          const next = i === -1 ? visibleIds[0] : visibleIds[i + 1];
          if (next) ui.setOpenEmailId(next);        // read happens in EmailView, not here
          break;
        }
        case 'k': {                                 // up = newer; no-op when nothing is open
          const i = open ? visibleIds.indexOf(open) : -1;
          if (i > 0) ui.setOpenEmailId(visibleIds[i - 1]);
          break;
        }
        case 'e': if (open) actions.onArchive(open); break;
        case '#': if (open) actions.onDelete(open);  break;
        case 's': if (open) actions.onStar(open);    break;
        case 'u': if (open) actions.onMarkUnread(open); break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [ui, visibleIds, actions]);
};
