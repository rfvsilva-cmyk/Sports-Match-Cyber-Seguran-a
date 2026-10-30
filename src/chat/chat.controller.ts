import { Controller, Get, Post, Patch, Body, Param, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PerfilCompletoGuard } from '../auth/perfil-completo.guard';
import { ChatService } from './chat.service';
import { RealtimeService } from './realtime.service';
import { EnviarMensagemDto, CriarPartidaDto, AtualizarStatusPartidaDto } from './dto/chat.dto';

@Controller('chat')
@UseGuards(AuthGuard('jwt'), PerfilCompletoGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly realtimeService: RealtimeService,
  ) {}

  @Get('conversas')
  async listarConversas(@Request() req: any) {
    return this.chatService.listarConversas(req.user.id);
  }

  @Get('conversa/:id')
  async buscarHistorico(@Request() req: any, @Param('id') conversaId: string) {
    return this.chatService.buscarHistoricoConversa(req.user.id, conversaId);
  }

  @Post('mensagem')
  async enviarMensagem(@Request() req: any, @Body() dto: EnviarMensagemDto) {
    return this.chatService.enviarMensagem(req.user.id, dto);
  }

  @Get('conversa/:id/realtime-token')
  async criarTokenRealtime(@Request() req: any, @Param('id') conversaId: string) {
    return this.realtimeService.criarTokenConversa(req.user.id, conversaId);
  }

  @Post('partida')
  async agendarPartida(@Request() req: any, @Body() dto: CriarPartidaDto) {
    return this.chatService.agendarPartida(req.user.id, dto);
  }

  @Post('partida/:id/aceitar')
  async aceitarPartida(@Request() req: any, @Param('id') partidaId: string) {
    return this.chatService.aceitarPartida(req.user.id, partidaId);
  }

  @Patch('partida/:id/status')
  async atualizarStatusPartida(
    @Request() req: any,
    @Param('id') partidaId: string,
    @Body() dto: AtualizarStatusPartidaDto,
  ) {
    return this.chatService.atualizarStatusPartida(req.user.id, partidaId, dto);
  }
}
