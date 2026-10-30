import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class AppController {
  @Get()
  status() {
    return { status: 'ok', service: 'sports-match-api' };
  }
}
