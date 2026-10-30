import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App, { AuthPage, ChatScheduleModal, CreateGame, FigmaProfilePage, InstallPrompt, NotificationsModal } from './App';
import { Api, SessionUser } from './services/api';

const user: SessionUser = {
  id: 'user-1',
  email: 'jorge@example.com',
  jogador: { id: 'player-1', nome: 'Jorge', perfil_completo: true },
};

describe('AuthPage', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('authenticates using the real email and password fields', async () => {
    const onAuthenticated = vi.fn();
    const login = vi.spyOn(Api, 'login').mockResolvedValue({ usuario: user });
    render(<MemoryRouter><AuthPage mode="login" onAuthenticated={onAuthenticated} /></MemoryRouter>);

    await userEvent.type(screen.getByLabelText('E-mail'), 'jorge@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-segura');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith({ email: 'jorge@example.com', senha: 'senha-segura' }));
    expect(onAuthenticated).toHaveBeenCalledWith(user);
  });

  it('keeps an API authentication error visible to the user', async () => {
    const onAuthenticated = vi.fn();
    vi.spyOn(Api, 'login').mockRejectedValue(new Error('E-mail ou senha inválidos.'));
    render(<MemoryRouter><AuthPage mode="login" onAuthenticated={onAuthenticated} /></MemoryRouter>);

    await userEvent.type(screen.getByLabelText('E-mail'), 'jorge@example.com');
    await userEvent.type(screen.getByLabelText('Senha'), 'senha-incorreta');
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

    expect(await screen.findByText('E-mail ou senha inválidos.')).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it('redirects an unauthenticated app session to login', async () => {
    vi.spyOn(Api, 'session').mockRejectedValue(new Error('Sessão expirada.'));
    window.history.replaceState({}, '', '/descobrir');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('redirects an incomplete profile from discovery to its real profile form', async () => {
    vi.spyOn(Api, 'session').mockResolvedValue({
      usuario: { ...user, jogador: { ...user.jogador, perfil_completo: false } },
    });
    vi.spyOn(Api, 'sports').mockResolvedValue([]);
    window.history.replaceState({}, '', '/descobrir');
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Meu perfil' })).toBeInTheDocument();
  });

  it('blocks signup when password confirmation differs', async () => {
    const register = vi.spyOn(Api, 'register');
    render(<MemoryRouter><AuthPage mode="signup" onAuthenticated={vi.fn()} /></MemoryRouter>);

    await userEvent.type(screen.getByLabelText('Nome'), 'Jorge');
    await userEvent.type(screen.getByLabelText('E-mail'), 'jorge@example.com');
    const passwords = screen.getAllByLabelText(/senha/i);
    await userEvent.type(passwords[0], 'senha-1');
    await userEvent.type(passwords[1], 'senha-2');
    fireEvent.submit(screen.getByRole('button', { name: 'Criar conta' }).closest('form')!);

    expect(await screen.findByText('As senhas não coincidem.')).toBeInTheDocument();
    expect(register).not.toHaveBeenCalled();
  });

  it('marks a notification as read and opens its conversation', async () => {
    const onClose = vi.fn();
    const readNotification = vi.spyOn(Api, 'readNotification').mockResolvedValue({
      id: 'notification-1', tipo: 'MENSAGEM', titulo: 'Nova mensagem', corpo: 'Oi!', dados: { conversa_id: 'conversation-1' }, lida_em: null, data_criacao: '2026-09-22T12:00:00.000Z',
    });
    vi.spyOn(Api, 'notifications').mockResolvedValue([{
      id: 'notification-1', tipo: 'MENSAGEM', titulo: 'Nova mensagem', corpo: 'Oi!', dados: { conversa_id: 'conversation-1' }, lida_em: null, data_criacao: '2026-09-22T12:00:00.000Z',
    }]);
    const Location = () => <span data-testid="location">{useLocation().pathname}</span>;
    render(<MemoryRouter><NotificationsModal onClose={onClose} /><Location /></MemoryRouter>);

    await userEvent.click(await screen.findByRole('button', { name: /nova mensagem/i }));

    await waitFor(() => expect(readNotification).toHaveBeenCalledWith('notification-1'));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/conversas/conversation-1');
  });

  it('does not show the install prompt after the user has dismissed it', () => {
    localStorage.setItem('sports_match_install_dismissed', 'true');
    render(<InstallPrompt />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('persists dismissal when the install prompt is closed', async () => {
    render(<InstallPrompt />);
    const event = new Event('beforeinstallprompt');
    Object.assign(event, {
      prompt: vi.fn(),
      userChoice: Promise.resolve({ outcome: 'dismissed' }),
    });
    window.dispatchEvent(event);

    await userEvent.click(await screen.findByRole('button', { name: 'Agora não' }));

    expect(localStorage.getItem('sports_match_install_dismissed')).toBe('true');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('rejects an invalid profile photo before calling the API', async () => {
    const upload = vi.spyOn(Api, 'uploadProfilePhoto');
    vi.spyOn(Api, 'sports').mockResolvedValue([]);
    render(<MemoryRouter><FigmaProfilePage user={user} refresh={vi.fn()} /></MemoryRouter>);

    await userEvent.click(screen.getByRole('button', { name: 'Editar perfil' }));
    fireEvent.change(screen.getByLabelText('Escolher foto'), {
      target: { files: [new File(['not an image'], 'arquivo.txt', { type: 'text/plain' })] },
    });

    expect(await screen.findByText(/Escolha uma imagem JPEG, PNG ou WebP/)).toBeInTheDocument();
    expect(upload).not.toHaveBeenCalled();
  });

  it('creates a private game from the chat with the actual conversation id', async () => {
    const onClose = vi.fn();
    const createChatGame = vi.spyOn(Api, 'createChatGame').mockResolvedValue({
      message: 'Partida agendada.', partida: { id: 'game-1', modalidade: 'Tênis', local_nome: 'Quadra central', data_hora: '2026-12-25T18:30:00.000Z', status: 'AGENDADA' },
    });
    vi.spyOn(Api, 'sports').mockResolvedValue([{ id: 'sport-1', nome: 'Tênis' }]);
    render(<MemoryRouter><ChatScheduleModal conversationId="conversation-1" onClose={onClose} /></MemoryRouter>);
    const dateTime = '2026-12-25T18:30';

    await userEvent.selectOptions(await screen.findByLabelText('Modalidade'), 'Tênis');
    await userEvent.type(screen.getByLabelText('Local'), 'Quadra central');
    fireEvent.change(screen.getByLabelText(/Data e hor/), { target: { value: dateTime } });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar proposta' }));

    await waitFor(() => expect(createChatGame).toHaveBeenCalledWith({
      conversa_id: 'conversation-1', modalidade: 'Tênis', local_nome: 'Quadra central', data_hora: new Date(dateTime).toISOString(),
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('publishes a public game using the current profile location', async () => {
    const onCreated = vi.fn();
    const player = { ...user, jogador: { ...user.jogador, esporte_individual: 'Tênis', cidade: 'São Paulo', bairro: 'Pinheiros' } };
    const createGame = vi.spyOn(Api, 'createGame').mockResolvedValue({
      id: 'game-1', criador_id: 'player-1', modalidade: 'Tênis', local_nome: 'Quadra central', cidade: 'São Paulo', bairro: 'Pinheiros', capacidade: 4, data_hora: '2026-12-25T18:30:00.000Z', status: 'ABERTA', participantes: [], total_participantes: 1, minha_participacao: true, sou_organizador: true,
    });
    vi.spyOn(Api, 'sports').mockResolvedValue([{ id: 'sport-1', nome: 'Tênis' }]);
    render(<MemoryRouter><CreateGame user={player} onClose={vi.fn()} onCreated={onCreated} /></MemoryRouter>);
    const dateTime = '2026-12-25T18:30';

    await userEvent.selectOptions(await screen.findByLabelText('Modalidade'), 'Tênis');
    await userEvent.type(screen.getByLabelText('Local'), 'Quadra central');
    fireEvent.change(screen.getByLabelText(/Data e hor/), { target: { value: dateTime } });
    await userEvent.click(screen.getByRole('button', { name: 'Publicar partida' }));

    await waitFor(() => expect(createGame).toHaveBeenCalledWith({
      modalidade: 'Tênis', visibilidade: 'PUBLICA', local_nome: 'Quadra central', cidade: 'São Paulo', bairro: 'Pinheiros', capacidade: 4, data_hora: new Date(dateTime).toISOString(), descricao: '',
    }));
    expect(onCreated).toHaveBeenCalled();
  });
});
