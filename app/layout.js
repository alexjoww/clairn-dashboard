import { Geist } from 'next/font/google';
import './globals.css';

// Same typeface as the marketing site. next/font downloads it at build time
// and serves it from this app, so browsers never call Google.
const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
  display: 'swap',
});

export const metadata = {
  title: 'Clairn',
  description:
    'Clairn automates the answering of vendor security questionnaires.',
};

// The app has one (dark) theme, so there is nothing to vary by color scheme.
export const viewport = {
  themeColor: '#09090b',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={geistSans.variable}>
      <body>{children}</body>
    </html>
  );
}
