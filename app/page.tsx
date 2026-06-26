'use client';

export const dynamic = 'force-dynamic';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthProvider';
import { Header } from '@/components/landing/header';
import { Hero } from '@/components/landing/hero';
import { About } from '@/components/landing/about';
import { Features } from '@/components/landing/features';
import { StudyTracks } from '@/components/landing/study-tracks';
import { Community } from '@/components/landing/community';
import { Pricing } from '@/components/landing/pricing';
import { FAQ } from '@/components/landing/faq';
import { Footer } from '@/components/landing/footer';

/**
 * Landing page based on the v0 design delivered by the client on 2026-05-12.
 * Sections (top to bottom):
 *   Header / Hero / About / Features / StudyTracks (Scientific & Literary) /
 *   Community / Pricing / FAQ / Footer (legal + payment logos).
 *
 * Signed-in users get redirected straight to /chat.
 */
export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/chat');
  }, [user, loading, router]);

  return (
    <main className="min-h-screen bg-background">
      <Header />
      <Hero />
      <About />
      <Features />
      <StudyTracks />
      <Community />
      <Pricing />
      <FAQ />
      <Footer />
    </main>
  );
}
