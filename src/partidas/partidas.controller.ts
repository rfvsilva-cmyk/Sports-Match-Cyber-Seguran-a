import { Body, Controller, Get, Param, Patch, Post, Query, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PerfilCompletoGuard } from '../auth/perfil-completo.guard';
import { CriarPartidaPublicaDto, ListarPartidasDto } from './dto/partidas.dto';
import { PartidasService } from './partidas.service';

@Controller('partidas')
@UseGuards(AuthGuard('jwt'), PerfilCompletoGuard)
export class PartidasController {
  constructor(private readonly partidasService: PartidasService) {}

  @Get()
  listar(@Request() req: any, @Query() filtros: ListarPartidasDto) {
    return this.partidasService.listarPublicas(req.user.id, filtros);
  }

  @Get('minhas')
  minhas(@Request() req: any) {
    return this.partidasService.listarMinhas(req.user.id);
  }

  @Post()
  criar(@Request() req: any, @Body() dto: CriarPartidaPublicaDto) {
    return this.partidasService.criar(req.user.id, dto);
  }

  @Get('convite/:token')
  convite(@Request() req: any, @Param('token') token: string) {
    return this.partidasService.buscarPorConvite(req.user.id, token);
  }

  @Post(':id/participacoes')
  entrar(@Request() req: any, @Param('id') partidaId: string) {
    return this.partidasService.entrar(req.user.id, partidaId);
  }

  @Post(':id/sair')
  sair(@Request() req: any, @Param('id') partidaId: string) {
    return this.partidasService.sair(req.user.id, partidaId);
  }

  @Patch(':id/status')
  atualizarStatus(@Request() req: any, @Param('id') partidaId: string, @Body('status') status: 'CONCLUIDA' | 'CANCELADA') {
    return this.partidasService.atualizarStatus(req.user.id, partidaId, status);
  }
}
