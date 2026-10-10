import { type HelpIntent } from '@nixzora/validation';

/** One of the shopper's recent orders, as the classifier may see it (no addresses, no emails). */
export type HelpOrderRef = { number: string; status: string; items: string[] };

export type HelpUnderstanding = { intent: HelpIntent; orderNumber: string | null };

const ORDER_NUMBER = /\bNX-[A-Z0-9]{6}\b/i;

/**
 * Words that point at each intent, English, French and Spanish together (a shopper may mix
 * them). Checked in this order: asking for a person wins, then the actions, then questions.
 */
const RULES: [HelpIntent, RegExp][] = (
  [
    [
      'HUMAN',
      String.raw`human|real person|a person|someone|agent|representative|staff|operator|talk to|speak (to|with)|call me|humain|une personne|quelqu.un|conseill\w*|parler (à|a|avec)|humano|una persona|alguien|asesor|agente|hablar con`,
    ],
    ['CANCEL', String.raw`cancel\w*|annul\w*|cancela\w*`],
    [
      'REFUND',
      String.raw`refund\w*|money back|reimburs\w*|rembours\w*|reembols\w*|devoluci[oó]n del dinero`,
    ],
    [
      'RETURN',
      String.raw`return\w*|send (it )?back|exchange|wrong (size|item|colou?r)|damaged|broken|defective|retour\w*|retourn\w*|renvoy\w*|[ée]chang\w*|ab[iî]m[ée]\w*|cass[ée]\w*|d[ée]fectueu\w*|devolver|devoluci[oó]n|devuelv\w*|cambi\w*|da[ñn]ad\w*|roto|rota|defectuos\w*`,
    ],
    [
      'TRACK',
      String.raw`where|track\w*|package|parcel|arriv\w*|deliver\w*|ship\w*|when will|late|not received|hasn.t (come|arrived)|où|o[uù] (est|sont)|suivi|suivre|colis|livr\w*|exp[ée]di\w*|re[çc]u|retard|d[oó]nde|rastre\w*|seguimiento|paquete|lleg\w*|entreg\w*|env[ií]o|enviad\w*|atrasad\w*`,
    ],
    [
      'ORDERS',
      String.raw`orders?|my purchases?|commandes?|achats?|pedidos?|[oó]rden(es)?|compras?`,
    ],
    [
      'GREETING',
      String.raw`hi|hello|hey|thanks?|thank you|ok|okay|great|bonjour|salut|merci|bonsoir|hola|gracias|buenas|vale`,
    ],
  ] as [HelpIntent, string][]
).map(([intent, words]) => [
  intent,
  // Whole words in any script: \b only knows ASCII, so "échange" needs letter lookarounds.
  new RegExp(
    `${intent === 'GREETING' ? '^\\s*' : '(?<![\\p{L}\\p{N}])'}(?:${words.replaceAll('\\w', '\\p{L}')})(?![\\p{L}\\p{N}])`,
    'iu',
  ),
]);

/**
 * The free, offline reading of a help message (the local driver, and the fallback when a model
 * call fails): keyword rules over the latest message, then the conversation, plus any order
 * number written out. Only numbers from the shopper's own orders are kept.
 */
export function classifyHelpLocally(turns: string[], orders: HelpOrderRef[]): HelpUnderstanding {
  const latest = turns[turns.length - 1] ?? '';
  const mine = new Set(orders.map((o) => o.number));
  const written = latest.match(ORDER_NUMBER)?.[0]?.toUpperCase() ?? null;
  const orderNumber = written && mine.has(written) ? written : null;
  const match = (text: string) => RULES.find(([, pattern]) => pattern.test(text))?.[0];
  let intent = match(latest);
  // A bare order number ("NX-7KQ4M2"): keep the topic of the previous message.
  if (!intent && written) {
    intent = [...turns.slice(0, -1)].reverse().map(match).find(Boolean) ?? 'ORDERS';
  }
  return { intent: intent ?? 'OTHER', orderNumber };
}
