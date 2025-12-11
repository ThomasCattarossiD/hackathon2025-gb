import { tool } from 'ai';
import { z } from 'zod';
import {
  findAvailableRooms,
  createBooking,
  findRoomByLocation,
  findRoomByName,
  findMeetingByCompany,
  updateMeeting,
  getUserMeetings,
} from '@/services/bookingService';
import {
  formatRoomsResponse,
  formatBookingSuccess,
  formatBookingError,
} from '@/lib/formatters';

// ========================
// ZOD SCHEMAS FOR VALIDATION
// ========================

const availabilityZodObject = z
  .object({
    date: z
      .string()
      .describe(
        'Date et heure de début au format ISO 8601 (ex: 2026-12-12T14:00:00)'
      ),
    duration: z
      .number()
      .int()
      .min(15)
      .optional()
      .describe('Durée en minutes (par défaut 60, minimum 15)'),
    capacity: z
      .number()
      .int()
      .optional()
      .describe('Nombre de personnes (capacité minimale requise)'),
    equipment: z
      .array(z.string())
      .optional()
      .describe('Liste des équipements requis (ex: ["vidéo-projecteur", "wifi"])'),
  })
  .describe('Paramètres pour vérifier la disponibilité des salles');

const roomBookingZodObject = z
  .object({
    roomName: z.string().describe('Le nom exact de la salle à réserver'),
    date: z
      .string()
      .describe('Date et heure de début au format ISO 8601'),
    duration: z
      .number()
      .int()
      .min(15)
      .describe('Durée en minutes'),
  })
  .describe('Paramètres pour réserver une salle');

const roomLocationZodObject = z
  .object({
    location: z
      .string()
      .describe(
        'Localisation recherchée (ex: "1er étage", "RDC", "2ème étage")'
      ),
  })
  .describe('Paramètres pour rechercher une salle par localisation');

const roomNameZodObject = z
  .object({
    roomName: z.string().describe('Nom de la salle recherchée'),
  })
  .describe('Paramètres pour rechercher une salle par nom');

const meetingByCompanyZodObject = z
  .object({
    company: z
      .string()
      .describe(
        'Nom de l\'entreprise ou mot-clé à rechercher dans le titre de la réunion'
      ),
  })
  .describe('Paramètres pour rechercher une réunion par entreprise');

const updateMeetingZodObject = z
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
  .describe('Paramètres pour mettre à jour une réunion');

// ========================
// TOOLS DEFINITION
// ========================

export const chatTools = {
  // OUTIL 1 : VÉRIFIER LA DISPONIBILITÉ DES SALLES
  checkAvailability: tool({
    description:
      'Vérifie les salles disponibles pour un créneau donné, avec filtres optionnels.',
    inputSchema: availabilityZodObject,
    execute: async ({ date, duration = 60, capacity, equipment }) => {
      console.log('🤖 IA Check Dispo :', date, (duration || 60) + 'min', {
        capacity,
        equipment,
      });

      try {
        const availableRooms = await findAvailableRooms(
          date,
          duration || 60,
          { capacity, equipment }
        );
        console.log('📦 Rooms trouvées :', availableRooms);

        if (!availableRooms || availableRooms.length === 0) {
          const response = {
            available: false,
            message:
              '❌ Aucune salle n\'est libre à cet horaire avec ces critères. Demande à l\'utilisateur s\'il veut changer d\'heure ou de critères.',
            rooms: [],
            formattedResponse: 'Aucune salle disponible correspondant à vos critères.',
          };
          console.log('📤 Réponse checkAvailability (vide):', response);
          return response;
        }

        // Format lisible pour l'IA avec le formatter
        const formattedResponse = formatRoomsResponse(availableRooms);
        const response = {
          available: true,
          message: `${availableRooms.length} salle(s) disponible(s) à ${date} pour ${duration || 60} minutes.`,
          rooms: availableRooms,
          formattedResponse: formattedResponse,
        };
        console.log('📤 Réponse checkAvailability:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur check availability:', error);
        const response = {
          available: false,
          error: true,
          message: '❌ Erreur lors de la vérification de la disponibilité.',
          formattedResponse: 'Une erreur est survenue. Veuillez réessayer.',
        };
        console.log('📤 Réponse checkAvailability (erreur):', response);
        return response;
      }
    },
  }),

  // OUTIL 2 : RECHERCHER UNE SALLE PAR LOCALISATION
  findRoomByLocation: tool({
    description: 'Recherche une salle par sa localisation (étage, bâtiment, etc.)',
    inputSchema: roomLocationZodObject,
    execute: async ({ location }) => {
      console.log('🤖 IA Find Room by Location :', location);

      try {
        const room = await findRoomByLocation(location);
        console.log('📦 Room trouvée :', room);

        if (!room) {
          const response = {
            found: false,
            message: `Aucune salle trouvée à la localisation "${location}".`,
            room: null,
            formattedResponse: `Pas de salle disponible à la localisation "${location}".`,
          };
          console.log('📤 Réponse findRoomByLocation (not found):', response);
          return response;
        }

        const formattedResponse = `📍 **${room.name}**\n👥 Capacité: ${room.capacity} personne(s)\n📦 Équipements: ${(room.equipment || []).join(', ')}\n📍 Localisation: ${room.location}`;
        const response = {
          found: true,
          message: `Salle trouvée à ${location}`,
          room: room,
          formattedResponse: formattedResponse,
        };
        console.log('📤 Réponse findRoomByLocation:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur find room by location:', error);
        const response = {
          found: false,
          error: true,
          message: 'Erreur lors de la recherche de salle.',
          formattedResponse: 'Une erreur est survenue lors de la recherche.',
        };
        console.log('📤 Réponse findRoomByLocation (erreur):', response);
        return response;
      }
    },
  }),

  // OUTIL 3 : RECHERCHER UNE SALLE PAR NOM
  findRoomByName: tool({
    description:
      'Recherche une salle par son nom exact (ex: "Aquarium", "Jungle", "Space Station")',
    inputSchema: roomNameZodObject,
    execute: async ({ roomName }) => {
      console.log('🤖 IA Find Room by Name :', roomName);

      try {
        const room = await findRoomByName(roomName);
        console.log('📦 Room trouvée :', room);

        if (!room) {
          const response = {
            found: false,
            message: `Salle "${roomName}" non trouvée.`,
            room: null,
            formattedResponse: `La salle "${roomName}" n'existe pas ou n'est pas active.`,
          };
          console.log('📤 Réponse findRoomByName (not found):', response);
          return response;
        }

        const formattedResponse = `✅ **${room.name}**\n👥 Capacité: ${room.capacity} personne(s)\n📦 Équipements: ${(room.equipment || []).join(', ')}\n📍 Localisation: ${room.location}`;
        const response = {
          found: true,
          message: `Salle "${roomName}" trouvée`,
          room: room,
          formattedResponse: formattedResponse,
        };
        console.log('📤 Réponse findRoomByName:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur find room by name:', error);
        const response = {
          found: false,
          error: true,
          message: 'Erreur lors de la recherche de salle.',
          formattedResponse: 'Une erreur est survenue lors de la recherche.',
        };
        console.log('📤 Réponse findRoomByName (erreur):', response);
        return response;
      }
    },
  }),

  // OUTIL 4 : RÉSERVER UNE SALLE
  createBooking: tool({
    description: 'Effectue la réservation ferme d\'une salle.',
    inputSchema: roomBookingZodObject,
    execute: async ({ roomName, date, duration }) => {
      console.log('🤖 IA Booking :', roomName, date, duration + 'min');

      try {
        const result = await createBooking(roomName, date, duration);
        console.log('📦 Résultat booking :', result);

        // Utiliser le formatter pour les messages de succès/erreur
        const formattedResponse = result.success
          ? formatBookingSuccess(roomName, date, duration)
          : formatBookingError(roomName, result.message);

        const response = {
          success: result.success,
          message: `${result.message}\n\n${formattedResponse}`,
          formattedResponse: formattedResponse,
        };
        console.log('📤 Réponse createBooking:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur create booking:', error);
        const formattedResponse = formatBookingError(
          roomName,
          'Une erreur système est survenue.'
        );
        const response = {
          success: false,
          message: 'Erreur système lors de la réservation.',
          formattedResponse: formattedResponse,
        };
        console.log('📤 Réponse createBooking (erreur):', response);
        return response;
      }
    },
  }),

  // OUTIL 5 : TROUVER UNE RÉUNION PAR ENTREPRISE/SOCIÉTÉ
  findMeetingByCompany: tool({
    description:
      'Recherche une réunion de l\'utilisateur pour une entreprise/société donnée',
    inputSchema: meetingByCompanyZodObject,
    execute: async ({ company }) => {
      console.log('🤖 IA Find Meeting by Company :', company);

      try {
        const result = await findMeetingByCompany(company);
        console.log('📦 Résultat recherche réunion :', result);

        if (!result.found) {
          const response = {
            found: false,
            message: result.message,
            formattedResponse: result.message,
          };
          console.log('📤 Réponse findMeetingByCompany (not found):', response);
          return response;
        }

        const meeting = result.meeting as Record<string, unknown>;
        const roomData = Array.isArray(meeting.rooms) ? (meeting.rooms as any[])[0] : meeting.rooms;
        const formattedResponse = `📅 **${meeting.title}**\n🏢 Salle: ${(roomData as any)?.name}\n⏰ ${new Date(meeting.start_time as string).toLocaleString('fr-FR')} - ${new Date(meeting.end_time as string).toLocaleTimeString('fr-FR')}\n📍 Localisation: ${(roomData as any)?.location}`;
        const response = {
          found: true,
          meeting: meeting,
          message: `Réunion trouvée pour ${company}`,
          formattedResponse: formattedResponse,
        };
        console.log('📤 Réponse findMeetingByCompany:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur find meeting by company:', error);
        const response = {
          found: false,
          error: true,
          message: 'Erreur lors de la recherche.',
          formattedResponse: 'Une erreur est survenue lors de la recherche.',
        };
        console.log('📤 Réponse findMeetingByCompany (erreur):', response);
        return response;
      }
    },
  }),

  // OUTIL 6 : METTRE À JOUR UNE RÉUNION
  updateMeeting: tool({
    description:
      'Modifie les détails d\'une réunion (horaire, titre, etc.)',
    inputSchema: updateMeetingZodObject,
    execute: async ({ meetingId, startTime, endTime, title }) => {
      console.log('🤖 IA Update Meeting :', meetingId, {
        startTime,
        endTime,
        title,
      });

      try {
        const updates: { start_time?: string; end_time?: string; title?: string } = {};
        if (startTime) updates.start_time = startTime;
        if (endTime) updates.end_time = endTime;
        if (title) updates.title = title;

        const result = await updateMeeting(meetingId, updates);
        console.log('📦 Résultat mise à jour :', result);

        const response = {
          success: result.success,
          message: result.message,
          formattedResponse: result.success
            ? '✅ Réunion mise à jour avec succès !'
            : `❌ ${result.message}`,
        };
        console.log('📤 Réponse updateMeeting:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur update meeting:', error);
        const response = {
          success: false,
          error: true,
          message: 'Erreur lors de la mise à jour.',
          formattedResponse: 'Une erreur est survenue lors de la mise à jour.',
        };
        console.log('📤 Réponse updateMeeting (erreur):', response);
        return response;
      }
    },
  }),

  // OUTIL 7 : LISTER LES RÉUNIONS DE L'UTILISATEUR
  getUserMeetings: tool({
    description: 'Récupère la liste des réunions prévues de l\'utilisateur',
    inputSchema: z
      .object({})
      .describe('Aucun paramètre requis'),
    execute: async () => {
      console.log('🤖 IA Get User Meetings');

      try {
        const result = await getUserMeetings();
        console.log('📦 Réunions trouvées :', result.meetings);

        if (!result.meetings || result.meetings.length === 0) {
          const response = {
            found: false,
            meetings: [],
            message: 'Aucune réunion prévue.',
            formattedResponse: 'Vous n\'avez aucune réunion prévue.',
          };
          console.log('📤 Réponse getUserMeetings (empty):', response);
          return response;
        }

        const formattedList = result.meetings
          .map(
            (m: Record<string, unknown>) =>
              `• **${m.title || 'Réunion'}** en ${(m.rooms as any)?.name}\n  ${new Date(m.start_time as string).toLocaleString('fr-FR')}`
          )
          .join('\n');

        const response = {
          found: true,
          meetings: result.meetings,
          message: `${result.meetings.length} réunion(s) prévue(s)`,
          formattedResponse: `📅 **Vos réunions:**\n${formattedList}`,
        };
        console.log('📤 Réponse getUserMeetings:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur get user meetings:', error);
        const response = {
          found: false,
          meetings: [],
          error: true,
          message: 'Erreur lors de la récupération des réunions.',
          formattedResponse: 'Une erreur est survenue.',
        };
        console.log('📤 Réponse getUserMeetings (erreur):', response);
        return response;
      }
    },
  }),
};
