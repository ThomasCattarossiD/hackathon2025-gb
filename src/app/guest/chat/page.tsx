'use client';

import { useEffect, useState } from 'react';
import ChatInterface from '@/components/chat/ChatInterface';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function GuestChatPage() {
  const [isGuest] = useState(true);

  return (
    <main className="bg-gray-100 min-h-screen">
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">RoomBarber Chat</h1>
            <p className="text-sm text-gray-600">
              Mode <span className="font-semibold text-amber-600">Invité (Consultation uniquement)</span>
            </p>
          </div>
          <Button
            asChild
            variant="outline"
            className="flex items-center gap-2"
          >
            <Link href="/guest">
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
          </Button>
        </div>
      </header>

      <ChatInterface />
    </main>
  );
}
