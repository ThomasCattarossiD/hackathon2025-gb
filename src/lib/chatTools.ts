import { z } from 'zod';
import { tool } from 'ai';
import * as bookingService from '@/services/bookingService';
import { format, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Room {
    id: string;
    name: string;
    capacity: number;
    location: string;
    equipment: string[];
    [key: string]: any;
}

// TOOL 1: findRoomsByCarac
export const findRoomsByCaracSchema = z.object({
    startTime: z.string().describe('REQUIRED - ISO 8601 date string for the start of the meeting.'),
    duration: z.number().min(15).describe('REQUIRED - Duration of the meeting in minutes.'),
    capacity: z.number().optional().describe('Optional capacity of the room.'),
    equipment: z.array(z.string()).optional().describe('Optional list of equipment required.'),
    location: z.string().optional().describe('Optional location of the room.'),
    name: z.string().optional().describe('Optional name of the room.'),
});

export async function findRoomsByCarac({
    startTime,
    duration,
    capacity,
    equipment,
    location,
    name,
}: z.infer<typeof findRoomsByCaracSchema>): Promise<string> {
    try {
        const potentialRooms = await bookingService.findRoomsByCharacteristics({
            capacity,
            equipment,
            location,
            name,
        });

        if (!potentialRooms || potentialRooms.length === 0) {
            return '❌ Aucune salle ne correspond à vos critères de base.';
        }

        const availableRooms: { room: Room; score: number }[] = [];

        for (const room of potentialRooms) {
            const { available } = await bookingService.checkRoomAvailability(room.id, startTime, duration);
            if (available) {
                // Calculate relevance score
                let score = 0;
                if (equipment && room.equipment) {
                    score += equipment.filter(e => room.equipment.includes(e)).length * 10;
                }
                if (capacity && room.capacity) {
                    // Prefer right-sized rooms
                    const capacityDiff = room.capacity - capacity;
                    if (capacityDiff >= 0) {
                        score += 5 - Math.min(capacityDiff / 2, 4); // Decrease score for oversized rooms
                    }
                }
                if (name && room.name.toLowerCase().includes(name.toLowerCase())) {
                    score += 3;
                }
                if (location && room.location.toLowerCase().includes(location.toLowerCase())) {
                    score += 2;
                }
                availableRooms.push({ room, score });
            }
        }

        if (availableRooms.length === 0) {
            return '❌ Aucune salle disponible à cet horaire.';
        }

        // Sort by relevance score (descending)
        availableRooms.sort((a, b) => b.score - a.score);

        const startDate = new Date(startTime);
        const endDate = addMinutes(startDate, duration);
        const dateStr = format(startDate, 'dd/MM/yyyy');
        const startTimeStr = format(startDate, 'HH:mm');
        const endTimeStr = format(endDate, 'HH:mm');

        const header = `✅ ${availableRooms.length} salle(s) disponible(s) le ${dateStr} de ${startTimeStr} à ${endTimeStr}:\n\n`;
        const roomList = availableRooms
            .map(({ room }) => `• **${room.name}** • ${room.capacity} pers • ${room.location}`)
            .join('\n');

        return header + roomList;
    } catch (error) {
        console.error('Error in findRoomsByCarac:', error);
        return '❌ Une erreur est survenue lors de la recherche de salles.';
    }
}


// TOOL 2: proposeRoomToUser
export const proposeRoomToUserSchema = z.object({
    roomId: z.string().describe('The ID of the room to propose.'),
    startTime: z.string().describe('ISO 8601 date string for the start of the meeting.'),
    duration: z.number().describe('Duration of the meeting in minutes.'),
});

export async function proposeRoomToUser({
    roomId,
    startTime,
    duration,
}: z.infer<typeof proposeRoomToUserSchema>): Promise<string> {
    try {
        const { available, room } = await bookingService.checkRoomAvailability(roomId, startTime, duration);

        if (!available || !room) {
            return "❌ Cette salle n'est plus disponible à cet horaire.";
        }

        const startDate = new Date(startTime);
        const endDate = addMinutes(startDate, duration);

        const proposal = `
✅ **${room.name}**

📅 ${format(startDate, 'dd/MM/yyyy', { locale: fr })}
⏰ ${format(startDate, 'HH:mm')} à ${format(endDate, 'HH:mm')} (${duration} min)
📍 ${room.location}
👥 ${room.capacity} personnes
🛠️ Équipements: ${room.equipment ? room.equipment.join(', ') : 'N/A'}

Souhaitez-vous réserver cette salle?
        `.trim();

        return proposal;
    } catch (error) {
        console.error('Error in proposeRoomToUser:', error);
        return '❌ Une erreur est survenue lors de la proposition de la salle.';
    }
}


// TOOL 3: createMeeting
export const createMeetingSchema = z.object({
    roomId: z.string().describe('The ID of the room to book.'),
    startTime: z.string().describe('ISO 8601 date string for the start of the meeting.'),
    duration: z.number().describe('Duration of the meeting in minutes.'),
    title: z.string().optional().describe('Optional title for the meeting.'),
    userId: z.string().describe("The user's ID."),
});

export async function createMeeting({
    roomId,
    startTime,
    duration,
    userId,
}: z.infer<typeof createMeetingSchema>): Promise<string> {
    try {
        // The bookingService.createBooking function requires a userId.
        const result = await bookingService.createBooking(roomId, startTime, duration, userId);

        if (result.success) {
            const startDate = new Date(startTime);
            const endDate = addMinutes(startDate, duration);
            return `
✅ **Réservation confirmée!**

📅 ${format(startDate, 'dd/MM/yyyy', { locale: fr })}
⏰ ${format(startDate, 'HH:mm')} à ${format(endDate, 'HH:mm')}

Votre réunion est réservée!
            `.trim();
        } else {
            return `❌ Impossible de créer la réservation: ${result.message}`;
        }
    } catch (error: any) {
        console.error('Error in createMeeting:', error);
        return `❌ Impossible de créer la réservation: ${error.message || 'Erreur inconnue'}`;
    }
}

export const chatTools = {
    findRoomsByCarac: {
        description: 'Find and filter available rooms by criteria. Returns a list of available rooms sorted by relevance.',
        parameters: findRoomsByCaracSchema,
    },
    proposeRoomToUser: {
        description: 'Show full room details and ask for confirmation. Re-verifies availability before proposing.',
        parameters: proposeRoomToUserSchema,
    },
    createMeeting: {
        description: 'Create the actual booking in the database.',
        parameters: createMeetingSchema,
    },
};

// Tool execution handlers
export const toolExecutors = {
    findRoomsByCarac,
    proposeRoomToUser,
    createMeeting,
};