import { ConflictException, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthService } from '../src/auth/auth.service';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  const authService = { cadastro: jest.fn(), login: jest.fn(), sessao: jest.fn(), solicitarRedefinicaoSenha: jest.fn(), redefinirSenha: jest.fn() };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(AuthService).useValue(authService).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  beforeEach(() => jest.resetAllMocks());
  afterAll(async () => app.close());

  it('rejects an invalid registration before it reaches the service', async () => {
    await request(app.getHttpAdapter().getInstance()).post('/auth/cadastro').send({ email: 'invalid-email', senha: '123' }).expect(400);
    expect(authService.cadastro).not.toHaveBeenCalled();
  });

  it('creates a session only in an HttpOnly cookie', async () => {
    authService.cadastro.mockResolvedValue({ access_token: 'server-only-token', message: 'Conta criada', usuario: { id: 'user-1', email: 'jogador@example.com', jogador: { id: 'player-1' } } });
    const response = await request(app.getHttpAdapter().getInstance())
      .post('/auth/cadastro').send({ nome: 'Jogador', email: 'jogador@example.com', senha: 'Password123!' }).expect(201);
    expect(response.body.access_token).toBeUndefined();
    expect(response.headers['set-cookie'][0]).toContain('sports_match_session=server-only-token');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });

  it('returns a conflict for an existing email', async () => {
    authService.cadastro.mockRejectedValue(new ConflictException('E-mail já cadastrado no sistema.'));
    await request(app.getHttpAdapter().getInstance())
      .post('/auth/cadastro').send({ nome: 'Jogador', email: 'jogador@example.com', senha: 'Password123!' }).expect(409);
  });
});
