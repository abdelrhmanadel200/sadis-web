'use client';

import { ClipboardList } from 'lucide-react';
import PlatformGate from '@/components/PlatformGate';
import LibrarySection from '@/components/LibrarySection';

export default function MinistryExamsPage() {
  return (
    <PlatformGate sectionName="مناهج الأسئلة الوزارية">
      <LibrarySection
        section="ministry"
        title="مناهج الأسئلة الوزارية"
        description="أسئلة وزارية سابقة وحلولها مرتبة حسب المادة، يرفعها فريق سادس ألترا والأعضاء. اضغط على الغلاف لفتح الملف."
        icon={<ClipboardList className="w-7 h-7 text-primary-light" />}
      />
    </PlatformGate>
  );
}
