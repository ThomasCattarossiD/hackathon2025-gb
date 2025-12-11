import { NextRequest, NextResponse } from 'next/server';
import { decodeSessionToken, getUserById } from '@/lib/auth';

/**
 * Middleware pour vérifier l'authentification de l'utilisateur
 * Expose les informations utilisateur dans les headers de réponse
 */
export async function withAuth(req: NextRequest) {
  try {
    const sessionToken = req.cookies.get('session_token')?.value;

    if (!sessionToken) {
      return null;
    }

    const decoded = decodeSessionToken(sessionToken);

    if (!decoded || !decoded.userId) {
      return null;
    }

    const user = await getUserById(decoded.userId);

    return user;
  } catch {
    return null;
  }
}

/**
 * Middleware pour protéger une route (nécessite d'être authentifié)
 */
export async function requireAuth(req: NextRequest) {
  const user = await withAuth(req);

  if (!user) {
    return {
      error: 'Non authentifié',
      status: 401,
    };
  }

  return { user };
}

/**
 * Middleware pour mode invité (accès limité)
 * Utilisé pour les consultations publiques
 */
export function isGuest(req: NextRequest): boolean {
  const sessionToken = req.cookies.get('session_token')?.value;
  return !sessionToken;
}

/**
 * Wrapper pour les routes protégées
 */
export async function protectedApiRoute(
  req: NextRequest,
  handler: (req: NextRequest, user: any) => Promise<NextResponse>
) {
  const auth = await requireAuth(req);

  if (auth.error) {
    return NextResponse.json(
      { error: auth.error },
      { status: auth.status }
    );
  }

  return handler(req, auth.user);
}
