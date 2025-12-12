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
  getUserMeetings,
  updateMeeting,
  cancelMeeting,
  findInstantRoom,
  createRecurringMeeting,
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

## DETECTION PRIORITAIRE - CASE 9: Reservation Recurrente
**DETECTE EN PREMIER** si l'utilisateur mentionne:
- "tous les" (tous les lundis, tous les jours)
- "chaque" (chaque mardi, chaque semaine)
- "weekly", "hebdomadaire", "hebdo"
- "recurrent", "recurring", "serie"
- "pendant X semaines/mois" (pendant 4 semaines, pendant 1 mois)
- "toutes les semaines", "toutes les 2 semaines"
- "standup", "daily", "weekly meeting"
- un jour de la semaine + "a Xh" + indication de repetition

Exemples CASE 9:
- "Reserve la salle Zen tous les mardis a 10h" -> CASE 9
- "Je veux une salle chaque lundi pendant 1 mois" -> CASE 9
- "Weekly standup pour 6 personnes" -> CASE 9
- "Reunion hebdomadaire le jeudi" -> CASE 9

Workflow CASE 9:
1. Collecte: salle ou criteres, jour, heure, duree, frequence, nombre d'occurrences
2. Appelle findRoomsByCarac puis proposeRoomToUser
3. Si OUI: appelle createRecurringMeeting (PAS createMeeting!)
4. Frequences: daily (quotidien), weekly (1x/semaine), biweekly (2 semaines), monthly

## CASE 1-3: Reservation UNIQUE avec horaire precis
Quand l'utilisateur donne une date/heure precise SANS mention de recurrence:
1. Appelle findRoomsByCarac pour trouver la meilleure salle
2. IMMEDIATEMENT apres, appelle proposeRoomToUser avec roomId, startTime et duration
3. Affiche UNIQUEMENT le resultat de proposeRoomToUser
4. Si OUI: appelle createMeeting
5. Si NON: rappelle findRoomsByCarac avec excludeRoomIds contenant l'ID refuse

## CASE 4: Reunion d'equipe (pas d'horaire precis)
Detecte quand l'utilisateur dit: "reunion d'equipe", "meeting d'equipe", "tous ensemble", "trouver un creneau pour [equipe]"
1. Demande les infos manquantes: nom de l'equipe (societe), equipements, duree, periode (demain/cette semaine/semaine prochaine/du X au Y)
2. Appelle findTeamAvailability avec teamName, dateRange, duration, equipmentNeeded
3. Affiche le meilleur creneau avec la salle proposee (le resultat contient requiresConfirmation: true)
4. IMPORTANT: Quand l'utilisateur confirme (ex: "oui", "ok", "je reserve", "c'est bon"):
   - Extrait les informations du slot depuis le resultat precedent de findTeamAvailability (slots[0])
   - Appelle createMeeting avec: roomId (slots[0].room.id), startTime (slots[0].startTime), endTime (slots[0].endTime), title (ex: "Reunion equipe [teamName]"), userId

## CASE 5: Modification de reunion
Detecte quand l'utilisateur dit: "modifier", "decaler", "changer l'heure", "changer de salle", "reporter"
1. Appelle getUserMeetings pour lister ses reunions
2. Demande quelle reunion modifier si plusieurs
3. Demande ce qu'il veut changer (horaire, salle, titre)
4. Appelle updateMeeting avec les nouvelles valeurs

## CASE 6: Annulation de reunion
Detecte quand l'utilisateur dit: "annuler", "supprimer", "cancel", "enlever ma reunion"
1. Appelle getUserMeetings pour lister ses reunions
2. Demande quelle reunion annuler si plusieurs (utilise l'ID)
3. Appelle cancelMeeting avec l'ID de la reunion

## CASE 7: Voir mes reunions
Detecte quand l'utilisateur dit: "mes reunions", "mon planning", "mes reservations", "qu'est-ce que j'ai"
1. Appelle getUserMeetings
2. Affiche la liste formatee

## CASE 8: Reservation Express (maintenant)
Detecte quand l'utilisateur dit: "maintenant", "tout de suite", "urgent", "dans 5 minutes", "une salle libre", "salle dispo"
1. Appelle findInstantRoom avec les criteres (capacite, equipements, duree)
2. Propose la meilleure salle disponible immediatement
3. Si OUI: appelle createMeeting avec startTime = maintenant
4. Si NON: propose les autres options listees

## Gestion du refus
- Garde en memoire les roomIds refuses
- Rappelle findRoomsByCarac avec excludeRoomIds: [IDs refuses]
- Propose la salle suivante

## REGLES CRITIQUES
- TOUJOURS verifier si c'est une demande recurrente AVANT de traiter comme CASE 1-3
- Pour recurrence: utiliser createRecurringMeeting, JAMAIS createMeeting
- Ne JAMAIS afficher le resultat brut de findRoomsByCarac
- Pour CASE 1-3: TOUJOURS enchainer findRoomsByCarac -> proposeRoomToUser
- Pour CASE 4: Afficher directement le texte de findTeamAvailability
- Pour CASE 5-7: Toujours commencer par getUserMeetings
- Pour CASE 8: Utiliser findInstantRoom (pas findRoomsByCarac)
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
            minCapacity: z.number().optional().describe('Capacite minimum requise (nombre de personnes)'),
            equipments: z.array(z.string()).optional().describe('Equipements requis'),
            location: z.string().optional().describe('Zone ou description du lieu'),
            floor: z.number().optional().describe('Etage: 0=RDC, 1=1er etage, 2=2eme etage, -1=sous-sol. Utiliser quand l\'utilisateur mentionne un etage specifique'),
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
          description: 'CASE 4: Trouve les meilleurs creneaux pour une reunion d\'equipe. Recherche les membres par nom d\'equipe (societe) et analyse leurs calendriers.',
          inputSchema: z.object({
            teamName: z.string().describe('Nom de l\'equipe/societe (ex: "GoodBarber", "Marketing")'),
            dateRange: z.string().describe('Plage de dates: "demain", "cette semaine", "semaine prochaine", ou "du X au Y"'),
            duration: z.number().optional().describe('Duree de la reunion en minutes (defaut: 60)'),
            minAvailability: z.number().optional().describe('Pourcentage minimum de disponibilite (defaut: 70)'),
            equipmentNeeded: z.array(z.string()).optional().describe('Equipements requis'),
          }),
          execute: async (params) => {
            return await findTeamAvailability({
              teamName: params.teamName,
              dateRange: params.dateRange,
              duration: params.duration,
              minAvailability: params.minAvailability,
              equipmentNeeded: params.equipmentNeeded,
            });
          },
        },
        getUserMeetings: {
          description: 'CASE 5-7: Recupere les reunions a venir de l\'utilisateur. Utiliser AVANT de modifier ou annuler une reunion.',
          inputSchema: z.object({
            includeHistory: z.boolean().optional().describe('Inclure les reunions passees (defaut: false)'),
          }),
          execute: async (params) => {
            if (!currentUserId) {
              return {
                success: false,
                meetings: [],
                text: 'Vous devez etre connecte pour voir vos reunions.'
              };
            }
            return await getUserMeetings({
              userId: currentUserId,
              includeHistory: params.includeHistory,
            });
          },
        },
        updateMeeting: {
          description: 'CASE 5: Modifie une reunion existante (horaire, salle, titre). Utiliser apres getUserMeetings.',
          inputSchema: z.object({
            meetingId: z.number().describe('ID de la reunion a modifier (obtenu via getUserMeetings)'),
            newStartTime: z.string().optional().describe('Nouvel horaire au format ISO (ex: 2025-12-13T15:00:00)'),
            newDuration: z.number().optional().describe('Nouvelle duree en minutes'),
            newRoomId: z.number().optional().describe('ID de la nouvelle salle'),
            newTitle: z.string().optional().describe('Nouveau titre'),
          }),
          execute: async (params) => {
            if (!currentUserId) {
              return {
                success: false,
                text: 'Vous devez etre connecte pour modifier une reunion.'
              };
            }
            return await updateMeeting({
              meetingId: params.meetingId,
              userId: currentUserId,
              newStartTime: params.newStartTime,
              newDuration: params.newDuration,
              newRoomId: params.newRoomId,
              newTitle: params.newTitle,
            });
          },
        },
        cancelMeeting: {
          description: 'CASE 6: Annule/supprime une reunion. Utiliser apres getUserMeetings pour connaitre l\'ID.',
          inputSchema: z.object({
            meetingId: z.number().describe('ID de la reunion a annuler (obtenu via getUserMeetings)'),
          }),
          execute: async (params) => {
            if (!currentUserId) {
              return {
                success: false,
                text: 'Vous devez etre connecte pour annuler une reunion.'
              };
            }
            return await cancelMeeting({
              meetingId: params.meetingId,
              userId: currentUserId,
            });
          },
        },
        findInstantRoom: {
          description: 'CASE 8: Reservation Express - Trouve une salle disponible MAINTENANT. Utiliser quand l\'utilisateur dit "maintenant", "urgent", "tout de suite", "une salle libre".',
          inputSchema: z.object({
            minCapacity: z.number().optional().describe('Capacite minimum requise'),
            duration: z.number().optional().describe('Duree souhaitee en minutes (defaut: 30)'),
            equipments: z.array(z.string()).optional().describe('Equipements requis'),
          }),
          execute: async (params) => {
            return await findInstantRoom({
              minCapacity: params.minCapacity,
              duration: params.duration,
              equipments: params.equipments,
            });
          },
        },
        createRecurringMeeting: {
          description: 'PRIORITAIRE pour reservations repetitives! Cree une SERIE de reunions. OBLIGATOIRE quand l\'utilisateur mentionne: "tous les lundis/mardis/etc", "chaque semaine", "weekly", "hebdomadaire", "pendant X semaines", "standup quotidien". NE PAS utiliser createMeeting pour les demandes recurrentes!',
          inputSchema: z.object({
            roomId: z.number().describe('ID de la salle (obtenu via findRoomsByCarac)'),
            title: z.string().describe('Titre de la reunion (ex: Weekly Standup, Reunion hebdo)'),
            startTime: z.string().describe('Date et heure de la PREMIERE occurrence au format ISO (ex: 2025-12-16T10:00:00 pour lundi prochain a 10h)'),
            duration: z.number().describe('Duree en minutes (ex: 30, 60)'),
            recurrencePattern: z.enum(['daily', 'weekly', 'biweekly', 'monthly']).describe('Frequence: "weekly" pour tous les X jours de la semaine, "daily" pour quotidien, "biweekly" pour toutes les 2 semaines, "monthly" pour mensuel'),
            occurrences: z.number().describe('Nombre de reunions a creer. Ex: "pendant 1 mois" avec weekly = 4, "pendant 4 semaines" = 4'),
          }),
          execute: async (params) => {
            if (!currentUserId) {
              return {
                success: false,
                text: 'Vous devez etre connecte pour creer une serie de reunions.',
                createdMeetings: [],
                failedDates: []
              };
            }
            return await createRecurringMeeting({
              roomId: params.roomId,
              title: params.title,
              startTime: params.startTime,
              duration: params.duration,
              userId: currentUserId,
              recurrencePattern: params.recurrencePattern,
              occurrences: params.occurrences,
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
