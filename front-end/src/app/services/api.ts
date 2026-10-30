import { createClient, RealtimeChannel } from '@supabase/supabase-js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
let cacheScope = 'anonymous';

export interface Profile {
  id: string;
  usuario_id?: string;
  nome: string;
  foto_url?: string | null;
  bio?: string | null;
  cidade?: string | null;
  bairro?: string | null;
  esporte_individual?: string | null;
  modalidade_id?: string | null;
  nivel_individual?: string | null;
  perfil_completo: boolean;
  media_avaliacao?: number | null;
  total_avaliacoes?: number | null;
}

export interface SessionUser {
  id: string;
  email: string;
  jogador: Profile;
}

export interface Conversation {
  match_id: string;
  conversa_id: string;
  oponente: Profile;
  nao_lidas?: number;
}

export interface Message {
  id: string;
  conversa_id: string;
  conteudo: string;
  remetente_id: string;
  data_criacao: string;
  remetente?: Pick<Profile, 'id' | 'nome' | 'foto_url'>;
}

export interface GameParticipant {
  jogador_id: string;
  jogador?: Pick<Profile, 'id' | 'nome' | 'foto_url'>;
}

export interface Game {
  id: string;
  criador_id: string;
  modalidade: string;
  local_nome: string;
  cidade: string;
  bairro: string;
  descricao?: string | null;
  capacidade: number;
  data_hora: string;
  status: 'PENDENTE' | 'AGENDADA' | 'ABERTA' | 'LOTADA' | 'CONCLUIDA' | 'CANCELADA';
  participantes: GameParticipant[];
  total_participantes: number;
  minha_participacao: boolean;
  sou_organizador: boolean;
  visibilidade?: 'PUBLICA' | 'PRIVADA_LINK';
  convite_token?: string | null;
  aguardando_minha_confirmacao?: boolean;
  proposta_enviada_por_mim?: boolean;
}
export interface ChatGame {
  id: string;
  modalidade: string;
  local_nome: string;
  data_hora: string;
  status: 'PENDENTE' | 'AGENDADA' | 'CONCLUIDA' | 'CANCELADA';
  aguardando_minha_confirmacao?: boolean;
}
export interface Notification {
  id: string;
  tipo: 'MATCH' | 'MENSAGEM' | 'PARTIDA' | 'AVALIACAO';
  titulo: string;
  corpo: string;
  dados: Record<string, string>;
  lida_em?: string | null;
  data_criacao: string;
}

export interface ApiError extends Error {
  status?: number;
}
export interface Sport { id: string; slug: string; nome: string; }

export type ProfileUpdate = Partial<Pick<Profile,
  'nome' | 'foto_url' | 'bio' | 'cidade' | 'bairro' | 'modalidade_id' | 'nivel_individual'
>>;

const profileUpdateFields = [
  'nome',
  'foto_url',
  'bio',
  'cidade',
  'bairro',
  'modalidade_id',
  'nivel_individual',
] as const;

// The API rejects unknown fields. Keep this runtime allow-list as a second
// line of defense in case a cached client or a future screen passes a full Profile.
export function serializeProfileUpdate(data: Partial<Profile>): ProfileUpdate {
  return Object.fromEntries(
    profileUpdateFields
      .filter((field) => data[field] !== undefined)
      .map((field) => [field, data[field]]),
  ) as ProfileUpdate;
}

function cacheKey(key: string) {
  return `sports_match_cache_${cacheScope}_${key}`;
}

function getCached<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(key));
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function cache<T>(key: string, value: T) {
  try { localStorage.setItem(cacheKey(key), JSON.stringify(value)); } catch { /* storage may be unavailable */ }
  return value;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    });
  } catch {
    const error = new Error('Você está offline ou não foi possível alcançar o servidor.') as ApiError;
    error.status = 0;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(Array.isArray(body.message) ? body.message.join(' ') : body.message || 'Não foi possível concluir a operação.') as ApiError;
    error.status = response.status;
    throw error;
  }
  return response.json() as Promise<T>;
}

async function upload<T>(path: string, file: File): Promise<T> {
  const body = new FormData();
  body.append('foto', file);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST', credentials: 'include', body });
  } catch {
    throw new Error('Você está offline ou não foi possível alcançar o servidor.');
  }
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(Array.isArray(result.message) ? result.message.join(' ') : result.message || 'Não foi possível enviar a foto.');
  }
  return response.json() as Promise<T>;
}

export const Api = {
  setCacheScope(userId: string) { cacheScope = userId; },
  clearCachedData(userId?: string) {
    const prefix = `sports_match_cache_${userId || cacheScope}_`;
    Object.keys(localStorage).filter((key) => key.startsWith(prefix)).forEach((key) => localStorage.removeItem(key));
  },
  login(data: { email: string; senha: string }) {
    return request<{ usuario: SessionUser }>('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  },
  register(data: { nome: string; email: string; senha: string }) {
    return request<{ usuario: SessionUser }>('/auth/cadastro', { method: 'POST', body: JSON.stringify(data) });
  },
  logout() { return request<void>('/auth/logout', { method: 'POST' }); },
  session() { return request<{ usuario: SessionUser }>('/auth/sessao'); },
  requestPasswordReset(email: string) {
    return request<{ message: string }>('/auth/recuperar-senha', { method: 'POST', body: JSON.stringify({ email }) });
  },
  resetPassword(token: string, senha: string) {
    return request<{ message: string }>('/auth/redefinir-senha', { method: 'POST', body: JSON.stringify({ token, senha }) });
  },
  profile() { return request<Profile>('/jogador/meu-perfil'); },
  publicProfile(id: string) { return request<Profile>(`/jogador/${id}/publico`); },
  sports() { return request<Sport[]>('/modalidades'); },
  requestSport(nome: string) { return request<{ message: string }>('/modalidades/solicitacoes', { method: 'POST', body: JSON.stringify({ nome }) }); },
  updateProfile(data: Partial<Profile>) {
    return request<{ jogador: Profile }>('/jogador/perfil', {
      method: 'PUT',
      body: JSON.stringify(serializeProfileUpdate(data)),
    });
  },
  uploadProfilePhoto(file: File) {
    return upload<{ message: string; jogador: Profile }>('/jogador/foto', file);
  },
  removeProfilePhoto() {
    return request<{ message: string; jogador: Profile }>('/jogador/foto', { method: 'DELETE' });
  },
  notifications() { return request<Notification[]>('/notificacoes'); },
  unreadNotifications() { return request<{ total: number }>('/notificacoes/nao-lidas'); },
  readNotification(id: string) { return request<Notification>(`/notificacoes/${id}/ler`, { method: 'PATCH' }); },
  readAllNotifications() { return request<{ message: string }>('/notificacoes/ler-todas', { method: 'PATCH' }); },
  async discovery(filters: Record<string, string> = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value))).toString();
    try {
      return cache('discovery', await request<{ total: number; perfis: Profile[] }>(`/descoberta/feed${query ? `?${query}` : ''}`));
    } catch (error) {
      const saved = getCached<{ total: number; perfis: Profile[] }>('discovery');
      if (saved) return saved;
      throw error;
    }
  },
  swipe(id_destino: string, tipo: 'LIKE' | 'DISLIKE') {
    return request<{ match: boolean; conversa_id?: string }>('/descoberta/swipe', { method: 'POST', body: JSON.stringify({ id_destino, tipo }) });
  },
  conversations() { return request<Conversation[]>('/chat/conversas'); },
  conversation(id: string) { return request<{ mensagens: Message[]; partidas: ChatGame[]; match: unknown; oponente?: Profile }>(`/chat/conversa/${id}`); },
  sendMessage(conversa_id: string, conteudo: string) {
    return request<Message>('/chat/mensagem', { method: 'POST', body: JSON.stringify({ conversa_id, conteudo }) });
  },
  realtimeToken(conversationId: string) {
    return request<{ token: string }>(`/chat/conversa/${conversationId}/realtime-token`);
  },
  createChatGame(data: Pick<ChatGame, 'modalidade' | 'local_nome' | 'data_hora'> & { conversa_id: string }) {
    return request<{ message: string; partida: ChatGame }>('/chat/partida', { method: 'POST', body: JSON.stringify(data) });
  },
  updateChatGameStatus(id: string, status: 'CONCLUIDA' | 'CANCELADA') {
    return request<{ message: string; partida: ChatGame }>(`/chat/partida/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  acceptChatGame(id: string) {
    return request<{ message: string; partida: ChatGame }>(`/chat/partida/${id}/aceitar`, { method: 'POST' });
  },
  async games(filters: Record<string, string> = {}) {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => Boolean(value))).toString();
    try {
      return cache('games', await request<Game[]>(`/partidas${query ? `?${query}` : ''}`));
    } catch (error) {
      const saved = getCached<Game[]>('games');
      if (saved) return saved;
      throw error;
    }
  },
  myGames() { return request<Game[]>('/partidas/minhas'); },
  createGame(data: Pick<Game, 'modalidade' | 'local_nome' | 'cidade' | 'bairro' | 'capacidade' | 'data_hora' | 'descricao'> & { visibilidade?: 'PUBLICA' | 'PRIVADA_LINK' }) {
    return request<Game>('/partidas', { method: 'POST', body: JSON.stringify(data) });
  },
  gameByInvite(token: string) { return request<Game>(`/partidas/convite/${encodeURIComponent(token)}`); },
  joinGame(id: string) { return request(`/partidas/${id}/participacoes`, { method: 'POST' }); },
  leaveGame(id: string) { return request(`/partidas/${id}/sair`, { method: 'POST' }); },
  updateGameStatus(id: string, status: 'CONCLUIDA' | 'CANCELADA') {
    return request<{ partida: Game }>(`/partidas/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
  },
  review(data: { partida_id: string; avaliado_id: string; nota: number; comentario?: string }) {
    return request('/avaliacao', { method: 'POST', body: JSON.stringify(data) });
  },
};

export async function subscribeToMessages(
  conversationId: string,
  onMessage: (message: Message) => void,
): Promise<() => void> {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key || !navigator.onLine) return () => undefined;

  const { token } = await Api.realtimeToken(conversationId);
  const client = createClient(url, key, { auth: { persistSession: false } });
  client.realtime.setAuth(token);
  const channel: RealtimeChannel = client
    .channel(`conversation:${conversationId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'mensagem', filter: `conversa_id=eq.${conversationId}`,
    }, (payload) => onMessage(payload.new as Message))
    .subscribe();

  return () => { void client.removeChannel(channel); };
}
