import { NextRequest, NextResponse } from 'next/server';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';
import { readFileSync } from 'fs';
import { join } from 'path';
import { decodeSessionToken } from '@/lib/auth';
import { cookies } from 'next/headers';
import { getChatTools } from '@/lib/chat-tools';

// Load system prompt
const systemPrompt = readFileSync(join(process.cwd(), 'prompts/main.md'), 'utf-8');

export async function POST(req: NextRequest) {
    // --- User Authentication ---
    const cookieStore = cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
        return new NextResponse('Unauthorized: No session token', { status: 401 });
    }

    const decodedToken = decodeSessionToken(sessionToken);
    const userId = decodedToken?.userId;

    if (!userId) {
        return new NextResponse('Unauthorized: Invalid session token', { status: 401 });
    }

    // --- Get Tools ---
    const chatTools = getChatTools(userId);

    // --- Main API Logic ---
    const { messages } = await req.json();

    const result = await streamText({
        model: openai('gpt-4o-mini'),
        system: systemPrompt,
        messages,
        tools: chatTools,
    });

    return result.toUIMessageStreamResponse();
}