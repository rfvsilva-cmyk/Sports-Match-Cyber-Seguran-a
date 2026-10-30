import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Request, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { JogadorService } from './jogador.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

@Controller('jogador')
@UseGuards(AuthGuard('jwt'))
export class JogadorController {
  constructor(private readonly jogadorService: JogadorService) {}

  @Get('meu-perfil')
  async meuPerfil(@Request() req: any) {
    return this.jogadorService.buscarMeuPerfil(req.user.id);
  }

  @Get(':id/publico')
  async perfilPublico(@Param('id') jogadorId: string) {
    return this.jogadorService.buscarPerfilPublico(jogadorId);
  }

  @Put('perfil')
  async atualizarPerfil(@Request() req: any, @Body() dto: AtualizarPerfilDto) {
    return this.jogadorService.atualizarPerfil(req.user.id, dto);
  }

  @Post('foto')
  @UseInterceptors(FileInterceptor('foto', {
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, callback) => {
      callback(null, ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype));
    },
  }))
  async enviarFoto(@Request() req: any, @UploadedFile() foto?: any) {
    if (!foto) throw new BadRequestException('Envie uma imagem JPEG, PNG ou WebP de até 5 MB.');
    return this.jogadorService.enviarFoto(req.user.id, foto);
  }

  @Delete('foto')
  async removerFoto(@Request() req: any) {
    return this.jogadorService.removerFoto(req.user.id);
  }
}
