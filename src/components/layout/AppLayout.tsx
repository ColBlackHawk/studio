import type { ReactNode } from 'react';
import Header from './Header';
import Sidebar from './Sidebar';
import { Toaster } from "@/components/ui/toaster";

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex min-h-screen w-full flex-col bg-muted/40">
      <Header />
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 p-4 sm:px-6 sm:py-0 md:gap-8 md:p-6 lg:p-8 overflow-auto">
          {children}
        </main>
      </div>
      <Toaster />
    </div>
  );
}