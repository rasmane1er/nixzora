/** Query keys for customer ↔ store messages (p10-12). */
export const messageKeys = {
  all: ['conversations'] as const,
  one: (id: string) => ['conversations', id] as const,
};
