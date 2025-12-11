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

export async function findAvailableRooms(date: string, duration: number, options?: { capacity?: number; equipment?: string[]; roomName?: string }) {
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

    // Si une salle spécifique est demandée, la chercher en priorité
    let availableRooms = [];
    if (options?.roomName) {
      const specificRoom = rooms.find((r) => r.name.toLowerCase() === options?.roomName?.toLowerCase());
      if (specificRoom) {
        const hasConflict = await hasMeetingConflict(specificRoom.id, date, endDate.toISOString());
        if (!hasConflict) {
          availableRooms.push(specificRoom);
        }
      }
    }

    // Filtrer les salles : pas de conflit + critères optionnels
    // (Pour alternatives ou si salle spécifique non trouvée/indisponible)
    for (const room of rooms) {
      // Sauter la salle si elle a déjà été ajoutée (salle spécifique)
      if (availableRooms.some((r) => r.id === room.id)) continue;

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
        const hasAllEquipment = options.equipment.every((eq: string) =>
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
export async function findRoomByLocation(location: string): Promise<any | null> {
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

export async function createBooking(roomName: string, date: string, duration: number, userId?: string) {
  console.log(`Creating meeting for ${roomName} on ${date} for ${duration} minutes. UserId: ${userId}`);
  
  try {
    // Vérifier qu'un userId est fourni
    if (!userId) {
      return { success: false, message: 'Vous devez être connecté pour réserver.' };
    }

    // Récupérer l'ID de la salle par son nom
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id')
      .ilike('name', roomName)
      .single();

    if (roomError || !room) {
      return { success: false, message: `Salle "${roomName}" introuvable.` };
    }

    // Créer la réservation dans la table meetings
    // La date reçue est en heure locale de Paris (Europe/Paris timezone)
    // On doit la convertir en UTC pour stockage en base
    const localDate = new Date(date);
    
    // Créer une date UTC en soustrayant le décalage horaire de Paris
    // Obtenir le décalage horaire pour Paris (en minutes)
    const parisFormatter = new Intl.DateTimeFormat('fr-FR', {
      timeZone: 'Europe/Paris',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    
    const parts = parisFormatter.formatToParts(localDate);
    const parisDateStr = `${parts.find(p => p.type === 'year')?.value}-${parts.find(p => p.type === 'month')?.value}-${parts.find(p => p.type === 'day')?.value}T${parts.find(p => p.type === 'hour')?.value}:${parts.find(p => p.type === 'minute')?.value}:${parts.find(p => p.type === 'second')?.value}`;
    
    // Calculer le décalage entre heure locale et Paris timezone
    const utcDate = new Date(parisDateStr);
    const offset = localDate.getTime() - utcDate.getTime();
    const startDateUTC = new Date(localDate.getTime() - offset);
    const endDateUTC = new Date(startDateUTC.getTime() + duration * 60000);
    
    console.log(`📅 Dates: local=${localDate.toISOString()}, startUTC=${startDateUTC.toISOString()}, endUTC=${endDateUTC.toISOString()}, duration=${duration}min`);
    
    const { error: meetingError } = await supabase
      .from('meetings')
      .insert([
        {
          room_id: room.id,
          user_id: userId,
          title: 'Réunion réservée via chatbot',
          start_time: startDateUTC.toISOString(),
          end_time: endDateUTC.toISOString(),
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

// Fonction pour rechercher une réunion de l'utilisateur par entreprise/société
export async function findMeetingByCompany(company: string, userId?: string) {
  console.log(`Finding meeting for company: ${company}. UserId: ${userId}`);
  
  try {
    if (!userId) {
      return { found: false, message: 'Vous devez être connecté.' };
    }

    const today = new Date().toISOString();
    
    // Chercher une réunion de l'utilisateur aujourd'hui avec cette entreprise dans le titre
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        room_id,
        rooms(id, name, capacity, location, equipment)
      `)
      .eq('user_id', userId)
      .gte('start_time', today)
      .ilike('title', `%${company}%`)
      .limit(1);

    if (error) {
      console.error('Erreur recherche réunion par entreprise:', error);
      return { found: false, message: 'Erreur lors de la recherche.' };
    }

    if (!meetings || meetings.length === 0) {
      return { 
        found: false, 
        message: `Aucune réunion trouvée pour l'entreprise "${company}".` 
      };
    }

    const meeting = meetings[0];
    return {
      found: true,
      meeting: meeting,
      message: `Réunion trouvée pour ${company}`
    };
  } catch (error) {
    console.error('Erreur find meeting by company:', error);
    return { found: false, message: 'Erreur système.' };
  }
}

// Fonction pour mettre à jour une réunion
export async function updateMeeting(meetingId: string, updates: { start_time?: string; end_time?: string; title?: string }, userId?: string) {
  console.log(`Updating meeting ${meetingId}:`, updates);
  
  try {
    if (!userId) {
      return { success: false, message: 'Vous devez être connecté.' };
    }

    // Vérifier que la réunion appartient à l'utilisateur
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('room_id, user_id')
      .eq('id', meetingId)
      .single();

    if (fetchError || !meeting) {
      return { success: false, message: 'Réunion non trouvée.' };
    }

    if (meeting.user_id !== userId) {
      return { success: false, message: 'Vous ne pouvez modifier que vos propres réunions.' };
    }

    // Si les horaires changent, vérifier les conflits
    if (updates.start_time && updates.end_time) {
      // Exclure la réunion actuelle du test de conflit
      const { data: conflicts, error: conflictError } = await supabase
        .from('meetings')
        .select('id')
        .eq('room_id', meeting.room_id)
        .neq('id', meetingId)
        .or(`start_time.lt.${updates.end_time},end_time.gt.${updates.start_time}`)
        .limit(1);

      if (conflictError) {
        return { success: false, message: 'Erreur lors de la vérification des conflits.' };
      }

      if (conflicts && conflicts.length > 0) {
        return { success: false, message: 'Un conflit d\'horaire existe à ces nouvelles heures.' };
      }
    }

    // Effectuer la mise à jour
    const { error: updateError } = await supabase
      .from('meetings')
      .update(updates)
      .eq('id', meetingId);

    if (updateError) {
      console.error('Erreur mise à jour réunion:', updateError);
      return { success: false, message: 'Erreur lors de la mise à jour.' };
    }

    return { success: true, message: `Réunion mise à jour avec succès !` };
  } catch (error) {
    console.error('Erreur update meeting:', error);
    return { success: false, message: 'Erreur système lors de la mise à jour.' };
  }
}

// Fonction pour lister les réunions de l'utilisateur
export async function getUserMeetings(userId?: string) {
  console.log(`Fetching user meetings... UserId: ${userId}`);
  
  try {
    if (!userId) {
      return { meetings: [], message: 'Vous devez être connecté.' };
    }

    const today = new Date().toISOString();
    
    const { data: meetings, error } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        start_time,
        end_time,
        room_id,
        rooms(id, name, location)
      `)
      .eq('user_id', userId)
      .gte('start_time', today)
      .order('start_time', { ascending: true })
      .limit(10);

    if (error) {
      console.error('Erreur chargement réunions:', error);
      return { meetings: [], message: 'Erreur lors du chargement.' };
    }

    return { 
      meetings: meetings || [], 
      message: meetings && meetings.length > 0 ? 'Réunions trouvées' : 'Aucune réunion prévue'
    };
  } catch (error) {
    console.error('Erreur get user meetings:', error);
    return { meetings: [], message: 'Erreur système.' };
  }
}
