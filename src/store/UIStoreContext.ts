import { createContext, useContext } from 'react';
import type { UIStore } from './useUIStore';

export const UIStoreContext = createContext<UIStore | null>(null);
export const useUI = () => {
  const ctx = useContext(UIStoreContext);
  if (!ctx) throw new Error('useUI must be inside UIStoreContext.Provider');
  return ctx;
};
