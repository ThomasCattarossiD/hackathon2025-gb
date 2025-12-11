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
    roomName: z
      .string()
      .optional()
      .describe('Nom spécifique de la salle à vérifier (ex: "Aquarium", "Innovation Lab")'),
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
      'Vérifie les salles disponibles pour un créneau donné et retourne la meilleure option.',
    inputSchema: availabilityZodObject,
    execute: async ({ date, duration = 60, capacity, equipment, roomName }) => {
      console.log('🤖 IA Check Dispo :', date, (duration || 60) + 'min', {
        capacity,
        equipment,
        roomName,
      });

      try {
        const availableRooms = await findAvailableRooms(
          date,
          duration || 60,
          { capacity, equipment, roomName }
        );
        console.log('📦 Rooms trouvées :', availableRooms);

        if (!availableRooms || availableRooms.length === 0) {
          // Si une salle spécifique était demandée et indisponible, retourner ses détails
          // pour que l'IA puisse proposer des alternatives avec les mêmes critères
          let unavailableRoomDetails = null;
          if (roomName) {
            unavailableRoomDetails = await findRoomByName(roomName);
          }

          const baseMessage = roomName 
            ? `❌ Malheureusement, la salle **${roomName}** n'est pas disponible à cet horaire.`
            : '❌ Malheureusement, aucune salle n\'est disponible avec ces critères à cet horaire.';
          
          const response = {
            available: false,
            text: baseMessage + ' Voulez-vous essayer avec des critères différents ou à un autre moment ?',
            bestRoom: null,
            allRooms: [],
            requestedRoomName: roomName || null,
            // Ajouter les détails de la salle indisponible pour que l'IA propose des alternatives similaires
            unavailableRoomDetails: unavailableRoomDetails || null,
          };
          console.log('📤 Réponse checkAvailability (vide):', response);
          return response;
        }

        // Retourner UNE salle principale + les alternatives
        const bestRoom = availableRooms[0];
        const startDate = new Date(date);
        const endDate = new Date(startDate.getTime() + (duration || 60) * 60000);
        
        // Message différencié si c'est une salle spécifique demandée
        const confirmation = roomName && bestRoom.name.toLowerCase() === roomName.toLowerCase()
          ? `✅ Parfait ! La salle **${bestRoom.name}** est disponible`
          : `✅ Excellente nouvelle ! La salle **${bestRoom.name}** est disponible`;
        
        const text = `${confirmation} le ${startDate.toLocaleDateString('fr-FR')} de ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${endDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}.\n\n📊 Détails:\n- 👥 Capacité: ${bestRoom.capacity} personnes\n- 📍 Localisation: ${bestRoom.location}\n- 🛠️ Équipements: ${Array.isArray(bestRoom.equipment) && bestRoom.equipment.length > 0 ? bestRoom.equipment.join(', ') : 'Équipements standard'}\n\nVoulez-vous réserver cette salle ?`;
        
        const response = {
          available: true,
          text: text,
          bestRoom: {
            id: bestRoom.id,
            name: bestRoom.name,
            capacity: bestRoom.capacity,
            location: bestRoom.location,
            equipment: bestRoom.equipment,
            description: bestRoom.description,
          },
          // Retourner toutes les salles disponibles pour permettre à l'IA de proposer des alternatives
          allRooms: availableRooms.map((room: any) => ({
            id: room.id,
            name: room.name,
            capacity: room.capacity,
            location: room.location,
            equipment: room.equipment,
          })),
          requestedRoomName: roomName || null,
        };
        console.log('📤 Réponse checkAvailability:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur checkAvailability:', error);
        return {
          available: false,
          text: `❌ Une erreur s'est produite lors de la vérification de la disponibilité: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
          bestRoom: null,
          allRooms: [],
        };
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
          const text = `Pas de salle disponible à la localisation "${location}".`;
          const response = {
            found: false,
            text: text,
            message: `Aucune salle trouvée à la localisation "${location}".`,
            room: null,
            formattedResponse: text,
          };
          console.log('📤 Réponse findRoomByLocation (not found):', response);
          return response;
        }

        const text = `📍 **${room.name}**\n👥 Capacité: ${room.capacity} personne(s)\n📦 Équipements: ${(room.equipment || []).join(', ')}\n📍 Localisation: ${room.location}`;
        const response = {
          found: true,
          text: text,
          message: `Salle trouvée à ${location}`,
          room: room,
          formattedResponse: text,
        };
        console.log('📤 Réponse findRoomByLocation:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur find room by location:', error);
        const text = 'Une erreur est survenue lors de la recherche.';
        const response = {
          found: false,
          error: true,
          text: text,
          message: 'Erreur lors de la recherche de salle.',
          formattedResponse: text,
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
          const text = `La salle "${roomName}" n'existe pas ou n'est pas active.`;
          const response = {
            found: false,
            text: text,
            message: `Salle "${roomName}" non trouvée.`,
            room: null,
            formattedResponse: text,
          };
          console.log('📤 Réponse findRoomByName (not found):', response);
          return response;
        }

        const text = `✅ **${room.name}**\n👥 Capacité: ${room.capacity} personne(s)\n📦 Équipements: ${(room.equipment || []).join(', ')}\n📍 Localisation: ${room.location}`;
        const response = {
          found: true,
          text: text,
          message: `Salle "${roomName}" trouvée`,
          room: room,
          formattedResponse: text,
        };
        console.log('📤 Réponse findRoomByName:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur find room by name:', error);
        const text = 'Une erreur est survenue lors de la recherche.';
        const response = {
          found: false,
          error: true,
          text: text,
          message: 'Erreur lors de la recherche de salle.',
          formattedResponse: text,
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
          text: formattedResponse,
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
          text: formattedResponse,
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
          const text = result.message;
          const response = {
            found: false,
            text: text,
            message: result.message,
            formattedResponse: result.message,
          };
          console.log('📤 Réponse findMeetingByCompany (not found):', response);
          return response;
        }

        const meeting = result.meeting as Record<string, unknown>;
        const roomData = Array.isArray(meeting.rooms) ? (meeting.rooms as any[])[0] : meeting.rooms;
        const text = `📅 **${meeting.title}**\n🏢 Salle: ${(roomData as any)?.name}\n⏰ ${new Date(meeting.start_time as string).toLocaleString('fr-FR')} - ${new Date(meeting.end_time as string).toLocaleTimeString('fr-FR')}\n📍 Localisation: ${(roomData as any)?.location}`;
        const response = {
          found: true,
          text: text,
          meeting: meeting,
          message: `Réunion trouvée pour ${company}`,
          formattedResponse: text,
        };
        console.log('📤 Réponse findMeetingByCompany:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur find meeting by company:', error);
        const text = 'Une erreur est survenue lors de la recherche.';
        const response = {
          found: false,
          error: true,
          text: text,
          message: 'Erreur lors de la recherche.',
          formattedResponse: text,
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

        const text = result.success
          ? '✅ Réunion mise à jour avec succès !'
          : `❌ ${result.message}`;
        const response = {
          success: result.success,
          text: text,
          message: result.message,
          formattedResponse: text,
        };
        console.log('📤 Réponse updateMeeting:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur update meeting:', error);
        const text = 'Une erreur est survenue lors de la mise à jour.';
        const response = {
          success: false,
          error: true,
          text: text,
          message: 'Erreur lors de la mise à jour.',
          formattedResponse: text,
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
          const text = 'Vous n\'avez aucune réunion prévue.';
          const response = {
            found: false,
            text: text,
            meetings: [],
            message: 'Aucune réunion prévue.',
            formattedResponse: text,
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

        const text = `📅 **Vos réunions:**\n${formattedList}`;
        const response = {
          found: true,
          text: text,
          meetings: result.meetings,
          message: `${result.meetings.length} réunion(s) prévue(s)`,
          formattedResponse: text,
        };
        console.log('📤 Réponse getUserMeetings:', response);
        return response;
      } catch (error) {
        console.error('❌ Erreur get user meetings:', error);
        const text = 'Une erreur est survenue.';
        const response = {
          found: false,
          meetings: [],
          error: true,
          text: text,
          message: 'Erreur lors de la récupération des réunions.',
          formattedResponse: text,
        };
        console.log('📤 Réponse getUserMeetings (erreur):', response);
        return response;
      }
    },
  }),
};

// Fonction pour créer les tools avec le contexte utilisateur (userId)
// Cela permet aux tools qui ont besoin d'authentification d'avoir accès à l'userId
export function createToolsWithUserContext(userId?: string) {
  return {
    // OUTIL 1 : VÉRIFIER LA DISPONIBILITÉ DES SALLES (pas besoin d'userId)
    checkAvailability: chatTools.checkAvailability,

    // OUTIL 2 : RECHERCHER UNE SALLE PAR LOCALISATION (pas besoin d'userId)
    findRoomByLocation: chatTools.findRoomByLocation,

    // OUTIL 3 : RECHERCHER UNE SALLE PAR NOM (pas besoin d'userId)
    findRoomByName: chatTools.findRoomByName,

    // OUTIL 4 : RÉSERVER UNE SALLE (besoin d'userId)
    createBooking: tool({
      description: 'Effectue la réservation ferme d\'une salle.',
      inputSchema: z
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
        .describe('Paramètres pour réserver une salle'),
      execute: async ({ roomName, date, duration }) => {
        console.log('🤖 IA Booking :', roomName, date, duration + 'min');

        try {
          const result = await createBooking(roomName, date, duration, userId);
          console.log('📦 Résultat booking :', result);

          const text = result.success
            ? `✅ **Réservation confirmée pour ${roomName}**\n\n📅 ${new Date(date).toLocaleDateString('fr-FR')} de ${new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} à ${new Date(new Date(date).getTime() + duration * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}\n\n✨ Votre réunion est maintenant réservée !`
            : `❌ **Réservation échouée pour ${roomName}**\n\nRaison: ${result.message}`;

          const response = {
            success: result.success,
            text: text,
            message: result.message,
            formattedResponse: text,
          };
          console.log('📤 Réponse createBooking:', response);
          return response;
        } catch (error) {
          console.error('❌ Erreur create booking:', error);
          const text = `❌ **Réservation échouée pour ${roomName}**\n\nUne erreur système est survenue.`;
          const response = {
            success: false,
            text: text,
            message: 'Erreur système lors de la réservation.',
            formattedResponse: text,
          };
          console.log('📤 Réponse createBooking (erreur):', response);
          return response;
        }
      },
    }),

    // OUTIL 5 : TROUVER UNE RÉUNION PAR ENTREPRISE/SOCIÉTÉ (besoin d'userId)
    findMeetingByCompany: tool({
      description:
        'Recherche une réunion de l\'utilisateur pour une entreprise/société donnée',
      inputSchema: z
        .object({
          company: z
            .string()
            .describe(
              'Nom de l\'entreprise ou mot-clé à rechercher dans le titre de la réunion'
            ),
        })
        .describe('Paramètres pour rechercher une réunion par entreprise'),
      execute: async ({ company }) => {
        console.log('🤖 IA Find Meeting by Company :', company);

        try {
          const result = await findMeetingByCompany(company, userId);
          console.log('📦 Résultat recherche réunion :', result);

          if (!result.found) {
            const text = result.message;
            const response = {
              found: false,
              text: text,
              message: result.message,
              formattedResponse: text,
            };
            console.log('📤 Réponse findMeetingByCompany (not found):', response);
            return response;
          }

          const meeting = result.meeting as Record<string, unknown>;
          const roomData = Array.isArray(meeting.rooms) ? (meeting.rooms as any[])[0] : meeting.rooms;
          const text = `📅 **${meeting.title}**\n🏢 Salle: ${(roomData as any)?.name}\n⏰ ${new Date(meeting.start_time as string).toLocaleString('fr-FR')} - ${new Date(meeting.end_time as string).toLocaleTimeString('fr-FR')}\n📍 Localisation: ${(roomData as any)?.location}`;
          const response = {
            found: true,
            text: text,
            meeting: meeting,
            message: `Réunion trouvée pour ${company}`,
            formattedResponse: text,
          };
          console.log('📤 Réponse findMeetingByCompany:', response);
          return response;
        } catch (error) {
          console.error('❌ Erreur find meeting by company:', error);
          const text = 'Une erreur est survenue lors de la recherche.';
          const response = {
            found: false,
            error: true,
            text: text,
            message: 'Erreur lors de la recherche.',
            formattedResponse: text,
          };
          console.log('📤 Réponse findMeetingByCompany (erreur):', response);
          return response;
        }
      },
    }),

    // OUTIL 6 : METTRE À JOUR UNE RÉUNION (besoin d'userId)
    updateMeeting: tool({
      description:
        'Modifie les détails d\'une réunion (horaire, titre, etc.)',
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

          const result = await updateMeeting(meetingId, updates, userId);
          console.log('📦 Résultat mise à jour :', result);

          const text = result.success
            ? '✅ Réunion mise à jour avec succès !'
            : `❌ ${result.message}`;
          const response = {
            success: result.success,
            text: text,
            message: result.message,
            formattedResponse: text,
          };
          console.log('📤 Réponse updateMeeting:', response);
          return response;
        } catch (error) {
          console.error('❌ Erreur update meeting:', error);
          const text = 'Une erreur est survenue lors de la mise à jour.';
          const response = {
            success: false,
            error: true,
            text: text,
            message: 'Erreur lors de la mise à jour.',
            formattedResponse: text,
          };
          console.log('📤 Réponse updateMeeting (erreur):', response);
          return response;
        }
      },
    }),

    // OUTIL 7 : LISTER LES RÉUNIONS DE L'UTILISATEUR (besoin d'userId)
    getUserMeetings: tool({
      description: 'Récupère la liste des réunions prévues de l\'utilisateur',
      inputSchema: z
        .object({})
        .describe('Aucun paramètre requis'),
      execute: async () => {
        console.log('🤖 IA Get User Meetings');

        try {
          const result = await getUserMeetings(userId);
          console.log('📦 Réunions trouvées :', result.meetings);

          if (!result.meetings || result.meetings.length === 0) {
            const text = 'Vous n\'avez aucune réunion prévue.';
            const response = {
              found: false,
              text: text,
              meetings: [],
              message: 'Aucune réunion prévue.',
              formattedResponse: text,
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

          const text = `📅 **Vos réunions:**\n${formattedList}`;
          const response = {
            found: true,
            text: text,
            meetings: result.meetings,
            message: `${result.meetings.length} réunion(s) prévue(s)`,
            formattedResponse: text,
          };
          console.log('📤 Réponse getUserMeetings:', response);
          return response;
        } catch (error) {
          console.error('❌ Erreur get user meetings:', error);
          const text = 'Une erreur est survenue.';
          const response = {
            found: false,
            meetings: [],
            error: true,
            text: text,
            message: 'Erreur lors de la récupération des réunions.',
            formattedResponse: 'Une erreur est survenue.',
          };
          console.log('📤 Réponse getUserMeetings (erreur):', response);
          return response;
        }
      },
    }),
  };
}
