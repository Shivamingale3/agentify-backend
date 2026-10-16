import { ResponseMessage } from '@/common/decorators/response-message.decorator.js';
import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @ResponseMessage('Server is healthy')
  @Get()
  check(): void {}
}
