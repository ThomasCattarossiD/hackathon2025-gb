import { NextRequest, NextResponse } from 'next/server';
import { registerUser } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const { fullName, email, password, society, pmrNeeded } = await req.json();

    console.log('Register request:', { fullName, email, society, pmrNeeded });

    // Valider les données
    if (!fullName || !email || !password) {
      return NextResponse.json(
        { error: 'Tous les champs sont obligatoires' },
        { status: 400 }
      );
    }

    // Créer l'utilisateur
    const user = await registerUser(fullName, email, password, society, pmrNeeded);

    console.log('User registered:', user);

    return NextResponse.json(
      {
        message: 'Inscription réussie',
        user,
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur d\'inscription';
    
    console.error('Register error:', message);

    return NextResponse.json(
      { error: message },
      { status: 400 }
    );
  }
}
