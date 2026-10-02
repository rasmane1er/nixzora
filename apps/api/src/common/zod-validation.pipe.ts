import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { type ZodType } from 'zod';

/** Validates and normalizes a request body or query with a shared Zod schema. */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value ?? {});
    if (!result.success) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Some fields need attention.',
        issues: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      });
    }
    return result.data;
  }
}
