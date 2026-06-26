import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ChatView from '@/components/chat/ChatView';

export default function SubjectChatPage({
  params,
}: {
  params: { subjectId: string };
}) {
  return (
    <AppShell fullHeight>
      <Suspense fallback={<div className="p-8 text-muted">جاري التحميل...</div>}>
        <ChatView subjectId={params.subjectId} />
      </Suspense>
    </AppShell>
  );
}
