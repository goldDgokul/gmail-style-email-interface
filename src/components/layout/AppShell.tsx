import type { ReactNode } from 'react';

export const AppShell = ({ closed, children }: { closed: boolean; children: ReactNode }) => (
  <div className="shell" data-sidebar-closed={closed ? '' : undefined}>
    {children}
  </div>
);
