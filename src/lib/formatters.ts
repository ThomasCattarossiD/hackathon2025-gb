/**
 * Formatters pour les réponses du chatbot
 * Assure une présentation cohérente et lisible des données
 */

interface Room {
  id?: number | string;
  name: string;
  capacity: number;
  equipment?: string[] | null;
  location?: string;
  is_active?: boolean;
}

/**
 * Formate une liste de salles en texte lisible pour l'utilisateur
 * @param rooms - Tableau des salles disponibles
 * @returns Texte formaté avec détails des salles
 */
export function formatRoomsResponse(rooms: Room[]): string {
  if (!rooms || rooms.length === 0) {
    return "❌ Aucune salle disponible à cet horaire.";
  }

  const formatted = rooms
    .map((room, index) => {
      const equipment = room.equipment && room.equipment.length > 0
        ? `\n   📦 Équipements: ${Array.isArray(room.equipment) ? room.equipment.join(", ") : "Aucun"}`
        : '';
      
      const location = room.location 
        ? `\n   📍 Localisation: ${room.location}`
        : '';

      return `${index + 1}. **${room.name}**\n   👥 Capacité: ${room.capacity} personne(s)${equipment}${location}`;
    })
    .join('\n\n');

  return `✅ **${rooms.length} salle(s) disponible(s):**\n\n${formatted}`;
}

/**
 * Formate un message de succès de réservation
 * @param roomName - Nom de la salle réservée
 * @param date - Date et heure de la réservation
 * @param duration - Durée en minutes
 * @returns Message formaté de confirmation
 */
export function formatBookingSuccess(roomName: string, date: string, duration: number): string {
  const endTime = new Date(new Date(date).getTime() + duration * 60000).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `✅ **Réservation confirmée!**\n\n📋 Détails:\n- Salle: **${roomName}**\n- Date: ${date}\n- Durée: ${duration} minutes\n- Fin estimée: ${endTime}`;
}

/**
 * Formate un message d'erreur de réservation
 * @param roomName - Nom de la salle
 * @param reason - Raison de l'erreur
 * @returns Message formaté d'erreur
 */
export function formatBookingError(roomName: string, reason: string): string {
  return `❌ **Réservation échouée pour ${roomName}**\n\nRaison: ${reason}`;
}

/**
 * Formate un message d'attente de confirmation
 * @param roomName - Nom de la salle proposée
 * @param capacity - Capacité de la salle
 * @param date - Date proposée
 * @returns Message formaté avec demande de confirmation
 */
export function formatConfirmationRequest(
  roomName: string,
  capacity: number,
  date: string
): string {
  return `Je vous propose la salle **${roomName}** (${capacity} personnes).\n\nPour la date: **${date}**\n\nConfirmez-vous cette réservation? (oui/non)`;
}

/**
 * Formate un message indiquant qu'il manque des informations
 * @param missingFields - Tableau des champs manquants
 * @returns Message formaté demandant les informations
 */
export function formatMissingInfo(missingFields: string[]): string {
  if (missingFields.length === 0) return "";

  const fields = missingFields.map(f => `• ${f}`).join('\n');
  return `Pour continuer, j'ai besoin des informations suivantes:\n${fields}`;
}
