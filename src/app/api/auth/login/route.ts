import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateSessionToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    console.log('Login request:', { email });

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe obligatoires' },
        { status: 400 }
      );
    }

    // Authentifier l'utilisateur
    const user = await authenticateUser(email, password);
    
    console.log('User authenticated:', user);

    // Générer un token de session
    const sessionToken = generateSessionToken(user.id);

    // Créer la réponse avec cookie de session
    const response = NextResponse.json(
      {
        message: 'Connexion réussie',
        user,
      },
      { status: 200 }
    );

    // Définir le cookie de session (sécurisé, httpOnly, 7 jours)
    response.cookies.set({
      name: 'session_token',
      value: sessionToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 jours
      path: '/',
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur de connexion';
    
    console.error('Login error:', message);

    return NextResponse.json(
      { error: message },
      { status: 401 }
    );
  }
}
