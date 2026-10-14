import { definePrismaConfig } from '@prisma/cli-engine';
import { defineConfig as ormConfig } from '@prisma/orm-postgres/config';
import 'dotenv/config';

// The Prisma CLI loads this file by itself, outside Nest: no ConfigModule and no `@/` aliases,
// so DATABASE_URL is read straight from the environment.
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is required');
}

export default definePrismaConfig({
  orm: ormConfig({
    contract: './src/database/prisma/contract.prisma',
    db: {
      connection: databaseUrl,
    },
  }),
});
