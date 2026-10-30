import { expect, Page, test } from '@playwright/test';

const authenticatedUser = {
  id: 'user-1',
  email: 'jorge@example.com',
  jogador: {
    id: 'player-1', nome: 'Jorge', perfil_completo: true,
    esporte_individual: 'Tênis', cidade: 'São Paulo', bairro: 'Pinheiros', nivel_individual: 'Intermediário',
  },
};

async function mockApi(page: Page, session = false) {
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

    if (path === '/api/auth/sessao') return session ? json({ usuario: authenticatedUser }) : json({ message: 'Sessão expirada.' }, 401);
    if (path === '/api/auth/login' && request.method() === 'POST') return json({ usuario: authenticatedUser });
    if (path === '/api/descoberta/feed') return json({ total: 0, perfis: [] });
    if (path === '/api/modalidades') return json([{ id: 'sport-1', nome: 'Tênis' }]);
    if (path === '/api/notificacoes/nao-lidas') return json({ total: 0 });
    if (path === '/api/chat/conversa/conversation-1') return json({ mensagens: [], partidas: [], match: {} });
    if (path === '/api/chat/mensagem' && request.method() === 'POST') return json({ id: 'message-1', conversa_id: 'conversation-1', conteudo: 'Vamos jogar sábado?', remetente_id: 'player-1', data_criacao: '2026-12-25T18:30:00.000Z' });
    if (path === '/api/partidas' && request.method() === 'GET') return json([]);
    if (path === '/api/partidas' && request.method() === 'POST') return json({ id: 'game-1' });
    return json({});
  });
}

test('login leva um usuário real para descoberta', async ({ page }) => {
  await mockApi(page);
  await page.goto('/login');

  await page.getByLabel('E-mail').fill('jorge@example.com');
  await page.getByLabel('Senha').fill('senha-segura');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/descobrir$/);
  await expect(page.getByRole('heading', { name: 'Descoberta' })).toBeVisible();
  await expect(page.getByText('Sem novos perfis')).toBeVisible();
});

test('perfil completo publica partida pública pelo endpoint existente', async ({ page }) => {
  let published: Record<string, unknown> | undefined;
  await mockApi(page, true);
  await page.route('**/api/partidas', async (route) => {
    if (route.request().method() === 'POST') {
      published = route.request().postDataJSON();
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'game-1' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });
  await page.goto('/partidas');

  await page.getByRole('button', { name: 'Criar partida' }).click();
  await page.getByLabel('Modalidade').selectOption({ label: 'Tênis' });
  await page.getByLabel('Local').fill('Quadra central');
  await page.getByLabel(/Data e hor/).fill('2026-12-25T18:30');
  await page.getByRole('button', { name: 'Publicar partida' }).click();

  await expect.poll(() => published).toMatchObject({
    modalidade: 'Tênis', local_nome: 'Quadra central', cidade: 'São Paulo', bairro: 'Pinheiros', capacidade: 4,
  });
});

test('chat envia mensagem para a conversa aberta', async ({ page }) => {
  let message: Record<string, unknown> | undefined;
  await mockApi(page, true);
  await page.route('**/api/chat/mensagem', async (route) => {
    message = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'message-1', conversa_id: 'conversation-1', conteudo: 'Vamos jogar sábado?', remetente_id: 'player-1', data_criacao: '2026-12-25T18:30:00.000Z' }) });
  });
  await page.goto('/conversas/conversation-1');

  await page.getByPlaceholder('Digite sua mensagem...').fill('Vamos jogar sábado?');
  await page.locator('.sm-send button').click();

  await expect.poll(() => message).toEqual({ conversa_id: 'conversation-1', conteudo: 'Vamos jogar sábado?' });
  await expect(page.getByText('Vamos jogar sábado?')).toBeVisible();
});

test('chat cria partida privada para a conversa aberta', async ({ page }) => {
  let game: Record<string, unknown> | undefined;
  await mockApi(page, true);
  await page.route('**/api/chat/partida', async (route) => {
    game = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'game-1' }) });
  });
  await page.goto('/conversas/conversation-1');

  await page.getByRole('button', { name: 'Marcar partida' }).click();
  await page.getByLabel('Modalidade').selectOption({ label: 'Tênis' });
  await page.getByLabel('Local').fill('Quadra central');
  await page.getByLabel('Data e horário').fill('2026-12-25T18:30');
  await page.getByRole('button', { name: 'Enviar proposta' }).click();

  await expect.poll(() => game).toMatchObject({
    conversa_id: 'conversation-1', modalidade: 'Tênis', local_nome: 'Quadra central',
  });
});

test('jogador convidado aceita proposta privada e a confirma na agenda', async ({ page }) => {
  let accepted = false;
  await mockApi(page, true);
  await page.route('**/api/chat/conversa/conversation-1', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      mensagens: [],
      oponente: { id: 'player-2', nome: 'Alexandre', esporte_individual: 'Tênis', nivel_individual: 'Intermediário' },
      partidas: [{ id: 'game-1', modalidade: 'Tênis', local_nome: 'Quadra central', data_hora: '2026-12-25T18:30:00.000Z', status: 'PENDENTE', aguardando_minha_confirmacao: true }],
    }) });
  });
  await page.route('**/api/chat/partida/game-1/aceitar', async (route) => {
    accepted = route.request().method() === 'POST';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ partida: { id: 'game-1', status: 'AGENDADA' } }) });
  });

  await page.goto('/conversas/conversation-1');
  await expect(page.getByRole('heading', { name: 'Alexandre' })).toBeVisible();
  await page.getByRole('button', { name: 'Aceitar e adicionar à agenda' }).click();

  await expect.poll(() => accepted).toBe(true);
  await expect(page.getByText('Partida confirmada e adicionada à sua agenda.')).toBeVisible();
});

test('convite privado mostra a partida e permite entrar', async ({ page }) => {
  let joined = false;
  await mockApi(page, true);
  await page.route('**/api/partidas/convite/token-seguro', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 'game-private', modalidade: 'Tênis', local_nome: 'Quadra central', cidade: 'São Paulo', bairro: 'Pinheiros', capacidade: 4, data_hora: '2026-12-25T18:30:00.000Z', status: 'ABERTA', participantes: [], total_participantes: 1, minha_participacao: false, sou_organizador: false }) });
  });
  await page.route('**/api/partidas/game-private/participacoes', async (route) => { joined = route.request().method() === 'POST'; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ message: 'Você entrou na partida.' }) }); });
  await page.goto('/partidas/convite/token-seguro');
  await expect(page.getByRole('heading', { name: 'Você foi convidado para uma partida' })).toBeVisible();
  await page.getByRole('button', { name: 'Confirmar entrada' }).click();
  await expect.poll(() => joined).toBe(true);
  await expect(page.getByText('Você entrou na partida. Ela está na sua agenda.')).toBeVisible();
});

test('agenda mostra pendência recebida e permite confirmar no modal', async ({ page }) => {
  let accepted = false;
  await mockApi(page, true);
  await page.route('**/api/partidas/minhas', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 'pending-1', criador_id: 'player-2', modalidade: 'Tênis', local_nome: 'Quadra central', cidade: 'São Paulo', bairro: 'Pinheiros', capacidade: 2, data_hora: '2026-12-25T18:30:00.000Z', status: 'PENDENTE', participantes: [], total_participantes: 0, minha_participacao: false, sou_organizador: false, aguardando_minha_confirmacao: true }]) });
  });
  await page.route('**/api/chat/partida/pending-1/aceitar', async (route) => { accepted = route.request().method() === 'POST'; await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ partida: { id: 'pending-1', status: 'AGENDADA' } }) }); });
  await page.goto('/agenda');
  await expect(page.getByRole('heading', { name: 'Pendentes' })).toBeVisible();
  await page.getByText('Tênis').click();
  await page.getByRole('button', { name: 'Aceitar e adicionar à agenda' }).click();
  await expect.poll(() => accepted).toBe(true);
});
