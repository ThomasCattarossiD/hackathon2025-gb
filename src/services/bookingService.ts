import { supabase } from '@/lib/supabaseClient';

export async function findAvailableRooms(date: string, duration: number) {
  console.log(`Finding available rooms for ${date} with duration ${duration} minutes.`);
  
  try {
    // Récupérer toutes les salles actives
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('is_active', true);

    if (error) {
      console.error('Erreur récupération salles:', error);
      return [];
    }

    // TODO: Implémenter la vérification des conflits avec les bookings existants
    // Pour l'instant, on retourne toutes les salles actives
    return rooms || [];
  } catch (error) {
    console.error('Erreur find available rooms:', error);
    return [];
  }
}

export async function createBooking(roomName: string, date: string, duration: number) {
  console.log(`Creating booking for ${roomName} on ${date} for ${duration} minutes.`);
  
  try {
    // Récupérer l'ID de la salle par son nom
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .ilike('name', roomName)
      .single();

    if (roomError || !room) {
      return { success: false, message: `Salle "${roomName}" introuvable.` };
    }

    // Créer la réservation
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert([
        {
          room_id: room.id,
          user_id: 'anonymous', // TODO: Récupérer l'user ID du contexte auth
          title: 'Réunion réservée via chatbot',
          start_time: date,
          end_time: new Date(new Date(date).getTime() + duration * 60000).toISOString(),
        },
      ]);

    if (bookingError) {
      console.error('Erreur création booking:', bookingError);
      return { success: false, message: 'Erreur lors de la réservation.' };
    }

    return { success: true, message: `Salle "${roomName}" réservée avec succès !` };
  } catch (error) {
    console.error('Erreur create booking:', error);
    return { success: false, message: 'Erreur système lors de la réservation.' };
  }
}
