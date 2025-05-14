import type { ReactNode } from 'react';

// The main AppLayout already provides the sidebar and header.
// This admin layout can be used for additional admin-specific wrappers or context if needed.
// For now, it will just render children.

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="w-full">
      {/* You could add admin-specific breadcrumbs or sub-navigation here if desired */}
      {/* <div className="mb-4">
        <h2 className="text-2xl font-semibold text-gray-700">Admin Panel</h2>
      </div> */}
      {children}
    </div>
  );
}