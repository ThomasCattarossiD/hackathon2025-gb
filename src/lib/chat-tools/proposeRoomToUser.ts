import { z } from 'zod';
import * as bookingService from '@/services/bookingService';
import { format, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

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
