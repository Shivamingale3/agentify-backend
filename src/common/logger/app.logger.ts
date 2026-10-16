import { ConsoleLogger } from '@nestjs/common';

// Nest's own boot chatter: one line per module and route on every start.
const BOOT_CONTEXTS = new Set([
  'NestFactory',
  'InstanceLoader',
  'RoutesResolver',
  'RouterExplorer',
  'NestApplication',
]);

/** ConsoleLogger without the pid, with a short timestamp, and with Nest's boot lines hidden. */
export class AppLogger extends ConsoleLogger {
  override log(message: unknown, ...optionalParams: unknown[]): void {
    const context = optionalParams.at(-1);
    if (typeof context === 'string' && BOOT_CONTEXTS.has(context)) return;
    super.log(message, ...optionalParams);
  }

  protected override formatPid(): string {
    return '';
  }

  protected override getTimestamp(): string {
    return new Date().toLocaleTimeString('en-GB');
  }
}
