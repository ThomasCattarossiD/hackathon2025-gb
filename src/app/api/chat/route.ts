import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool } from 'ai';
import { z } from 'zod';
import { findAvailableRooms, createBooking } from '@/services/bookingService';

// 1. DÉFINITION DU PROMPT SYSTÈME & DES CONSTANTES
const SYSTEM_PROMPT = `
You are the "GoodBarber Workspace Agent" for the new 2026 HQ.
Current Date & Time (Paris Time): {{CURRENT_DATE}}.

**YOUR MISSION:**
Help employees find and book meeting rooms efficiently.

**STRICT RULES:**
1. **Timezone:** You operate in Europe/Paris time.
2. **Context:** Always ask for specific details if missing (Date, Time, Duration, Number of people).
3. **Defaults:** If the user doesn't specify a duration, assume 60 minutes.
4. **Safety:** NEVER confirm a booking without successfully calling the 'createBooking' tool.
5. **Honesty:** Always use 'checkAvailability' before suggesting a room. Do not guess.
6. **Fail Gracefully:** If a room is taken, immediately suggest another available room from the list.

**WORKFLOWS (IMPORTANT):**
- **Modification/Cancellation:** If a user wants to modify or cancel a meeting:
  1. FIRST, call 'getMyBookings' to find the meeting ID.
  2. Identify the correct meeting based on the user's description (e.g., "the one at 2pm").
  3. THEN, call 'cancelBooking' or 'rescheduleBooking' with the correct ID.
- **New Booking:** For new bookings:
    1. ALWAYS call 'checkAvailability' first.
    2. If rooms are available, present options to the user.
    3. ONLY after user confirmation, call 'createBooking'.

**TONE:**
Professional, concise, helpful. Short answers are better for mobile users.
`;
export const maxDuration = 30; // Timeout de sécurité (30s)

// Objets Zod pour la validation des paramètres des outils
const availabilityZodObject = z.object({
  date: z.string().describe('Date et heure de début au format ISO 8601 (ex: 2026-12-12T14:00:00)'),
  duration: z.number().int().min(15).describe('Durée en minutes (par défaut 60, minimum 15)'),
}).describe('Paramètres pour vérifier la disponibilité des salles');

const roomBookingZodObject = z.object({
  roomName: z.string().describe('Le nom exact de la salle à réserver'),
  date: z.string().describe('Date et heure de début au format ISO 8601'),
  duration: z.number().int().min(15).describe('Durée en minutes'),
}).describe('Paramètres pour réserver une salle');

// 2. AJUSTEMENT DYNAMIQUE DU PROMPT & RÉCUPÉRATION DES MESSAGES
export async function POST(req: Request) {
  const { messages } = await req.json(); // Récupération de l'historique de conversation
  const now = new Date();
  const parisTime = now.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'medium',
  });

  
const dynamicSystemPrompt = SYSTEM_PROMPT.replace('{{CURRENT_DATE}}', parisTime); // On remplace le placeholder dans le prompt

// 3. APPEL À L'IA AVEC LES OUTILS BACKEND
  const result = await streamText({
    model: openai('gpt-4o-mini'), // Modèle rapide et efficace
    system: dynamicSystemPrompt,
    messages: convertToModelMessages(messages),

    tools: {

      // OUTIL 1 : VÉRIFIER LA DISPONIBILITÉ DES SALLES
      checkAvailability: tool({
        description: 'Vérifie les salles disponibles pour un créneau donné.',
        inputSchema: availabilityZodObject,
        execute: async ({ date, duration }) => {
          console.log("🤖 IA Check Dispo :", date, duration + "min");

          try {
            const availableRooms = await findAvailableRooms(date, duration);

            if (availableRooms.length === 0) {
              return {
                available: false,
                message: "Aucune salle n'est libre à cet horaire précise. Demande à l'utilisateur s'il veut changer d'heure."
              };
            }

            // On formate la réponse pour l'IA (JSON stringifié lisible)
            return {
              available: true,
              rooms: availableRooms.map(r => ({
                nom: r.name,
                capacite: r.capacity,
                equipements: r.equipment
              }))
            };
          } catch (error) {
            return {
              error: true,
              message: "Une erreur critique est survenue lors de la vérification de la disponibilité."
            };
          }
        },
      }),

      // OUTIL 2 : RÉSERVER UNE SALLE
      createBooking: tool({
        description: 'Effectue la réservation ferme d\'une salle.',
        inputSchema: roomBookingZodObject,
        execute: async ({ roomName, date, duration }) => {
          console.log("🤖 IA Booking :", roomName, date);

          try {
            const result = await createBooking(roomName, date, duration);

            if (result.success) {
              return {
                success: true,
                message: `SUCCÈS : La salle ${roomName} a été réservée avec succès. Confirme-le à l'utilisateur.`
              };
            } else {
              return {
                success: false,
                message: `ÉCHEC : ${result.message}. Dis-le à l'utilisateur et propose une autre solution.`
              };
            }
          } catch (error) {
            return {
              error: true,
              message: "Une erreur critique est survenue lors de la tentative de réservation."
            };
          }
        },
      }),
    },
  });

  // On renvoie le flux (streaming) vers le frontend pour l'effet "machine à écrire"
  console.log("🤖 Réponse IA en streaming...", result);
  return result.toUIMessageStreamResponse();
}