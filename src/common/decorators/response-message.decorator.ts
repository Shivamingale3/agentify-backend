import { Reflector } from '@nestjs/core';

/** Sets the `message` of a successful response: `@ResponseMessage('Logged in successfully')`. */
export const ResponseMessage = Reflector.createDecorator<string>();
