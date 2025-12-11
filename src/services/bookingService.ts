import { supabase } from '@/lib/supabaseClient';

// Fonction utilitaire pour vérifier les conflits de réservation
async function hasMeetingConflict(roomId: number, startTime: string, endTime: string): Promise<boolean> {
  try {
    const { data: conflicts, error } = await supabase
      .from('meetings')
      .select('id')
      .eq('room_id', roomId)
      .or(`start_time.lt.${endTime},end_time.gt.${startTime}`)
      .limit(1);

    if (error) {
      console.error('Erreur vérification conflit:', error);
      return false;
    }

    return conflicts && conflicts.length > 0;
  } catch (error) {
    console.error('Erreur check conflict:', error);
    return false;
  }
}

export async function findAvailableRooms(date: string, duration: number, options?: { capacity?: number; equipment?: string[] }) {
  console.log(`Finding available rooms for ${date} with duration ${duration} minutes. Options:`, options);
  
  try {
    // Récupérer toutes les salles actives
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*');

    if (error) {
      console.error('Erreur récupération salles:', error);
      return [];
    }

    if (!rooms || rooms.length === 0) {
      return [];
    }

    // Calculer end_time
    const startDate = new Date(date);
    const endDate = new Date(startDate.getTime() + duration * 60000);

    // Filtrer les salles : pas de conflit + critères optionnels
    const availableRooms = [];
    for (const room of rooms) {
      // Vérifier conflit horaire
      const hasConflict = await hasMeetingConflict(room.id, date, endDate.toISOString());
      if (hasConflict) continue;

      // Filtrer par capacité si spécifiée
      if (options?.capacity && room.capacity < options.capacity) {
        continue;
      }

      // Filtrer par équipement si spécifié
      if (options?.equipment && options.equipment.length > 0) {
        const roomEquipment = Array.isArray(room.equipment) ? room.equipment : [];
        const hasAllEquipment = options.equipment.every((eq) =>
          roomEquipment.some((re: string) => re.toLowerCase().includes(eq.toLowerCase()))
        );
        if (!hasAllEquipment) continue;
      }

      availableRooms.push(room);
    }

    // Trier par capacité pour suggérer la salle la plus pertinente
    availableRooms.sort((a, b) => a.capacity - b.capacity);
    
    return availableRooms;
  } catch (error) {
    console.error('Erreur find available rooms:', error);
    return [];
  }
}

// Fonction pour rechercher une salle par localisation
export async function findRoomByLocation(location: string, date?: string): Promise<any | null> {
  console.log(`Finding room at location: ${location}`);
  
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .ilike('location', `%${location}%`)
      .limit(1);

    if (error) {
      console.error('Erreur recherche par localisation:', error);
      return null;
    }

    return rooms && rooms.length > 0 ? rooms[0] : null;
  } catch (error) {
    console.error('Erreur find room by location:', error);
    return null;
  }
}

// Fonction pour rechercher une salle par son nom exact
export async function findRoomByName(roomName: string): Promise<any | null> {
  console.log(`Finding room by name: ${roomName}`);
  
  try {
    const { data: rooms, error } = await supabase
      .from('rooms')
      .select('*')
      .ilike('name', roomName)
      .limit(1);

    if (error) {
      console.error('Erreur recherche par nom:', error);
      return null;
    }

    return rooms && rooms.length > 0 ? rooms[0] : null;
  } catch (error) {
    console.error('Erreur find room by name:', error);
    return null;
  }
}

export async function createBooking(roomName: string, date: string, duration: number) {
  console.log(`Creating meeting for ${roomName} on ${date} for ${duration} minutes.`);
  
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

    // Récupérer l'user_id de l'utilisateur connecté
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return { success: false, message: 'Vous devez être connecté pour réserver.' };
    }

    // Créer la réservation dans la table meetings
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert([
        {
          room_id: room.id,
          user_id: user.id,
          title: 'Réunion réservée via chatbot',
          start_time: date,
          end_time: new Date(new Date(date).getTime() + duration * 60000).toISOString(),
          status: 'confirmed'
        },
      ]);

    if (meetingError) {
      console.error('Erreur création meeting:', meetingError);
      return { success: false, message: 'Erreur lors de la réservation.' };
    }

    return { success: true, message: `Salle "${roomName}" réservée avec succès !` };
  } catch (error) {
    console.error('Erreur create meeting:', error);
    return { success: false, message: 'Erreur système lors de la réservation.' };
  }
}
