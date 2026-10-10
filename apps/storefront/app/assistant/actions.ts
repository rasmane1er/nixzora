'use server';

import {
  type AssistantChatResponse,
  type AssistantMessage,
  AssistantChatRequestSchema,
} from '@nixzora/validation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { ensureVisitorId } from '@/lib/visitor';

export type AskResult =
  { ok: true; response: AssistantChatResponse } | { ok: false; error: string };

/** Sends the conversation to the shopping assistant. Products and prices come from the API. */
export async function askAssistant(messages: AssistantMessage[]): Promise<AskResult> {
  const parsed = AssistantChatRequestSchema.safeParse({ messages: messages.slice(-12) });
  if (!parsed.success) return { ok: false, error: (await getT('assistant'))('writeMore') };
  try {
    // With the visitor id (and sign-in): what they ask for shapes their picks (p10-02).
    const visitorId = await ensureVisitorId().catch(() => undefined);
    const response = await api<AssistantChatResponse>('/assistant/chat', {
      method: 'POST',
      body: { ...parsed.data, visitorId },
    });
    return { ok: true, response };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
