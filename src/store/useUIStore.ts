import { useState, useCallback } from 'react';
import type { SidebarView, ComposeData } from '../types/email';

export const useUIStore = () => {
  const [view, setView]               = useState<SidebarView>('inbox');
  const [activeLabel, setActiveLabel] = useState<string | null>(null);
  const [search, setSearch]           = useState('');
  const [openEmailId, setOpenEmailId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [composeData, setComposeDataState] = useState<ComposeData | null>(null);
  // Bumped on every compose open/replace so <ComposeWindow key=…> remounts
  // with fresh field state (§0.6: a second compose replaces the first).
  const [composeToken, setComposeToken] = useState(0);
  const setComposeData = useCallback((data: ComposeData | null) => {
    setComposeDataState(data);
    setComposeToken(t => t + 1);
  }, []);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [toast, setToast]             = useState<string | null>(null);

  const toggleSelect = useCallback((id: string) =>
    setSelectedIds(prev => { const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next; }), []);
  const selectAll      = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  // A View change is a real context switch: clear ephemeral state (guardrail #20)
  const changeView = useCallback((v: SidebarView) => {
    setView(v); setActiveLabel(null);
    setOpenEmailId(null); setSelectedIds(new Set()); setSearch('');
  }, []);

  // A user label is a pseudo-view (Q17): same cleanup, one extra piece of state
  const changeLabel = useCallback((label: string) => {
    setView('label'); setActiveLabel(label);
    setOpenEmailId(null); setSelectedIds(new Set()); setSearch('');
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    const id = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(id);
  }, []);
  const dismissToast = useCallback(() => setToast(null), []);

  return { view, changeView, activeLabel, changeLabel,
           search, setSearch, openEmailId, setOpenEmailId,
           selectedIds, toggleSelect, selectAll, clearSelection,
           composeData, setComposeData, composeToken, sidebarOpen, setSidebarOpen,
           toast, showToast, dismissToast };
};
export type UIStore = ReturnType<typeof useUIStore>;
