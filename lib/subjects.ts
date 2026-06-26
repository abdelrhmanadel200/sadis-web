// Fallback seed list matches the supabase migration seed
import type { Subject } from './types';

export const DEFAULT_SUBJECTS: Subject[] = [
  { id: 'math', name_ar: 'الرياضيات', name_en: 'Mathematics', branch: 'both', color: '#1E66AA', icon: 'calculator', sort_order: 1 },
  { id: 'physics', name_ar: 'الفيزياء', name_en: 'Physics', branch: 'scientific', color: '#AA1E72', icon: 'zap', sort_order: 2 },
  { id: 'chemistry', name_ar: 'الكيمياء', name_en: 'Chemistry', branch: 'scientific', color: '#1EAACC', icon: 'flask', sort_order: 3 },
  { id: 'biology', name_ar: 'الأحياء', name_en: 'Biology', branch: 'scientific', color: '#AA2C1E', icon: 'dna', sort_order: 4 },
  { id: 'english', name_ar: 'الإنجليزي', name_en: 'English', branch: 'both', color: '#8A38F5', icon: 'languages', sort_order: 5 },
  { id: 'arabic', name_ar: 'العربي', name_en: 'Arabic', branch: 'both', color: '#AA681E', icon: 'scroll', sort_order: 6 },
  { id: 'islamic', name_ar: 'الإسلامية', name_en: 'Islamic', branch: 'both', color: '#22AA1E', icon: 'moon', sort_order: 7 },
  { id: 'history', name_ar: 'التاريخ', name_en: 'History', branch: 'literary', color: '#AA561E', icon: 'landmark', sort_order: 8 },
  { id: 'geography', name_ar: 'الجغرافيا', name_en: 'Geography', branch: 'literary', color: '#79AA1E', icon: 'globe', sort_order: 9 },
  { id: 'economics', name_ar: 'الاقتصاد', name_en: 'Economics', branch: 'literary', color: '#AA1E72', icon: 'bar-chart', sort_order: 10 },
];

export function getSubjectById(id: string | null | undefined): Subject | null {
  if (!id) return null;
  return DEFAULT_SUBJECTS.find((s) => s.id === id) ?? null;
}
