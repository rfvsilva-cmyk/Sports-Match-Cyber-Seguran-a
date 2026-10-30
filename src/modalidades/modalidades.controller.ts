import { Body, Controller, Get, Post, Request, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { ModalidadesService } from './modalidades.service';
class SolicitarModalidadeDto { @IsString() @IsNotEmpty() @MaxLength(80) nome: string; }
@Controller('modalidades') export class ModalidadesController {
  constructor(private readonly service: ModalidadesService) {}
  @Get() listar() { return this.service.listar(); }
  @Post('solicitacoes') @UseGuards(AuthGuard('jwt')) solicitar(@Request() req: any, @Body() dto: SolicitarModalidadeDto) { return this.service.solicitar(req.user.id, dto.nome); }
}
