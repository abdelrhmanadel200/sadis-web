'use client';

import { useCallback, useEffect, useState } from 'react';
import { FlaskConical, Landmark, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

export type Branch = 'scientific' | 'literary';

const BRANCH_EVENT = 'sadis:branch-changed';

/**
 * فرع الطالب (علمي/أدبي). `confirmed` تعني أنه اختاره بنفسه — القيمة
 * الافتراضية القديمة في القاعدة كانت "scientific" للجميع بلا اختيار.
 */
export function useBranch() {
  const { user } = useAuth();
  const [branch, setBranchState] = useState<Branch>('scientific');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('branch, branch_confirmed')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.branch === 'literary' || data?.branch === 'scientific') setBranchState(data.branch);
      setConfirmed(Boolean(data?.branch_confirmed));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // مزامنة كل نسخ الخطاف في الصفحة: اختيار الفرع من النافذة يحدّث القائمة فوراً.
  useEffect(() => {
    const onChange = (e: Event) => {
      const b = (e as CustomEvent<Branch>).detail;
      if (b === 'scientific' || b === 'literary') {
        setBranchState(b);
        setConfirmed(true);
      }
    };
    window.addEventListener(BRANCH_EVENT, onChange);
    return () => window.removeEventListener(BRANCH_EVENT, onChange);
  }, []);

  const setBranch = useCallback(
    async (b: Branch) => {
      if (!user) return false;
      const { error } = await supabase
        .from('profiles')
        .update({ branch: b, branch_confirmed: true })
        .eq('id', user.id);
      if (error) return false;
      setBranchState(b);
      setConfirmed(true);
      window.dispatchEvent(new CustomEvent<Branch>(BRANCH_EVENT, { detail: b }));
      return true;
    },
    [user],
  );

  return { branch, confirmed, loading, setBranch };
}

/** هل تُعرض هذه المادة لطالب في هذا الفرع؟ */
export function subjectVisibleFor(subjectBranch: string | null | undefined, branch: Branch): boolean {
  return !subjectBranch || subjectBranch === 'both' || subjectBranch === branch;
}

const OPTIONS: { v: Branch; label: string; hint: string; icon: React.ReactNode }[] = [
  {
    v: 'scientific',
    label: 'السادس العلمي',
    hint: 'فيزياء، كيمياء، أحياء، رياضيات علمي + المواد المشتركة',
    icon: <FlaskConical className="w-7 h-7" />,
  },
  {
    v: 'literary',
    label: 'السادس الأدبي',
    hint: 'تاريخ، جغرافيا، اقتصاد، رياضيات أدبي + المواد المشتركة',
    icon: <Landmark className="w-7 h-7" />,
  },
];

/**
 * نافذة اختيار الفرع — تظهر مرة واحدة لمن لم يختر فرعه بعد، ولا تُغلق
 * إلا بالاختيار. يمكن تغيير الفرع لاحقاً من صفحة حسابي.
 */
export default function BranchGate() {
  const { user } = useAuth();
  const { confirmed, loading, setBranch } = useBranch();
  const [busy, setBusy] = useState<Branch | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!user || loading || confirmed) return null;

  const choose = async (b: Branch) => {
    setBusy(b);
    setError(null);
    const ok = await setBranch(b);
    if (!ok) setError('تعذّر الحفظ، حاول مرة ثانية.');
    setBusy(null);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" dir="rtl">
      <div className="w-full max-w-lg rounded-2xl border border-dark-border bg-background p-6 shadow-2xl">
        <h2 className="text-2xl font-bold mb-1">أنت في أي فرع؟</h2>
        <p className="text-sm text-muted mb-5">
          نعرض لك مواد فرعك فقط في الدردشة والمواد. تقدر تغيّره لاحقاً من صفحة حسابي.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {OPTIONS.map((o) => (
            <button
              key={o.v}
              onClick={() => choose(o.v)}
              disabled={busy !== null}
              className="group rounded-2xl border border-dark-border bg-card/40 p-5 text-start hover:border-primary transition disabled:opacity-60"
            >
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary-light group-hover:bg-primary group-hover:text-white transition">
                {busy === o.v ? <Loader2 className="w-6 h-6 animate-spin" /> : o.icon}
              </div>
              <div className="font-bold text-lg">{o.label}</div>
              <div className="text-xs text-muted mt-1 leading-relaxed">{o.hint}</div>
            </button>
          ))}
        </div>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
      </div>
    </div>
  );
}
