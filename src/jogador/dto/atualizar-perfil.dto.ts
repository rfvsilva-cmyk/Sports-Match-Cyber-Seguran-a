import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class AtualizarPerfilDto {
  @IsString()
  @IsOptional()
  @MaxLength(100)
  nome?: string;

  @IsString()
  @IsOptional()
  @IsUrl({ protocols: ['http', 'https'], require_protocol: true })
  @MaxLength(2048)
  foto_url?: string;

  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  cidade?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  bairro?: string;

  @IsString()
  @IsOptional()
  @MaxLength(80)
  esporte_individual?: string;

  @IsString()
  @IsOptional()
  modalidade_id?: string;

  @IsString()
  @IsOptional()
  @MaxLength(40)
  nivel_individual?: string;
}
