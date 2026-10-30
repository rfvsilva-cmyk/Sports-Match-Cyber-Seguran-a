import {
  CanActivate,
  ExecutionContext,
  Injectable,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

type Bucket = { count: number; resetAt: number };

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>();

  private readonly limits: Record<string, { max: number; windowMs: number }> = {
    'auth/cadastro': { max: 5, windowMs: 60_000 },
    'auth/login': { max: 8, windowMs: 60_000 },
    'auth/recuperar-senha': { max: 3, windowMs: 60_000 },
    'auth/redefinir-senha': { max: 8, windowMs: 60_000 },
  };

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<any>();
    const routePath = request.route?.path?.replace(/^\//, '') || '';
    const route = `auth/${routePath}`;

    const config = this.limits[route];
    if (!config) return true;

    const forwarded = request.headers?.['x-forwarded-for'];
    const ip =
      process.env.TRUST_PROXY === 'true' && typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : request.ip || request.socket?.remoteAddress || 'unknown';

    const key = `${route}:${ip}`;
    const now = Date.now();
    const existing = this.buckets.get(key);

    if (!existing || now >= existing.resetAt) {
      this.buckets.set(key, { count: 1, resetAt: now + config.windowMs });
      this.cleanup(now);
      return true;
    }

    existing.count += 1;
    if (existing.count > config.max) {
      const retryAfter = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));
      throw new HttpException({
        message: 'Muitas tentativas. Aguarde antes de tentar novamente.',
        retryAfter,
      }, HttpStatus.TOO_MANY_REQUESTS);
    }

    return true;
  }

  private cleanup(now: number) {
    if (this.buckets.size < 5000) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}
