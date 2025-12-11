// Mock functions to simulate booking service
export async function findAvailableRooms(date: string, duration: number) {
  console.log(`Finding available rooms for ${date} with duration ${duration} minutes.`);
  // In a real application, you would query your database here.
  // For this example, we'll return a static list of rooms.
  return [
    { name: 'Room 1', capacity: 4, equipment: ['whiteboard'] },
    { name: 'Room 2', capacity: 2, equipment: [] },
    { name: 'Room 3', capacity: 10, equipment: ['projector', 'whiteboard'] },
  ];
}

export async function createBooking(roomName: string, date: string, duration: number) {
  console.log(`Creating booking for ${roomName} on ${date} for ${duration} minutes.`);
  // In a real application, you would insert a new booking into your database here.
  // For this example, we'll just return a success message.
  return { success: true, message: 'Booking successful' };
}
