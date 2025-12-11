import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool } from 'ai';
import { z } from 'zod';
import { findAvailableRooms, createBooking } from '@/services/bookingService';
import { formatRoomsResponse, formatBookingSuccess, formatBookingError } from '@/lib/formatters';

// 1. DÉFINITION DU PROMPT SYSTÈME & DES CONSTANTES
const SYSTEM_PROMPT = `
You are the "GoodBarber Workspace Agent" for the new 2026 HQ.
Current Date & Time (Paris Time): {{CURRENT_DATE}}.

**YOUR MISSION:**
Help employees find and book meeting rooms efficiently.

**CRITICAL RULE - ALWAYS RESPOND:**
You MUST ALWAYS generate a natural language response to the user. Never leave a response empty or blank, even after calling a tool. Every message to the user should be helpful and complete.

**STRICT RULES:**
1. **Timezone:** You operate in Europe/Paris time.
2. **Context:** Always ask for specific details if missing (Date, Time, Duration, Number of people).
3. **Defaults:** If the user doesn't specify a duration, assume 60 minutes.
4. **Safety:** NEVER confirm a booking without successfully calling the 'createBooking' tool.
5. **Honesty:** Always use 'checkAvailability' before suggesting a room. Do not guess.
6. **Fail Gracefully:** If a room is taken, immediately suggest another available room from the list.
7. **Response Format:** After calling a tool, always provide a clear human-readable response explaining the results. Use the formatted data from the tool to compose your message.

**WORKFLOWS (IMPORTANT):**
- **Check Availability:** 
    1. ALWAYS call 'checkAvailability' with the date/time and duration.
    2. After the tool returns results, provide a natural response describing the available rooms.
    3. If rooms are available, list them clearly and ask which one the user prefers.
    4. If no rooms are available, suggest alternative times.
- **New Booking:** 
    1. Ask for confirmation from the user before booking.
    2. Call 'createBooking' with the exact room name, date, and duration.
    3. After the tool returns, confirm the booking details to the user.

**TONE:**
Professional, concise, helpful. Short answers are better for mobile users.

**IMPORTANT - QUALITY CHECK:**
Before sending your response: Does it answer the user's question? Is it complete? Never send empty or placeholder text.
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
            console.log("📦 Rooms trouvées :", availableRooms);

            if (!availableRooms || availableRooms.length === 0) {
              const response = {
                available: false,
                message: "❌ Aucune salle n'est libre à cet horaire. Demande à l'utilisateur s'il veut changer d'heure ou de durée.",
                rooms: [],
                formattedResponse: "Aucune salle disponible à cet horaire."
              };
              console.log("📤 Réponse checkAvailability (vide):", response);
              return response;
            }

            // Format lisible pour l'IA avec le formatter
            const formattedResponse = formatRoomsResponse(availableRooms);
            const response = {
              available: true,
              message: `${availableRooms.length} salle(s) disponible(s) à ${date} pour ${duration} minutes.\n\n${formattedResponse}`,
              rooms: availableRooms,
              formattedResponse: formattedResponse
            };
            console.log("📤 Réponse checkAvailability:", response);
            return response;
          } catch (error) {
            console.error('❌ Erreur check availability:', error);
            const response = {
              available: false,
              error: true,
              message: "❌ Erreur lors de la vérification de la disponibilité.",
              formattedResponse: "Une erreur est survenue. Veuillez réessayer."
            };
            console.log("📤 Réponse checkAvailability (erreur):", response);
            return response;
          }
        },
      }),

      // OUTIL 2 : RÉSERVER UNE SALLE
      createBooking: tool({
        description: 'Effectue la réservation ferme d\'une salle.',
        inputSchema: roomBookingZodObject,
        execute: async ({ roomName, date, duration }) => {
          console.log("🤖 IA Booking :", roomName, date, duration + "min");

          try {
            const result = await createBooking(roomName, date, duration);
            console.log("📦 Résultat booking :", result);

            // Utiliser le formatter pour les messages de succès/erreur
            const formattedResponse = result.success
              ? formatBookingSuccess(roomName, date, duration)
              : formatBookingError(roomName, result.message);

            const response = {
              success: result.success,
              message: `${result.message}\n\n${formattedResponse}`,
              formattedResponse: formattedResponse
            };
            console.log("📤 Réponse createBooking:", response);
            return response;
          } catch (error) {
            console.error('❌ Erreur create booking:', error);
            const formattedResponse = formatBookingError(
              roomName,
              'Une erreur système est survenue.'
            );
            const response = {
              success: false,
              message: "Erreur système lors de la réservation.",
              formattedResponse: formattedResponse
            };
            console.log("📤 Réponse createBooking (erreur):", response);
            return response;
          }
        },
      }),
    },
  });

  // On renvoie le flux (streaming) vers le frontend pour l'effet "machine à écrire"
  console.log("🤖 Réponse IA en streaming initialisée...");
  return result.toUIMessageStreamResponse();
}