import { INestApplication, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { SupabaseService } from '../src/supabase/supabase.service';

describe('Profile update contract (e2e)', () => {
  let app: INestApplication;
  let update: jest.Mock;

  beforeAll(async () => {
    const profile = { id: 'player-1', usuario_id: 'user-1', nome: 'Jorge', cidade: null, bairro: null, esporte_individual: null, nivel_individual: null, perfil_completo: false };
    update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single: jest.fn().mockResolvedValue({ data: profile, error: null }) }) }) });
    const jogadorQuery = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: profile }), update };
    jogadorQuery.select.mockReturnValue(jogadorQuery);
    jogadorQuery.eq.mockReturnValue(jogadorQuery);
    const usuarioQuery = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'user-1', email: 'jogador@example.com', jogador: profile } }) };
    usuarioQuery.select.mockReturnValue(usuarioQuery);
    usuarioQuery.eq.mockReturnValue(usuarioQuery);
    const client = { from: jest.fn((table: string) => table === 'usuarios' ? usuarioQuery : jogadorQuery) };

    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(SupabaseService).useValue({ getClient: () => client }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => app.close());
  const authorization = () => `Bearer ${new JwtService({ secret: process.env.JWT_SECRET }).sign({ sub: 'user-1', email: 'jogador@example.com' })}`;

  it('rejects a full database record instead of silently changing protected fields', async () => {
    await request(app.getHttpAdapter().getInstance()).put('/jogador/perfil').set('Authorization', authorization())
      .send({ nome: 'Jorge', cidade: 'Cascavel', id: 'player-1', usuario_id: 'user-1', media_avaliacao: 5 }).expect(400);
    expect(update).not.toHaveBeenCalled();
  });

  it('accepts the allow-listed profile payload', async () => {
    await request(app.getHttpAdapter().getInstance()).put('/jogador/perfil').set('Authorization', authorization())
      .send({ nome: 'Jorge', cidade: 'Cascavel', bairro: 'Centro', esporte_individual: 'Tênis', nivel_individual: 'Intermediário' }).expect(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ perfil_completo: true }));
  });
});
