import type { Metadata } from 'next';
import { Inter } from 'next/font/google'; // Changed to Inter for a more modern feel
import './globals.css';
import AppLayout from '@/components/layout/AppLayout';
import { APP_NAME } from '@/lib/constants';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Manage your tournaments with ease using TournamentBracket.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased">
        <AppLayout>{children}</AppLayout>
      </body>
    </html>
  );
}
