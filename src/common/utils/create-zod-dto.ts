import type { z } from 'zod';

/** A class carrying a Zod schema. Its instance type is the schema's output, so `@Body() dto: LoginDto` is fully typed. */
export interface ZodDto<S extends z.ZodType> {
  new (): z.output<S>;
  schema: S;
}

/**
 * Turn a Zod schema into a DTO class: `export class LoginDto extends createZodDto(loginSchema) {}`.
 * A class (not a type) is needed because Nest only sees runtime values: the global ZodValidationPipe
 * finds the schema through the parameter's class, which decorator metadata records.
 */
export function createZodDto<S extends z.ZodType>(schema: S): ZodDto<S> {
  // The class is never constructed: it only carries the schema, and its instance type is the parsed output.
  // oxlint-disable-next-line typescript/no-extraneous-class, typescript/no-unsafe-type-assertion
  return class {
    static readonly schema = schema;
  } as ZodDto<S>;
}
