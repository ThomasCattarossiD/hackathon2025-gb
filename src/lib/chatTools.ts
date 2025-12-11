import { tool } from 'ai';
import { z } from 'zod';
import {
  checkRoomAvailability,
  findRoomsByCharacteristics,
  createBooking,
  updateMeeting,
  getUserMeetings,
} from '@/services/bookingService';

// ========================
// ZOD SCHEMAS FOR VALIDATION
// ========================

const checkAvailabilitySchema = z
  .object({
    roomId: z.string().describe('ID de la salle à vérifier'),
    startTime: z
      .string()
      .describe('Date et heure de début au format ISO 8601 (ex: 2026-12-12T14:00:00)'),
    duration: z
      .number()
      .int()
      .min(15)
      .optional()
      .describe('Durée en minutes (par défaut 60, minimum 15)'),
  })
  .describe('Paramètres pour vérifier la disponibilité d\'une salle');

const findRoomsByCaracSchema = z
  .object({
    capacity: z
      .number()
      .int()
      .optional()
      .describe('Capacité minimale requise (nombre de personnes)'),
    equipment: z
      .array(z.string())
      .optional()
      .describe('Liste des équipements requis (ex: ["wifi", "vidéo-projecteur"])'),
    location: z
      .string()
      .optional()
      .describe('Localisation recherchée (ex: "1er étage", "RDC")'),
    name: z
      .string()
      .optional()
      .describe('Nom ou partie du nom de la salle (ex: "Aquarium")'),
  })
  .describe('Paramètres pour rechercher des salles par caractéristiques');

const createMeetingSchema = z
  .object({
    roomId: z.string().describe('ID de la salle à réserver'),
    startTime: z
      .string()
      .describe('Date et heure de début au format ISO 8601'),
    duration: z
      .number()
      .int()
      .min(15)
      .describe('Durée en minutes'),
    title: z
      .string()
      .optional()
      .describe('Titre de la réunion'),
  })
  .describe('Paramètres pour créer une réunion/réservation');

// ========================
// TOOLS DEFINITION
// ========================

export const chatTools = {
  // OUTIL 1 : VÉRIFIER LA DISPONIBILITÉ D'UNE SALLE
  checkAvailability: tool({
    description:
      'Vérifie si une salle spécifique est disponible pour un créneau donné',
    inputSchema: checkAvailabilitySchema,
    execute: async ({ roomId, startTime, duration = 60 }) => {
      console.log('🤖 Check Availability :', roomId, startTime, (duration || 60) + 'min');

      try {
        const result = await checkRoomAvailability(roomId, startTime, duration || 60);

        if (!result.available || !result.room) {
          return {
            available: false,
            text: `❌ La salle n'est pas disponible à cet horaire.`,
          };
        }

        const startDate = new Date(startTime);
        const endDate = new Date(startDate.getTime() + (duration || 60) * 60000);
        const text = `✅ **${result.room.name}** est disponible le ${startDate.toLocaleDateString('fr-FR')} de ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.\n📍 ${result.room.location}\n👥 ${result.room.capacity} personnes`;

        return {
          available: true,
          text: text,
          room: result.room,
        };
      } catch (error) {
        console.error('❌ Erreur checkAvailability:', error);
        return {
          available: false,
          text: `❌ Erreur lors de la vérification: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        };
      }
    },
  }),

  // OUTIL 2 : RECHERCHER DES SALLES PAR CARACTÉRISTIQUES
  // Retourne UNIQUEMENT les IDs des salles matchant les critères
  findRoomsByCarac: tool({
    description:
      'Recherche les IDs des salles selon des critères (capacité, équipements, localisation, nom). L\'IA doit ensuite vérifier la dispo de chaque salle avec checkAvailability.',
    inputSchema: findRoomsByCaracSchema,
    execute: async ({ capacity, equipment, location, name }) => {
      console.log('🤖 Find Rooms by Characteristics :', {
        capacity,
        equipment,
        location,
        name,
      });

      try {
        const rooms = await findRoomsByCharacteristics({
          capacity,
          equipment,
          location,
          name,
        });

        if (!rooms || rooms.length === 0) {
          return {
            found: false,
            text: `❌ Aucune salle ne correspond à ces critères.`,
            roomIds: [],
          };
        }

        // Retourner UNIQUEMENT les IDs et noms (pas de vérification dispo)
        const roomInfo = rooms.map((r: any) => ({
          id: r.id,
          name: r.name,
        }));

        const formattedNames = rooms
          .map((r: any) => `• ${r.name}`)
          .join('\n');

        const text = `✅ ${rooms.length} salle(s) correspondent à ces critères:\n\n${formattedNames}\n\nJe vais vérifier la disponibilité de chacune...`;

        return {
          found: true,
          text: text,
          roomIds: roomInfo,
        };
      } catch (error) {
        console.error('❌ Erreur findRoomsByCarac:', error);
        return {
          found: false,
          text: `❌ Erreur lors de la recherche: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          roomIds: [],
        };
      }
    },
  }),

  // OUTIL 3 : CRÉER UNE RÉUNION/RÉSERVATION
  createMeeting: tool({
    description: 'Crée une réunion/réservation pour une salle',
    inputSchema: createMeetingSchema,
    execute: async ({ roomId, startTime, duration }) => {
      console.log('🤖 Create Meeting :', roomId, startTime, duration + 'min');

      try {
        // Note: on utilise roomId au lieu de roomName pour la nouvelle implémentation
        const result = await createBooking(roomId, startTime, duration);
        console.log('📦 Résultat :', result);

        if (!result.success) {
          return {
            success: false,
            text: `❌ Impossible de créer la réunion: ${result.message}`,
          };
        }

        const startDate = new Date(startTime);
        const endDate = new Date(startDate.getTime() + duration * 60000);
        const text = `✅ Réunion créée avec succès!\n📅 ${startDate.toLocaleDateString('fr-FR')} de ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

        return {
          success: true,
          text: text,
        };
      } catch (error) {
        console.error('❌ Erreur createMeeting:', error);
        return {
          success: false,
          text: `❌ Erreur système: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        };
      }
    },
  }),

  // OUTIL 4 : METTRE À JOUR UNE RÉUNION
  updateMeeting: tool({
    description: 'Modifie les détails d\'une réunion (horaire, titre, etc.)',
    inputSchema: z
      .object({
        meetingId: z.string().describe('ID de la réunion à modifier'),
        startTime: z
          .string()
          .optional()
          .describe('Nouvelle date/heure de début (format ISO 8601)'),
        endTime: z
          .string()
          .optional()
          .describe('Nouvelle date/heure de fin (format ISO 8601)'),
        title: z
          .string()
          .optional()
          .describe('Nouveau titre de la réunion'),
      })
      .describe('Paramètres pour mettre à jour une réunion'),
    execute: async ({ meetingId, startTime, endTime, title }) => {
      console.log('🤖 Update Meeting :', meetingId, { startTime, endTime, title });

      try {
        const updates: { start_time?: string; end_time?: string; title?: string } = {};
        if (startTime) updates.start_time = startTime;
        if (endTime) updates.end_time = endTime;
        if (title) updates.title = title;

        const result = await updateMeeting(meetingId, updates);
        console.log('📦 Résultat :', result);

        const text = result.success
          ? '✅ Réunion mise à jour avec succès !'
          : `❌ ${result.message}`;

        return {
          success: result.success,
          text: text,
        };
      } catch (error) {
        console.error('❌ Erreur updateMeeting:', error);
        return {
          success: false,
          text: `❌ Erreur lors de la mise à jour: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        };
      }
    },
  }),

  // OUTIL 5 : LISTER LES RÉUNIONS DE L'UTILISATEUR
  getUserMeetings: tool({
    description: 'Récupère la liste des réunions prévues de l\'utilisateur',
    inputSchema: z.object({}).describe('Aucun paramètre requis'),
    execute: async () => {
      console.log('🤖 Get User Meetings');

      try {
        const result = await getUserMeetings();
        console.log('📦 Réunions trouvées :', result.meetings);

        if (!result.meetings || result.meetings.length === 0) {
          return {
            found: false,
            text: 'Vous n\'avez aucune réunion prévue.',
            meetings: [],
          };
        }

        const formattedList = result.meetings
          .map(
            (m: any) =>
              `• **${m.title || 'Réunion'}** en ${m.room?.name || 'Salle'}\n  ${new Date(m.start_time).toLocaleString('fr-FR')}`
          )
          .join('\n');

        const text = `📅 Vos réunions:\n${formattedList}`;

        return {
          found: true,
          text: text,
          meetings: result.meetings,
        };
      } catch (error) {
        console.error('❌ Erreur getUserMeetings:', error);
        return {
          found: false,
          text: `❌ Erreur lors de la récupération: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          meetings: [],
        };
      }
    },
  }),
};

// Fonction pour créer les tools avec le contexte utilisateur (userId)
export function createToolsWithUserContext(userId?: string) {
  return {
    checkAvailability: chatTools.checkAvailability,
    findRoomsByCarac: chatTools.findRoomsByCarac,
    
    // TOOLS QUI NÉCESSITENT L'AUTHENTIFICATION
    createMeeting: tool({
      description: 'Crée une réunion/réservation pour une salle',
      inputSchema: createMeetingSchema,
      execute: async ({ roomId, startTime, duration }) => {
        console.log('🤖 Create Meeting :', roomId, startTime, duration + 'min');

        try {
          const result = await createBooking(roomId, startTime, duration, userId);
          console.log('📦 Résultat :', result);

          if (!result.success) {
            return {
              success: false,
              text: `❌ Impossible de créer la réunion: ${result.message}`,
            };
          }

          const startDate = new Date(startTime);
          const endDate = new Date(startDate.getTime() + duration * 60000);
          const text = `✅ Réunion créée avec succès!\n📅 ${startDate.toLocaleDateString('fr-FR')} de ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;

          return {
            success: true,
            text: text,
          };
        } catch (error) {
          console.error('❌ Erreur createMeeting:', error);
          return {
            success: false,
            text: `❌ Erreur système: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          };
        }
      },
    }),

    updateMeeting: tool({
      description: 'Modifie les détails d\'une réunion (horaire, titre, etc.)',
      inputSchema: z
        .object({
          meetingId: z.string().describe('ID de la réunion à modifier'),
          startTime: z
            .string()
            .optional()
            .describe('Nouvelle date/heure de début (format ISO 8601)'),
          endTime: z
            .string()
            .optional()
            .describe('Nouvelle date/heure de fin (format ISO 8601)'),
          title: z
            .string()
            .optional()
            .describe('Nouveau titre de la réunion'),
        })
        .describe('Paramètres pour mettre à jour une réunion'),
      execute: async ({ meetingId, startTime, endTime, title }) => {
        console.log('🤖 Update Meeting :', meetingId, { startTime, endTime, title });

        try {
          const updates: { start_time?: string; end_time?: string; title?: string } = {};
          if (startTime) updates.start_time = startTime;
          if (endTime) updates.end_time = endTime;
          if (title) updates.title = title;

          const result = await updateMeeting(meetingId, updates, userId);
          console.log('📦 Résultat :', result);

          const text = result.success
            ? '✅ Réunion mise à jour avec succès !'
            : `❌ ${result.message}`;

          return {
            success: result.success,
            text: text,
          };
        } catch (error) {
          console.error('❌ Erreur updateMeeting:', error);
          return {
            success: false,
            text: `❌ Erreur lors de la mise à jour: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          };
        }
      },
    }),

    getUserMeetings: tool({
      description: 'Récupère la liste des réunions prévues de l\'utilisateur',
      inputSchema: z.object({}).describe('Aucun paramètre requis'),
      execute: async () => {
        console.log('🤖 Get User Meetings');

        try {
          const result = await getUserMeetings(userId);
          console.log('📦 Réunions trouvées :', result.meetings);

          if (!result.meetings || result.meetings.length === 0) {
            return {
              found: false,
              text: 'Vous n\'avez aucune réunion prévue.',
              meetings: [],
            };
          }

          const formattedList = result.meetings
            .map(
              (m: any) =>
                `• **${m.title || 'Réunion'}** en ${m.room?.name || 'Salle'}\n  ${new Date(m.start_time).toLocaleString('fr-FR')}`
            )
            .join('\n');

          const text = `📅 Vos réunions:\n${formattedList}`;

          return {
            found: true,
            text: text,
            meetings: result.meetings,
          };
        } catch (error) {
          console.error('❌ Erreur getUserMeetings:', error);
          return {
            found: false,
            text: `❌ Erreur lors de la récupération: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
            meetings: [],
          };
        }
      },
    }),
  };
}
