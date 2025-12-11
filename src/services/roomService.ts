import { supabase } from '@/lib/supabaseClient';

export async function getAllRooms() {
  const { data, error } = await supabase
    .from('rooms')
    .select('*');

  if (error) {
    console.error('Erreur récupération salles:', error);
    return [];
  }
  return data;
}

export async function getRoomByName(name: string) {
  // L'IA peut dire "Aquarium" ou "l'aquarium", on gère l'insensibilité à la casse
  const { data, error } = await supabase
    .from('rooms')
    .select('*')
    .ilike('name', name) // ilike = Case insensitive (maj/min)
    .single();

  if (error) return null;
  return data;
}