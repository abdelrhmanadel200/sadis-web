import { Suspense } from 'react';
import AppShell from '@/components/AppShell';
import ChatView from '@/components/chat/ChatView';

export default function ChatPage() {
  return (
    <AppShell fullHeight>
      <Suspense fallback={<div className="p-8 text-muted">جاري التحميل...</div>}>
        <ChatView />
      </Suspense>
    </AppShell>
  );
}
