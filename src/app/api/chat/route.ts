import { openai } from '@ai-sdk/openai';
import { streamText, tool } from 'ai';
import { z } from 'zod';

// SYSTEM PROMPT STATIQUE
const SYSTEM_PROMPT = `
You are the "GoodBarber Workspace Agent".
Today's date is: {{CURRENT_DATE}}.

Your role is to help users manage meeting rooms.
- User Timezone: Europe/Paris.
- Tone: Professional, concise, efficient.
- IMPORTANT: Always use the 'checkAvailability' tool before promising a room.
- IMPORTANT: If the user doesn't specify duration, assume 1 hour.
- If a room is not available, suggest an alternative.
`;

export async function POST(req: Request) {
  // Récupération de l'historique de conversation envoyé par le front
  const { messages } = await req.json();

  // 2. Injection de la Date (CRUCIAL)
  // Sans ça, l'IA ne sait pas ce que "demain" veut dire.
  const now = new Date();
  const formattedDate = now.toLocaleString('fr-FR', { timeZone: 'Europe/Paris' });
  const dynamicPrompt = SYSTEM_PROMPT.replace('{{CURRENT_DATE}}', formattedDate);

  // 3. Appel à OpenAI avec streaming
  const result = streamText({
    model: openai('gpt-4o-mini'), // Le modèle rapide et pas cher
    system: dynamicPrompt,
    messages,
    
    // 4. Définition des Tools (C'est ici que la magie opère)
    tools: {
      checkAvailability: tool({
        description: 'Vérifie quelles salles sont disponibles pour un créneau donné.',
        parameters: z.object({
          date: z.string().describe('Date et heure de début au format ISO 8601 (ex: 2026-05-21T14:00:00)'),
          duration: z.number().describe('Durée en minutes (défaut: 60)'),
          minCapacity: z.number().optional().describe('Nombre de personnes minimum'),
        }),
        execute: async ({ date, duration, minCapacity }) => {
          console.log("🛠️ Tool appelé : checkAvailability", { date, duration });
          
          // --- ICI : TU CONNECTERAS SUPABASE PLUS TARD ---
          // Pour l'instant, on simule une réponse pour tester l'IA
          // C'est ce qu'on appelle un "Mock"
          
          const isBusy = Math.random() > 0.5; // Pile ou face

          if (isBusy) {
            return "Désolé, l'Aquarium est pris, mais la salle Jungle est libre.";
          } else {
            return "La salle Aquarium est disponible pour ce créneau.";
          }
        },
      }),

      createBooking: tool({
        description: 'Réserve une salle précise pour un utilisateur.',
        parameters: z.object({
          roomName: z.string().describe('Nom de la salle à réserver'),
          date: z.string().describe('Date et heure de début ISO 8601'),
          duration: z.number().describe('Durée en minutes'),
        }),
        execute: async ({ roomName, date }) => {
          console.log("🛠️ Tool appelé : createBooking", { roomName });
          
          // --- ICI : INSÉRER LOGIQUE SUPABASE ---
          return `Réservation confirmée pour la salle ${roomName} le ${date}. Un email a été envoyé.`;
        },
      }),
    },
  });

  // Renvoie le flux de données vers le frontend
  return result.toDataStreamResponse();
}