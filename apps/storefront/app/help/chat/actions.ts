'use server';

import {
  type HelpAction,
  HelpActionSchema,
  type HelpConversation,
  HelpMessageCreateSchema,
} from '@nixzora/validation';
import { api, errorMessage } from '@/lib/api';

export type HelpResult =
  { ok: true; conversation: HelpConversation } | { ok: false; error: string };

async function run(call: () => Promise<HelpConversation>): Promise<HelpResult> {
  try {
    return { ok: true, conversation: await call() };
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
}

/** Sends a message to the help agent; the reply comes back with the whole conversation. */
export async function sendHelpMessage(text: string): Promise<HelpResult> {
  const parsed = HelpMessageCreateSchema.safeParse({ text });
  if (!parsed.success) return { ok: false, error: 'Write a message first.' };
  return run(() =>
    api<HelpConversation>('/me/help/messages', { method: 'POST', body: parsed.data }),
  );
}

/** A button in the chat: cancel an order, choose one, or send the chat to the team. */
export async function helpAction(action: HelpAction): Promise<HelpResult> {
  const parsed = HelpActionSchema.safeParse(action);
  if (!parsed.success) return { ok: false, error: 'That action isn’t available.' };
  return run(() =>
    api<HelpConversation>('/me/help/actions', { method: 'POST', body: parsed.data }),
  );
}

export async function startHelpOver(): Promise<HelpResult> {
  return run(async () => {
    await api('/me/help', { method: 'DELETE' });
    return api<HelpConversation>('/me/help');
  });
}
