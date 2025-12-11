import { supabase } from '@/lib/supabaseClient';
import { addMinutes, parseISO, isBefore, isAfter } from 'date-fns';

// --- FONCTION 1 : VÉRIFIER LA DISPONIBILITÉ ---
export async function findAvailableRooms(startIso: string, durationMinutes: number) {
  const startDate = parseISO(startIso);
  const endDate = addMinutes(startDate, durationMinutes);

  console.log(`🔍 Recherche de ${startDate.toISOString()} à ${endDate.toISOString()}`);

  // 1. On récupère TOUTES les réservations qui chevauchent ce créneau
  // Logique : Une réunion gêne si elle commence AVANT ma fin ET finit APRÈS mon début.
  const { data: conflicts, error } = await supabase
    .from('bookings')
    .select('room_id')
    .lt('start_time', endDate.toISOString()) // Commence avant que je finisse
    .gt('end_time', startDate.toISOString()); // Finit après que je commence

  if (error) {
    console.error("Erreur check conflit:", error);
    return [];
  }

  // 2. On liste les ID des salles occupées
  const occupiedRoomIds = conflicts.map(b => b.room_id);

  // 3. On récupère les salles qui NE SONT PAS dans la liste des occupées
  let query = supabase.from('rooms').select('*');
  
  if (occupiedRoomIds.length > 0) {
    query = query.not('id', 'in', `(${occupiedRoomIds.join(',')})`);
  }

  const { data: freeRooms } = await query;
  
  return freeRooms || [];
}

// --- FONCTION 2 : CRÉER UNE RÉSERVATION ---
export async function createBooking(roomName: string, startIso: string, durationMinutes: number) {
  // 1. Trouver l'ID de la salle à partir du nom
  const { data: room } = await supabase
    .from('rooms')
    .select('id')
    .ilike('name', roomName)
    .single();

  if (!room) return { success: false, message: `Salle '${roomName}' introuvable.` };

  // 2. Calculer la fin
  const startDate = parseISO(startIso);
  const endDate = addMinutes(startDate, durationMinutes);

  // 3. (Optionnel mais recommandé) Re-vérifier le conflit juste avant d'insérer (Double sécu)
  
  // 4. Insérer
  // Note: user_id est mis en dur pour le MVP si tu n'as pas encore fait l'Auth complète
  // Idéalement : await supabase.auth.getUser()
  const { error } = await supabase
    .from('bookings')
    .insert({
      room_id: room.id,
      start_time: startDate.toISOString(),
      end_time: endDate.toISOString(),
      title: 'Réservation via Agent IA',
      user_id: 'met-ici-un-uuid-valide-de-ta-table-users-pour-tester' 
    });

  if (error) {
    console.error("Erreur insert:", error);
    return { success: false, message: "Erreur technique lors de la réservation." };
  }

  return { success: true, message: `C'est fait ! ${roomName} réservée.` };
}