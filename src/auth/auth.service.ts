import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes } from 'node:crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { SupabaseService } from '../supabase/supabase.service';
import { CadastroDto } from './dto/cadastro.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async cadastro(dto: CadastroDto) {
    const supabase = this.supabaseService.getClient();
    const email = dto.email.trim().toLowerCase();
    const { data: usuarioExistente } = await supabase
      .from('usuarios')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (usuarioExistente) throw new ConflictException('E-mail já cadastrado no sistema.');

    const senhaHash = await bcrypt.hash(dto.senha, 10);
    const { data: usuario, error: errorUsuario } = await supabase
      .from('usuarios')
      .insert({ email, senha: senhaHash })
      .select()
      .single();

    if (errorUsuario || !usuario) {
  this.logger.error('ERRO AO CRIAR USUARIO:', errorUsuario);
  throw new ConflictException(
    errorUsuario?.message || 'Não foi possível criar a conta. Tente novamente.',
  );
}

    const { data: jogador, error: jogadorError } = await supabase
      .from('jogador')
      .insert({ usuario_id: usuario.id, nome: dto.nome.trim(), perfil_completo: false })
      .select()
      .single();

    if (jogadorError || !jogador) {
      throw new BadRequestException('Conta criada, mas o perfil não pôde ser preparado.');
    }

    return this.criarRespostaSessao(usuario, jogador, 'Usuário cadastrado com sucesso!');
  }

  async login(dto: LoginDto) {
    const supabase = this.supabaseService.getClient();
    const { data: usuario } = await supabase
      .from('usuarios')
      .select('*, jogador(*)')
      .eq('email', dto.email.trim().toLowerCase())
      .maybeSingle();

    if (!usuario || !(await bcrypt.compare(dto.senha, usuario.senha))) {
      throw new UnauthorizedException('Credenciais inválidas.');
    }

    await supabase.from('usuarios').update({ ultimo_login: new Date().toISOString() }).eq('id', usuario.id);
    const jogador = Array.isArray(usuario.jogador) ? usuario.jogador[0] : usuario.jogador;
    return this.criarRespostaSessao(usuario, jogador, 'Login realizado com sucesso!');
  }

  sessao(usuario: any) {
    const jogador = Array.isArray(usuario.jogador) ? usuario.jogador[0] : usuario.jogador;
    return { usuario: { id: usuario.id, email: usuario.email, jogador } };
  }

  async solicitarRedefinicaoSenha(email: string) {
    const genericMessage = 'Se existir uma conta para este e-mail, enviaremos as instruções.';
    if (!email) return { message: genericMessage };

    const normalizedEmail = email.trim().toLowerCase();
    const { data: usuario } = await this.supabaseService.getClient()
      .from('usuarios')
      .select('id, email')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (!usuario) return { message: genericMessage };

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    const supabase = this.supabaseService.getClient();

    // Only the newest recovery request remains valid for this account.
    await supabase
      .from('password_reset_token')
      .update({ used_at: new Date().toISOString() })
      .eq('usuario_id', usuario.id)
      .is('used_at', null);

    const { error: tokenError } = await supabase
      .from('password_reset_token')
      .insert({
        usuario_id: usuario.id,
        token_hash: tokenHash,
        expires_at: expiresAt,
      });

    if (tokenError) {
      this.logger.error('Não foi possível registrar o token de recuperação de senha.');
      return { message: genericMessage };
    }

    const resendKey = this.configService.get<string>('RESEND_API_KEY');
    const resendFrom = this.configService.get<string>('RESEND_FROM_EMAIL');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL');

    if (!resendKey || !resendFrom || !frontendUrl) {
      this.logger.warn('Recuperação de senha solicitada sem um provedor de e-mail configurado.');
      return { message: genericMessage };
    }

    const resetUrl = `${frontendUrl.replace(/\/$/, '')}/redefinir-senha?token=${encodeURIComponent(rawToken)}`;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: resendFrom,
        to: usuario.email,
        subject: 'Redefinição de senha - Sports Match',
        html: `<p>Use este link para redefinir sua senha: <a href="${resetUrl}">redefinir senha</a>.</p><p>Ele expira em 15 minutos e só pode ser usado uma vez.</p>`,
      }),
    });

    if (!response.ok) this.logger.error('O provedor de e-mail recusou uma solicitação de recuperação de senha.');
    return { message: genericMessage };
  }

  async redefinirSenha(token: string, senha: string) {
    if (!token || !senha || senha.length < 6 || senha.length > 72) {
      throw new BadRequestException('Informe um link válido e uma senha entre 6 e 72 caracteres.');
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const supabase = this.supabaseService.getClient();
    const now = new Date().toISOString();

    const { data: resetToken, error: tokenError } = await supabase
      .from('password_reset_token')
      .update({ used_at: now })
      .eq('token_hash', tokenHash)
      .is('used_at', null)
      .gt('expires_at', now)
      .select('usuario_id')
      .maybeSingle();

    if (tokenError || !resetToken) {
      throw new BadRequestException('O link de redefinição é inválido, expirou ou já foi utilizado.');
    }

    const { error } = await supabase
      .from('usuarios')
      .update({ senha: await bcrypt.hash(senha, 10) })
      .eq('id', resetToken.usuario_id);

    if (error) throw new BadRequestException('Não foi possível redefinir a senha.');
    return { message: 'Senha redefinida com sucesso.' };
  }

  private criarRespostaSessao(usuario: any, jogador: any, message: string) {
    const accessToken = this.jwtService.sign({ sub: usuario.id, email: usuario.email });
    return {
      message,
      access_token: accessToken,
      usuario: { id: usuario.id, email: usuario.email, jogador },
    };
  }
}
