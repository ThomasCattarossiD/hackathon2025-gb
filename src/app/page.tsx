'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CalendarDays, Lock, Users, Zap } from 'lucide-react';
import ChatInterface from '@/components/chat/ChatInterface';

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Vérifier si l'utilisateur est connecté
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          setIsAuthenticated(true);
          // Rediriger automatiquement vers le chat
          router.push('/chat');
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      } 
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="h-[100dvh] w-full bg-gray-100 flex items-center justify-center overflow-hidden">
      <ChatInterface />
    </main>
  );
}
