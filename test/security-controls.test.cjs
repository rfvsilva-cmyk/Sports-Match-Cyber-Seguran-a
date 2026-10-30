const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const test = require('node:test');

const root = join(__dirname, '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('IDOR: chat history checks that the authenticated player belongs to the match', () => {
  const source = read('src/chat/chat.service.ts');
  assert.match(source, /if \(matchData\.id_jogador1 !== jogador\.id && matchData\.id_jogador2 !== jogador\.id\)/);
  assert.match(source, /ForbiddenException\('Acesso negado a esta conversa\.'\)/);
});

test('IDOR: sending a message checks conversation ownership', () => {
  const source = read('src/chat/chat.service.ts');
  assert.match(source, /Acesso negado para enviar mensagem nesta conversa/);
  assert.match(source, /remetente_id: jogador\.id/);
});

test('IDOR: notifications can only be marked by their owner', () => {
  const source = read('src/notificacao/notificacao.service.ts');
  assert.match(source, /\.eq\('jogador_id', jogador\.id\)/);
  assert.match(source, /Notificação não encontrada/);
});

test('IDOR: only a game participant/organizer can perform sensitive game actions', () => {
  const chat = read('src/chat/chat.service.ts');
  const games = read('src/partidas/partidas.service.ts');
  assert.match(chat, /partida\.oponente_id !== jogador\.id/);
  assert.match(chat, /partida\.criador_id !== jogador\.id && partida\.oponente_id !== jogador\.id/);
  assert.match(games, /partida\.criador_id !== jogador\.id/);
});

test('IDOR: evaluations require participation and cannot target yourself', () => {
  const source = read('src/avaliacao/avaliacao.service.ts');
  assert.match(source, /participanteIds\.includes\(avaliador\.id\)/);
  assert.match(source, /dto\.avaliado_id === avaliador\.id/);
});

test('code injection: user input is validated and the frontend has no dangerous HTML sinks', () => {
  const bootstrap = read('src/bootstrap.ts');
  const chatDto = read('src/chat/dto/chat.dto.ts');
  const app = read('front-end/src/app/App.tsx');
  assert.match(bootstrap, /forbidNonWhitelisted: true/);
  assert.match(chatDto, /MaxLength\(2000/);
  assert.doesNotMatch(app, /dangerouslySetInnerHTML|innerHTML\s*=|eval\s*\(|new Function\s*\(/);
});

test('code injection: profile image URLs only accept http/https', () => {
  const dto = read('src/jogador/dto/atualizar-perfil.dto.ts');
  assert.match(dto, /IsUrl\(\{ protocols: \['http', 'https'\]/);
});

test('file upload: image MIME types are backed by magic-byte validation', () => {
  const service = read('src/jogador/jogador.service.ts');
  assert.match(service, /isValidImageSignature/);
  assert.match(service, /FF|0xff/);
  assert.match(service, /RIFF/);
  assert.match(service, /WEBP/);
});

test('bots/brute force: authentication-sensitive endpoints have rate limiting', () => {
  const controller = read('src/auth/auth.controller.ts');
  const guard = read('src/auth/auth-rate-limit.guard.ts');
  for (const endpoint of ['cadastro', 'login', 'recuperar-senha', 'redefinir-senha']) {
    assert.match(controller, new RegExp(`Post\\('${endpoint}'\\)[\\s\\S]*?UseGuards\\(AuthRateLimitGuard\\)`));
  }
  assert.match(guard, /HttpStatus\.TOO_MANY_REQUESTS/);
  assert.match(guard, /Muitas tentativas/);
});

test('bots/brute force: password recovery does not reveal whether an email exists', () => {
  const source = read('src/auth/auth.service.ts');
  assert.match(source, /Se existir uma conta para este e-mail/);
  assert.match(source, /if \(!usuario\) return \{ message: genericMessage \}/);
});

test('session security: JWT is kept in an HttpOnly cookie and is not returned to the browser body', () => {
  const source = read('src/auth/auth.controller.ts');
  assert.match(source, /httpOnly: true/);
  assert.match(source, /sameSite: 'lax'/);
  assert.match(source, /secure: process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /const \{ access_token, \.\.\.session \}/);
});

test('CORS security: credentialed requests are restricted to configured origins', () => {
  const source = read('src/bootstrap.ts');
  assert.doesNotMatch(source, /origin:\s*[\s\S]*\|\|\s*true/);
  assert.match(source, /configuredOrigins\.includes\(origin\)/);
});

test('security headers are configured for production deployment', () => {
  const vercel = read('vercel.json');
  for (const header of ['X-Content-Type-Options', 'X-Frame-Options', 'Referrer-Policy', 'Permissions-Policy']) {
    assert.match(vercel, new RegExp(header));
  }
});

test('server secrets are not exposed through Vite variables', () => {
  const env = read('.env.example');
  assert.doesNotMatch(env, /VITE_.*SERVICE_ROLE|VITE_.*JWT_SECRET/i);
  assert.match(env, /SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(env, /JWT_SECRET/);
});
