import type { SupabaseClient } from '@supabase/supabase-js';

export type SavedKind = 'book' | 'lecture';

/**
 * Fetch the set of `item_id`s saved by the given user for a given kind.
 * Returns an empty Set if not signed in or on any error so callers can render
 * the page anyway and just treat everything as not-saved.
 */
export async function fetchSavedIds(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  kind: SavedKind,
): Promise<Set<string>> {
  if (!userId) return new Set();
  try {
    const { data } = await supabase
      .from('saved_items')
      .select('item_id')
      .eq('user_id', userId)
      .eq('kind', kind);
    return new Set((data ?? []).map((r: { item_id: string }) => r.item_id));
  } catch {
    return new Set();
  }
}

/** Toggle a save: returns the new state (true = saved). Best-effort, the
 *  caller should update its local Set optimistically. */
export async function toggleSave(
  supabase: SupabaseClient,
  userId: string,
  kind: SavedKind,
  itemId: string,
  currentlySaved: boolean,
): Promise<boolean> {
  if (currentlySaved) {
    await supabase
      .from('saved_items')
      .delete()
      .eq('user_id', userId)
      .eq('kind', kind)
      .eq('item_id', itemId);
    return false;
  }
  await supabase.from('saved_items').upsert(
    { user_id: userId, kind, item_id: itemId },
    { onConflict: 'user_id,kind,item_id' },
  );
  return true;
}

/** Extract a YouTube video ID from any common URL shape:
 *  https://youtube.com/watch?v=XYZ, https://youtu.be/XYZ, embed/XYZ, shorts/XYZ
 *  Returns null if the URL doesn't look like YouTube. */
export function youtubeIdFromUrl(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0] || null;
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      // /embed/<id>, /shorts/<id>, /v/<id>
      const m = u.pathname.match(/\/(embed|shorts|v)\/([^/?#]+)/);
      if (m) return m[2];
    }
    return null;
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(url: string): string | null {
  const id = youtubeIdFromUrl(url);
  return id ? `https://www.youtube-nocookie.com/embed/${id}?rel=0` : null;
}

export function youtubeThumb(url: string): string | null {
  const id = youtubeIdFromUrl(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}
