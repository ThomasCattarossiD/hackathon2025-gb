import { z } from 'zod';
import * as bookingService from '@/services/bookingService';
import { format, addMinutes } from 'date-fns';
import { fr } from 'date-fns/locale';

export const createMeetingSchema = z.object({
    roomId: z.string().describe('The ID of the room to book.'),
    startTime: z.string().describe('ISO 8601 date string for the start of the meeting.'),
    duration: z.number().describe('Duration of the meeting in minutes.'),
    title: z.string().optional().describe('Optional title for the meeting.'),
});

export async function createMeeting(
    { roomId, startTime, duration }: z.infer<typeof createMeetingSchema>,
    userId: string
): Promise<string> {
    try {
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
