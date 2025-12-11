// src/app/chat/page.tsx
import ChatInterface from "@/components/chat/ChatInterface";

export default function ChatPage() {
  return (
    <main className="h-[100dvh] w-full bg-gray-100 flex items-center justify-center overflow-hidden">
      <ChatInterface />
    </main>
  );
}
