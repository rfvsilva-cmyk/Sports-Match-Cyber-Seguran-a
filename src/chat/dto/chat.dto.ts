import { IsDateString, IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class EnviarMensagemDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID da conversa é obrigatório' })
  @MaxLength(100)
  conversa_id: string;

  @IsString()
  @IsNotEmpty({ message: 'O conteúdo da mensagem é obrigatório' })
  @MaxLength(2000, { message: 'A mensagem deve ter no máximo 2000 caracteres' })
  conteudo: string;
}

export class CriarPartidaDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID da conversa é obrigatório' })
  @MaxLength(100)
  conversa_id: string;

  @IsString()
  @IsNotEmpty({ message: 'A modalidade esportiva é obrigatória' })
  @MaxLength(80)
  modalidade: string;

  @IsString()
  @IsNotEmpty({ message: 'O nome do local é obrigatório' })
  @MaxLength(120)
  local_nome: string;

  @IsNumber()
  @IsOptional()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsNumber()
  @IsOptional()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsDateString({}, { message: 'A data e hora devem ser uma string ISO válida' })
  @IsNotEmpty({ message: 'A data e hora da partida são obrigatórias' })
  data_hora: string;
}


export class AtualizarStatusPartidaDto {
  @IsString()
  @IsIn(['CONCLUIDA', 'CANCELADA'], { message: 'Status inválido.' })
  status: 'CONCLUIDA' | 'CANCELADA';
}
