require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const test = require('node:test');
const { AuthController } = require('../src/auth/auth.controller');

function responseSpy() {
  return {
    cookies: [],
    cleared: [],
    cookie(...args) { this.cookies.push(args); },
    clearCookie(...args) { this.cleared.push(args); },
  };
}

test('cadastro coloca a sessão somente no cookie HttpOnly', async () => {
  const authService = {
    cadastro: async () => ({
      access_token: 'server-only-token',
      message: 'Conta criada',
      usuario: { id: 'user-1', email: 'jogador@example.com', jogador: { id: 'player-1' } },
    }),
  };
  const controller = new AuthController(authService);
  const response = responseSpy();

  const body = await controller.cadastro({ nome: 'Jogador', email: 'jogador@example.com', senha: '123456' }, response);

  assert.equal(body.access_token, undefined);
  assert.equal(body.usuario.id, 'user-1');
  assert.equal(response.cookies.length, 1);
  assert.equal(response.cookies[0][0], 'sports_match_session');
  assert.equal(response.cookies[0][1], 'server-only-token');
  assert.equal(response.cookies[0][2].httpOnly, true);
  assert.equal(response.cookies[0][2].sameSite, 'lax');
});

test('logout limpa o cookie da sessão', () => {
  const controller = new AuthController({});
  const response = responseSpy();
  controller.logout(response);
  assert.equal(response.cleared.length, 1);
  assert.equal(response.cleared[0][0], 'sports_match_session');
});
