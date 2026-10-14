import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { z } from 'zod';

/** Validates every @Body/@Query/@Param whose type is a createZodDto class; other params pass through untouched. */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, { metatype }: ArgumentMetadata): unknown {
    if (!metatype || !('schema' in metatype) || !(metatype.schema instanceof z.ZodType)) {
      return value;
    }

    const result = metatype.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(result.error.issues[0]?.message ?? 'Validation failed');
    }
    return result.data;
  }
}
