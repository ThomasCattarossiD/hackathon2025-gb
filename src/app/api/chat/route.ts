import { openai } from '@ai-sdk/openai';
import { streamText, convertToModelMessages } from 'ai';
import { z } from 'zod';
import {
  findRoomsByCarac,
  proposeRoomToUser,
  createMeeting,
  findTeamAvailability,
} from '@/services/bookingService';

export const maxDuration = 30;

function getSystemPrompt(): string {
  const today = new Date().toISOString().split('T')[0];
  const dayOfWeek = new Date().toLocaleDateString('fr-FR', { weekday: 'long' });

  return `# Room Barber - Assistant de Reservation de Salles

Tu es un assistant intelligent de reservation de salles de reunion pour GoodBarber.
Tu communiques UNIQUEMENT en francais.

## Date et Contexte
- Date actuelle: ${today} (${dayOfWeek})
- Les horaires de bureau sont de 9h a 18h, du lundi au vendredi

## Workflow OBLIGATOIRE pour une reservation

1. L'utilisateur demande une salle
2. Appelle findRoomsByCarac pour trouver la meilleure salle
3. IMMEDIATEMENT apres, appelle proposeRoomToUser avec roomId, startTime et duration
4. Affiche UNIQUEMENT le resultat de proposeRoomToUser
5. Attends la confirmation de l'utilisateur
6. Si OUI: appelle createMeeting
7. Si NON: rappelle findRoomsByCarac avec excludeRoomIds contenant l'ID refuse

## Gestion du refus
Quand l'utilisateur refuse une salle:
- Garde en memoire le roomId refuse
- Rappelle findRoomsByCarac avec les MEMES criteres + excludeRoomIds: [ID refuse]
- Propose la salle suivante via proposeRoomToUser
- Repete jusqu'a acceptation ou plus de salles disponibles

## REGLES CRITIQUES
- Ne JAMAIS afficher le resultat de findRoomsByCarac directement
- TOUJOURS enchainer findRoomsByCarac -> proposeRoomToUser
- Afficher UNIQUEMENT le texte retourne par proposeRoomToUser
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
            userId: z.string().optional().describe('ID utilisateur'),
          }),
          execute: async (params) => {
            return await createMeeting({
              roomId: params.roomId,
              startTime: params.startTime,
              duration: params.duration,
              title: params.title,
              userId: params.userId || '',
            });
          },
        },
        findTeamAvailability: {
          description: 'Trouve les creneaux ou une equipe est disponible.',
          inputSchema: z.object({
            teamMembers: z.array(z.string()).describe('Emails des membres'),
            date: z.string().describe('Date YYYY-MM-DD'),
            duration: z.number().describe('Duree en minutes'),
            preferredTimeRange: z.object({
              start: z.string().describe('Debut HH:mm'),
              end: z.string().describe('Fin HH:mm'),
            }).optional(),
          }),
          execute: async (params) => {
            return await findTeamAvailability(params);
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
