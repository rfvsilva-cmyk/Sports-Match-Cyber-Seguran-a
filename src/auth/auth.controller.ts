import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { AuthRateLimitGuard } from './auth-rate-limit.guard';
import { CadastroDto } from './dto/cadastro.dto';
import { LoginDto } from './dto/login.dto';
import { RecuperarSenhaDto } from './dto/recuperar-senha.dto';
import { RedefinirSenhaDto } from './dto/redefinir-senha.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('cadastro')
  @UseGuards(AuthRateLimitGuard)
  async cadastro(@Body() dto: CadastroDto, @Res({ passthrough: true }) response: Response) {
    const { access_token, ...session } = await this.authService.cadastro(dto);
    this.setSessionCookie(response, access_token);
    return session;
  }

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) response: Response) {
    const { access_token, ...session } = await this.authService.login(dto);
    this.setSessionCookie(response, access_token);
    return session;
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response) {
    response.clearCookie('sports_match_session', this.cookieOptions());
  }

  @Get('sessao')
  @UseGuards(AuthGuard('jwt'))
  sessao(@Request() request: any) {
    return this.authService.sessao(request.user);
  }

  @Post('recuperar-senha')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  recuperarSenha(@Body() dto: RecuperarSenhaDto) {
    return this.authService.solicitarRedefinicaoSenha(dto.email);
  }

  @Post('redefinir-senha')
  @UseGuards(AuthRateLimitGuard)
  @HttpCode(HttpStatus.OK)
  redefinirSenha(@Body() dto: RedefinirSenhaDto) {
    return this.authService.redefinirSenha(dto.token, dto.senha);
  }

  private setSessionCookie(response: Response, token: string) {
    response.cookie('sports_match_session', token, this.cookieOptions());
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 1000 * 60 * 60 * 24 * 7,
      path: '/',
    };
  }
}
