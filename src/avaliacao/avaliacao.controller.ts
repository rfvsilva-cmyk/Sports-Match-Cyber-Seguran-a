import { Controller, Post, Get, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PerfilCompletoGuard } from '../auth/perfil-completo.guard';
import { AvaliacaoService } from './avaliacao.service';
import { CriarAvaliacaoDto } from './dto/avaliacao.dto';

@Controller('avaliacao')
@UseGuards(AuthGuard('jwt'), PerfilCompletoGuard)
export class AvaliacaoController {
  constructor(private readonly avaliacaoService: AvaliacaoService) {}

  @Post()
  async avaliarPartida(@Request() req: any, @Body() dto: CriarAvaliacaoDto) {
    return this.avaliacaoService.avaliarPartida(req.user.id, dto);
  }

  @Get('jogador/:id')
  async buscarAvaliacoesDoJogador(@Param('id') jogadorId: string) {
    return this.avaliacaoService.buscarAvaliacoesDoJogador(jogadorId);
  }
}
