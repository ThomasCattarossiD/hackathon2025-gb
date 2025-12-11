import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Client Supabase côté serveur (pour les routes API)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

/**
 * Hash un mot de passe avec bcrypt-like salt
 * Utilise crypto natif de Node.js pour éviter des dépendances supplémentaires
 */
export async function hashPassword(password: string): Promise<string> {
  // Générer un salt aléatoire
  const salt = crypto.randomBytes(16).toString('hex');
  
  // Créer un hash PBKDF2 (similaire à bcrypt mais plus simple)
  const hash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');
  
  // Retourner salt + hash séparé par :
  return `${salt}:${hash}`;
}

/**
 * Vérifier un mot de passe contre un hash
 */
export async function verifyPassword(
  password: string,
  passwordHash: string
): Promise<boolean> {
  const [salt, hash] = passwordHash.split(':');
  
  if (!salt || !hash) {
    return false;
  }
  
  const compareHash = crypto
    .pbkdf2Sync(password, salt, 100000, 64, 'sha256')
    .toString('hex');
  
  // Comparaison constante (prévient les timing attacks)
  return crypto.timingSafeEqual(
    Buffer.from(hash),
    Buffer.from(compareHash)
  );
}

/**
 * Créer une nouvelle session utilisateur
 */
export async function createSession(userId: string): Promise<string> {
  // Créer un token de session aléatoire (40 caractères)
  const token = crypto.randomBytes(20).toString('hex');
  
  // Sauvegarder dans une table ou en cache (pour cet exemple, on utilise cookies)
  return token;
}

/**
 * Enregistrer un nouvel utilisateur
 */
export async function registerUser(
  fullName: string,
  email: string,
  password: string,
  society?: string,
  pmrNeeded: boolean = false
) {
  // Valider les données
  if (!fullName.trim() || !email.trim() || !password.trim()) {
    throw new Error('Tous les champs sont obligatoires');
  }

  if (password.length < 8) {
    throw new Error('Le mot de passe doit contenir au minimum 8 caractères');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Email invalide');
  }

  try {
    // Vérifier que l'email n'existe pas déjà
    const { data: existingUsers, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email.toLowerCase());

    if (checkError) {
      throw new Error(`Erreur lors de la vérification: ${checkError.message}`);
    }

    if (existingUsers && existingUsers.length > 0) {
      throw new Error('Cet email est déjà utilisé');
    }

    // Hash du mot de passe
    const passwordHash = await hashPassword(password);

    // Créer l'utilisateur
    const { data, error } = await supabase
      .from('users')
      .insert([
        {
          full_name: fullName.trim(),
          email: email.toLowerCase(),
          password_hash: passwordHash,
          society: society?.trim() || null,
          pmr_needed: pmrNeeded,
          is_active: true,
        },
      ])
      .select('id, full_name, email, society')
      .single();

    if (error) {
      console.error('Erreur Supabase lors de l\'insertion:', error);
      throw new Error(`Erreur lors de l'inscription: ${error.message}`);
    }

    if (!data) {
      throw new Error('Erreur: aucune donnée retournée');
    }

    return {
      id: data.id,
      email: data.email,
      fullName: data.full_name,
      society: data.society,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erreur lors de l\'inscription');
  }
}

/**
 * Authentifier un utilisateur (login)
 */
export async function authenticateUser(
  email: string,
  password: string
) {
  if (!email.trim() || !password.trim()) {
    throw new Error('Email et mot de passe obligatoires');
  }

  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, password_hash, society, pmr_needed, is_active')
      .eq('email', email.toLowerCase())
      .single();

    if (error || !user) {
      console.error('Erreur ou utilisateur non trouvé:', error);
      throw new Error('Email ou mot de passe incorrect');
    }

    if (!user.is_active) {
      throw new Error('Ce compte a été désactivé');
    }

    // Vérifier le mot de passe
    const isValid = await verifyPassword(password, user.password_hash);

    if (!isValid) {
      throw new Error('Email ou mot de passe incorrect');
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      society: user.society,
      pmrNeeded: user.pmr_needed,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Erreur lors de l\'authentification');
  }
}

/**
 * Récupérer les informations d'un utilisateur par ID
 */
export async function getUserById(userId: string) {
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, full_name, email, society, pmr_needed, is_active')
      .eq('id', userId)
      .single();

    if (error || !user) {
      console.error('Erreur ou utilisateur non trouvé:', error);
      return null;
    }

    if (!user.is_active) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      society: user.society,
      pmrNeeded: user.pmr_needed,
    };
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'utilisateur:', error);
    return null;
  }
}

/**
 * Générer un token JWT simple (pour les cookies)
 * Note: Pour la production, utiliser jsonwebtoken
 */
export function generateSessionToken(userId: string): string {
  const payload = {
    userId,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60, // 7 jours
  };

  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

/**
 * Décoder un session token
 */
export function decodeSessionToken(token: string): { userId: string; exp: number } | null {
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
    
    // Vérifier l'expiration
    if (decoded.exp && decoded.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return decoded;
  } catch {
    return null;
  }
}
