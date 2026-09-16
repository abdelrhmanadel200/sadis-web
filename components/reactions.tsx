'use client';

import { useCallback, useEffect, useState } from 'react';
import { ThumbsUp, ThumbsDown, BadgeCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/providers/AuthProvider';

export type ReactionKind =
  | 'book'
  | 'library_file'
  | 'news'
  | 'institute'
  | 'telegram'
  | 'lecture'
  | 'playlist'
  | 'ministry_file';

interface Counts {
  likes: number;
  dislikes: number;
  mine: 1 | -1 | 0;
}

const EMPTY: Counts = { likes: 0, dislikes: 0, mine: 0 };

/** الأعداد بعد نقرة الطالب: نفس الزر يلغي، والزر الآخر يبدّل. */
function applyToggle(cur: Counts, value: 1 | -1): Counts {
  if (cur.mine === value) {
    return {
      likes: cur.likes - (value === 1 ? 1 : 0),
      dislikes: cur.dislikes - (value === -1 ? 1 : 0),
      mine: 0,
    };
  }
  return {
    likes: cur.likes + (value === 1 ? 1 : 0) - (cur.mine === 1 ? 1 : 0),
    dislikes: cur.dislikes + (value === -1 ? 1 : 0) - (cur.mine === -1 ? 1 : 0),
    mine: value,
  };
}

/**
 * يجلب أعداد اللايك/الدسلايك لمجموعة عناصر دفعة واحدة (RPC واحد للصفحة كلها)
 * ويوفر دالة تبديل تفاعل الطالب مع تحديث فوري يُتراجع عنه إن فشل الحفظ.
 */
export function useReactions(kind: ReactionKind, ids: string[]) {
  const { user } = useAuth();
  const [map, setMap] = useState<Record<string, Counts>>({});
  const key = ids.join(',');

  useEffect(() => {
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.rpc('reaction_counts', { p_kind: kind, p_item_ids: ids });
      if (cancelled || !Array.isArray(data)) return;
      const next: Record<string, Counts> = {};
      for (const r of data as Array<{ item_id: string; likes: number; dislikes: number; mine: number | null }>) {
        next[r.item_id] = {
          likes: Number(r.likes) || 0,
          dislikes: Number(r.dislikes) || 0,
          mine: r.mine === 1 ? 1 : r.mine === -1 ? -1 : 0,
        };
      }
      setMap(next);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, key, user?.id]);

  const toggle = useCallback(
    async (itemId: string, value: 1 | -1) => {
      if (!user) return false;
      const cur = map[itemId] ?? EMPTY;
      const removing = cur.mine === value;
      setMap((m) => ({ ...m, [itemId]: applyToggle(cur, value) }));

      const { error } = removing
        ? await supabase
            .from('reactions')
            .delete()
            .eq('user_id', user.id)
            .eq('kind', kind)
            .eq('item_id', itemId)
        : await supabase
            .from('reactions')
            .upsert({ user_id: user.id, kind, item_id: itemId, value }, { onConflict: 'user_id,kind,item_id' });

      if (error) {
        // ارجع للحالة السابقة بدل أن يرى الطالب تفاعلاً لم يُحفظ.
        setMap((m) => ({ ...m, [itemId]: cur }));
        alert('تعذّر حفظ تفاعلك، حاول مرة ثانية.');
        return false;
      }
      return true;
    },
    [user, kind, map],
  );

  return { counts: map, toggle };
}

/** شريط لايك/دسلايك صغير يوضع على بطاقة العنصر. */
export function ReactionBar({
  itemId,
  counts,
  onToggle,
  compact,
}: {
  itemId: string;
  counts?: Counts;
  onToggle: (itemId: string, value: 1 | -1) => void;
  compact?: boolean;
}) {
  const { user } = useAuth();
  const c = counts ?? EMPTY;
  const size = compact ? 'w-3.5 h-3.5' : 'w-4 h-4';
  const base = `inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-bold transition ${compact ? '' : 'border'}`;
  return (
    // preventDefault ضروري: بعض البطاقات روابط (قنوات تليجرام)، وبدونه تفتح
    // القناة مع كل ضغطة لايك.
    <div
      className="flex items-center gap-1"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <button
        type="button"
        title={user ? 'أعجبني' : 'سجّل دخولك لتتفاعل'}
        disabled={!user}
        onClick={() => onToggle(itemId, 1)}
        className={`${base} ${c.mine === 1 ? 'bg-emerald-600 text-white border-emerald-600' : 'border-dark-border text-muted hover:text-emerald-400 hover:border-emerald-500/60'} disabled:opacity-60`}
      >
        <ThumbsUp className={size} />
        {c.likes}
      </button>
      <button
        type="button"
        title={user ? 'لم يعجبني' : 'سجّل دخولك لتتفاعل'}
        disabled={!user}
        onClick={() => onToggle(itemId, -1)}
        className={`${base} ${c.mine === -1 ? 'bg-red-600 text-white border-red-600' : 'border-dark-border text-muted hover:text-red-400 hover:border-red-500/60'} disabled:opacity-60`}
      >
        <ThumbsDown className={size} />
        {c.dislikes}
      </button>
    </div>
  );
}

/** علامة الصح الزرقاء: محتوى رفعه فريق سادس ألترا. */
export function OfficialBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="رفعه فريق سادس ألترا"
      className={`inline-flex items-center gap-1 rounded-full bg-sky-600 text-white text-[11px] font-bold px-2 py-0.5 ${className}`}
    >
      <BadgeCheck className="w-3.5 h-3.5" />
      رسمي
    </span>
  );
}
