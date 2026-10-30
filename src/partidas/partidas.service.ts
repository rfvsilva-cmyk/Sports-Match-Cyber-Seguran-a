import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CriarPartidaPublicaDto, ListarPartidasDto } from './dto/partidas.dto';
import { NotificacaoService } from '../notificacao/notificacao.service';
import { randomBytes } from 'node:crypto';

@Injectable()
export class PartidasService {
  constructor(private readonly supabaseService: SupabaseService, private readonly notificacaoService: NotificacaoService) {}

  async listarPublicas(usuarioId: string, filtros: ListarPartidasDto) {
    const jogador = await this.buscarJogador(usuarioId);
    let query = this.supabaseService.getClient()
      .from('partida')
      .select('*, organizador:criador_id(id,nome,foto_url), participantes:partida_participante(jogador_id,jogador:jogador_id(id,nome,foto_url))')
      .eq('visibilidade', 'PUBLICA')
      .in('status', ['AGENDADA', 'ABERTA', 'LOTADA'])
      .gte('data_hora', new Date().toISOString())
      .order('data_hora', { ascending: true });
    if (filtros.cidade?.trim()) query = query.eq('cidade', filtros.cidade.trim());
    else if (jogador.cidade) query = query.eq('cidade', jogador.cidade);
    if (filtros.bairro?.trim()) query = query.eq('bairro', filtros.bairro.trim());
    if (filtros.modalidade?.trim()) query = query.ilike('modalidade', filtros.modalidade.trim());

    const { data, error } = await query;
    if (error) throw new BadRequestException('Não foi possível carregar as partidas públicas.');
    return (data || []).map((partida: any) => this.apresentarPartida(partida, jogador.id));
  }

  async listarMinhas(usuarioId: string) {
    const jogador = await this.buscarJogador(usuarioId);
    const { data, error } = await this.supabaseService.getClient()
      .from('partida_participante')
      .select('partida:partida_id(*, organizador:criador_id(id,nome,foto_url), participantes:partida_participante(jogador_id,jogador:jogador_id(id,nome,foto_url)))')
      .eq('jogador_id', jogador.id)
      .order('data_entrada', { ascending: false });
    if (error) throw new BadRequestException('Não foi possível carregar sua agenda.');
    const { data: pendentes, error: pendentesError } = await this.supabaseService.getClient()
      .from('partida')
      .select('*, organizador:criador_id(id,nome,foto_url), participantes:partida_participante(jogador_id,jogador:jogador_id(id,nome,foto_url))')
      .eq('status', 'PENDENTE')
      .or(`criador_id.eq.${jogador.id},oponente_id.eq.${jogador.id}`)
      .order('data_criacao', { ascending: false });
    if (pendentesError) throw new BadRequestException('Não foi possível carregar suas pendências.');
    const confirmadas = (data || []).map((item: any) => this.apresentarPartida(item.partida, jogador.id));
    const propostas = (pendentes || []).map((partida: any) => ({
      ...this.apresentarPartida(partida, jogador.id),
      aguardando_minha_confirmacao: partida.oponente_id === jogador.id,
      proposta_enviada_por_mim: partida.criador_id === jogador.id,
    }));
    return [...propostas, ...confirmadas];
  }

  async criar(usuarioId: string, dto: CriarPartidaPublicaDto) {
    const jogador = await this.buscarJogador(usuarioId);
    if (new Date(dto.data_hora).getTime() <= Date.now()) {
      throw new BadRequestException('A partida deve ser agendada para uma data futura.');
    }
    const { data: modalidade } = await this.supabaseService.getClient()
      .from('modalidade')
      .select('id,nome')
      .eq('nome', dto.modalidade.trim())
      .eq('ativa', true)
      .maybeSingle();
    if (!modalidade) throw new BadRequestException('Selecione uma modalidade válida do catálogo.');
    const visibilidade = dto.visibilidade === 'PRIVADA_LINK' ? 'PRIVADA_LINK' : 'PUBLICA';
    const conviteToken = visibilidade === 'PRIVADA_LINK' ? randomBytes(24).toString('base64url') : null;
    const { data: partida, error } = await this.supabaseService.getClient()
      .from('partida')
      .insert({
        criador_id: jogador.id,
        modalidade: dto.modalidade.trim(),
        local_nome: dto.local_nome.trim(),
        cidade: dto.cidade.trim(),
        bairro: dto.bairro.trim(),
        capacidade: dto.capacidade,
        descricao: dto.descricao?.trim() || null,
        data_hora: new Date(dto.data_hora).toISOString(),
        status: 'ABERTA',
        visibilidade,
        convite_token: conviteToken,
      })
      .select()
      .single();
    if (error || !partida) throw new BadRequestException('Não foi possível criar a partida.');

    const { error: participanteError } = await this.supabaseService.getClient()
      .from('partida_participante')
      .insert({ partida_id: partida.id, jogador_id: jogador.id });
    if (participanteError) throw new BadRequestException('Partida criada, mas não foi possível incluir o organizador.');
    return this.apresentarPartida({ ...partida, organizador: jogador, participantes: [{ jogador_id: jogador.id, jogador }] }, jogador.id);
  }

  async buscarPorConvite(usuarioId: string, token: string) {
    const jogador = await this.buscarJogador(usuarioId);
    const { data: partida } = await this.supabaseService.getClient().from('partida')
      .select('*, organizador:criador_id(id,nome,foto_url), participantes:partida_participante(jogador_id,jogador:jogador_id(id,nome,foto_url))')
      .eq('convite_token', token).eq('visibilidade', 'PRIVADA_LINK').maybeSingle();
    if (!partida) throw new NotFoundException('Convite de partida não encontrado ou expirado.');
    return this.apresentarPartida(partida, jogador.id);
  }

  async entrar(usuarioId: string, partidaId: string) {
    const jogador = await this.buscarJogador(usuarioId);
    const { data, error } = await this.supabaseService.getClient()
      .rpc('entrar_na_partida', { p_partida_id: partidaId, p_jogador_id: jogador.id });
    if (error) {
      if (error.message.includes('lotada')) throw new BadRequestException('Esta partida já está lotada.');
      if (error.message.includes('encerrada')) throw new BadRequestException('Esta partida não aceita novos participantes.');
      throw new BadRequestException('Não foi possível entrar na partida.');
    }
    const { data: partida } = await this.supabaseService.getClient().from('partida').select('criador_id,modalidade').eq('id', partidaId).maybeSingle();
    if (partida?.criador_id && partida.criador_id !== jogador.id) {
      await this.notificacaoService.criar(partida.criador_id, 'PARTIDA', 'Novo participante', `${jogador.nome} entrou na sua partida de ${partida.modalidade}.`, { partida_id: partidaId });
    }
    return { message: 'Você entrou na partida.', participacao: Array.isArray(data) ? data[0] : data };
  }

  async sair(usuarioId: string, partidaId: string) {
    const jogador = await this.buscarJogador(usuarioId);
    const { error } = await this.supabaseService.getClient()
      .rpc('sair_da_partida', { p_partida_id: partidaId, p_jogador_id: jogador.id });
    if (error) throw new BadRequestException(error.message.includes('organizador')
      ? 'O organizador deve cancelar a partida em vez de sair.'
      : 'Não foi possível sair da partida.');
    return { message: 'Você saiu da partida.' };
  }

  async atualizarStatus(usuarioId: string, partidaId: string, status: 'CONCLUIDA' | 'CANCELADA') {
    if (!['CONCLUIDA', 'CANCELADA'].includes(status)) throw new BadRequestException('Status inválido.');
    const jogador = await this.buscarJogador(usuarioId);
    const { data: partida } = await this.supabaseService.getClient().from('partida').select('*').eq('id', partidaId).maybeSingle();
    if (!partida) throw new NotFoundException('Partida não encontrada.');
    if (partida.criador_id !== jogador.id) throw new ForbiddenException('Somente o organizador pode encerrar ou cancelar a partida.');
    if (!['ABERTA', 'LOTADA'].includes(partida.status)) throw new BadRequestException('Esta partida já foi encerrada.');
    const { data, error } = await this.supabaseService.getClient()
      .from('partida')
      .update({ status, data_atualizacao: new Date().toISOString() })
      .eq('id', partidaId)
      .select()
      .single();
    if (error) throw new BadRequestException('Não foi possível atualizar a partida.');
    const { data: participantes } = await this.supabaseService.getClient()
      .from('partida_participante')
      .select('jogador_id')
      .eq('partida_id', partidaId);
    const acao = status === 'CONCLUIDA' ? 'concluída' : 'cancelada';
    await Promise.all((participantes || [])
      .filter((participante) => participante.jogador_id !== jogador.id)
      .map((participante) => this.notificacaoService.criar(
        participante.jogador_id,
        'PARTIDA',
        `Partida ${acao}`,
        `${jogador.nome} ${acao} a partida de ${partida.modalidade}.`,
        { partida_id: partidaId },
      )));
    return { message: status === 'CONCLUIDA' ? 'Partida concluída.' : 'Partida cancelada.', partida: data };
  }

  private async buscarJogador(usuarioId: string) {
    const { data } = await this.supabaseService.getClient().from('jogador').select('*').eq('usuario_id', usuarioId).maybeSingle();
    if (!data) throw new NotFoundException('Perfil de jogador não encontrado.');
    return data;
  }

  private apresentarPartida(partida: any, jogadorId: string) {
    const participantes = partida?.participantes || [];
    const conviteToken = partida.criador_id === jogadorId ? partida.convite_token || null : null;
    return {
      ...partida,
      convite_token: conviteToken,
      participantes,
      total_participantes: participantes.length,
      minha_participacao: participantes.some((item: any) => item.jogador_id === jogadorId),
      sou_organizador: partida.criador_id === jogadorId,
    };
  }
}
