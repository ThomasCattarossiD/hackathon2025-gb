import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText } from 'ai';
import { createToolsWithUserContext } from '@/lib/chatTools';
import { decodeSessionToken, getUserById } from '@/lib/auth';
import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import { join } from 'path';

// 1. CHARGER LE PROMPT DEPUIS LE MARKDOWN
function loadSystemPrompt(isGuest: boolean, userName?: string): string {
  try {
    // Lire le fichier markdown depuis la racine du projet
    const promptPath = join(process.cwd(), 'SYSTEM_PROMPT_ROOM_BOOKING.md');
    let promptContent = readFileSync(promptPath, 'utf-8');

    // Injecter les restrictions de mode invité si nécessaire
    const guestRestriction = isGuest
      ? `\n\n**GUEST MODE - LIMITED ACCESS:**
You are operating in GUEST MODE. You can:
✓ Show available rooms
✓ Show room details (location, capacity, equipment)
✓ Find meetings by company name
✓ List meetings

But you CANNOT:
✗ Book a room (require login)
✗ Modify a meeting (require login)
✗ See personal meeting details

When a guest asks to book or modify, respond: "This action requires authentication. Please login or register to book rooms."`
      : `\n\n**AUTHENTICATED USER:**
User: ${userName || 'Unknown'}
You have full access to all features:
✓ Book rooms
✓ Modify meetings
✓ List personal meetings
✓ Find meetings by company`;

    // Ajouter les restrictions à la fin du prompt
    promptContent += guestRestriction;

    return promptContent;
  } catch (error) {
    console.error('❌ Erreur lors du chargement du SYSTEM_PROMPT_ROOM_BOOKING.md:', error);
    // Fallback minimal si le fichier ne peut pas être chargé
    return `You are the GoodBarber Workspace Agent for room booking.
IMPORTANT: You MUST speak ONLY about room reservation, modification, and display. 
For any other question, respond: "Je suis l'assistant de réservation de salles. Je ne peux t'aider que pour réserver, modifier ou visualiser vos réunions."`;
  }
}

export const maxDuration = 30; // Timeout de sécurité (30s)

// 2. AJUSTEMENT DYNAMIQUE DU PROMPT & RÉCUPÉRATION DES MESSAGES
export async function POST(req: NextRequest) {
  // Vérifier l'authentification (mode invité ou authentifié)
  const sessionToken = req.cookies.get('session_token')?.value;
  let currentUser = null;
  let isGuest = false;

  if (sessionToken) {
    const decoded = decodeSessionToken(sessionToken);
    if (decoded?.userId) {
      currentUser = await getUserById(decoded.userId);
    }
  } else {
    // Mode invité - accès limité
    isGuest = true;
  }

  const { messages } = await req.json(); // Récupération de l'historique de conversation
  const now = new Date();
  const parisTime = now.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  // Charger le prompt depuis le markdown et injecter les données dynamiques
  const baseSystemPrompt = loadSystemPrompt(isGuest, currentUser?.fullName);
  const dynamicSystemPrompt = baseSystemPrompt.replace('{{CURRENT_DATE}}', parisTime);

  // 3. CRÉER LES TOOLS AVEC ACCÈS AU USERID (contexte d'authentification)
  // On utilise le userId du currentUser pour les opérations qui l'exigent
  const toolsWithUserContext = createToolsWithUserContext(currentUser?.id);

  // 4. APPEL À L'IA AVEC LES OUTILS BACKEND
  const result = await streamText({
    model: openai('gpt-4o-mini'), // Modèle rapide et efficace
    system: dynamicSystemPrompt,
    messages: convertToModelMessages(messages),
    tools: toolsWithUserContext,
  });

  // On renvoie le flux (streaming) vers le frontend pour l'effet "machine à écrire"
  console.log('🤖 Réponse IA en streaming initialisée...');
  return result.toUIMessageStreamResponse();
}