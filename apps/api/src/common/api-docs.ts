import { applyDecorators } from '@nestjs/common';
import { ApiBody, ApiOkResponse, ApiResponse } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';

// The OpenAPI schema type is not exported from the package root; derive it from ApiBody.
type SchemaObject = NonNullable<
  Extract<Parameters<typeof ApiBody>[0], { schema?: unknown }>['schema']
>;

function toOpenApi(schema: ZodType, io: 'input' | 'output'): SchemaObject {
  return z.toJSONSchema(schema, { io, unrepresentable: 'any' }) as SchemaObject;
}

/** Documents a request body from the same Zod schema that validates it. */
export function ApiZodBody(schema: ZodType): MethodDecorator & ClassDecorator {
  return applyDecorators(ApiBody({ schema: toOpenApi(schema, 'input') }));
}

/** Documents a response body from a shared Zod schema. */
export function ApiZodResponse(
  schema: ZodType,
  status = 200,
  description?: string,
): MethodDecorator & ClassDecorator {
  return status === 200
    ? applyDecorators(ApiOkResponse({ schema: toOpenApi(schema, 'output'), description }))
    : applyDecorators(ApiResponse({ status, schema: toOpenApi(schema, 'output'), description }));
}
