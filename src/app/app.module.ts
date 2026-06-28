import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InMemoryPersistenceModule } from './persistence/in-memory-persistence.module';
import { FEATURE_MODULES } from './feature-modules';

/**
 * Default application composition: feature modules on the in-memory persistence
 * backend (sandbox, tests, local dev). The Prisma-backed composition for a DB
 * environment lives at `prisma/composition/app-prisma.module` and is selected by
 * `PERSISTENCE=prisma` in main.ts (ADR 0009).
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    InMemoryPersistenceModule,
    ...FEATURE_MODULES,
  ],
})
export class AppModule {}
