import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { decodeSessionToken } from '@/lib/auth';
import {
  findRoomsByCarac,
  proposeRoomToUser,
  createMeeting,
  findTeamAvailability,
} from '@/services/bookingService';

export const maxDuration = 30;

// Get current user ID from session cookie
async function getCurrentUserId(): Promise<string | null> {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;
    if (!sessionToken) return null;
    
    const decoded = decodeSessionToken(sessionToken);
    return decoded?.userId || null;
  } catch {
    return null;
  }
}

function getSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });

  return `# Room Barber - Assistant de Reservation de Salles

Tu es un assistant intelligent de reservation de salles de reunion pour GoodBarber.
Tu communiques UNIQUEMENT en francais.

## Date et Contexte
- Date actuelle: ${today} (${dayOfWeek})
- Les horaires de bureau sont de 9h a 18h, du lundi au vendredi

## CASE 1-3: Reservation avec horaire precis
Quand l'utilisateur donne une date/heure precise:
1. Appelle findRoomsByCarac pour trouver la meilleure salle
2. IMMEDIATEMENT apres, appelle proposeRoomToUser avec roomId, startTime et duration
3. Affiche UNIQUEMENT le resultat de proposeRoomToUser
4. Si OUI: appelle createMeeting
5. Si NON: rappelle findRoomsByCarac avec excludeRoomIds contenant l'ID refuse

## CASE 4: Reunion d'equipe (pas d'horaire precis)
Detecte quand l'utilisateur dit: "reunion d'equipe", "meeting d'equipe", "tous ensemble", "trouver un creneau"
1. Demande les infos manquantes: taille equipe, equipements, duree, periode (demain/cette semaine/etc)
2. Appelle findTeamAvailability avec teamSize, dateRange, duration, equipmentNeeded
3. Affiche les 3 meilleures options avec salle pour chaque creneau
4. Quand l'utilisateur choisit une option, appelle createMeeting avec les infos du slot choisi

## Gestion du refus
- Garde en memoire les roomIds refuses
- Rappelle findRoomsByCarac avec excludeRoomIds: [IDs refuses]
- Propose la salle suivante

## REGLES CRITIQUES
- Ne JAMAIS afficher le resultat brut de findRoomsByCarac
- Pour CASE 1-3: TOUJOURS enchainer findRoomsByCarac -> proposeRoomToUser
- Pour CASE 4: Afficher directement le texte de findTeamAvailability
- Ne pas reformuler les reponses des outils`;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Messages array is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get current user ID from session
    const currentUserId = await getCurrentUserId();

    const modelMessages = convertToModelMessages(messages);

    const result = streamText({
      model: openai('gpt-4o-mini'),
      system: getSystemPrompt(),
      messages: modelMessages,
      tools: {
        findRoomsByCarac: {
          description: 'ETAPE 1: Recherche la meilleure salle selon les criteres. Retourne roomId, startTime et duration. NE PAS afficher le resultat. TOUJOURS enchainer avec proposeRoomToUser. Si l\'utilisateur refuse, rappeler avec excludeRoomIds.',
          inputSchema: z.object({
            name: z.string().optional().describe('Nom de la salle (ex: Aquarium, Zen, Creative)'),
            minCapacity: z.number().optional().describe('Capacite minimum requise'),
            maxCapacity: z.number().optional().describe('Capacite maximum souhaitee'),
            equipments: z.array(z.string()).optional().describe('Equipements requis'),
            location: z.string().optional().describe('Etage ou zone (ex: Floor 1, Floor 2)'),
            startTime: z.string().optional().describe('Date et heure de debut ISO (ex: 2025-12-13T14:30:00)'),
            duration: z.number().optional().describe('Duree en minutes'),
            excludeRoomIds: z.array(z.number()).optional().describe('IDs des salles deja refusees par l\'utilisateur'),
          }),
          execute: async (params) => {
            const result = await findRoomsByCarac(params);
            // Return data needed for proposeRoomToUser
            return {
              ...result,
              nextAction: 'proposeRoomToUser',
              params: {
                roomId: result.roomId,
                startTime: params.startTime,
                duration: params.duration || 60,
              }
            };
          },
        },
        proposeRoomToUser: {
          description: 'ETAPE 2: Affiche les details de la salle a l\'utilisateur. Appeler IMMEDIATEMENT apres findRoomsByCarac avec les parametres retournes.',
          inputSchema: z.object({
            roomId: z.number().describe('ID de la salle retourne par findRoomsByCarac'),
            startTime: z.string().describe('Date et heure ISO (ex: 2025-12-13T14:30:00)'),
            duration: z.number().describe('Duree en minutes'),
          }),
          execute: async (params) => {
            return await proposeRoomToUser({
              roomId: params.roomId,
              startTime: params.startTime,
              duration: params.duration,
            });
          },
        },
        createMeeting: {
          description: 'Cree une reservation apres confirmation utilisateur. Utiliser l\'ID numerique de la salle.',
          inputSchema: z.object({
            roomId: z.number().describe('ID numerique de la salle (ex: 1, 2, 3). NE PAS utiliser le nom.'),
            title: z.string().describe('Titre de la reunion'),
            startTime: z.string().describe('Debut au format ISO (ex: 2025-12-13T14:30:00)'),
            duration: z.number().describe('Duree en minutes'),
          }),
          execute: async (params) => {
            if (!currentUserId) {
              return {
                success: false,
                meetingId: null,
                text: 'Vous devez etre connecte pour reserver une salle. Veuillez vous connecter.'
              };
            }
            return await createMeeting({
              roomId: params.roomId,
              startTime: params.startTime,
              duration: params.duration,
              title: params.title,
              userId: currentUserId,
            });
          },
        },
        findTeamAvailability: {
          description: 'CASE 4: Trouve les meilleurs creneaux pour une reunion d\'equipe. Analyse les calendriers et propose les 3 meilleures options avec une salle pour chaque creneau.',
          inputSchema: z.object({
            teamSize: z.number().describe('Nombre de personnes dans l\'equipe'),
            dateRange: z.string().describe('Plage de dates: "demain", "cette semaine", "semaine prochaine", ou "YYYY-MM-DD to YYYY-MM-DD"'),
            duration: z.number().optional().describe('Duree de la reunion en minutes (defaut: 60)'),
            minAvailability: z.number().optional().describe('Pourcentage minimum de disponibilite (defaut: 70)'),
            equipmentNeeded: z.array(z.string()).optional().describe('Equipements requis'),
            society: z.string().optional().describe('Societe/equipe a filtrer'),
          }),
          execute: async (params) => {
            return await findTeamAvailability({
              teamSize: params.teamSize,
              dateRange: params.dateRange,
              duration: params.duration,
              minAvailability: params.minAvailability,
              equipmentNeeded: params.equipmentNeeded,
              society: params.society,
            });
          },
        },
      },
      
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error('Chat API Error:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
