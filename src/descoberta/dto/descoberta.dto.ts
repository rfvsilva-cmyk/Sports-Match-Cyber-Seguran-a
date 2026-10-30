import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum TipoSwipeEnum {
  LIKE = 'LIKE',
  DISLIKE = 'DISLIKE',
}

export class RegistrarSwipeDto {
  @IsString()
  @IsNotEmpty({ message: 'O ID do jogador de destino é obrigatório' })
  id_destino: string;

  @IsEnum(TipoSwipeEnum, { message: 'Tipo de swipe deve ser LIKE ou DISLIKE' })
  tipo: TipoSwipeEnum;
}

export class FiltroDescobertaDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  raio_km?: number = 50; // Raio de busca padrão de 50km
}
