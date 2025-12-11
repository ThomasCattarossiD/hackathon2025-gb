'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { AlertCircle, Home } from 'lucide-react';

export default function GuestPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl p-8 shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-amber-100 p-3 rounded-full mb-4">
            <AlertCircle className="w-6 h-6 text-amber-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Accès Invité</h1>
          <p className="text-gray-600 text-sm mt-2">Consultation des salles et réunions</p>
        </div>

        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h2 className="font-semibold text-blue-900 mb-3">Mode Invité - Fonctionnalités Disponibles</h2>
            <ul className="space-y-2 text-sm text-blue-800">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Consulter les salles de réunion disponibles</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Voir les réunions par entreprise (ex: Microsoft, Google, etc.)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Filtrer par localisation ou équipement</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span>Chat de consultation (informations uniquement)</span>
              </li>
            </ul>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="font-semibold text-red-900 mb-3">Restrictions - Mode Invité</h2>
            <ul className="space-y-2 text-sm text-red-800">
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✗</span>
                <span>Impossible de réserver une salle</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✗</span>
                <span>Impossible de modifier une réunion</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-600 font-bold">✗</span>
                <span>Impossible de voir les détails personnels des réunions</span>
              </li>
            </ul>
          </div>

          <div className="pt-4 space-y-3">
            <Button
              asChild
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              <Link href="/guest/chat">
                Accéder au Chat Invité
              </Link>
            </Button>

            <div className="flex gap-3">
              <Button
                asChild
                variant="outline"
                className="flex-1"
              >
                <Link href="/login">
                  Se connecter
                </Link>
              </Button>

              <Button
                asChild
                variant="outline"
                className="flex-1"
              >
                <Link href="/register">
                  S'inscrire
                </Link>
              </Button>
            </div>

            <Button
              asChild
              variant="ghost"
              className="w-full"
            >
              <Link href="/" className="flex items-center gap-2">
                <Home className="w-4 h-4" />
                Retour à l'accueil
              </Link>
            </Button>
          </div>
        </div>
      </Card>
    </main>
  );
}
