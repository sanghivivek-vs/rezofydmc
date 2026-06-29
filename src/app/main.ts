import 'reflect-metadata';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { DomainErrorFilter } from '@common/http/domain-error.filter';

/**
 * Choose the application composition by persistence backend (ADR 0009). The
 * Prisma composition is loaded with a runtime require so the default build does
 * not depend on the generated @prisma/client; it is compiled separately via
 * tsconfig.prisma.json in a DB environment.
 */
function resolveRootModule(): unknown {
  if ((process.env.PERSISTENCE ?? 'memory') === 'prisma') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
    return require('../../prisma/composition/app-prisma.module').AppPrismaModule;
  }
  return AppModule;
}

async function bootstrap(): Promise<void> {
  // rawBody is required for webhook HMAC signature verification.
  const app = await NestFactory.create<NestExpressApplication>(resolveRootModule() as never, {
    rawBody: true,
  });

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

  // Optional single-process deploy: serve the built SPA from this API so the
  // whole app lives at one URL. Set SERVE_WEB to the web build dir (web/dist).
  // API routes are under /v1; everything else falls back to the SPA shell so
  // client-side routes (e.g. /settings) work on hard refresh.
  const webDir = process.env.SERVE_WEB ? resolve(process.env.SERVE_WEB) : undefined;
  if (webDir && existsSync(join(webDir, 'index.html'))) {
    const indexHtml = join(webDir, 'index.html');
    app.useStaticAssets(webDir);
    app
      .getHttpAdapter()
      .getInstance()
      .get(/^(?!\/v1\/).*/, (_req: unknown, res: { sendFile: (p: string) => void }) =>
        res.sendFile(indexHtml),
      );
    new Logger('Bootstrap').log(`Serving SPA from ${webDir}`);
  }

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `DMC platform API listening on :${port} (persistence: ${process.env.PERSISTENCE ?? 'memory'})`,
  );
}

void bootstrap();
