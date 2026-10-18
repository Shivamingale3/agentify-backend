import type { z } from 'zod';

/** A class carrying a Zod schema; its instance type is the schema's output. */
export interface ZodDto<S extends z.ZodType> {
  new (): z.output<S>;
  schema: S;
}

/**
 * Turn a Zod schema into a DTO class. A class, not a type, because Nest only sees runtime values:
 * ZodValidationPipe finds the schema through the parameter's class in decorator metadata.
 */
export function createZodDto<S extends z.ZodType>(schema: S): ZodDto<S> {
  // Never constructed: it only carries the schema.
  // oxlint-disable-next-line typescript/no-extraneous-class, typescript/no-unsafe-type-assertion
  return class {
    static readonly schema = schema;
  } as ZodDto<S>;
}
