import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { IncomingMessage, ServerResponse } from 'node:http';
import express from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfigService } from './config/app-config.service';
import { maybeAutoseed } from './database/seed';

/**
 * Serverless bootstrap for Vercel. The Nest app is created once per warm
 * instance and reused across invocations. Runs in DEMO_MODE with an
 * in-memory sql.js database that is re-seeded on every cold start — fine for
 * a pitch demo, not for real users (see README → Deployment).
 */
let serverPromise: Promise<express.Express> | null = null;

async function createServer(): Promise<express.Express> {
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { bufferLogs: true });
  const config = app.get(AppConfigService);
  app.use(helmet());
  // Empty allow-list → reflect any origin (hosted demo); set CORS_ORIGINS to lock it down.
  const origins = config.get('CORS_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean);
  app.enableCors({ origin: origins.length ? origins : true, credentials: true });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'webhooks/(.*)'] });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  await app.init();
  await maybeAutoseed(app, new Logger('Autoseed'));
  return server;
}

export async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const server = await (serverPromise ??= createServer());
    server(req, res);
  } catch (err) {
    serverPromise = null; // let the next invocation retry a failed boot
    // eslint-disable-next-line no-console
    console.error(err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ statusCode: 500, code: 'BOOT_FAILED', message: 'API failed to start' }));
  }
}
