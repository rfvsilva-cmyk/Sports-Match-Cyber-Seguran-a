import { Body, Controller, Get, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PerfilCompletoGuard } from '../auth/perfil-completo.guard';
import { DescobertaService } from './descoberta.service';
import { RegistrarSwipeDto } from './dto/descoberta.dto';

@Controller('descoberta')
@UseGuards(AuthGuard('jwt'), PerfilCompletoGuard)
export class DescobertaController {
  constructor(private readonly descobertaService: DescobertaService) {}

  @Get('feed')
  buscarFeed(
    @Request() req: any,
    @Query('modalidade') modalidade?: string,
    @Query('nivel') nivel?: string,
    @Query('cidade') cidade?: string,
    @Query('bairro') bairro?: string,
  ) {
    return this.descobertaService.buscarFeedDescoberta(req.user.id, {
      modalidade,
      nivel,
      cidade,
      bairro,
    });
  }

  @Post('swipe')
  registrarSwipe(@Request() req: any, @Body() dto: RegistrarSwipeDto) {
    return this.descobertaService.registrarSwipe(req.user.id, dto);
  }
}
