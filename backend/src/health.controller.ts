import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly db: DataSource) {}

  @Get()
  async health() {
    let database: 'ok' | 'error' = 'ok';
    try {
      await this.db.query('SELECT 1');
    } catch {
      database = 'error';
    }
    return { status: database === 'ok' ? 'ok' : 'degraded', database, uptimeSeconds: Math.round(process.uptime()) };
  }
}
