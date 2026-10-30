import { Controller, Get, Param, Patch, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { NotificacaoService } from './notificacao.service';

@Controller('notificacoes')
@UseGuards(AuthGuard('jwt'))
export class NotificacaoController {
  constructor(private readonly service: NotificacaoService) {}

  @Get() listar(@Request() req: any) { return this.service.listar(req.user.id); }
  @Get('nao-lidas') naoLidas(@Request() req: any) { return this.service.naoLidas(req.user.id); }
  @Patch('ler-todas') lerTodas(@Request() req: any) { return this.service.marcarTodasLidas(req.user.id); }
  @Patch(':id/ler') ler(@Request() req: any, @Param('id') id: string) { return this.service.marcarLida(req.user.id, id); }
}
