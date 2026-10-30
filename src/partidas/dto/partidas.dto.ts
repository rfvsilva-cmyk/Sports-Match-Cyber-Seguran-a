import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CriarPartidaPublicaDto {
  @IsString()
  @MaxLength(80)
  modalidade: string;

  @IsString()
  @IsOptional()
  visibilidade?: 'PUBLICA' | 'PRIVADA_LINK';

  @IsString()
  @IsOptional()
  convite_token?: string;

  @IsString()
  @MaxLength(120)
  local_nome: string;

  @IsString()
  @MaxLength(80)
  cidade: string;

  @IsString()
  @MaxLength(80)
  bairro: string;

  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(100)
  capacidade: number;

  @IsDateString()
  data_hora: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  descricao?: string;
}

export class ListarPartidasDto {
  @IsString()
  @IsOptional()
  modalidade?: string;

  @IsString()
  @IsOptional()
  cidade?: string;

  @IsString()
  @IsOptional()
  bairro?: string;
}
