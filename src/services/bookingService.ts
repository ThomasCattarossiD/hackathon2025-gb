import { supabase } from '@/lib/supabaseClient';

// ==========================================
// TYPES
// ==========================================

interface Room {
  id: number;
  name: string;
  room_type: string;
  capacity: number;
  floor: number | null;
  location: string | null;
  description: string | null;
  equipment: string[];
  opening_time: string;
  closing_time: string;
  pmr_accessible: boolean;
}

interface AvailableSlot {
  startTime: string;
  endTime: string;
  dayName: string;
  dateFormatted: string;
  timeSlot: string;
  availableCount: number;
  conflictCount: number;
  availabilityPercent: number;
  // Room info for this slot
  room?: {
    id: number;
    name: string;
    capacity: number;
    location: string | null;
    equipment: string[];
  };
  isRecommended?: boolean;
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

async function hasMeetingConflict(roomId: number, startTime: string, endTime: string): Promise<boolean> {
  try {
    const { data: conflicts, error } = await supabase
      .from('meetings')
      .select('id')
      .eq('room_id', roomId)
      .lt('start_time', endTime)
      .gt('end_time', startTime)
      .limit(1);

    if (error) {
      console.error('Error checking conflict:', error);
      return false;
    }

    return conflicts && conflicts.length > 0;
  } catch (error) {
    console.error('Error in hasMeetingConflict:', error);
    return false;
  }
}

function calculateRelevanceScore(room: Room, filters: {
  capacity?: number;
  equipment?: string[];
  location?: string;
  name?: string;
}): number {
  let score = 0;

  if (filters.equipment && filters.equipment.length > 0) {
    const roomEquipment = room.equipment || [];
    for (const eq of filters.equipment) {
      if (roomEquipment.some(re => re.toLowerCase().includes(eq.toLowerCase()))) {
        score += 10;
      }
    }
  }

  if (filters.capacity) {
    const diff = room.capacity - filters.capacity;
    if (diff >= 0 && diff <= 2) {
      score += 5;
    } else if (diff > 2) {
      score += 2;
    }
  }

  if (filters.name && room.name.toLowerCase().includes(filters.name.toLowerCase())) {
    score += 3;
  }

  if (filters.location && room.location?.toLowerCase().includes(filters.location.toLowerCase())) {
    score += 2;
  }

  return score;
}

function formatRoomDisplay(room: Room): string {
  const equipmentList = room.equipment?.join(', ') || 'Aucun';
  const location = room.location || 'Non specifie';
  return `- **${room.name}** | ${room.capacity} pers | ${location}\n  Equipements: ${equipmentList}`;
}

function getDayName(date: Date): string {
  const days = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  return days[date.getDay()];
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

// ==========================================
// TOOL 1: findRoomsByCarac
// ==========================================

export interface FindRoomsParams {
  name?: string;
  minCapacity?: number;
  maxCapacity?: number;
  equipments?: string[];
  location?: string;
  startTime?: string;
  duration?: number;
  excludeRoomIds?: number[]; // IDs of rooms already refused by user
}

export interface FindRoomsResult {
  success: boolean;
  rooms: Room[];
  text: string;
  roomId?: number; // ID of the best room for easy access
  allRoomIds?: number[]; // All matching room IDs for fallback proposals
}

export async function findRoomsByCarac(params: FindRoomsParams): Promise<FindRoomsResult> {
  console.log('[findRoomsByCarac] Params:', params);

  try {
    let query = supabase.from('rooms').select('*');

    if (params.minCapacity) {
      query = query.gte('capacity', params.minCapacity);
    }

    if (params.maxCapacity) {
      query = query.lte('capacity', params.maxCapacity);
    }

    if (params.name) {
      query = query.ilike('name', `%${params.name}%`);
    }

    if (params.location) {
      query = query.ilike('location', `%${params.location}%`);
    }

    const { data: rooms, error } = await query;

    if (error) {
      console.error('Database error:', error);
      return {
        success: false,
        rooms: [],
        text: 'Erreur lors de la recherche des salles.'
      };
    }

    if (!rooms || rooms.length === 0) {
      return {
        success: false,
        rooms: [],
        text: 'Aucune salle ne correspond a ces criteres.'
      };
    }

    let filteredRooms = rooms as Room[];
    if (params.equipments && params.equipments.length > 0) {
      filteredRooms = rooms.filter(room => {
        const roomEquipment = room.equipment || [];
        return params.equipments!.every((eq: string) =>
          roomEquipment.some((re: string) => re.toLowerCase().includes(eq.toLowerCase()))
        );
      });
    }

    if (params.startTime && params.duration) {
      const startDate = new Date(params.startTime);
      const endDate = new Date(startDate.getTime() + params.duration * 60000);
      const endTimeISO = endDate.toISOString();

      const availableRooms: Room[] = [];
      for (const room of filteredRooms) {
        const hasConflict = await hasMeetingConflict(room.id, params.startTime, endTimeISO);
        if (!hasConflict) {
          availableRooms.push(room);
        }
      }
      filteredRooms = availableRooms;
    }

    // Exclude rooms already refused by user
    if (params.excludeRoomIds && params.excludeRoomIds.length > 0) {
      filteredRooms = filteredRooms.filter(room => !params.excludeRoomIds!.includes(room.id));
    }

    if (filteredRooms.length === 0) {
      return {
        success: false,
        rooms: [],
        text: 'Aucune autre salle disponible avec ces criteres.'
      };
    }

    filteredRooms.sort((a, b) => {
      const scoreA = calculateRelevanceScore(a, params);
      const scoreB = calculateRelevanceScore(b, params);
      return scoreB - scoreA;
    });

    // Store all room IDs for fallback proposals
    const allRoomIds = filteredRooms.map(r => r.id);

    // Return only the best room with a direct booking request
    const bestRoom = filteredRooms[0];
    const equipmentList = bestRoom.equipment?.join(', ') || 'Aucun';
    const location = bestRoom.location || 'Non specifie';
    
    // Format time info if provided
    let timeInfo = '';
    if (params.startTime && params.duration) {
      const startDate = new Date(params.startTime);
      const endDate = new Date(startDate.getTime() + params.duration * 60000);
      timeInfo = `\n📅 ${getDayName(startDate)} ${formatDate(startDate)}\n⏰ ${formatTime(startDate)} - ${formatTime(endDate)} (${params.duration} min)`;
    }

    const text = `✅ **${bestRoom.name}**
🆔 ID: ${bestRoom.id}
📍 ${location}
👥 Capacite: ${bestRoom.capacity} personnes
🛠️ Equipements: ${equipmentList}${timeInfo}

Souhaites-tu reserver cette salle ?`;

    console.log(`[findRoomsByCarac] Found ${filteredRooms.length} rooms, proposing best: ${bestRoom.name} (ID: ${bestRoom.id})`);

    return {
      success: true,
      rooms: [bestRoom], // Only return the best room with full data including ID
      text,
      roomId: bestRoom.id, // Explicitly return the room ID for easy access
      allRoomIds // All matching room IDs for fallback if user refuses
    };

  } catch (error) {
    console.error('Error in findRoomsByCarac:', error);
    return {
      success: false,
      rooms: [],
      text: 'Erreur systeme lors de la recherche.'
    };
  }
}

// ==========================================
// TOOL 2: proposeRoomToUser
// ==========================================

export interface ProposeRoomParams {
  roomId: number;
  startTime: string;
  duration: number;
}

export interface ProposeRoomResult {
  success: boolean;
  room: Room | null;
  text: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    roomId: number;
    roomName: string;
    startTime: string;
    duration: number;
  };
}

export async function proposeRoomToUser(params: ProposeRoomParams): Promise<ProposeRoomResult> {
  console.log('[proposeRoomToUser] Params:', params);

  try {
    const { data: room, error } = await supabase
      .from('rooms')
      .select('*')
      .eq('id', params.roomId)
      .single();

    if (error || !room) {
      console.error('Room not found:', error);
      return {
        success: false,
        room: null,
        text: 'Cette salle n\'existe pas.'
      };
    }

    const startDate = new Date(params.startTime);
    const endDate = new Date(startDate.getTime() + params.duration * 60000);

    const hasConflict = await hasMeetingConflict(room.id, params.startTime, endDate.toISOString());
    if (hasConflict) {
      return {
        success: false,
        room: room as Room,
        text: `**${room.name}** n'est pas disponible a cet horaire.`
      };
    }

    const equipmentList = room.equipment?.join(', ') || 'Aucun';
    const location = room.location || 'Non specifie';

    const text = `**${room.name}**

Date: ${formatDate(startDate)}
Horaire: ${formatTime(startDate)} a ${formatTime(endDate)} (${params.duration} min)
Lieu: ${location}
Capacite: ${room.capacity} personnes
Equipements: ${equipmentList}`;

    console.log(`[proposeRoomToUser] Room ${room.name} proposed`);

    return {
      success: true,
      room: room as Room,
      text,
      requiresConfirmation: true,
      confirmationData: {
        roomId: room.id,
        roomName: room.name,
        startTime: params.startTime,
        duration: params.duration
      }
    };

  } catch (error) {
    console.error('Error in proposeRoomToUser:', error);
    return {
      success: false,
      room: null,
      text: 'Erreur systeme lors de l\'affichage de la salle.'
    };
  }
}

// ==========================================
// TOOL 3: createMeeting
// ==========================================

export interface CreateMeetingParams {
  roomId: number;
  startTime: string;
  duration: number;
  title?: string;
  userId: string;
  attendeesCount?: number;
}

export interface CreateMeetingResult {
  success: boolean;
  meetingId: number | null;
  text: string;
}

export async function createMeeting(params: CreateMeetingParams): Promise<CreateMeetingResult> {
  console.log('[createMeeting] Params:', params);

  try {
    if (!params.userId) {
      return {
        success: false,
        meetingId: null,
        text: 'Vous devez etre connecte pour reserver une salle.'
      };
    }

    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('id, name')
      .eq('id', params.roomId)
      .single();

    if (roomError || !room) {
      return {
        success: false,
        meetingId: null,
        text: 'Salle introuvable.'
      };
    }

    const startDate = new Date(params.startTime);
    const endDate = new Date(startDate.getTime() + params.duration * 60000);

    const hasConflict = await hasMeetingConflict(room.id, params.startTime, endDate.toISOString());
    if (hasConflict) {
      return {
        success: false,
        meetingId: null,
        text: `**${room.name}** n'est plus disponible a cet horaire.`
      };
    }

    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert([{
        room_id: room.id,
        user_id: params.userId,
        title: params.title || 'Reunion',
        start_time: startDate.toISOString(),
        end_time: endDate.toISOString(),
        attendees_count: params.attendeesCount || 1,
        status: 'confirmed'
      }])
      .select('id')
      .single();

    if (meetingError || !meeting) {
      console.error('Error creating meeting:', meetingError);
      return {
        success: false,
        meetingId: null,
        text: 'Erreur lors de la creation de la reservation.'
      };
    }

    const text = `**Reservation confirmee!**

Date: ${formatDate(startDate)}
Horaire: ${formatTime(startDate)} a ${formatTime(endDate)}
Salle: **${room.name}**

Votre reunion est reservee!`;

    console.log(`[createMeeting] Meeting ${meeting.id} created for room ${room.name}`);

    return {
      success: true,
      meetingId: meeting.id,
      text
    };

  } catch (error) {
    console.error('Error in createMeeting:', error);
    return {
      success: false,
      meetingId: null,
      text: 'Erreur systeme lors de la reservation.'
    };
  }
}

// ==========================================
// TOOL 4: findTeamAvailability
// ==========================================

export interface FindTeamAvailabilityParams {
  teamSize: number;
  dateRange: string;
  duration?: number;
  minAvailability?: number;
  equipmentNeeded?: string[];
  society?: string;
}

export interface FindTeamAvailabilityResult {
  success: boolean;
  slots: AvailableSlot[];
  teamSize: number;
  period: string;
  text: string;
}

export async function findTeamAvailability(params: FindTeamAvailabilityParams): Promise<FindTeamAvailabilityResult> {
  console.log('[findTeamAvailability] Params:', params);

  const duration = params.duration || 60;
  const minAvailability = params.minAvailability || 70;

  try {
    // Parse date range
    const today = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (params.dateRange.toLowerCase()) {
      case 'tomorrow':
      case 'demain':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() + 1);
        startDate.setHours(8, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(18, 0, 0, 0);
        break;

      case 'this-week':
      case 'cette semaine':
        startDate = new Date(today);
        startDate.setHours(8, 0, 0, 0);
        endDate = new Date(today);
        endDate.setDate(endDate.getDate() + (7 - endDate.getDay()));
        endDate.setHours(18, 0, 0, 0);
        break;

      case 'next-week':
      case 'semaine prochaine':
        startDate = new Date(today);
        startDate.setDate(startDate.getDate() + (8 - startDate.getDay()));
        startDate.setHours(8, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + 4);
        endDate.setHours(18, 0, 0, 0);
        break;

      default:
        if (params.dateRange.includes(' to ')) {
          const [start, end] = params.dateRange.split(' to ');
          startDate = new Date(start);
          startDate.setHours(8, 0, 0, 0);
          endDate = new Date(end);
          endDate.setHours(18, 0, 0, 0);
        } else {
          startDate = new Date(params.dateRange);
          startDate.setHours(8, 0, 0, 0);
          endDate = new Date(startDate);
          endDate.setHours(18, 0, 0, 0);
        }
    }

    // Get team members
    let userQuery = supabase.from('users').select('id');
    if (params.society) {
      userQuery = userQuery.eq('society', params.society);
    }
    userQuery = userQuery.eq('is_active', true).limit(params.teamSize);

    const { data: users, error: usersError } = await userQuery;

    if (usersError) {
      console.error('Error fetching users:', usersError);
      return {
        success: false,
        slots: [],
        teamSize: params.teamSize,
        period: params.dateRange,
        text: 'Erreur lors de la recherche des membres de l\'equipe.'
      };
    }

    const userIds = users?.map(u => u.id) || [];
    const actualTeamSize = userIds.length > 0 ? userIds.length : params.teamSize;

    console.log(`[findTeamAvailability] Found ${userIds.length} team members`);

    // Find all available slots
    const slots: AvailableSlot[] = [];
    const currentSlot = new Date(startDate);

    while (currentSlot < endDate) {
      const slotStart = new Date(currentSlot);
      const slotEnd = new Date(slotStart.getTime() + duration * 60000);

      // Skip outside business hours
      if (slotStart.getHours() < 8 || slotStart.getHours() >= 18) {
        currentSlot.setHours(currentSlot.getHours() + 1);
        continue;
      }

      // Skip weekends
      if (slotStart.getDay() === 0 || slotStart.getDay() === 6) {
        currentSlot.setDate(currentSlot.getDate() + 1);
        currentSlot.setHours(8, 0, 0, 0);
        continue;
      }

      // Check team conflicts
      let conflictCount = 0;
      if (userIds.length > 0) {
        const { data: conflicts, error: conflictError } = await supabase
          .from('meetings')
          .select('user_id')
          .in('user_id', userIds)
          .lt('start_time', slotEnd.toISOString())
          .gt('end_time', slotStart.toISOString());

        if (!conflictError && conflicts) {
          const uniqueConflicts = new Set(conflicts.map(c => c.user_id));
          conflictCount = uniqueConflicts.size;
        }
      }

      const availableCount = actualTeamSize - conflictCount;
      const availabilityPercent = Math.round((availableCount / actualTeamSize) * 100);

      if (availabilityPercent >= minAvailability) {
        slots.push({
          startTime: slotStart.toISOString(),
          endTime: slotEnd.toISOString(),
          dayName: getDayName(slotStart),
          dateFormatted: formatDate(slotStart),
          timeSlot: `${formatTime(slotStart)}-${formatTime(slotEnd)}`,
          availableCount,
          conflictCount,
          availabilityPercent
        });
      }

      currentSlot.setHours(currentSlot.getHours() + 1);
    }

    // Sort by availability and take top 3
    slots.sort((a, b) => {
      // First by availability percent
      if (b.availabilityPercent !== a.availabilityPercent) {
        return b.availabilityPercent - a.availabilityPercent;
      }
      // Then by earliest date
      return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
    });

    const topSlots = slots.slice(0, 3);

    if (topSlots.length === 0) {
      return {
        success: false,
        slots: [],
        teamSize: actualTeamSize,
        period: params.dateRange,
        text: `Aucun creneau trouve avec au moins ${minAvailability}% de disponibilite pour l'equipe de ${actualTeamSize} personnes.`
      };
    }

    // For each slot, find the best available room
    for (let i = 0; i < topSlots.length; i++) {
      const slot = topSlots[i];
      
      // Build room query
      let roomQuery = supabase
        .from('rooms')
        .select('*')
        .gte('capacity', params.teamSize);

      const { data: rooms, error: roomError } = await roomQuery;

      if (roomError || !rooms || rooms.length === 0) {
        continue;
      }

      // Filter by equipment if needed
      let filteredRooms = rooms as Room[];
      if (params.equipmentNeeded && params.equipmentNeeded.length > 0) {
        filteredRooms = rooms.filter(room => {
          const roomEquipment = room.equipment || [];
          return params.equipmentNeeded!.every((eq: string) =>
            roomEquipment.some((re: string) => re.toLowerCase().includes(eq.toLowerCase()))
          );
        });
      }

      // Check room availability for this slot
      const availableRooms: Room[] = [];
      for (const room of filteredRooms) {
        const hasConflict = await hasMeetingConflict(room.id, slot.startTime, slot.endTime);
        if (!hasConflict) {
          availableRooms.push(room);
        }
      }

      if (availableRooms.length > 0) {
        // Sort by best fit (closest capacity to team size)
        availableRooms.sort((a, b) => {
          const diffA = a.capacity - params.teamSize;
          const diffB = b.capacity - params.teamSize;
          return diffA - diffB;
        });

        const bestRoom = availableRooms[0];
        slot.room = {
          id: bestRoom.id,
          name: bestRoom.name,
          capacity: bestRoom.capacity,
          location: bestRoom.location,
          equipment: bestRoom.equipment || []
        };
      }

      // Mark first slot as recommended
      if (i === 0) {
        slot.isRecommended = true;
      }
    }

    // Build response text
    const slotsText = topSlots.map((slot, index) => {
      const recommended = slot.isRecommended ? ' ⭐ RECOMMANDEE' : '';
      const roomInfo = slot.room 
        ? `\n   🏛️ Salle: **${slot.room.name}** (${slot.room.capacity} places)\n   🛠️ ${slot.room.equipment.join(', ') || 'Aucun equipement'}`
        : '\n   ⚠️ Aucune salle disponible pour ce creneau';

      return `📅 **Option ${index + 1}${recommended}**
   🕐 ${slot.dayName} ${slot.dateFormatted}, ${slot.timeSlot}
   👥 ${slot.availableCount}/${actualTeamSize} personnes disponibles (${slot.availabilityPercent}%)${roomInfo}`;
    }).join('\n\n');

    const text = `Voici les ${topSlots.length} meilleurs creneaux pour votre reunion d'equipe de ${actualTeamSize} personnes:\n\n${slotsText}\n\nQuelle option vous convient?`;

    console.log(`[findTeamAvailability] Found ${topSlots.length} slots with rooms`);

    return {
      success: true,
      slots: topSlots,
      teamSize: actualTeamSize,
      period: params.dateRange,
      text
    };

  } catch (error) {
    console.error('Error in findTeamAvailability:', error);
    return {
      success: false,
      slots: [],
      teamSize: params.teamSize,
      period: params.dateRange,
      text: 'Erreur systeme lors de l\'analyse des disponibilites.'
    };
  }
}

// ==========================================
// DELETE MEETING
// ==========================================

export interface DeleteMeetingResult {
  success: boolean;
  message: string;
}

export async function deleteMeeting(meetingId: number, userId: string): Promise<DeleteMeetingResult> {
  console.log(`[deleteMeeting] meetingId: ${meetingId}, userId: ${userId}`);

  try {
    // First verify the meeting belongs to the user
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select('id, user_id')
      .eq('id', meetingId)
      .single();

    if (fetchError || !meeting) {
      return {
        success: false,
        message: 'Réunion introuvable.'
      };
    }

    if (meeting.user_id !== userId) {
      return {
        success: false,
        message: 'Vous ne pouvez supprimer que vos propres réunions.'
      };
    }

    // Delete the meeting
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', meetingId);

    if (deleteError) {
      console.error('Error deleting meeting:', deleteError);
      return {
        success: false,
        message: 'Erreur lors de la suppression.'
      };
    }

    console.log(`[deleteMeeting] Meeting ${meetingId} deleted successfully`);

    return {
      success: true,
      message: 'Réunion supprimée avec succès.'
    };

  } catch (error) {
    console.error('Error in deleteMeeting:', error);
    return {
      success: false,
      message: 'Erreur système lors de la suppression.'
    };
  }
}

// ==========================================
// TOOL: getUserMeetings
// Get user's upcoming meetings for modification/cancellation
// ==========================================

export interface GetUserMeetingsParams {
  userId: string;
  includeHistory?: boolean; // Include past meetings
}

export interface UserMeeting {
  id: number;
  title: string;
  roomId: number;
  roomName: string;
  startTime: string;
  endTime: string;
  duration: number;
  dateFormatted: string;
  timeFormatted: string;
}

export interface GetUserMeetingsResult {
  success: boolean;
  meetings: UserMeeting[];
  text: string;
}

export async function getUserMeetings(params: GetUserMeetingsParams): Promise<GetUserMeetingsResult> {
  console.log('[getUserMeetings] Params:', params);

  try {
    const now = new Date().toISOString();
    
    let query = supabase
      .from('meetings')
      .select(`
        id,
        title,
        room_id,
        start_time,
        end_time,
        rooms(name)
      `)
      .eq('user_id', params.userId)
      .order('start_time', { ascending: true })
      .limit(10);

    // By default, only future meetings
    if (!params.includeHistory) {
      query = query.gte('start_time', now);
    }

    const { data: meetings, error } = await query;

    if (error) {
      console.error('Error fetching user meetings:', error);
      return {
        success: false,
        meetings: [],
        text: 'Erreur lors de la récupération de vos réunions.'
      };
    }

    if (!meetings || meetings.length === 0) {
      return {
        success: true,
        meetings: [],
        text: 'Vous n\'avez aucune réunion à venir.'
      };
    }

    const formattedMeetings: UserMeeting[] = meetings.map((m: any) => {
      const start = new Date(m.start_time);
      const end = new Date(m.end_time);
      const duration = Math.round((end.getTime() - start.getTime()) / 60000);

      return {
        id: m.id,
        title: m.title || 'Réunion',
        roomId: m.room_id,
        roomName: m.rooms?.name || 'Salle inconnue',
        startTime: m.start_time,
        endTime: m.end_time,
        duration,
        dateFormatted: start.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Paris'
        }),
        timeFormatted: `${start.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })} - ${end.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`
      };
    });

    // Build text response
    let text = `**Vos ${formattedMeetings.length} prochaine(s) réunion(s) :**\n\n`;
    formattedMeetings.forEach((m, idx) => {
      text += `${idx + 1}. **${m.title}** (ID: ${m.id})\n`;
      text += `   📅 ${m.dateFormatted}\n`;
      text += `   🕐 ${m.timeFormatted} (${m.duration} min)\n`;
      text += `   📍 ${m.roomName}\n\n`;
    });

    text += `\nQue souhaitez-vous faire ? (modifier l'horaire, changer de salle, annuler)`;

    console.log(`[getUserMeetings] Found ${formattedMeetings.length} meetings`);

    return {
      success: true,
      meetings: formattedMeetings,
      text
    };

  } catch (error) {
    console.error('Error in getUserMeetings:', error);
    return {
      success: false,
      meetings: [],
      text: 'Erreur système lors de la récupération des réunions.'
    };
  }
}

// ==========================================
// TOOL: updateMeeting
// Modify an existing meeting (time, room, title)
// ==========================================

export interface UpdateMeetingParams {
  meetingId: number;
  userId: string;
  newStartTime?: string;
  newDuration?: number;
  newRoomId?: number;
  newTitle?: string;
}

export interface UpdateMeetingResult {
  success: boolean;
  text: string;
  updatedMeeting?: {
    id: number;
    title: string;
    roomName: string;
    startTime: string;
    endTime: string;
  };
}

export async function updateMeeting(params: UpdateMeetingParams): Promise<UpdateMeetingResult> {
  console.log('[updateMeeting] Params:', params);

  try {
    // First fetch the existing meeting
    const { data: existingMeeting, error: fetchError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        room_id,
        start_time,
        end_time,
        user_id,
        rooms(name)
      `)
      .eq('id', params.meetingId)
      .single();

    if (fetchError || !existingMeeting) {
      return {
        success: false,
        text: `Réunion #${params.meetingId} introuvable.`
      };
    }

    // Verify ownership
    if (existingMeeting.user_id !== params.userId) {
      return {
        success: false,
        text: 'Vous ne pouvez modifier que vos propres réunions.'
      };
    }

    // Calculate new values
    const currentStart = new Date(existingMeeting.start_time);
    const currentEnd = new Date(existingMeeting.end_time);
    const currentDuration = Math.round((currentEnd.getTime() - currentStart.getTime()) / 60000);

    const newStartTime = params.newStartTime ? new Date(params.newStartTime) : currentStart;
    const newDuration = params.newDuration || currentDuration;
    const newEndTime = new Date(newStartTime.getTime() + newDuration * 60000);
    const newRoomId = params.newRoomId || existingMeeting.room_id;
    const newTitle = params.newTitle || existingMeeting.title;

    // Check for conflicts if time or room changed
    if (params.newStartTime || params.newRoomId) {
      const hasConflict = await hasMeetingConflict(
        newRoomId, 
        newStartTime.toISOString(), 
        newEndTime.toISOString()
      );

      // Exclude current meeting from conflict check
      const { data: conflictingMeetings } = await supabase
        .from('meetings')
        .select('id')
        .eq('room_id', newRoomId)
        .neq('id', params.meetingId)
        .lt('start_time', newEndTime.toISOString())
        .gt('end_time', newStartTime.toISOString())
        .limit(1);

      if (conflictingMeetings && conflictingMeetings.length > 0) {
        return {
          success: false,
          text: `Ce créneau n'est pas disponible. La salle est déjà réservée.`
        };
      }
    }

    // Get new room name if room changed
    let newRoomName = (existingMeeting.rooms as any)?.name || 'Salle';
    if (params.newRoomId && params.newRoomId !== existingMeeting.room_id) {
      const { data: newRoom } = await supabase
        .from('rooms')
        .select('name')
        .eq('id', params.newRoomId)
        .single();
      
      if (newRoom) {
        newRoomName = newRoom.name;
      }
    }

    // Update the meeting
    const { error: updateError } = await supabase
      .from('meetings')
      .update({
        title: newTitle,
        room_id: newRoomId,
        start_time: newStartTime.toISOString(),
        end_time: newEndTime.toISOString()
      })
      .eq('id', params.meetingId);

    if (updateError) {
      console.error('Error updating meeting:', updateError);
      return {
        success: false,
        text: 'Erreur lors de la modification de la réunion.'
      };
    }

    // Build success message
    const changes: string[] = [];
    if (params.newStartTime) {
      changes.push(`nouvel horaire: ${newStartTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} à ${newStartTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })}`);
    }
    if (params.newDuration) {
      changes.push(`nouvelle durée: ${newDuration} minutes`);
    }
    if (params.newRoomId && params.newRoomId !== existingMeeting.room_id) {
      changes.push(`nouvelle salle: ${newRoomName}`);
    }
    if (params.newTitle && params.newTitle !== existingMeeting.title) {
      changes.push(`nouveau titre: ${newTitle}`);
    }

    const text = `✅ **Réunion modifiée avec succès !**

**${newTitle}**
📅 ${newStartTime.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })}
🕐 ${newStartTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })} - ${newEndTime.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })} (${newDuration} min)
📍 ${newRoomName}

Modifications: ${changes.join(', ')}`;

    console.log(`[updateMeeting] Meeting ${params.meetingId} updated successfully`);

    return {
      success: true,
      text,
      updatedMeeting: {
        id: params.meetingId,
        title: newTitle,
        roomName: newRoomName,
        startTime: newStartTime.toISOString(),
        endTime: newEndTime.toISOString()
      }
    };

  } catch (error) {
    console.error('Error in updateMeeting:', error);
    return {
      success: false,
      text: 'Erreur système lors de la modification.'
    };
  }
}

// ==========================================
// TOOL: cancelMeeting
// Cancel/delete a meeting via chat
// ==========================================

export interface CancelMeetingParams {
  meetingId: number;
  userId: string;
}

export interface CancelMeetingResult {
  success: boolean;
  text: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    meetingId: number;
    meetingTitle: string;
    action: 'cancel';
  };
}

export async function cancelMeeting(params: CancelMeetingParams): Promise<CancelMeetingResult> {
  console.log('[cancelMeeting] Params:', params);

  try {
    // First fetch the meeting details for confirmation
    const { data: meeting, error: fetchError } = await supabase
      .from('meetings')
      .select(`
        id,
        title,
        room_id,
        start_time,
        end_time,
        user_id,
        rooms(name)
      `)
      .eq('id', params.meetingId)
      .single();

    if (fetchError || !meeting) {
      return {
        success: false,
        text: `Réunion #${params.meetingId} introuvable.`
      };
    }

    // Verify ownership
    if (meeting.user_id !== params.userId) {
      return {
        success: false,
        text: 'Vous ne pouvez annuler que vos propres réunions.'
      };
    }

    // Delete the meeting
    const { error: deleteError } = await supabase
      .from('meetings')
      .delete()
      .eq('id', params.meetingId);

    if (deleteError) {
      console.error('Error canceling meeting:', deleteError);
      return {
        success: false,
        text: 'Erreur lors de l\'annulation de la réunion.'
      };
    }

    const startDate = new Date(meeting.start_time);
    const roomName = (meeting.rooms as any)?.name || 'Salle';

    const text = `✅ **Réunion annulée avec succès !**

La réunion **"${meeting.title || 'Réunion'}"** du ${startDate.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })} à ${startDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })} (${roomName}) a été annulée.`;

    console.log(`[cancelMeeting] Meeting ${params.meetingId} canceled successfully`);

    return {
      success: true,
      text
    };

  } catch (error) {
    console.error('Error in cancelMeeting:', error);
    return {
      success: false,
      text: 'Erreur système lors de l\'annulation.'
    };
  }
}

// ==========================================
// TOOL: findInstantRoom
// Express booking - find a room available RIGHT NOW
// ==========================================

export interface FindInstantRoomParams {
  minCapacity?: number;
  duration?: number; // in minutes, default 30
  equipments?: string[];
}

export interface InstantRoomOption {
  room: {
    id: number;
    name: string;
    capacity: number;
    location: string | null;
    equipment: string[];
  };
  availableUntil: string; // ISO datetime
  availableMinutes: number;
}

export interface FindInstantRoomResult {
  success: boolean;
  instantRooms: InstantRoomOption[];
  text: string;
  requiresConfirmation?: boolean;
  confirmationData?: {
    roomId: number;
    roomName: string;
    startTime: string;
    duration: number;
  };
}

export async function findInstantRoom(params: FindInstantRoomParams): Promise<FindInstantRoomResult> {
  console.log('[findInstantRoom] Params:', params);

  try {
    const now = new Date();
    const requestedDuration = params.duration || 30;
    
    // Round to next 5 minutes for cleaner start time
    const minutes = now.getMinutes();
    const roundedMinutes = Math.ceil(minutes / 5) * 5;
    now.setMinutes(roundedMinutes, 0, 0);
    
    const startTime = now.toISOString();
    const endTime = new Date(now.getTime() + requestedDuration * 60000).toISOString();

    // Get all active rooms
    let query = supabase
      .from('rooms')
      .select('*');

    if (params.minCapacity) {
      query = query.gte('capacity', params.minCapacity);
    }

    const { data: rooms, error: roomsError } = await query;

    if (roomsError || !rooms || rooms.length === 0) {
      return {
        success: false,
        instantRooms: [],
        text: 'Aucune salle disponible ne correspond à vos critères.'
      };
    }

    // Filter by equipment if specified
    let filteredRooms = rooms;
    if (params.equipments && params.equipments.length > 0) {
      filteredRooms = rooms.filter(room => {
        const roomEquipment = room.equipment || [];
        return params.equipments!.every(eq =>
          roomEquipment.some((re: string) => re.toLowerCase().includes(eq.toLowerCase()))
        );
      });
    }

    if (filteredRooms.length === 0) {
      return {
        success: false,
        instantRooms: [],
        text: 'Aucune salle avec les équipements demandés n\'est disponible.'
      };
    }

    // Check availability for each room
    const availableRooms: InstantRoomOption[] = [];

    for (const room of filteredRooms) {
      // Get next meeting in this room (after now)
      const { data: nextMeetings } = await supabase
        .from('meetings')
        .select('start_time')
        .eq('room_id', room.id)
        .gt('start_time', startTime)
        .order('start_time', { ascending: true })
        .limit(1);

      // Check if room is currently occupied
      const { data: currentMeetings } = await supabase
        .from('meetings')
        .select('id, end_time')
        .eq('room_id', room.id)
        .lte('start_time', startTime)
        .gt('end_time', startTime)
        .limit(1);

      // Skip if room is currently in use
      if (currentMeetings && currentMeetings.length > 0) {
        continue;
      }

      // Calculate available time
      let availableUntil: Date;
      if (nextMeetings && nextMeetings.length > 0) {
        availableUntil = new Date(nextMeetings[0].start_time);
      } else {
        // No future meetings, assume available until end of day (18h)
        availableUntil = new Date(now);
        availableUntil.setHours(18, 0, 0, 0);
      }

      const availableMinutes = Math.floor((availableUntil.getTime() - now.getTime()) / 60000);

      // Only include if available for at least the requested duration
      if (availableMinutes >= requestedDuration) {
        availableRooms.push({
          room: {
            id: room.id,
            name: room.name,
            capacity: room.capacity,
            location: room.location,
            equipment: room.equipment || []
          },
          availableUntil: availableUntil.toISOString(),
          availableMinutes
        });
      }
    }

    if (availableRooms.length === 0) {
      return {
        success: false,
        instantRooms: [],
        text: `Aucune salle n'est disponible immédiatement pour ${requestedDuration} minutes. Essayez une durée plus courte ou réservez pour plus tard.`
      };
    }

    // Sort by capacity (prefer smaller rooms to not waste space) and availability
    availableRooms.sort((a, b) => {
      // Then prefer smaller capacity
      return a.room.capacity - b.room.capacity;
    });

    // Take top 3
    const topRooms = availableRooms.slice(0, 3);
    const bestRoom = topRooms[0];

    // Format time display
    const startDisplay = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });
    const endDisplay = new Date(now.getTime() + requestedDuration * 60000).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

    let text = `🚀 **Réservation Express**\n\n`;
    text += `**${bestRoom.room.name}** est disponible maintenant !\n\n`;
    text += `📍 ${bestRoom.room.location || 'Non spécifié'}\n`;
    text += `👥 Capacité: ${bestRoom.room.capacity} personnes\n`;
    text += `🕐 Créneau: ${startDisplay} - ${endDisplay} (${requestedDuration} min)\n`;
    text += `⏰ Disponible encore ${bestRoom.availableMinutes} minutes\n`;
    
    if (bestRoom.room.equipment.length > 0) {
      text += `🔧 ${bestRoom.room.equipment.join(', ')}\n`;
    }

    if (topRooms.length > 1) {
      text += `\n**Autres options :**\n`;
      topRooms.slice(1).forEach((option, idx) => {
        text += `${idx + 2}. ${option.room.name} (${option.room.capacity} pers, dispo ${option.availableMinutes} min)\n`;
      });
    }

    console.log(`[findInstantRoom] Found ${availableRooms.length} available rooms, recommending ${bestRoom.room.name}`);

    return {
      success: true,
      instantRooms: topRooms,
      text,
      requiresConfirmation: true,
      confirmationData: {
        roomId: bestRoom.room.id,
        roomName: bestRoom.room.name,
        startTime: startTime,
        duration: requestedDuration
      }
    };

  } catch (error) {
    console.error('Error in findInstantRoom:', error);
    return {
      success: false,
      instantRooms: [],
      text: 'Erreur système lors de la recherche de salle.'
    };
  }
}

// ==========================================
// TOOL: createRecurringMeeting
// Create recurring meetings (weekly, daily, etc.)
// ==========================================

export type RecurrencePattern = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface CreateRecurringMeetingParams {
  roomId: number;
  title: string;
  startTime: string; // ISO datetime for first occurrence
  duration: number; // minutes
  userId: string;
  recurrencePattern: RecurrencePattern;
  occurrences: number; // number of meetings to create (max 12)
  weekDays?: number[]; // For weekly: 0=Sunday, 1=Monday, etc. If not provided, uses the day of startTime
}

export interface RecurringMeetingResult {
  success: boolean;
  text: string;
  createdMeetings: {
    id: number;
    date: string;
    time: string;
  }[];
  failedDates: string[];
}

export async function createRecurringMeeting(params: CreateRecurringMeetingParams): Promise<RecurringMeetingResult> {
  console.log('[createRecurringMeeting] Params:', params);

  try {
    const { roomId, title, startTime, duration, userId, recurrencePattern, occurrences, weekDays } = params;

    // Limit occurrences to prevent abuse
    const maxOccurrences = Math.min(occurrences, 12);

    // Get room info
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('name')
      .eq('id', roomId)
      .single();

    if (roomError || !room) {
      return {
        success: false,
        text: 'Salle introuvable.',
        createdMeetings: [],
        failedDates: []
      };
    }

    // Generate all occurrence dates
    const occurrenceDates: Date[] = [];
    const firstDate = new Date(startTime);
    const startHour = firstDate.getHours();
    const startMinute = firstDate.getMinutes();

    for (let i = 0; i < maxOccurrences; i++) {
      const date = new Date(firstDate);

      switch (recurrencePattern) {
        case 'daily':
          date.setDate(firstDate.getDate() + i);
          break;
        case 'weekly':
          date.setDate(firstDate.getDate() + (i * 7));
          break;
        case 'biweekly':
          date.setDate(firstDate.getDate() + (i * 14));
          break;
        case 'monthly':
          date.setMonth(firstDate.getMonth() + i);
          break;
      }

      // Ensure same time (handles DST)
      date.setHours(startHour, startMinute, 0, 0);

      // Skip weekends for business meetings
      const dayOfWeek = date.getDay();
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        // Move to Monday if weekend
        const daysToAdd = dayOfWeek === 0 ? 1 : 2;
        date.setDate(date.getDate() + daysToAdd);
      }

      occurrenceDates.push(date);
    }

    // Create meetings and track results
    const createdMeetings: { id: number; date: string; time: string }[] = [];
    const failedDates: string[] = [];

    for (const occurrenceDate of occurrenceDates) {
      const meetingStartTime = occurrenceDate.toISOString();
      const meetingEndTime = new Date(occurrenceDate.getTime() + duration * 60000).toISOString();

      // Check for conflicts
      const hasConflict = await hasMeetingConflict(roomId, meetingStartTime, meetingEndTime);

      if (hasConflict) {
        failedDates.push(occurrenceDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'Europe/Paris'
        }));
        continue;
      }

      // Create meeting
      const { data: meeting, error: createError } = await supabase
        .from('meetings')
        .insert({
          room_id: roomId,
          user_id: userId,
          title: title,
          start_time: meetingStartTime,
          end_time: meetingEndTime,
        })
        .select('id')
        .single();

      if (createError || !meeting) {
        failedDates.push(occurrenceDate.toLocaleDateString('fr-FR', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          timeZone: 'Europe/Paris'
        }));
        continue;
      }

      createdMeetings.push({
        id: meeting.id,
        date: occurrenceDate.toLocaleDateString('fr-FR', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          timeZone: 'Europe/Paris'
        }),
        time: occurrenceDate.toLocaleTimeString('fr-FR', {
          hour: '2-digit',
          minute: '2-digit',
          timeZone: 'Europe/Paris'
        })
      });
    }

    // Build response text
    const patternText = {
      daily: 'quotidienne',
      weekly: 'hebdomadaire',
      biweekly: 'bimensuelle',
      monthly: 'mensuelle'
    }[recurrencePattern];

    if (createdMeetings.length === 0) {
      return {
        success: false,
        text: `❌ Impossible de créer la série de réunions. Tous les créneaux sont déjà occupés.`,
        createdMeetings: [],
        failedDates
      };
    }

    let text = `✅ **Série ${patternText} créée avec succès !**\n\n`;
    text += `**${title}**\n`;
    text += `📍 ${room.name}\n`;
    text += `⏱️ ${duration} minutes\n\n`;
    text += `**${createdMeetings.length} réunion(s) créée(s) :**\n`;

    createdMeetings.forEach((m, idx) => {
      text += `${idx + 1}. ${m.date} à ${m.time}\n`;
    });

    if (failedDates.length > 0) {
      text += `\n⚠️ **${failedDates.length} créneau(x) non disponible(s) :**\n`;
      text += failedDates.join(', ');
    }

    console.log(`[createRecurringMeeting] Created ${createdMeetings.length} meetings, ${failedDates.length} conflicts`);

    return {
      success: true,
      text,
      createdMeetings,
      failedDates
    };

  } catch (error) {
    console.error('Error in createRecurringMeeting:', error);
    return {
      success: false,
      text: 'Erreur système lors de la création de la série.',
      createdMeetings: [],
      failedDates: []
    };
  }
}
