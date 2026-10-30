import { afterEach, describe, expect, it, vi } from 'vitest';
import { Api, serializeProfileUpdate } from './api';

describe('serializeProfileUpdate', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends only fields accepted by the profile endpoint', () => {
    const result = serializeProfileUpdate({
      id: 'player-1',
      usuario_id: 'user-1',
      nome: 'Jorge',
      foto_url: 'https://images.example/avatar.webp',
      bio: 'Tênis aos sábados',
      cidade: 'São Paulo',
      bairro: 'Pinheiros',
      modalidade_id: 'tenis',
      nivel_individual: 'Intermediário',
      perfil_completo: true,
      media_avaliacao: 5,
    });

    expect(result).toEqual({
      nome: 'Jorge',
      foto_url: 'https://images.example/avatar.webp',
      bio: 'Tênis aos sábados',
      cidade: 'São Paulo',
      bairro: 'Pinheiros',
      modalidade_id: 'tenis',
      nivel_individual: 'Intermediário',
    });
  });

  it('does not send unset optional fields', () => {
    expect(serializeProfileUpdate({ nome: 'Jorge', bio: undefined })).toEqual({ nome: 'Jorge' });
  });

  it('loads notifications from the authenticated API endpoint', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(Api.notifications()).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledWith('/api/notificacoes', expect.objectContaining({
      credentials: 'include',
    }));
  });

  it('sends profile photos as multipart data without a JSON content type', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Foto atualizada.', jogador: {} }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const photo = new File(['image'], 'foto.png', { type: 'image/png' });

    await Api.uploadProfilePhoto(photo);

    const [, init] = fetchMock.mock.calls[0];
    expect(init).toEqual(expect.objectContaining({ method: 'POST', credentials: 'include' }));
    expect(init.headers).toBeUndefined();
    expect((init.body as FormData).get('foto')).toBe(photo);
  });

  it('sends a chat message only to the selected conversation', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: 'message-1' }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await Api.sendMessage('conversation-1', 'Vamos jogar sábado?');

    expect(fetchMock).toHaveBeenCalledWith('/api/chat/mensagem', expect.objectContaining({
      method: 'POST',
      credentials: 'include',
      body: JSON.stringify({ conversa_id: 'conversation-1', conteudo: 'Vamos jogar sábado?' }),
    }));
  });

  it('uses the protected endpoints to enter and conclude a public game', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
    vi.stubGlobal('fetch', fetchMock);

    await Api.joinGame('game-1');
    await Api.updateGameStatus('game-1', 'CONCLUIDA');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/partidas/game-1/participacoes', expect.objectContaining({ method: 'POST', credentials: 'include' }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/partidas/game-1/status', expect.objectContaining({
      method: 'PATCH',
      credentials: 'include',
      body: JSON.stringify({ status: 'CONCLUIDA' }),
    }));
  });
});
