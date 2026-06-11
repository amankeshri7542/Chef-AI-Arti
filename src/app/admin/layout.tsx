import type { Metadata } from 'next';
import AdminShell from './AdminShell';

export const metadata: Metadata = {
  title: 'Chief Arti Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen text-white" style={{ background: '#1A1A2E' }}>
      <AdminShell>{children}</AdminShell>
    </div>
  );
}
