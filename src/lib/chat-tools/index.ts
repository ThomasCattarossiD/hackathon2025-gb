import { tool } from 'ai';

import { findRoomsByCarac, findRoomsByCaracSchema } from './findRoomsByCarac';
import { proposeRoomToUser, proposeRoomToUserSchema } from './proposeRoomToUser';
import { createMeeting, createMeetingSchema } from './createMeeting';

export const getChatTools = (userId: string) => {
    return {
        findRoomsByCarac: tool({
            description: 'Find and filter available rooms by criteria. Returns a list of available rooms sorted by relevance.',
            parameters: findRoomsByCaracSchema,
            execute: findRoomsByCarac,
        }),
        proposeRoomToUser: tool({
            description: 'Show full room details and ask for confirmation. Re-verifies availability before proposing.',
            parameters: proposeRoomToUserSchema,
            execute: proposeRoomToUser,
        }),
        createMeeting: tool({
            description: 'Create the actual booking in the database.',
            parameters: createMeetingSchema,
            execute: (args) => createMeeting(args, userId),
        }),
    };
};
