import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool } from 'ai';
import { z } from 'zod';
import { findAvailableRooms, createBooking, findRoomByLocation, findRoomByName } from '@/services/bookingService';
import { formatRoomsResponse, formatBookingSuccess, formatBookingError } from '@/lib/formatters';

// 1. DÉFINITION DU PROMPT SYSTÈME & DES CONSTANTES
const SYSTEM_PROMPT = `
You are the "GoodBarber Workspace Agent" for the new 2026 HQ.
Current Date & Time (Paris Time): {{CURRENT_DATE}}.

**YOUR MISSION:**
Help employees find and book meeting rooms efficiently. Support 4 main workflows:
1. Book a specific room (e.g., "I want to book Aquarium tomorrow at 2pm")
2. Book with criteria (e.g., "I need a room for 6 people tomorrow at 2pm" → suggest best fit)
3. Book by equipment (e.g., "I need a room with a video projector")
4. Find room by information (e.g., "What room is on 1st floor at 2pm?")

**CRITICAL RULE - ALWAYS RESPOND:**
You MUST ALWAYS generate a natural language response to the user. Never leave a response empty or blank, even after calling a tool. Every message to the user should be helpful and complete.

**STRICT RULES:**
1. **Timezone:** You operate in Europe/Paris time. Parse relative dates (demain, aujourd'hui, etc.) correctly.
2. **Context:** Always ask for specific details if missing (Date, Time, Duration, Number of people, Required equipment).
3. **Defaults:** If the user doesn't specify a duration, assume 60 minutes.
4. **Safety:** NEVER confirm a booking without successfully calling the 'createBooking' tool.
5. **Honesty:** Always use available tools before suggesting a room. Do not guess.
6. **Smart Suggestions:** When multiple rooms are available, suggest the most suitable one based on capacity and equipment.
7. **Conflict Handling:** If a room is taken, immediately suggest another available room from the list.
8. **Response Format:** After calling a tool, always provide a clear human-readable response explaining the results.

**WORKFLOW EXAMPLES:**

**Workflow 1 - Specific Room Booking:**
- User: "Je veux réserver l'Aquarium demain 14h"
- Tool: Use checkAvailability to verify room is free
- Response: Confirm availability and ask to book or ask for duration if missing

**Workflow 2 - Criteria-Based Booking (Capacity + Time):**
- User: "Je voudrais réserver une salle pour 6 personnes demain 14h"
- Tool: Use checkAvailability with capacity=6 filter
- Response: Show available rooms sorted by best fit (smallest room that fits), suggest the first one

**Workflow 3 - Equipment-Based Booking:**
- User: "Il me faut une salle avec vidéo-projecteur"
- Tool: Use checkAvailability with equipment=[vidéo-projecteur] filter (or similar keyword)
- Response: Show rooms with required equipment, ask for date/time if missing

**Workflow 4 - Room Search by Information:**
- User: "J'ai une réunion au 1er étage à 14h, c'est quelle salle?"
- Tool: Use findRoomByLocation to search by location
- Response: Return the room details (name, capacity, equipment)

**TOOLS AT YOUR DISPOSAL:**
- checkAvailability: Find rooms by date/time/duration, with optional capacity and equipment filters
- createBooking: Permanently book a specific room
- findRoomByLocation: Search room by location (building/floor)

**TONE:**
Professional, concise, helpful. Short answers are better for mobile users.

**IMPORTANT - QUALITY CHECK:**
Before sending your response: Does it answer the user's question? Is it complete? Never send empty or placeholder text.
`;
export const maxDuration = 30; // Timeout de sécurité (30s)

// Objets Zod pour la validation des paramètres des outils
const availabilityZodObject = z.object({
  date: z.string().describe('Date et heure de début au format ISO 8601 (ex: 2026-12-12T14:00:00)'),
  duration: z.number().int().min(15).optional().describe('Durée en minutes (par défaut 60, minimum 15)'),
  capacity: z.number().int().optional().describe('Nombre de personnes (capacité minimale requise)'),
  equipment: z.array(z.string()).optional().describe('Liste des équipements requis (ex: ["vidéo-projecteur", "wifi"])'),
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
        description: 'Vérifie les salles disponibles pour un créneau donné, avec filtres optionnels.',
        inputSchema: availabilityZodObject,
        execute: async ({ date, duration = 60, capacity, equipment }) => {
          console.log("🤖 IA Check Dispo :", date, (duration || 60) + "min", { capacity, equipment });

          try {
            const availableRooms = await findAvailableRooms(date, duration || 60, { capacity, equipment });
            console.log("📦 Rooms trouvées :", availableRooms);

            if (!availableRooms || availableRooms.length === 0) {
              const response = {
                available: false,
                message: "❌ Aucune salle n'est libre à cet horaire avec ces critères. Demande à l'utilisateur s'il veut changer d'heure ou de critères.",
                rooms: [],
                formattedResponse: "Aucune salle disponible correspondant à vos critères."
              };
              console.log("📤 Réponse checkAvailability (vide):", response);
              return response;
            }

            // Format lisible pour l'IA avec le formatter
            const formattedResponse = formatRoomsResponse(availableRooms);
            const response = {
              available: true,
              message: `${availableRooms.length} salle(s) disponible(s) à ${date} pour ${duration || 60} minutes.`,
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

      // OUTIL 2 : RECHERCHER UNE SALLE PAR LOCALISATION
      findRoomByLocationTool: tool({
        description: 'Recherche une salle par sa localisation (étage, bâtiment, etc.)',
        inputSchema: z.object({
          location: z.string().describe('Localisation recherchée (ex: "1er étage", "RDC", "2ème étage")'),
        }).describe('Paramètres pour rechercher une salle par localisation'),
        execute: async ({ location }) => {
          console.log("🤖 IA Find Room by Location :", location);

          try {
            const room = await findRoomByLocation(location);
            console.log("📦 Room trouvée :", room);

            if (!room) {
              const response = {
                found: false,
                message: `Aucune salle trouvée à la localisation "${location}".`,
                room: null,
                formattedResponse: `Pas de salle disponible à la localisation "${location}".`
              };
              console.log("📤 Réponse findRoomByLocation (not found):", response);
              return response;
            }

            const formattedResponse = `📍 **${room.name}**\n👥 Capacité: ${room.capacity} personne(s)\n📦 Équipements: ${(room.equipment || []).join(', ')}\n📍 Localisation: ${room.location}`;
            const response = {
              found: true,
              message: `Salle trouvée à ${location}`,
              room: room,
              formattedResponse: formattedResponse
            };
            console.log("📤 Réponse findRoomByLocation:", response);
            return response;
          } catch (error) {
            console.error('❌ Erreur find room by location:', error);
            const response = {
              found: false,
              error: true,
              message: "Erreur lors de la recherche de salle.",
              formattedResponse: "Une erreur est survenue lors de la recherche."
            };
            console.log("📤 Réponse findRoomByLocation (erreur):", response);
            return response;
          }
        },
      }),

      // OUTIL 3 : RECHERCHER UNE SALLE PAR NOM
      findRoomByNameTool: tool({
        description: 'Recherche une salle par son nom exact (ex: "Aquarium", "Jungle", "Space Station")',
        inputSchema: z.object({
          roomName: z.string().describe('Nom de la salle recherchée'),
        }).describe('Paramètres pour rechercher une salle par nom'),
        execute: async ({ roomName }) => {
          console.log("🤖 IA Find Room by Name :", roomName);

          try {
            const room = await findRoomByName(roomName);
            console.log("📦 Room trouvée :", room);

            if (!room) {
              const response = {
                found: false,
                message: `Salle "${roomName}" non trouvée.`,
                room: null,
                formattedResponse: `La salle "${roomName}" n'existe pas ou n'est pas active.`
              };
              console.log("📤 Réponse findRoomByName (not found):", response);
              return response;
            }

            const formattedResponse = `✅ **${room.name}**\n👥 Capacité: ${room.capacity} personne(s)\n📦 Équipements: ${(room.equipment || []).join(', ')}\n📍 Localisation: ${room.location}`;
            const response = {
              found: true,
              message: `Salle "${roomName}" trouvée`,
              room: room,
              formattedResponse: formattedResponse
            };
            console.log("📤 Réponse findRoomByName:", response);
            return response;
          } catch (error) {
            console.error('❌ Erreur find room by name:', error);
            const response = {
              found: false,
              error: true,
              message: "Erreur lors de la recherche de salle.",
              formattedResponse: "Une erreur est survenue lors de la recherche."
            };
            console.log("📤 Réponse findRoomByName (erreur):", response);
            return response;
          }
        },
      }),

      // OUTIL 4 : RÉSERVER UNE SALLE
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