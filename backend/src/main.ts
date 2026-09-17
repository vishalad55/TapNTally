import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(AppConfigService);
  const logger = new Logger('Bootstrap');

  app.use(helmet());
  app.enableCors({
    origin: config.get('CORS_ORIGINS').split(',').map((s) => s.trim()).filter(Boolean),
    credentials: true,
  });
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'webhooks/(.*)'] });
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: false }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();

  if (!config.isProd) {
    const doc = new DocumentBuilder()
      .setTitle('TapNTally API')
      .setDescription('NFC tap-to-get-bill expense tracking')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  const port = config.get('PORT');
  await app.listen(port);
  logger.log(`TapNTally API listening on http://localhost:${port}  (driver=${config.get('DB_DRIVER')})`);
  if (!config.isProd) logger.log(`Swagger UI at http://localhost:${port}/docs`);
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
