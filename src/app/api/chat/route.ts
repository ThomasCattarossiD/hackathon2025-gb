import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';
import { findAvailableRooms, createBooking } from '@/services/bookingService';

// -----------------------------------------------------------------------------
// 1. LE CERVEAU (System Prompt)
// -----------------------------------------------------------------------------
// On définit ici la personnalité et les règles strictes.
// Note : {{CURRENT_DATE}} sera remplacé dynamiquement à chaque requête.
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

**TONE:**
Professional, concise, helpful. Short answers are better for mobile users.
`;

export const maxDuration = 30; // Timeout de sécurité (30s)

export async function POST(req: Request) {
  // Récupération de l'historique de conversation
  const { messages } = await req.json();

  // ---------------------------------------------------------------------------
  // 2. INJECTION TEMPORELLE (Crucial pour "Demain", "Cet aprem")
  // ---------------------------------------------------------------------------
  // On calcule l'heure exacte de Paris maintenant pour que l'IA ait un repère.
  const now = new Date();
  const parisTime = now.toLocaleString('fr-FR', {
    timeZone: 'Europe/Paris',
    dateStyle: 'full',
    timeStyle: 'medium',
  });
  
  // On remplace le placeholder dans le prompt
  const dynamicSystemPrompt = SYSTEM_PROMPT.replace('{{CURRENT_DATE}}', parisTime);

  // ---------------------------------------------------------------------------
  // 3. APPEL OPENAI & DÉFINITION DES OUTILS (TOOLS)
  // ---------------------------------------------------------------------------
  const result = streamText({
    model: openai('gpt-4o-mini'), // Modèle rapide et économique
    system: dynamicSystemPrompt,
    messages,
    
    // C'est ici qu'on branche tes fonctions Backend
    tools: {
      
      // OUTIL 1 : VÉRIFIER LA DISPO
      checkAvailability: tool({
        description: 'Vérifie les salles disponibles pour un créneau donné.',
        parameters: z.object({
          date: z.string().describe('Date et heure de début au format ISO 8601 (ex: 2026-12-12T14:00:00)'),
          duration: z.number().describe('Durée en minutes (par défaut 60)'),
        }),
        execute: async ({ date, duration }) => {
          console.log("🤖 IA Check Dispo :", date, duration + "min");
          
          try {
            const availableRooms = await findAvailableRooms(date, duration);
            
            if (availableRooms.length === 0) {
              return "Aucune salle n'est libre à cet horaire précise. Demande à l'utilisateur s'il veut changer d'heure.";
            }

            // On formate la réponse pour l'IA (JSON stringifié lisible)
            return JSON.stringify(availableRooms.map(r => ({
              nom: r.name,
              capacite: r.capacity,
              equipements: r.equipment
            })));
          } catch (error) {
            return "Erreur technique lors de la vérification des disponibilités.";
          }
        },
      }),

      // OUTIL 2 : RÉSERVER UNE SALLE
      createBooking: tool({
        description: 'Effectue la réservation ferme d\'une salle.',
        parameters: z.object({
          roomName: z.string().describe('Le nom exact de la salle à réserver'),
          date: z.string().describe('Date et heure de début au format ISO 8601'),
          duration: z.number().describe('Durée en minutes'),
        }),
        execute: async ({ roomName, date, duration }) => {
          console.log("🤖 IA Booking :", roomName, date);
          
          try {
            const result = await createBooking(roomName, date, duration);
            
            if (result.success) {
              return `SUCCÈS : La salle ${roomName} a été réservée avec succès. Confirme-le à l'utilisateur.`;
            } else {
              return `ÉCHEC : ${result.message}. Dis-le à l'utilisateur et propose une autre solution.`;
            }
          } catch (error) {
            return "Une erreur critique est survenue lors de la tentative de réservation.";
          }
        },
      }),
    },
  });

  // On renvoie le flux (streaming) vers le frontend pour l'effet "machine à écrire"
  return result.toDataStreamResponse();
}