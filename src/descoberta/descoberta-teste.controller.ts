import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PerfilCompletoGuard } from '../auth/perfil-completo.guard';

@Controller('descoberta')
@UseGuards(AuthGuard('jwt'), PerfilCompletoGuard)
export class DescobertaTesteController {
  @Get('feed')
  async feedTeste(@Request() req: any) {
    return {
      message: 'Acesso liberado ao ecossistema de descoberta!',
      jogador: req.user.jogador,
    };
  }
}
