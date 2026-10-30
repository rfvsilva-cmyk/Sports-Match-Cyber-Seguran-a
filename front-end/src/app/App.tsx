import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Bell, CalendarDays, Check, ChevronLeft, Compass, Heart, LogOut, MapPin,
  MessageCircle, Plus, Send, Star, User, Users, X,
} from 'lucide-react';
import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Api, ChatGame, Conversation, Game, Message, Notification, Profile, SessionUser, Sport, subscribeToMessages } from './services/api';
import logoSportsMatch from '../imports/logo-app-sports-match.png';

type Notice = { kind: 'error' | 'success'; text: string } | null;
type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : 'Algo não saiu como esperado. Tente novamente.';
}

function formatChatTime(value?: string | null) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime())
    ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    : '';
}

function NoticeBox({ notice }: { notice: Notice }) {
  if (!notice) return null;
  return <p className={`sm-notice ${notice.kind}`}>{notice.text}</p>;
}

function Loading() {
  return <main className="sm-loading"><div className="sm-spinner" /><p>Carregando Sports Match...</p></main>;
}

export function InstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const dismissed = localStorage.getItem('sports_match_install_dismissed') === 'true';
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true;
    if (dismissed || standalone) return;
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/crios|fxios|edgios|chrome|android/i.test(navigator.userAgent);
    if (isIos && isSafari) { setIos(true); setVisible(true); }
    const capture = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent); setVisible(true); };
    window.addEventListener('beforeinstallprompt', capture);
    return () => window.removeEventListener('beforeinstallprompt', capture);
  }, []);
  const dismiss = () => { localStorage.setItem('sports_match_install_dismissed', 'true'); setVisible(false); };
  const install = async () => {
    if (!promptEvent) return;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    setPromptEvent(null);
    if (choice.outcome !== 'accepted') dismiss(); else setVisible(false);
  };
  if (!visible) return null;
  return <div className="sm-install-backdrop" role="dialog" aria-modal="true" aria-labelledby="install-title"><section className="sm-install-modal"><button className="sm-icon-button sm-install-close" onClick={dismiss} aria-label="Fechar"><X /></button><img className="sm-install-logo" src={logoSportsMatch} alt="Sports Match" /><h2 id="install-title">Instale o Sports Match</h2><p>Tenha acesso rápido às suas partidas e conversas diretamente pela tela inicial.</p>{ios ? <p className="sm-install-ios">No Safari, toque em <strong>Compartilhar</strong> e depois em <strong>Adicionar à Tela de Início</strong>.</p> : <button className="sm-primary" onClick={() => void install()}>Instalar aplicativo</button>}<button className="sm-install-later" onClick={dismiss}>Agora não</button></section></div>;
}

function Empty({ title, children }: { title: string; children: ReactNode }) {
  return <section className="sm-empty"><h2>{title}</h2><p>{children}</p></section>;
}

export function AuthPage({ mode, onAuthenticated }: { mode: 'login' | 'signup' | 'forgot' | 'reset'; onAuthenticated: (user: SessionUser) => void }) {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const resetToken = search.get('token') || '';

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setNotice(null);
    if ((mode === 'signup' || mode === 'reset') && password !== confirm) {
      setNotice({ kind: 'error', text: 'As senhas não coincidem.' });
      return;
    }
    setBusy(true);
    try {
      if (mode === 'login') {
        const { usuario } = await Api.login({ email, senha: password });
        onAuthenticated(usuario);
        navigate(usuario.jogador?.perfil_completo ? '/descobrir' : '/perfil');
      } else if (mode === 'signup') {
        const { usuario } = await Api.register({ nome: name, email, senha: password });
        onAuthenticated(usuario);
        navigate('/perfil');
      } else if (mode === 'forgot') {
        const result = await Api.requestPasswordReset(email);
        setNotice({ kind: 'success', text: result.message });
      } else {
        if (!resetToken) throw new Error('O link de redefinição está incompleto. Solicite um novo.');
        const result = await Api.resetPassword(resetToken, password);
        setNotice({ kind: 'success', text: result.message });
        window.setTimeout(() => navigate('/login'), 1000);
      }
    } catch (error) {
      setNotice({ kind: 'error', text: messageOf(error) });
    } finally { setBusy(false); }
  };

  const labels = ({
    login: ['Entrar', 'Acesse sua conta para encontrar seu próximo parceiro de jogo.', 'Entrar'],
    signup: ['Criar conta', 'Junte-se à comunidade esportiva e encontre com quem jogar.', 'Criar conta'],
    forgot: ['Recuperar senha', 'Informe seu e-mail para receber um link seguro de redefinição.', 'Enviar link'],
    reset: ['Nova senha', 'Escolha uma nova senha para voltar a acessar sua conta.', 'Salvar nova senha'],
  } as Record<typeof mode, [string, string, string]>)[mode];

  return <main className="sm-auth sm-auth-figma"><section className="sm-auth-card">
    <Link to="/login" className="sm-auth-logo" aria-label="Sports Match">
      <img src={logoSportsMatch} alt="Sports Match" />
    </Link>
    <header className="sm-auth-heading">
      <h1>{labels[0]}</h1>
      <p>{labels[1]}</p>
    </header>
    <NoticeBox notice={notice} />
    <form onSubmit={submit} className="sm-form sm-auth-form">
      {mode === 'signup' && <label><span>Nome</span><input value={name} onChange={(e) => setName(e.target.value)} required minLength={2} autoComplete="name" placeholder="Seu nome" /></label>}
      {mode !== 'reset' && <label><span>E-mail</span><input value={email} onChange={(e) => setEmail(e.target.value)} required type="email" autoComplete="email" placeholder="seu@email.com" /></label>}
      {mode !== 'forgot' && <label><span>Senha</span><span className="sm-auth-password-field"><input value={password} onChange={(e) => setPassword(e.target.value)} required type={showPassword ? 'text' : 'password'} minLength={6} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} placeholder="••••••••" /><button type="button" className="sm-auth-password-toggle" onClick={() => setShowPassword((value) => !value)}>{showPassword ? 'Ocultar' : 'Mostrar'}</button></span></label>}
      {(mode === 'signup' || mode === 'reset') && <label><span>Confirmar senha</span><input value={confirm} onChange={(e) => setConfirm(e.target.value)} required type={showPassword ? 'text' : 'password'} minLength={6} autoComplete="new-password" placeholder="••••••••" /></label>}
      <button className="sm-primary sm-auth-submit" disabled={busy}>{busy ? 'Aguarde...' : labels[2]}</button>
    </form>
    {mode === 'login' && <div className="sm-auth-links"><Link to="/recuperar-senha">Esqueci minha senha</Link><span>Não tem conta? <Link to="/cadastro">Cadastre-se</Link></span></div>}
    {mode !== 'login' && <p className="sm-auth-back"><Link to="/login">Voltar para entrar</Link></p>}
  </section></main>;
}

function RequireAuth({ user, children }: { user: SessionUser | null; children: ReactNode }) {
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

function Shell({ user, onLogout, children }: { user: SessionUser; onLogout: () => void; children: ReactNode }) {
  const location = useLocation();
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const loadUnread = () => Api.unreadNotifications().then((result) => setUnread(result.total)).catch(() => undefined);
  useEffect(() => { loadUnread(); const onFocus = () => loadUnread(); window.addEventListener('focus', onFocus); return () => window.removeEventListener('focus', onFocus); }, []);
  const entries = [
    ['/descobrir', Compass, 'Descobrir'], ['/conversas', MessageCircle, 'Matches'],
    ['/partidas', Compass, 'Explorar partidas'], ['/agenda', CalendarDays, 'Minha agenda'], ['/perfil', User, 'Perfil'],
  ] as const;
  return <div className="sm-app"><header className="sm-header"><Link to="/descobrir" className="sm-brand" aria-label="Sports Match"><img src={logoSportsMatch} alt="Sports Match" /></Link>
    <div className="sm-user"><button className="sm-bell" onClick={() => setNotificationOpen(true)} title="Notificações"><Bell size={19} />{unread > 0 && <b>{unread > 9 ? '9+' : unread}</b>}</button><span>{user.jogador?.nome || user.email}</span><button onClick={onLogout} title="Sair"><LogOut size={18} /></button></div></header>
    <main className="sm-content">{children}</main>
    <nav className="sm-nav">{entries.map(([to, Icon, label]) => <Link key={to} className={location.pathname.startsWith(to) ? 'active' : ''} to={to}><Icon size={19} /><span>{label}</span></Link>)}</nav>
    {notificationOpen && <NotificationsModal onClose={() => { setNotificationOpen(false); loadUnread(); }} />}
  </div>;
}

export function NotificationsModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const load = () => Api.notifications().then(setItems).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const open = async (item: Notification) => {
    if (!item.lida_em) { await Api.readNotification(item.id).catch(() => undefined); setItems((current) => current.map((value) => value.id === item.id ? { ...value, lida_em: new Date().toISOString() } : value)); }
    onClose();
    if (item.dados.conversa_id) navigate('/conversas/' + item.dados.conversa_id);
    else if (item.dados.partida_id) navigate('/agenda');
    else if (item.tipo === 'MATCH') navigate('/conversas');
  };
  const readAll = async () => { await Api.readAllNotifications(); setItems((current) => current.map((item) => ({ ...item, lida_em: new Date().toISOString() }))); };
  return <div className="sm-modal-backdrop"><section className="sm-modal sm-notifications-modal"><div className="sm-page-title"><div><p className="sm-eyebrow">Atualizações</p><h2>Notificações</h2></div><button onClick={onClose} className="sm-icon-button" aria-label="Fechar"><X /></button></div>{items.some((item) => !item.lida_em) && <button className="sm-secondary sm-read-all" onClick={() => void readAll()}>Marcar todas como lidas</button>}{loading ? <Loading /> : items.length ? <div className="sm-notification-list">{items.map((item) => <button className={'sm-notification ' + (!item.lida_em ? 'unread' : '')} key={item.id} onClick={() => void open(item)}><span className="sm-notification-dot" /><span><strong>{item.titulo}</strong><small>{item.corpo}</small><em>{new Date(item.data_criacao).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</em></span></button>)}</div> : <Empty title="Nenhuma notificação">Quando houver um match ou uma nova mensagem, você verá aqui.</Empty>}</section></div>;
}

export function FigmaProfilePage({ user, refresh }: { user: SessionUser; refresh: () => Promise<void> }) {
  const [profile, setProfile] = useState<Profile>(user.jogador);
  const [sports, setSports] = useState<Sport[]>([]);
  const [newSport, setNewSport] = useState('');
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(!user.jogador.perfil_completo);
  const update = (field: keyof Profile, value: string) => setProfile((current) => ({ ...current, [field]: value }));
  useEffect(() => { Api.sports().then(setSports).catch(() => setNotice({ kind: 'error', text: 'Não foi possível carregar as modalidades.' })); }, []);
  const cancel = () => { setProfile(user.jogador); setNotice(null); setEditing(false); };
  const suggestSport = async () => {
    try {
      const result = await Api.requestSport(newSport);
      setNotice({ kind: 'success', text: result.message });
      setNewSport('');
    } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); }
  };
  const save = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      await Api.updateProfile({
        nome: profile.nome, foto_url: profile.foto_url ?? undefined, bio: profile.bio ?? undefined,
        cidade: profile.cidade ?? undefined, bairro: profile.bairro ?? undefined,
        modalidade_id: profile.modalidade_id ?? undefined, nivel_individual: profile.nivel_individual ?? undefined,
      });
      await refresh();
      setEditing(false);
      setNotice({ kind: 'success', text: 'Perfil salvo com sucesso.' });
    } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); }
  };
  const uploadPhoto = async (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setNotice({ kind: 'error', text: 'Escolha uma imagem JPEG, PNG ou WebP de até 5 MB.' });
      return;
    }
    setBusy(true); setNotice(null);
    try {
      const result = await Api.uploadProfilePhoto(file);
      setProfile(result.jogador);
      await refresh();
      setNotice({ kind: 'success', text: result.message });
    } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); }
  };
  const removePhoto = async () => {
    setBusy(true); setNotice(null);
    try {
      const result = await Api.removeProfilePhoto();
      setProfile(result.jogador);
      await refresh();
      setNotice({ kind: 'success', text: result.message });
    } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); }
  };
  const selectedSport = sports.find((sport) => sport.id === profile.modalidade_id);
  const location = [profile.bairro, profile.cidade].filter(Boolean).join(', ');

  return <section className="sm-profile-page">
    <div className="sm-page-title sm-profile-title"><div><p className="sm-eyebrow">Sua conta</p><h1>Meu perfil</h1></div>{editing ? <button type="submit" form="profile-form" className="sm-primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar'}</button> : <button className="sm-secondary" onClick={() => setEditing(true)}>Editar perfil</button>}</div>
    <NoticeBox notice={notice} />
    <article className="sm-profile-hero"><div className="sm-profile-avatar">{profile.foto_url ? <img src={profile.foto_url} alt="" /> : <User size={52} />}</div><div className="sm-profile-summary"><h2>{profile.nome || 'Seu nome'}</h2><p className="sm-profile-location"><MapPin size={16} />{location || 'Informe sua cidade e bairro'}</p><span className="sm-profile-rating"><Star size={16} fill="currentColor" /> {profile.media_avaliacao?.toFixed(1) || 'Novo'} <small>{profile.total_avaliacoes ? profile.total_avaliacoes + ' avaliações' : 'sem avaliações ainda'}</small></span></div><span className={'sm-chip ' + (profile.perfil_completo ? 'success' : '')}>{profile.perfil_completo ? 'Perfil completo' : 'Complete seu perfil'}</span></article>
    {editing && <article className="sm-profile-card sm-profile-photo-card"><div><h2>Foto de perfil</h2><p>JPEG, PNG ou WebP. Tamanho máximo: 5 MB.</p></div><div className="sm-profile-photo-actions"><label className="sm-secondary">Escolher foto<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => void uploadPhoto(e.target.files?.[0])} disabled={busy} /></label>{profile.foto_url && <button type="button" className="sm-text-danger" onClick={() => void removePhoto()} disabled={busy}>Remover</button>}</div></article>}
    {!editing ? <div className="sm-profile-details">
      <article className="sm-profile-card"><h2>Sobre</h2><p>{profile.bio || 'Conte um pouco sobre o seu estilo de jogo e disponibilidade.'}</p></article>
      <article className="sm-profile-card"><h2>Esporte e habilidade</h2><div className="sm-profile-sport"><div><small>Modalidade principal</small><strong>{selectedSport?.nome || profile.esporte_individual || 'Não informado'}</strong></div><div><small>Nível</small><strong>{profile.nivel_individual || 'Não informado'}</strong></div></div></article>
      <button className="sm-secondary sm-profile-edit" onClick={() => setEditing(true)}>Editar informações</button>
    </div> : <form id="profile-form" className="sm-profile-form" onSubmit={save}>
      <article className="sm-profile-card"><h2>Informações pessoais</h2><div className="sm-grid"><label className="full">Nome<input value={profile.nome || ''} onChange={(e) => update('nome', e.target.value)} required /></label><label>Cidade<input value={profile.cidade || ''} onChange={(e) => update('cidade', e.target.value)} required placeholder="Ex.: São Paulo" /></label><label>Bairro<input value={profile.bairro || ''} onChange={(e) => update('bairro', e.target.value)} required placeholder="Ex.: Pinheiros" /></label></div></article>
      <article className="sm-profile-card"><h2>Esporte e habilidade</h2><div className="sm-grid"><label>Modalidade principal<select value={profile.modalidade_id || ''} onChange={(e) => update('modalidade_id', e.target.value)} required><option value="">Selecione</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select></label><label>Nível<select value={profile.nivel_individual || ''} onChange={(e) => update('nivel_individual', e.target.value)} required><option value="">Selecione</option><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select></label><div className="full sm-sport-suggestion"><label>Não encontrou sua modalidade?<input value={newSport} onChange={(e) => setNewSport(e.target.value)} maxLength={80} placeholder="Sugira uma modalidade" /></label><button type="button" className="sm-secondary" disabled={!newSport.trim()} onClick={() => void suggestSport()}>Enviar sugestão</button></div></div></article>
      <article className="sm-profile-card"><label>Sobre você<textarea value={profile.bio || ''} onChange={(e) => update('bio', e.target.value)} maxLength={500} placeholder="Conte um pouco sobre como você gosta de jogar." /></label></article>
      <div className="sm-profile-form-actions"><button type="button" className="sm-secondary" onClick={cancel}>Cancelar</button><button className="sm-primary" disabled={busy}>{busy ? 'Salvando...' : 'Salvar perfil'}</button></div>
    </form>}
  </section>;
}

function FigmaDiscoveryPage({ user }: { user: SessionUser }) {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [sports, setSports] = useState<Sport[]>([]);
  const [filters, setFilters] = useState({ modalidade: '', nivel: '', bairro: '' });
  const [notice, setNotice] = useState<Notice>(null);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true); setNotice(null);
    try { const result = await Api.discovery(filters); setProfiles(result.perfis); }
    catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); Api.sports().then(setSports).catch(() => undefined); }, []);
  const decide = async (profile: Profile, type: 'LIKE' | 'DISLIKE') => {
    try {
      const result = await Api.swipe(profile.id, type);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      if (result.match && result.conversa_id) {
        setNotice({ kind: 'success', text: 'Você e ' + profile.nome + ' deram match!' });
        window.setTimeout(() => navigate('/conversas/' + result.conversa_id), 500);
      }
    } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); }
  };
  if (!user.jogador.perfil_completo) return <Navigate to="/perfil" replace />;
  const current = profiles[0];
  return <section className="sm-discovery-page">
    <div className="sm-page-title sm-discovery-title"><div><p className="sm-eyebrow">Comunidade local</p><h1>Descoberta</h1></div><span className="sm-location"><MapPin size={16} />{user.jogador.cidade} · {user.jogador.bairro}</span></div>
    <form className="sm-filters sm-discovery-filters" onSubmit={(e) => { e.preventDefault(); void load(); }}><select aria-label="Modalidade" value={filters.modalidade} onChange={(e) => setFilters({ ...filters, modalidade: e.target.value })}><option value="">Todas as modalidades</option>{sports.map((sport) => <option key={sport.id} value={sport.id}>{sport.nome}</option>)}</select><select aria-label="Nível" value={filters.nivel} onChange={(e) => setFilters({ ...filters, nivel: e.target.value })}><option value="">Todos os níveis</option><option>Iniciante</option><option>Intermediário</option><option>Avançado</option></select><input aria-label="Bairro" placeholder="Bairro" value={filters.bairro} onChange={(e) => setFilters({ ...filters, bairro: e.target.value })} /><button className="sm-secondary">Filtrar</button></form>
    <NoticeBox notice={notice} />
    {loading ? <Loading /> : current ? <article className="sm-discovery-figma-card"><div className="sm-discovery-cover"><div className="sm-discovery-avatar">{current.foto_url ? <img src={current.foto_url} alt="" /> : <User size={78} />}</div></div><div className="sm-discovery-body"><div className="sm-discovery-person"><div><h2>{current.nome}</h2><p><MapPin size={16} /> {current.bairro}, {current.cidade}</p></div><span className="sm-discovery-score"><Star size={16} fill="currentColor" /> {current.media_avaliacao?.toFixed(1) || 'Novo'}</span></div><div className="sm-discovery-tags"><span>{current.esporte_individual || 'Modalidade'}</span><span>{current.nivel_individual || 'Nível não informado'}</span>{current.total_avaliacoes ? <span>{current.total_avaliacoes} avaliações</span> : null}</div><p className="sm-discovery-bio">{current.bio || 'Este jogador ainda não adicionou uma apresentação.'}</p><div className="sm-discovery-actions"><button aria-label="Descartar perfil" className="sm-secondary" onClick={() => void decide(current, 'DISLIKE')}><X size={20} /> Descartar</button><button aria-label="Curtir perfil" className="sm-primary" onClick={() => void decide(current, 'LIKE')}><Heart size={20} /> Curtir</button></div></div></article> : <Empty title="Sem novos perfis">Tente alterar os filtros ou volte mais tarde para encontrar novos parceiros.</Empty>}
  </section>;
}

function ConversationsPage() {
  const [conversations, setConversations] = useState<Conversation[]>([]); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true);
  useEffect(() => { const load = () => { Api.conversations().then(setConversations).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })).finally(() => setLoading(false)); }; load(); window.addEventListener('focus', load); return () => window.removeEventListener('focus', load); }, []);
  return <section className="sm-conversations-page"><div className="sm-page-title"><div><p className="sm-eyebrow">Conexões recíprocas</p><h1>Conversas</h1></div><span className="sm-conversation-count">{conversations.length}</span></div><NoticeBox notice={notice} />{loading ? <Loading /> : conversations.length ? <div className="sm-conversation-list">{conversations.map((conversation) => <Link className={'sm-conversation-card ' + (conversation.nao_lidas ? 'unread' : '')} to={`/conversas/${conversation.conversa_id}`} key={conversation.conversa_id}><div className="sm-conversation-avatar">{conversation.oponente.foto_url ? <img src={conversation.oponente.foto_url} alt="" /> : <User size={29} />}</div><div className="sm-conversation-copy"><div><strong>{conversation.oponente.nome}</strong>{conversation.oponente.media_avaliacao ? <span className="sm-conversation-score"><Star size={13} fill="currentColor" /> {conversation.oponente.media_avaliacao.toFixed(1)}</span> : null}</div><p>{conversation.oponente.esporte_individual || 'Parceiro esportivo'} · {conversation.oponente.bairro || 'sua região'}</p><span>{conversation.nao_lidas ? `${conversation.nao_lidas} mensagem${conversation.nao_lidas > 1 ? 'ns' : ''} não lida${conversation.nao_lidas > 1 ? 's' : ''}` : 'Toque para abrir a conversa'}</span></div>{conversation.nao_lidas ? <b className="sm-conversation-unread">{conversation.nao_lidas > 9 ? '9+' : conversation.nao_lidas}</b> : <MessageCircle className="sm-conversation-icon" />}</Link>)}</div> : <Empty title="Seus matches aparecerão aqui">Curta perfis na descoberta. O chat abre quando o interesse for mútuo.</Empty>}</section>;
}

function ChatPage({ user }: { user: SessionUser }) {
  const { conversationId = '' } = useParams(); const navigate = useNavigate();
  const [conversation, setConversation] = useState<{ mensagens: Message[]; partidas: ChatGame[]; oponente?: Profile } | null>(null); const [text, setText] = useState(''); const [notice, setNotice] = useState<Notice>(null); const [sending, setSending] = useState(false); const [showSchedule, setShowSchedule] = useState(false);
  useEffect(() => { let cleanup: () => void = () => { }; Api.conversation(conversationId).then(async (data) => { setConversation(data); cleanup = await subscribeToMessages(conversationId, (message) => setConversation((current) => current && current.mensagens.some((item) => item.id === message.id) ? current : current ? { ...current, mensagens: [...current.mensagens, message] } : current)); }).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })); return () => cleanup(); }, [conversationId]);
  const send = async (event: FormEvent) => { event.preventDefault(); if (!text.trim()) return; setSending(true); try { const message = await Api.sendMessage(conversationId, text.trim()); setConversation((current) => current ? { ...current, mensagens: current.mensagens.some((item) => item.id === message.id) ? current.mensagens : [...current.mensagens, message] } : current); setText(''); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setSending(false); } };
  const accept = async (gameId: string) => { try { await Api.acceptChatGame(gameId); setConversation((current) => current && { ...current, partidas: current.partidas.map((game) => game.id === gameId ? { ...game, status: 'AGENDADA', aguardando_minha_confirmacao: false } : game) }); setNotice({ kind: 'success', text: 'Partida confirmada e adicionada à sua agenda.' }); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } };
  const opponent = conversation?.oponente;
  return <section className="sm-chat"><header className="sm-chat-figma-header"><button className="sm-back" onClick={() => navigate('/conversas')} aria-label="Voltar para conversas"><ChevronLeft size={21} /></button><button className="sm-chat-opponent" onClick={() => opponent && navigate(`/jogadores/${opponent.id}`)} disabled={!opponent} aria-label="Ver perfil do jogador"><div className="sm-chat-header-avatar">{opponent?.foto_url ? <img src={opponent.foto_url} alt="" /> : <User size={23} />}</div><div><h1>{opponent?.nome || 'Conversa'}</h1><p>{opponent?.esporte_individual || 'Match confirmado'}{opponent?.nivel_individual ? ` · ${opponent.nivel_individual}` : ''}</p></div></button></header><NoticeBox notice={notice} />{!conversation ? <Loading /> : <>{showSchedule && <ChatScheduleModal conversationId={conversationId} initialSport={opponent?.esporte_individual} onClose={() => setShowSchedule(false)} />}<button className="sm-chat-schedule" type="button" onClick={() => setShowSchedule(true)}><CalendarDays size={18} /> Marcar partida</button>{conversation.partidas.filter((game) => game.status === 'PENDENTE').map((game) => <article className="sm-chat-game-proposal" key={game.id}><strong>{game.aguardando_minha_confirmacao ? 'Você recebeu uma proposta de partida' : 'Proposta de partida enviada'}</strong><span>{game.modalidade} · {game.local_nome} · {formatChatTime(game.data_hora)}</span>{game.aguardando_minha_confirmacao && <button className="sm-primary" onClick={() => void accept(game.id)}>Aceitar e adicionar à agenda</button>}</article>)}<div className="sm-messages">{conversation.mensagens.length ? conversation.mensagens.map((message) => <div key={message.id} className={`sm-message ${message.remetente_id === user.jogador.id ? 'mine' : ''}`}><p>{message.conteudo}</p><small>{formatChatTime(message.data_criacao)}</small></div>) : <Empty title="Comece a conversa">Combine uma partida com respeito e segurança.</Empty>}</div><form onSubmit={send} className="sm-send"><input value={text} onChange={(e) => setText(e.target.value)} placeholder="Digite sua mensagem..." maxLength={1000} disabled={!navigator.onLine} /><button className="sm-primary" disabled={sending || !navigator.onLine}><Send size={18} /></button></form>{!navigator.onLine && <p className="sm-muted">Mensagens exigem conexão.</p>}</>}</section>;
}

export function ChatScheduleModal({ conversationId, initialSport, onClose }: { conversationId: string; initialSport?: string | null; onClose: () => void }) {
  const [modalidade, setModalidade] = useState(initialSport || '');
  const [localNome, setLocalNome] = useState('');
  const [dataHora, setDataHora] = useState('');
  const [sports, setSports] = useState<Sport[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [inviteLink, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { Api.sports().then(setSports).catch(() => setNotice({ kind: 'error', text: 'Não foi possível carregar as modalidades.' })); }, []);
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice(null);
    try {
      await Api.createChatGame({ conversa_id: conversationId, modalidade, local_nome: localNome, data_hora: new Date(dataHora).toISOString() });
      onClose();
    } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); }
  };
  return <div className="sm-modal-backdrop"><section className="sm-modal sm-chat-schedule-modal"><div className="sm-page-title"><div><p className="sm-eyebrow">Chat privado</p><h2>Propor partida</h2></div><button onClick={onClose} className="sm-icon-button" aria-label="Fechar"><X /></button></div><p className="sm-muted">Seu match receberá uma solicitação e precisa confirmar antes de a partida entrar na agenda.</p><NoticeBox notice={notice} /><form className="sm-form" onSubmit={submit}><label>Modalidade<select value={modalidade} onChange={(e) => setModalidade(e.target.value)} required><option value="">Selecione</option>{sports.map((sport) => <option value={sport.nome} key={sport.id}>{sport.nome}</option>)}</select></label><label>Local<input value={localNome} onChange={(e) => setLocalNome(e.target.value)} required /></label><label>Data e horário<input type="datetime-local" value={dataHora} onChange={(e) => setDataHora(e.target.value)} required /></label><button className="sm-primary" disabled={busy}>{busy ? 'Enviando...' : 'Enviar proposta'}</button></form></section></div>;
}

function GameCard({ game, onAction }: { game: Game; onAction: (action: 'join' | 'leave' | 'complete' | 'cancel') => void }) {
  const date = new Date(game.data_hora);
  return <article className="sm-game"><div className="sm-game-top"><div><span className={`sm-chip ${game.status === 'ABERTA' ? 'success' : ''}`}>{game.status}</span><h2>{game.modalidade}</h2></div><span className="sm-capacity"><Users size={16} /> {game.total_participantes}/{game.capacidade}</span></div><p><CalendarDays size={16} /> {date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' })} · {date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p><p><MapPin size={16} /> {game.local_nome} · {game.bairro}, {game.cidade}</p>{game.descricao && <p className="sm-bio">{game.descricao}</p>}<div className="sm-game-actions">{game.status === 'ABERTA' && !game.minha_participacao && <button className="sm-primary" onClick={() => onAction('join')}>Entrar</button>}{game.minha_participacao && !game.sou_organizador && ['ABERTA', 'LOTADA'].includes(game.status) && <button className="sm-secondary" onClick={() => onAction('leave')}>Sair</button>}{game.sou_organizador && ['ABERTA', 'LOTADA'].includes(game.status) && <><button className="sm-secondary" onClick={() => onAction('complete')}>Concluir</button><button className="sm-text-danger" onClick={() => onAction('cancel')}>Cancelar</button></>}</div></article>;
}

function GamesPage({ user }: { user: SessionUser }) {
  const [games, setGames] = useState<Game[]>([]); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true); const [showCreate, setShowCreate] = useState(false);
  const load = async () => { setLoading(true); try { setGames(await Api.games({ cidade: user.jogador.cidade || '' })); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setLoading(false); } };
  useEffect(() => { void load(); }, []);
  const act = async (game: Game, action: 'join' | 'leave' | 'complete' | 'cancel') => { try { if (action === 'join') await Api.joinGame(game.id); if (action === 'leave') await Api.leaveGame(game.id); if (action === 'complete') await Api.updateGameStatus(game.id, 'CONCLUIDA'); if (action === 'cancel') await Api.updateGameStatus(game.id, 'CANCELADA'); await load(); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } };
  if (!user.jogador.perfil_completo) return <Navigate to="/perfil" replace />;
  return <section><div className="sm-page-title"><div><p className="sm-eyebrow">Partidas públicas</p><h1>Explore onde jogar</h1><p className="sm-muted">Encontre partidas abertas na sua região ou crie uma para a comunidade.</p></div><button className="sm-primary icon" onClick={() => setShowCreate(true)}><Plus size={18} /> Criar partida</button></div><NoticeBox notice={notice} />{showCreate && <CreateGame user={user} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); void load(); }} />}{loading ? <Loading /> : games.length ? <div className="sm-games">{games.map((game) => <GameCard key={game.id} game={game} onAction={(action) => void act(game, action)} />)}</div> : <Empty title="Nenhuma partida pública disponível">Crie uma partida para sua comunidade ou verifique novamente mais tarde.</Empty>}</section>;
}

function InviteGamePage() {
  const { token = '' } = useParams();
  const navigate = useNavigate();
  const [game, setGame] = useState<Game | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { Api.gameByInvite(token).then(setGame).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })); }, [token]);
  const join = async () => { if (!game) return; setBusy(true); try { await Api.joinGame(game.id); setNotice({ kind: 'success', text: 'Você entrou na partida. Ela está na sua agenda.' }); setGame((current) => current && { ...current, minha_participacao: true, total_participantes: current.total_participantes + 1 }); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); } };
  return <section className="sm-panel sm-narrow"><button className="sm-back" onClick={() => navigate('/partidas')} aria-label="Voltar"><ChevronLeft size={21} /> Voltar</button><NoticeBox notice={notice} />{!game && !notice ? <Loading /> : game ? <><p className="sm-eyebrow">Convite privado</p><h1>Você foi convidado para uma partida</h1><GameCard game={game} onAction={() => void join()} />{!game.minha_participacao && game.status === 'ABERTA' && <button className="sm-primary" onClick={() => void join()} disabled={busy}>{busy ? 'Entrando...' : 'Confirmar entrada'}</button>}</> : null}</section>;
}

function LegacyCreateGame({ user, onClose, onCreated }: { user: SessionUser; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ modalidade: user.jogador.esporte_individual || '', local_nome: '', cidade: user.jogador.cidade || '', bairro: user.jogador.bairro || '', capacidade: 4, data_hora: '', descricao: '' }); const [notice, setNotice] = useState<Notice>(null); const [busy, setBusy] = useState(false);
  const set = (field: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await Api.createGame({ ...form, data_hora: new Date(form.data_hora).toISOString() }); onCreated(); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); } };
  return <div className="sm-modal-backdrop"><section className="sm-modal"><div className="sm-page-title"><h2>Nova partida</h2><button onClick={onClose} className="sm-icon-button"><X /></button></div><NoticeBox notice={notice} /><form className="sm-form sm-grid" onSubmit={submit}><label>Modalidade<input value={form.modalidade} onChange={(e) => set('modalidade', e.target.value)} required /></label><label>Vagas totais<input type="number" min="2" max="100" value={form.capacidade} onChange={(e) => set('capacidade', Number(e.target.value))} required /></label><label className="full">Local<input value={form.local_nome} onChange={(e) => set('local_nome', e.target.value)} required /></label><label>Cidade<input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} required /></label><label>Bairro<input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} required /></label><label className="full">Data e horário<input type="datetime-local" value={form.data_hora} onChange={(e) => set('data_hora', e.target.value)} required /></label><label className="full">Descrição opcional<textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} maxLength={500} /></label><button className="sm-primary full" disabled={busy}>{busy ? 'Criando...' : 'Publicar partida'}</button></form></section></div>;
}

function LegacyCreateGameV2({ user, onClose, onCreated }: { user: SessionUser; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ modalidade: '', visibilidade: 'PUBLICA' as 'PUBLICA' | 'PRIVADA_LINK', local_nome: '', cidade: user.jogador.cidade || '', bairro: user.jogador.bairro || '', capacidade: 4, data_hora: '', descricao: '' });
  const [sports, setSports] = useState<Sport[]>([]);
  const [notice, setNotice] = useState<Notice>(null);
  const [, setInviteLink] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { Api.sports().then(setSports).catch(() => setNotice({ kind: 'error', text: 'Nao foi possivel carregar as modalidades.' })); }, []);
  const set = (field: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  const copyInvite = async (link: string) => { try { await navigator.clipboard?.writeText(link); setNotice({ kind: 'success', text: 'Link de convite copiado.' }); } catch { setNotice({ kind: 'error', text: 'Não foi possível copiar automaticamente. Selecione o link e copie.' }); } };
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { const game = await Api.createGame({ ...form, data_hora: new Date(form.data_hora).toISOString() }); if (form.visibilidade === 'PRIVADA_LINK' && game.convite_token) { const link = `${window.location.origin}/partidas/convite/${game.convite_token}`; setInviteLink(link); await copyInvite(link); } else onCreated(); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); } };
  return <div className="sm-modal-backdrop"><section className="sm-modal"><div className="sm-page-title"><h2>Nova partida</h2><button onClick={onClose} className="sm-icon-button"><X /></button></div><NoticeBox notice={notice} /><form className="sm-form sm-grid" onSubmit={submit}><label>Visibilidade<select value={form.visibilidade} onChange={(e) => set('visibilidade', e.target.value)}><option value="PUBLICA">Pública</option><option value="PRIVADA_LINK">Privada por link</option></select></label><label>Modalidade<select value={form.modalidade} onChange={(e) => set('modalidade', e.target.value)} required><option value="">Selecione</option>{sports.map((sport) => <option value={sport.nome} key={sport.id}>{sport.nome}</option>)}</select></label><label>Vagas totais<input type="number" min="2" max="100" step="1" value={form.capacidade} onChange={(e) => set('capacidade', Math.max(2, Math.min(100, Number(e.target.value) || 2)))} required /></label><label className="full">Local<input value={form.local_nome} onChange={(e) => set('local_nome', e.target.value)} required /></label><label>Cidade<input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} required /></label><label>Bairro<input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} required /></label><label className="full">Data e horario<input type="datetime-local" value={form.data_hora} onChange={(e) => set('data_hora', e.target.value)} required /></label><label className="full">Descricao opcional<textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} maxLength={500} /></label><button className="sm-primary full" disabled={busy}>{busy ? 'Criando...' : 'Publicar partida'}</button></form></section></div>;
}

export function CreateGame({ user, onClose, onCreated }: { user: SessionUser; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ modalidade: '', visibilidade: 'PUBLICA' as 'PUBLICA' | 'PRIVADA_LINK', local_nome: '', cidade: user.jogador.cidade || '', bairro: user.jogador.bairro || '', capacidade: 4, data_hora: '', descricao: '' });
  const [sports, setSports] = useState<Sport[]>([]); const [notice, setNotice] = useState<Notice>(null); const [inviteLink, setInviteLink] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { Api.sports().then(setSports).catch(() => setNotice({ kind: 'error', text: 'Não foi possível carregar as modalidades.' })); }, []);
  const set = (field: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [field]: value }));
  const copyInvite = async () => { if (!inviteLink) return; try { await navigator.clipboard?.writeText(inviteLink); setNotice({ kind: 'success', text: 'Link de convite copiado.' }); } catch { setNotice({ kind: 'error', text: 'Selecione o link abaixo e copie manualmente.' }); } };
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { const game = await Api.createGame({ ...form, data_hora: new Date(form.data_hora).toISOString() }); if (form.visibilidade === 'PRIVADA_LINK' && game.convite_token) { const link = `${window.location.origin}/partidas/convite/${game.convite_token}`; setInviteLink(link); try { await navigator.clipboard?.writeText(link); setNotice({ kind: 'success', text: 'Partida privada criada. O link foi copiado e permanece disponível abaixo.' }); } catch { setNotice({ kind: 'success', text: 'Partida privada criada. Copie o link abaixo para compartilhar.' }); } } else onCreated(); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); } };
  return <div className="sm-modal-backdrop"><section className="sm-modal"><div className="sm-page-title"><h2>Nova partida</h2><button onClick={onClose} className="sm-icon-button" aria-label="Fechar"><X /></button></div><NoticeBox notice={notice} />{inviteLink ? <section className="sm-invite-link"><strong>Link de convite</strong><p>Guarde ou envie este link. Você pode copiá-lo novamente quando quiser.</p><input aria-label="Link de convite" value={inviteLink} readOnly onFocus={(event) => event.currentTarget.select()} /><button type="button" className="sm-secondary" onClick={() => void copyInvite()}>Copiar link</button></section> : <form className="sm-form sm-grid" onSubmit={submit}><label>Visibilidade<select value={form.visibilidade} onChange={(e) => set('visibilidade', e.target.value)}><option value="PUBLICA">Pública</option><option value="PRIVADA_LINK">Privada por link</option></select></label><label>Modalidade<select value={form.modalidade} onChange={(e) => set('modalidade', e.target.value)} required><option value="">Selecione</option>{sports.map((sport) => <option value={sport.nome} key={sport.id}>{sport.nome}</option>)}</select></label><label>Vagas totais<input type="number" min="2" max="100" step="1" value={form.capacidade} onChange={(e) => set('capacidade', Math.max(2, Math.min(100, Number(e.target.value) || 2)))} required /></label><label className="full">Local<input value={form.local_nome} onChange={(e) => set('local_nome', e.target.value)} required /></label><label>Cidade<input value={form.cidade} onChange={(e) => set('cidade', e.target.value)} required /></label><label>Bairro<input value={form.bairro} onChange={(e) => set('bairro', e.target.value)} required /></label><label className="full">Data e horário<input type="datetime-local" value={form.data_hora} onChange={(e) => set('data_hora', e.target.value)} required /></label><label className="full">Descrição opcional<textarea value={form.descricao} onChange={(e) => set('descricao', e.target.value)} maxLength={500} /></label><button className="sm-primary full" disabled={busy}>{busy ? 'Criando...' : 'Publicar partida'}</button></form>}</section></div>;
}

function LegacyAgendaPage({ user }: { user: SessionUser }) {
  const [games, setGames] = useState<Game[]>([]); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true); const [reviewing, setReviewing] = useState<Game | null>(null);
  const load = () => Api.myGames().then(setGames).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })).finally(() => setLoading(false)); useEffect(() => { load(); }, []);
  return <section><div className="sm-page-title"><div><p className="sm-eyebrow">Seus compromissos</p><h1>Minha agenda</h1><p className="sm-muted">Acompanhe as partidas confirmadas das quais você participa.</p></div></div><NoticeBox notice={notice} />{reviewing && <ReviewModal game={reviewing} user={user} onClose={() => setReviewing(null)} />}{loading ? <Loading /> : games.length ? <div className="sm-games">{games.map((game) => <div key={game.id}><GameCard game={game} onAction={() => undefined} />{game.status === 'CONCLUIDA' && <button className="sm-secondary" onClick={() => setReviewing(game)}><Star size={16} /> Avaliar no detalhe</button>}</div>)}</div> : <Empty title="Sua agenda está vazia">Quando você criar ou aceitar uma partida, ela aparecerá aqui.</Empty>}</section>;
}

function LegacyGameDetailModal({ game, user, onClose }: { game: Game; user: SessionUser; onClose: () => void }) {
  const [reviewing, setReviewing] = useState(false);
  const isPast = game.status === 'CONCLUIDA' || new Date(game.data_hora).getTime() < Date.now();
  return <div className="sm-modal-backdrop"><section className="sm-modal"><div className="sm-page-title"><h2>Detalhes da partida</h2><button onClick={onClose} className="sm-icon-button" aria-label="Fechar"><X /></button></div>{reviewing ? <ReviewModal game={game} user={user} onClose={() => setReviewing(false)} /> : <><GameCard game={game} onAction={() => undefined} />{isPast && game.status !== 'CANCELADA' && <button className="sm-secondary" onClick={() => setReviewing(true)}><Star size={16} /> Avaliar participantes</button>}</>}</section></div>;
}

function LegacyAgendaPageV2({ user }: { user: SessionUser }) {
  const [games, setGames] = useState<Game[]>([]); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<Game | null>(null);
  const load = () => Api.myGames().then(setGames).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const past = games.filter((game) => game.status === 'CONCLUIDA' || new Date(game.data_hora).getTime() < Date.now());
  const upcoming = games.filter((game) => !past.some((item) => item.id === game.id) && game.status !== 'CANCELADA');
  const list = (items: Game[]) => <div className="sm-games">{items.map((game) => <button className="sm-agenda-item" key={game.id} onClick={() => setSelected(game)}><GameCard game={game} onAction={() => undefined} /></button>)}</div>;
  return <section><div className="sm-page-title"><div><p className="sm-eyebrow">Seus compromissos</p><h1>Minha agenda</h1><p className="sm-muted">Acompanhe partidas confirmadas e consulte seus detalhes.</p></div></div><NoticeBox notice={notice} />{selected && <GameDetailModal game={selected} user={user} onClose={() => setSelected(null)} />}{loading ? <Loading /> : games.length ? <>{upcoming.length ? <section className="sm-agenda-group"><h2>Próximas</h2>{list(upcoming)}</section> : null}{past.length ? <section className="sm-agenda-group"><h2>Passadas</h2>{list(past)}</section> : null}</> : <Empty title="Sua agenda está vazia">Quando você criar ou aceitar uma partida, ela aparecerá aqui.</Empty>}</section>;
}

function GameDetailModal({ game, user, onClose, onConfirmed = () => undefined }: { game: Game; user: SessionUser; onClose: () => void; onConfirmed?: () => void }) {
  const [reviewing, setReviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<Notice>(null);
  const isPast = game.status === 'CONCLUIDA' || new Date(game.data_hora).getTime() < Date.now();
  const accept = async () => { setBusy(true); try { await Api.acceptChatGame(game.id); setNotice({ kind: 'success', text: 'Partida confirmada e adicionada à sua agenda.' }); onConfirmed(); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); } };
  const inviteLink = game.convite_token ? `${window.location.origin}/partidas/convite/${game.convite_token}` : '';
  const copyInvite = async () => { try { await navigator.clipboard?.writeText(inviteLink); setNotice({ kind: 'success', text: 'Link de convite copiado.' }); } catch { setNotice({ kind: 'error', text: 'Selecione o link e copie manualmente.' }); } };
  return <div className="sm-modal-backdrop"><section className="sm-modal"><div className="sm-page-title"><h2>{game.status === 'PENDENTE' ? 'Pendência de partida' : 'Detalhes da partida'}</h2><button onClick={onClose} className="sm-icon-button" aria-label="Fechar"><X /></button></div><NoticeBox notice={notice} />{reviewing ? <ReviewModal game={game} user={user} onClose={() => setReviewing(false)} /> : <><GameCard game={game} onAction={() => undefined} />{inviteLink && <section className="sm-invite-link"><strong>Link de convite</strong><input aria-label="Link de convite" value={inviteLink} readOnly onFocus={(event) => event.currentTarget.select()} /><button className="sm-secondary" onClick={() => void copyInvite()}>Copiar link</button></section>}{game.status === 'PENDENTE' && game.aguardando_minha_confirmacao && <button className="sm-primary" disabled={busy} onClick={() => void accept()}>{busy ? 'Confirmando...' : 'Aceitar e adicionar à agenda'}</button>}{game.status === 'PENDENTE' && game.proposta_enviada_por_mim && <p className="sm-muted">Você enviou esta proposta. Aguarde a confirmação do outro jogador.</p>}{isPast && game.status !== 'CANCELADA' && <button className="sm-secondary" onClick={() => setReviewing(true)}><Star size={16} /> Avaliar participantes</button>}</>}</section></div>;
}

function AgendaPage({ user }: { user: SessionUser }) {
  const [games, setGames] = useState<Game[]>([]); const [notice, setNotice] = useState<Notice>(null); const [loading, setLoading] = useState(true); const [selected, setSelected] = useState<Game | null>(null);
  const load = () => Api.myGames().then(setGames).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);
  const pending = games.filter((game) => game.status === 'PENDENTE');
  const past = games.filter((game) => game.status !== 'PENDENTE' && (game.status === 'CONCLUIDA' || new Date(game.data_hora).getTime() < Date.now()));
  const upcoming = games.filter((game) => game.status !== 'PENDENTE' && !past.some((item) => item.id === game.id) && game.status !== 'CANCELADA');
  const list = (items: Game[]) => <div className="sm-games">{items.map((game) => <button className="sm-agenda-item" key={game.id} onClick={() => setSelected(game)}><GameCard game={game} onAction={() => undefined} /></button>)}</div>;
  return <section><div className="sm-page-title"><div><p className="sm-eyebrow">Seus compromissos</p><h1>Minha agenda</h1><p className="sm-muted">Acompanhe pendências, partidas confirmadas e seus detalhes.</p></div></div><NoticeBox notice={notice} />{selected && <GameDetailModal game={selected} user={user} onClose={() => setSelected(null)} onConfirmed={() => { setSelected(null); load(); }} />}{loading ? <Loading /> : games.length ? <>{pending.length ? <section className="sm-agenda-group"><h2>Pendentes</h2>{list(pending)}</section> : null}{upcoming.length ? <section className="sm-agenda-group"><h2>Próximas</h2>{list(upcoming)}</section> : null}{past.length ? <section className="sm-agenda-group"><h2>Passadas</h2>{list(past)}</section> : null}</> : <Empty title="Sua agenda está vazia">Quando você criar ou aceitar uma partida, ela aparecerá aqui.</Empty>}</section>;
}

function ReviewModal({ game, user, onClose }: { game: Game; user: SessionUser; onClose: () => void }) {
  const targets = useMemo(() => game.participantes.filter((item) => item.jogador_id !== user.jogador.id), [game, user]); const [target, setTarget] = useState(targets[0]?.jogador_id || ''); const [note, setNote] = useState(5); const [comment, setComment] = useState(''); const [notice, setNotice] = useState<Notice>(null); const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await Api.review({ partida_id: game.id, avaliado_id: target, nota: note, comentario: comment }); setNotice({ kind: 'success', text: 'Avaliação enviada.' }); } catch (error) { setNotice({ kind: 'error', text: messageOf(error) }); } finally { setBusy(false); } };
  return <div className="sm-modal-backdrop"><section className="sm-modal"><div className="sm-page-title"><h2>Avaliar participantes</h2><button onClick={onClose} className="sm-icon-button"><X /></button></div><NoticeBox notice={notice} />{targets.length ? <form className="sm-form" onSubmit={submit}><label>Participante<select value={target} onChange={(e) => setTarget(e.target.value)}>{targets.map((item) => <option key={item.jogador_id} value={item.jogador_id}>{item.jogador?.nome || 'Participante'}</option>)}</select></label><label>Nota<select value={note} onChange={(e) => setNote(Number(e.target.value))}>{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} estrela{value > 1 ? 's' : ''}</option>)}</select></label><label>Comentário opcional<textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={500} /></label><button className="sm-primary" disabled={busy}>{busy ? 'Enviando...' : 'Enviar avaliação'}</button></form> : <Empty title="Sem outros participantes">Não há ninguém para avaliar nesta partida.</Empty>}</section></div>;
}

function PublicProfilePage() {
  const { playerId = '' } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  useEffect(() => { Api.publicProfile(playerId).then(setProfile).catch((error) => setNotice({ kind: 'error', text: messageOf(error) })); }, [playerId]);
  if (!profile && !notice) return <Loading />;
  return <section className="sm-public-profile"><button className="sm-back" onClick={() => navigate(-1)} aria-label="Voltar"><ChevronLeft size={21} /> Voltar</button><NoticeBox notice={notice} />{profile && <article className="sm-profile-card"><div className="sm-public-profile-head"><div className="sm-profile-avatar">{profile.foto_url ? <img src={profile.foto_url} alt="" /> : <User size={48} />}</div><div><h1>{profile.nome}</h1><p><MapPin size={16} /> {profile.bairro}, {profile.cidade}</p><span className="sm-profile-rating"><Star size={16} fill="currentColor" /> {profile.media_avaliacao?.toFixed(1) || 'Novo'} <small>{profile.total_avaliacoes || 0} avaliações</small></span></div></div><div className="sm-profile-sport"><div><small>Modalidade</small><strong>{profile.esporte_individual || 'Não informado'}</strong></div><div><small>Nível</small><strong>{profile.nivel_individual || 'Não informado'}</strong></div></div><h2>Sobre</h2><p>{profile.bio || 'Este jogador ainda não adicionou uma apresentação.'}</p></article>}</section>;
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null); const [loading, setLoading] = useState(true);
  const refresh = async () => { const { usuario } = await Api.session(); Api.setCacheScope(usuario.id); setUser(usuario); };
  useEffect(() => { refresh().catch(() => setUser(null)).finally(() => setLoading(false)); }, []);
  const logout = async () => { try { await Api.logout(); } finally { if (user) Api.clearCachedData(user.id); setUser(null); } };
  if (loading) return <Loading />;
  return <BrowserRouter><InstallPrompt /><Routes>
    <Route path="/login" element={user ? <Navigate to="/descobrir" replace /> : <AuthPage mode="login" onAuthenticated={(next) => { Api.setCacheScope(next.id); setUser(next); }} />} />
    <Route path="/cadastro" element={user ? <Navigate to="/perfil" replace /> : <AuthPage mode="signup" onAuthenticated={(next) => { Api.setCacheScope(next.id); setUser(next); }} />} />
    <Route path="/recuperar-senha" element={<AuthPage mode="forgot" onAuthenticated={setUser} />} /><Route path="/redefinir-senha" element={<AuthPage mode="reset" onAuthenticated={setUser} />} />
    <Route path="/descobrir" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><FigmaDiscoveryPage user={user!} /></Shell></RequireAuth>} />
    <Route path="/conversas" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><ConversationsPage /></Shell></RequireAuth>} />
    <Route path="/conversas/:conversationId" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><ChatPage user={user!} /></Shell></RequireAuth>} />
    <Route path="/partidas/convite/:token" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><InviteGamePage /></Shell></RequireAuth>} />
    <Route path="/partidas" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><GamesPage user={user!} /></Shell></RequireAuth>} />
    <Route path="/agenda" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><AgendaPage user={user!} /></Shell></RequireAuth>} />
    <Route path="/perfil" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><FigmaProfilePage user={user!} refresh={refresh} /></Shell></RequireAuth>} />
    <Route path="/jogadores/:playerId" element={<RequireAuth user={user}><Shell user={user!} onLogout={() => void logout()}><PublicProfilePage /></Shell></RequireAuth>} />
    <Route path="*" element={<Navigate to={user ? '/descobrir' : '/login'} replace />} />
  </Routes></BrowserRouter>;
}
