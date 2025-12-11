import { NextRequest, NextResponse } from 'next/server';
import { decodeSessionToken, getUserById } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    // Récupérer le token de session depuis les cookies
    const sessionToken = req.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    // Décoder le token
    const decoded = decodeSessionToken(sessionToken);

    if (!decoded || !decoded.userId) {
      return NextResponse.json(
        { error: 'Token invalide' },
        { status: 401 }
      );
    }

    // Récupérer les informations utilisateur
    const user = await getUserById(decoded.userId);

    if (!user) {
      return NextResponse.json(
        { error: 'Utilisateur non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        authenticated: true,
        user,
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
