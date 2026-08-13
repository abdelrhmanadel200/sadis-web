import type { Metadata } from 'next';
import { Cairo, Tajawal, Mulish } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { AuthProvider } from '@/components/providers/AuthProvider';
import ReferralCapture from '@/components/ReferralCapture';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  variable: '--font-cairo',
  display: 'swap',
  weight: ['400', '500', '600', '700', '800'],
});

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  variable: '--font-tajawal',
  display: 'swap',
  weight: ['400', '500', '700'],
});

const mulish = Mulish({
  subsets: ['latin'],
  variable: '--font-mulish',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://sadis-web.vercel.app'),
  title: 'SADIS Ultra — الأستاذ ذكي',
  description:
    'منصّة SADIS Ultra التعليمية — مساعدك الذكي لمنهج سادس إعدادي العراقي',
  openGraph: {
    title: 'SADIS Ultra — الأستاذ ذكي',
    description:
      'منصّة SADIS Ultra التعليمية — مساعدك الذكي لمنهج سادس إعدادي العراقي',
    locale: 'ar_IQ',
    type: 'website',
  },
  icons: {
    icon: [{ url: '/favicon-512.png', type: 'image/png' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#121212',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body
        className={`${cairo.variable} ${tajawal.variable} ${mulish.variable} font-tajawal`}
      >
        <ThemeProvider>
          <AuthProvider>
            <ReferralCapture />
            <div className="bg-shadows" aria-hidden />
            <div className="relative z-10">{children}</div>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
