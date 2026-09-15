'use client';

import { Library as LibraryIcon } from 'lucide-react';
import PlatformGate from '@/components/PlatformGate';
import LibrarySection from '@/components/LibrarySection';

export default function LibraryBrowsePage() {
  return (
    <PlatformGate sectionName="مكتبة سادس">
      <LibrarySection
        section="community"
        title="مكتبة سادس"
        description="ملفات وملازم يشاركها أعضاء المنصة وفريق سادس ألترا. اضغط على الغلاف لفتح الملف."
        icon={<LibraryIcon className="w-7 h-7 text-primary-light" />}
      />
    </PlatformGate>
  );
}
