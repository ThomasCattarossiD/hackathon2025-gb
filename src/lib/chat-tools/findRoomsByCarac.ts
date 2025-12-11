import { z } from 'zod';
import * as bookingService from '@/services/bookingService';
import { format, addMinutes } from 'date-fns';

interface Room {
    id: string;
    name: string;
    capacity: number;
    location: string;
    equipment: string[];
    [key: string]: any;
}

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
                let score = 0;
                if (equipment && room.equipment) {
                    score += equipment.filter(e => room.equipment.includes(e)).length * 10;
                }
                if (capacity && room.capacity) {
                    const capacityDiff = room.capacity - capacity;
                    if (capacityDiff >= 0) {
                        score += 5 - Math.min(capacityDiff / 2, 4);
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
