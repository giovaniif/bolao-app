import type { ReactNode } from 'react';
import { AppHeader } from './AppHeader';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

export function Layout({ children, title }: LayoutProps) {
  return (
    <div className="min-h-screen pb-28">
      <AppHeader title={title} />

      <main className="px-4 py-4 max-w-2xl mx-auto">{children}</main>

      <BottomNav />
    </div>
  );
}
