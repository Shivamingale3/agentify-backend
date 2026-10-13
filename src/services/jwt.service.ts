/* eslint-disable @typescript-eslint/no-unnecessary-type-parameters */
import { env } from '#providers/env.provider.js';
import * as jwt from 'jsonwebtoken';
import type { ZodType } from 'zod';

class JwtService {
  private secretKey = env.JWT_SECRET;

  public extractToken<T>(token: string, schema: ZodType<T>): T {
    const payload = jwt.verify(token, this.secretKey);
    if (typeof payload === 'string') {
      throw new Error('Unexpected non-object JWT payload');
    }
    return schema.parse(payload);
  }

  public generateToken<T extends object>(payload: T, expiresIn: number): string {
    return jwt.sign(payload, this.secretKey, { expiresIn });
  }
}

const jwtService = new JwtService();
export default jwtService;
