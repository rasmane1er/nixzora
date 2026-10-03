'use server';

import {
  type AssistantChatResponse,
  type AssistantMessage,
  AssistantChatRequestSchema,
} from '@nixzora/validation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

export type AskResult =
  { ok: true; response: AssistantChatResponse } | { ok: false; error: string };

/** Sends the conversation to the shopping assistant. Products and prices come from the API. */
export async function askAssistant(messages: AssistantMessage[]): Promise<AskResult> {
  const parsed = AssistantChatRequestSchema.safeParse({ messages: messages.slice(-12) });
  if (!parsed.success) return { ok: false, error: (await getT('assistant'))('writeMore') };
  try {
    const response = await api<AssistantChatResponse>('/assistant/chat', {
      method: 'POST',
      body: parsed.data,
      auth: false,
    });
    return { ok: true, response };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}
