import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

export class CriarAvaliacaoDto {
  @IsString()
  @IsNotEmpty()
  partida_id: string;

  @IsString()
  @IsNotEmpty()
  avaliado_id: string;

  @IsInt()
  @Min(1)
  @Max(5)
  nota: number;

  @IsString()
  @IsOptional()
  comentario?: string;
}
