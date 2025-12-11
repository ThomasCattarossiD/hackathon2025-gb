import { NextResponse } from 'next/server';

export async function POST() {
  // Créer la réponse de déconnexion
  const response = NextResponse.json(
    {
      message: 'Déconnexion réussie',
    },
    { status: 200 }
  );

  // Supprimer le cookie de session
  response.cookies.set({
    name: 'session_token',
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0, // Expire immédiatement
    path: '/',
  });

  return response;
}
