'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CalendarDays, Lock, Users, Zap } from 'lucide-react';

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
    <main className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">RoomBarber</h1>
              <p className="text-gray-600 text-sm">Réservez vos salles de réunion par conversation</p>
            </div>
            <div className="flex gap-3">
              <Button
                asChild
                variant="outline"
              >
                <Link href="/login">
                  Connexion
                </Link>
              </Button>
              <Button
                asChild
                className="bg-indigo-600 hover:bg-indigo-700"
              >
                <Link href="/register">
                  S'inscrire
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="max-w-7xl mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-4">
            Réservez vos salles<br />
            <span className="text-indigo-600">par conversation naturelle</span>
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            Oubliez les formulaires compliqués. Parlez simplement au chatbot RoomBarber.
          </p>
          <div className="flex gap-4 justify-center">
            <Button
              asChild
              size="lg"
              className="bg-indigo-600 hover:bg-indigo-700"
            >
              <Link href="/register">
                Commencer maintenant
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
            >
              <Link href="/guest">
                Mode invité
              </Link>
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="p-6 hover:shadow-lg transition">
            <div className="bg-blue-100 p-3 rounded-lg w-fit mb-4">
              <Zap className="w-6 h-6 text-blue-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Rapide & Simple</h3>
            <p className="text-gray-600 text-sm">
              Décrivez votre besoin en langage naturel, le chatbot s'occupe du reste.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="bg-green-100 p-3 rounded-lg w-fit mb-4">
              <CalendarDays className="w-6 h-6 text-green-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Disponibilité Immédiate</h3>
            <p className="text-gray-600 text-sm">
              Consultez les salles disponibles en temps réel et les conflits sont évités.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="bg-purple-100 p-3 rounded-lg w-fit mb-4">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Travail en Équipe</h3>
            <p className="text-gray-600 text-sm">
              Gérez vos réunions et collaborez facilement avec vos collègues.
            </p>
          </Card>

          <Card className="p-6 hover:shadow-lg transition">
            <div className="bg-red-100 p-3 rounded-lg w-fit mb-4">
              <Lock className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="font-semibold text-lg mb-2">Sécurisé</h3>
            <p className="text-gray-600 text-sm">
              Vos données sont protégées. Authentification requise pour les réservations.
            </p>
          </Card>
        </div>

        {/* How it Works */}
        <section className="mt-20">
          <h3 className="text-3xl font-bold text-center mb-12">Comment ça marche</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-indigo-600 text-white font-bold text-2xl rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                1
              </div>
              <h4 className="font-semibold mb-2">Inscrivez-vous</h4>
              <p className="text-gray-600">
                Créez votre compte en quelques secondes avec votre email.
              </p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-600 text-white font-bold text-2xl rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                2
              </div>
              <h4 className="font-semibold mb-2">Parlez au Chatbot</h4>
              <p className="text-gray-600">
                Décrivez votre besoin: "J'ai besoin d'une salle pour 5 personnes lundi".
              </p>
            </div>
            <div className="text-center">
              <div className="bg-indigo-600 text-white font-bold text-2xl rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                3
              </div>
              <h4 className="font-semibold mb-2">Réservez en 1 clic</h4>
              <p className="text-gray-600">
                Confirmez votre réservation et c'est prêt!
              </p>
            </div>
          </div>
        </section>

        {/* Guest Mode Info */}
        <section className="mt-20 bg-amber-50 border border-amber-200 rounded-lg p-8">
          <h3 className="text-2xl font-bold text-amber-900 mb-4">Mode Invité</h3>
          <p className="text-amber-800 mb-4">
            Vous n'avez pas de compte? Aucun problème! Accédez au mode invité pour consulter les salles et réunions (sans pouvoir réserver).
          </p>
          <Button
            asChild
            variant="outline"
            className="border-amber-300"
          >
            <Link href="/guest">
              Accéder au mode invité →
            </Link>
          </Button>
        </section>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 mt-20 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p>&copy; 2025 RoomBarber - Réservation intelligente de salles</p>
          <p className="text-sm mt-2">Hackathon GoodBarber 2025</p>
        </div>
      </footer>
    </main>
  );
}
