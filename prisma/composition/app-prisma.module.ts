/**
 * Prisma-backed application composition (ADR 0009). Same feature modules as the
 * default AppModule, on the Prisma persistence backend. Selected at runtime by
 * `PERSISTENCE=prisma` (see src/app/main.ts). Compiled via tsconfig.prisma.json.
 */

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FEATURE_MODULES } from '../../src/app/feature-modules';
import { PrismaPersistenceModule } from './prisma-persistence.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaPersistenceModule,
    ...FEATURE_MODULES,
  ],
})
export class AppPrismaModule {}
