import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Shared chrome for /terms /privacy /refund (AR + EN variants).
 * Renders a quiet, document-like page with a centered narrow column,
 * a back-home link, a localized language switcher, and a generous
 * prose body. Designed to be unambiguous for payment processors
 * reviewing our compliance pages.
 */
export function LegalLayout({
  lang,
  title,
  lastUpdated,
  switchHref,
  children,
}: {
  lang: 'ar' | 'en';
  title: string;
  lastUpdated: string;
  switchHref: string;
  children: React.ReactNode;
}) {
  const isAr = lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const homeLabel = isAr ? 'العودة للرئيسية' : 'Back to home';
  const switchLabel = isAr ? 'English' : 'العربية';
  const updatedLabel = isAr ? 'آخر تحديث' : 'Last updated';

  return (
    <div dir={dir} className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition"
          >
            <ArrowRight className={isAr ? 'h-4 w-4' : 'h-4 w-4 rotate-180'} />
            {homeLabel}
          </Link>
          <Link
            href={switchHref}
            className="text-sm text-primary hover:underline"
          >
            {switchLabel}
          </Link>
        </div>
      </header>

      <article className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl md:text-4xl font-bold mb-2">{title}</h1>
        <p className="text-sm text-muted-foreground mb-10">
          {updatedLabel}: {lastUpdated}
        </p>
        <div className="prose-legal space-y-6 text-base leading-loose">
          {children}
        </div>
      </article>
    </div>
  );
}
