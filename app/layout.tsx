import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = { title: 'Signal Hunter — Find the intent', description: 'Find the people already asking for you. A company brain, public buying signals, and replies worth sending.' };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) { return <html lang="en"><body>{children}</body></html>; }
