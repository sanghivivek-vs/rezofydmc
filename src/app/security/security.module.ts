/**
 * Security hardening (ADR 0007). Applies defence-in-depth at the HTTP edge:
 *  - helmet security headers on every route (middleware, so it is active in
 *    tests too), and
 *  - global rate limiting via @nestjs/throttler (APP_GUARD) to blunt
 *    brute-force/abuse; auth routes carry a tighter per-route limit.
 *
 * CORS and TLS are configured at the application bootstrap / deployment edge
 * (see main.ts).
 */

import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import helmet from 'helmet';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: Number(config.get<string>('RATE_LIMIT_TTL_MS') ?? 60_000),
            limit: Number(config.get<string>('RATE_LIMIT_MAX') ?? 500),
          },
        ],
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class SecurityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(helmet()).forRoutes('*');
  }
}
