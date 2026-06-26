'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/AppShell';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';
import { useTheme } from '@/components/providers/ThemeProvider';
import type { Profile } from '@/lib/types';
import {
  User,
  Phone,
  Mail,
  Moon,
  Sun,
  LogOut,
  Save,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';

export default function ProfilePage() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [branch, setBranch] = useState<'scientific' | 'literary'>('scientific');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      if (data) {
        setProfile(data as Profile);
        setName(data.name ?? '');
        setCity(data.city ?? '');
        setBranch((data.branch as any) ?? 'scientific');
      } else {
        // Defensive: create the profile row if the trigger didn't (older users)
        const { data: created } = await supabase
          .from('profiles')
          .insert({ id: user.id })
          .select()
          .maybeSingle();
        if (created) setProfile(created as Profile);
      }
      setLoading(false);
    })();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setMsg(null);
    const { error } = await supabase
      .from('profiles')
      .update({ name, city, branch })
      .eq('id', user.id);
    if (error) setMsg('حدث خطأ أثناء الحفظ');
    else setMsg('تم الحفظ بنجاح');
    setSaving(false);
    setTimeout(() => setMsg(null), 2500);
  };

  const handleLogout = async () => {
    await signOut();
    router.replace('/');
  };

  return (
    <AppShell>
      <div className="p-5 md:p-8 max-w-3xl mx-auto">
        <header className="mb-8 flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary to-primary-light flex items-center justify-center">
            <User className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-cairo font-extrabold text-3xl">حسابي</h1>
            {user?.email && (
              <p className="text-muted text-sm flex items-center gap-1.5 mt-1">
                <Mail className="w-4 h-4" />
                <span dir="ltr">{user.email}</span>
              </p>
            )}
            {user?.phone && (
              <p className="text-muted text-sm flex items-center gap-1.5 mt-1">
                <Phone className="w-4 h-4" />
                <span dir="ltr">{user.phone}</span>
              </p>
            )}
            {!user?.email && !user?.phone && (
              <p className="text-muted text-sm flex items-center gap-1.5 mt-1">
                <Mail className="w-4 h-4" />
                <span dir="ltr">—</span>
              </p>
            )}
          </div>
        </header>

        {loading ? (
          <div className="text-muted">جاري التحميل...</div>
        ) : (
          <div className="space-y-4">
            <section className="card border border-dark-border rounded-2xl p-5">
              <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-primary-light" />
                المعلومات الشخصية
              </h2>
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm mb-1 block">الاسم</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="input-field w-full rounded-xl px-3 py-2 outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-sm mb-1 block">المحافظة</label>
                  <input
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="input-field w-full rounded-xl px-3 py-2 outline-none focus:border-primary"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm mb-1 block">الفرع</label>
                  <div className="flex gap-2">
                    {(
                      [
                        { v: 'scientific', l: 'علمي' },
                        { v: 'literary', l: 'أدبي' },
                      ] as const
                    ).map((o) => (
                      <button
                        key={o.v}
                        onClick={() => setBranch(o.v)}
                        className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold border transition ${
                          branch === o.v
                            ? 'bg-primary text-white border-primary'
                            : 'card border-dark-border hover:border-primary/50'
                        }`}
                      >
                        {o.l}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {msg && (
                <div className="mt-4 text-sm text-success bg-success/10 border border-success/30 rounded-lg px-3 py-2">
                  {msg}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary mt-4 disabled:opacity-60"
              >
                <Save className="w-4 h-4" />
                {saving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
              </button>
            </section>

            <section className="card border border-dark-border rounded-2xl p-5">
              <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary-light" />
                إعدادات المظهر
              </h2>
              <button
                onClick={toggleTheme}
                className="w-full flex items-center justify-between rounded-xl px-4 py-3 border border-dark-border hover:border-primary/50 transition"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? (
                    <Moon className="w-5 h-5" />
                  ) : (
                    <Sun className="w-5 h-5" />
                  )}
                  {theme === 'dark' ? 'الوضع الداكن' : 'الوضع الفاتح'}
                </span>
                <span className="text-xs text-muted">
                  اضغط للتبديل
                </span>
              </button>
            </section>

            <section className="card border border-dark-border rounded-2xl p-5">
              <h2 className="font-cairo font-bold text-lg mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary-light" />
                الاشتراك
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold capitalize">
                    {profile?.subscription_tier ?? 'free'}
                  </p>
                  <p className="text-xs text-muted">
                    {profile?.subscription_expires_at
                      ? `ينتهي: ${new Date(
                          profile.subscription_expires_at as any
                        ).toLocaleDateString('ar-IQ')}`
                      : 'خطة مجانية'}
                  </p>
                </div>
                <span className="text-xs bg-primary/20 text-primary-light px-3 py-1 rounded-full">
                  {profile?.subscription_tier === 'premium'
                    ? 'مميّز'
                    : profile?.subscription_tier === 'basic'
                    ? 'أساسي'
                    : 'مجاني'}
                </span>
              </div>
              <Link
                href="/account/subscription"
                className="mt-4 inline-flex items-center justify-center w-full gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-primary text-primary-foreground hover:opacity-90 transition"
              >
                إدارة الاشتراك / اشتراك جديد
              </Link>
            </section>

            <button
              onClick={handleLogout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3 font-semibold border border-error/50 text-error hover:bg-error/10 transition"
            >
              <LogOut className="w-5 h-5" />
              تسجيل الخروج
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
