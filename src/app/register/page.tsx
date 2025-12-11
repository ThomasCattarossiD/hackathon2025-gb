'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { UserPlus } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
    society: '',
    pmrNeeded: false,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Validations
    if (!formData.fullName.trim()) {
      toast.error('Le nom complet est obligatoire');
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Le mot de passe doit contenir au minimum 8 caractères');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error('Les mots de passe ne correspondent pas');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: formData.fullName,
          email: formData.email,
          password: formData.password,
          society: formData.society || undefined,
          pmrNeeded: formData.pmrNeeded,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Erreur d\'inscription');
      }

      toast.success('Inscription réussie! Connectez-vous maintenant.');
      
      // Rediriger vers login
      router.push('/login');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur d\'inscription';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-indigo-100 p-3 rounded-full mb-4">
            <UserPlus className="w-6 h-6 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Inscription</h1>
          <p className="text-gray-600 text-sm mt-2">RoomBarber - Réservation de salles</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-2">
              Nom complet
            </label>
            <Input
              id="fullName"
              type="text"
              name="fullName"
              value={formData.fullName}
              onChange={handleChange}
              placeholder="Jean Dupont"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
              Email
            </label>
            <Input
              id="email"
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="votre@email.com"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="society" className="block text-sm font-medium text-gray-700 mb-2">
              Entreprise (optionnel)
            </label>
            <Input
              id="society"
              type="text"
              name="society"
              value={formData.society}
              onChange={handleChange}
              placeholder="Microsoft, Google, etc."
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
              Mot de passe
            </label>
            <Input
              id="password"
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-2">
              Confirmer le mot de passe
            </label>
            <Input
              id="confirmPassword"
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="••••••••"
              required
              disabled={loading}
            />
          </div>

          <div className="flex items-center space-x-2">
            <input
              id="pmrNeeded"
              type="checkbox"
              name="pmrNeeded"
              checked={formData.pmrNeeded}
              onChange={handleChange}
              disabled={loading}
              className="w-4 h-4 cursor-pointer"
            />
            <label
              htmlFor="pmrNeeded"
              className="text-sm font-medium text-gray-700 cursor-pointer"
            >
              J'ai besoin d'une accessibilité PMR
            </label>
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700"
            disabled={loading}
          >
            {loading ? 'Inscription en cours...' : "S'inscrire"}
          </Button>
        </form>

        <div className="mt-6 pt-6 border-t border-gray-200 text-center">
          <p className="text-gray-600 text-sm">
            Vous avez déjà un compte?{' '}
            <Link
              href="/login"
              className="text-indigo-600 hover:text-indigo-700 font-semibold"
            >
              Se connecter
            </Link>
          </p>
        </div>
      </Card>
    </main>
  );
}
