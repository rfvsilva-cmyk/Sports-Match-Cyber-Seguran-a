import { Module } from '@nestjs/common';
import { DescobertaService } from './descoberta.service';
import { DescobertaController } from './descoberta.controller';

@Module({
  controllers: [DescobertaController],
  providers: [DescobertaService],
  exports: [DescobertaService],
})
export class DescobertaModule {}
