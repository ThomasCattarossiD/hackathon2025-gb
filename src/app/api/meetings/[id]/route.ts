import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeSessionToken } from '@/lib/auth';
import { deleteMeeting } from '@/services/bookingService';

// DELETE /api/meetings/[id]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get current user from session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Non authentifié' },
        { status: 401 }
      );
    }

    const decoded = decodeSessionToken(sessionToken);
    if (!decoded?.userId) {
      return NextResponse.json(
        { error: 'Token invalide' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const meetingId = parseInt(id, 10);

    if (isNaN(meetingId)) {
      return NextResponse.json(
        { error: 'ID de réunion invalide' },
        { status: 400 }
      );
    }

    // Delete the meeting
    const result = await deleteMeeting(meetingId, decoded.userId);

    if (!result.success) {
      return NextResponse.json(
        { error: result.message },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: result.message },
      { status: 200 }
    );

  } catch (error) {
    console.error('Error in DELETE /api/meetings/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
