import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

async function bootstrap(): Promise<void> {
  // rawBody is required for webhook HMAC signature verification.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // CORS allowlist for the SPA / API consumers (ADR 0007). In production set
  // CORS_ORIGINS to an explicit comma-separated list; dev reflects the origin.
  const origins = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  app.enableCors({ origin: origins.length > 0 ? origins : true, credentials: true });

  // helmet + rate limiting are applied by SecurityModule.
  // Input validation is centralised in the service layer and DTO mappers
  // (which throw ValidationError -> 400 via DomainErrorFilter), so no global
  // class-validator pipe is needed.
  app.useGlobalFilters(new DomainErrorFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`DMC platform API listening on :${port}`);
}

void bootstrap();
