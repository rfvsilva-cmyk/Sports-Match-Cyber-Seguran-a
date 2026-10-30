import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

function cookieTokenExtractor(request: any): string | null {
  const cookieHeader = request?.headers?.cookie;
  if (!cookieHeader) return null;
  const sessionCookie = cookieHeader
    .split(';')
    .map((item: string) => item.trim())
    .find((item: string) => item.startsWith('sports_match_session='));
  return sessionCookie ? decodeURIComponent(sessionCookie.split('=').slice(1).join('=')) : null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieTokenExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: { sub: string; email: string }) {
    const supabase = this.supabaseService.getClient();

    const { data: usuario } = await supabase
      .from('usuarios')
      .select('*, jogador(*)')
      .eq('id', payload.sub)
      .maybeSingle();

    if (!usuario) {
      throw new UnauthorizedException('Acesso não autorizado.');
    }

    return usuario;
  }
}
