import { ForbiddenException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { SupabaseService } from '../supabase/supabase.service';

/** Issues short-lived Supabase Realtime credentials only after conversation authorization. */
@Injectable()
export class RealtimeService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async criarTokenConversa(usuarioId: string, conversaId: string) {
    const { data: jogador } = await this.supabaseService.getClient()
      .from('jogador')
      .select('id')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    const { data: conversa } = await this.supabaseService.getClient()
      .from('conversa')
      .select('match(id_jogador1,id_jogador2)')
      .eq('id', conversaId)
      .maybeSingle();
    const match = Array.isArray(conversa?.match) ? conversa?.match[0] : conversa?.match;
    if (!jogador || !match || (match.id_jogador1 !== jogador.id && match.id_jogador2 !== jogador.id)) {
      throw new ForbiddenException('Você não participa desta conversa.');
    }

    const supabaseJwtSecret = this.configService.get<string>('SUPABASE_JWT_SECRET');
    if (!supabaseJwtSecret) {
      throw new ServiceUnavailableException('SUPABASE_JWT_SECRET não está configurado para o Realtime.');
    }

    return {
      token: this.jwtService.sign(
        { sub: usuarioId, role: 'authenticated', aud: 'authenticated' },
        { secret: supabaseJwtSecret, expiresIn: '10m' },
      ),
      topic: `conversation:${conversaId}`,
      expires_in: 600,
    };
  }
}
