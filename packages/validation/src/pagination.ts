import { z } from 'zod';

/** Cursor pagination used by list endpoints. */
export const PageQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(200).optional(),
});

export type PageQuery = z.infer<typeof PageQuerySchema>;

export type Page<T> = {
  items: T[];
  nextCursor: string | null;
};
