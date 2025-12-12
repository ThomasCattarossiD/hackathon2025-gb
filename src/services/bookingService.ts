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
Equipements: ${equipmentList}

Souhaitez-vous reserver cette salle?`;

    console.log(`[proposeRoomToUser] Room ${room.name} proposed`);

    return {
      success: true,
      room: room as Room,
      text
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
// HELPER: Get user's meetings
// ==========================================

export async function getUserMeetings(userId: string) {
  console.log(`[getUserMeetings] userId: ${userId}`);

  try {
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
      console.error('Error fetching meetings:', error);
      return { meetings: [], message: 'Erreur lors du chargement des reunions.' };
    }

    return {
      meetings: meetings || [],
      message: meetings && meetings.length > 0 
        ? `${meetings.length} reunion(s) a venir` 
        : 'Aucune reunion prevue'
    };

  } catch (error) {
    console.error('Error in getUserMeetings:', error);
    return { meetings: [], message: 'Erreur systeme.' };
  }
}
