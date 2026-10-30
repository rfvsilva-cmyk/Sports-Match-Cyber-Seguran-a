import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';

export class RecuperarSenhaDto {
  @IsEmail({}, { message: 'Formato de e-mail inválido' })
  @IsNotEmpty({ message: 'O e-mail é obrigatório' })
  @MaxLength(254)
  email: string;
}
