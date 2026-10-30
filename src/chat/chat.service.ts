import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { EnviarMensagemDto, CriarPartidaDto, AtualizarStatusPartidaDto } from './dto/chat.dto';
import { NotificacaoService } from '../notificacao/notificacao.service';

export enum StatusPartidaEnum {
  PENDENTE = 'PENDENTE',
  AGENDADA = 'AGENDADA',
  CONCLUIDA = 'CONCLUIDA',
  CANCELADA = 'CANCELADA',
}

@Injectable()
export class ChatService {
  constructor(
    private supabaseService: SupabaseService,
    private notificacaoService: NotificacaoService,
  ) {}

  async listarConversas(usuarioId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: jogador } = await supabase
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    if (!jogador) {
      throw new NotFoundException('Perfil de jogador não encontrado.');
    }

    const { data: matches } = await supabase
      .from('match')
      .select(`
        *,
        jogador1:id_jogador1(*),
        jogador2:id_jogador2(*),
        conversa:conversa(*, mensagens:mensagem(remetente_id, lida_em))
      `)
      .or(`id_jogador1.eq.${jogador.id},id_jogador2.eq.${jogador.id}`)
      .order('data_criacao', { ascending: false });

    return (matches || []).map((m: any) => {
      const oponente = m.id_jogador1 === jogador.id ? m.jogador2 : m.jogador1;
      const conversaData = Array.isArray(m.conversa) ? m.conversa[0] : m.conversa;
      const naoLidas = (conversaData?.mensagens || [])
        .filter((mensagem: any) => mensagem.remetente_id !== jogador.id && !mensagem.lida_em)
        .length;

      return {
        match_id: m.id,
        conversa_id: conversaData?.id,
        nao_lidas: naoLidas,
        oponente: {
          id: oponente?.id,
          nome: oponente?.nome,
          foto_url: oponente?.foto_url,
          bairro: oponente?.bairro,
          esporte_individual: oponente?.esporte_individual,
          media_avaliacao: oponente?.media_avaliacao,
        },
      };
    });
  }

  async buscarHistoricoConversa(usuarioId: string, conversaId: string) {
    const supabase = this.supabaseService.getClient();

    const { data: jogador } = await supabase
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const { data: conversa } = await supabase
      .from('conversa')
      .select(`
        *,
        match(
          id_jogador1,
          id_jogador2,
          jogador1:id_jogador1(id,nome,foto_url,bio,cidade,bairro,esporte_individual,nivel_individual,media_avaliacao,total_avaliacoes,perfil_completo),
          jogador2:id_jogador2(id,nome,foto_url,bio,cidade,bairro,esporte_individual,nivel_individual,media_avaliacao,total_avaliacoes,perfil_completo)
        ),
        mensagens:mensagem(*, remetente:remetente_id(id, nome, foto_url)),
        partidas:partida(*)
      `)
      .eq('id', conversaId)
      .maybeSingle();

    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    const matchData = Array.isArray(conversa.match) ? conversa.match[0] : conversa.match;

    if (matchData.id_jogador1 !== jogador.id && matchData.id_jogador2 !== jogador.id) {
      throw new ForbiddenException('Acesso negado a esta conversa.');
    }

    await supabase
      .from('mensagem')
      .update({ lida_em: new Date().toISOString() })
      .eq('conversa_id', conversaId)
      .neq('remetente_id', jogador.id)
      .is('lida_em', null);

    const jogador1 = (Array.isArray(matchData.jogador1) ? matchData.jogador1[0] : matchData.jogador1) || null;
    const jogador2 = (Array.isArray(matchData.jogador2) ? matchData.jogador2[0] : matchData.jogador2) || null;
    const oponente = matchData.id_jogador1 === jogador.id ? jogador2 : jogador1;

    return {
      ...conversa,
      mensagens: (conversa.mensagens || []).map((mensagem: any) => ({
        ...mensagem,
        data_criacao: mensagem.data_criacao || mensagem.criado_em,
      })),
      partidas: (conversa.partidas || []).map((partida: any) => ({
        ...partida,
        aguardando_minha_confirmacao: partida.status === StatusPartidaEnum.PENDENTE && partida.oponente_id === jogador.id,
      })),
      oponente: oponente && {
        id: oponente.id,
        nome: oponente.nome,
        foto_url: oponente.foto_url,
        bio: oponente.bio,
        cidade: oponente.cidade,
        bairro: oponente.bairro,
        esporte_individual: oponente.esporte_individual,
        nivel_individual: oponente.nivel_individual,
        media_avaliacao: oponente.media_avaliacao,
        total_avaliacoes: oponente.total_avaliacoes,
        perfil_completo: oponente.perfil_completo,
      },
    };
  }

  async enviarMensagem(usuarioId: string, dto: EnviarMensagemDto) {
    const supabase = this.supabaseService.getClient();

    const { data: jogador } = await supabase
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const { data: conversa } = await supabase
      .from('conversa')
      .select('*, match(*)')
      .eq('id', dto.conversa_id)
      .maybeSingle();

    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    const matchData = Array.isArray(conversa.match) ? conversa.match[0] : conversa.match;

    if (matchData.id_jogador1 !== jogador.id && matchData.id_jogador2 !== jogador.id) {
      throw new ForbiddenException('Acesso negado para enviar mensagem nesta conversa.');
    }

    const { data: mensagem, error } = await supabase
      .from('mensagem')
      .insert({
        conversa_id: dto.conversa_id,
        remetente_id: jogador.id,
        conteudo: dto.conteudo,
      })
      .select('*, remetente:remetente_id(id, nome, foto_url)')
      .single();

    if (error) {
      throw new BadRequestException('Erro ao enviar mensagem.');
    }
    const destinatarioId = matchData.id_jogador1 === jogador.id ? matchData.id_jogador2 : matchData.id_jogador1;
    await this.notificacaoService.criar(destinatarioId, 'MENSAGEM', `Nova mensagem de ${jogador.nome}`, dto.conteudo.slice(0, 140), { conversa_id: dto.conversa_id });

    return {
      ...mensagem,
      data_criacao: mensagem.data_criacao || mensagem.criado_em,
    };
  }

  async agendarPartida(usuarioId: string, dto: CriarPartidaDto) {
    const supabase = this.supabaseService.getClient();

    const { data: jogador } = await supabase
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const { data: conversa } = await supabase
      .from('conversa')
      .select('*, match(*)')
      .eq('id', dto.conversa_id)
      .maybeSingle();

    if (!conversa) {
      throw new NotFoundException('Conversa não encontrada.');
    }

    const matchData = Array.isArray(conversa.match) ? conversa.match[0] : conversa.match;

    if (matchData.id_jogador1 !== jogador.id && matchData.id_jogador2 !== jogador.id) {
      throw new ForbiddenException('Acesso negado para agendar partida nesta conversa.');
    }

    const oponenteId = matchData.id_jogador1 === jogador.id
      ? matchData.id_jogador2
      : matchData.id_jogador1;

    const { data: propostaPendente } = await supabase
      .from('partida')
      .select('id,criador_id')
      .eq('conversa_id', dto.conversa_id)
      .eq('status', StatusPartidaEnum.PENDENTE)
      .maybeSingle();
    if (propostaPendente) {
      throw new BadRequestException('Já existe uma proposta pendente nesta conversa. Aguarde a confirmação ou resposta do outro jogador.');
    }

    const { data: partida, error } = await supabase
      .from('partida')
      .insert({
        conversa_id: dto.conversa_id,
        criador_id: jogador.id,
        oponente_id: oponenteId,
        modalidade: dto.modalidade,
        local_nome: dto.local_nome,
        latitude: dto.latitude,
        longitude: dto.longitude,
        data_hora: new Date(dto.data_hora).toISOString(),
        status: StatusPartidaEnum.PENDENTE,
      })
      .select()
      .single();

    if (error) {
      throw new BadRequestException('Erro ao agendar partida.');
    }
    await this.notificacaoService.criar(oponenteId, 'PARTIDA', 'Proposta de partida', `${jogador.nome} propôs uma partida de ${dto.modalidade}. Confirme para adicionar à agenda.`, { conversa_id: dto.conversa_id, partida_id: partida.id });

    return {
      message: 'Proposta enviada. A partida entra na agenda após o aceite do outro jogador.',
      partida,
    };
  }

  async aceitarPartida(usuarioId: string, partidaId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: jogador } = await supabase.from('jogador').select('*').eq('usuario_id', usuarioId).maybeSingle();
    if (!jogador) throw new NotFoundException('Perfil de jogador não encontrado.');

    const { data: partida } = await supabase.from('partida').select('*').eq('id', partidaId).maybeSingle();
    if (!partida) throw new NotFoundException('Partida não encontrada.');
    if (partida.status !== StatusPartidaEnum.PENDENTE) throw new BadRequestException('Esta proposta não está mais pendente.');
    if (partida.oponente_id !== jogador.id) throw new ForbiddenException('Somente o jogador convidado pode aceitar esta proposta.');
    if (new Date(partida.data_hora).getTime() <= Date.now()) throw new BadRequestException('Não é possível aceitar uma partida em data passada.');

    const { data: atualizada, error } = await supabase
      .from('partida')
      .update({ status: StatusPartidaEnum.AGENDADA, data_atualizacao: new Date().toISOString() })
      .eq('id', partidaId)
      .eq('status', StatusPartidaEnum.PENDENTE)
      .select()
      .maybeSingle();
    if (error || !atualizada) throw new BadRequestException('Esta proposta já foi respondida.');

    const { error: participantesError } = await supabase.from('partida_participante').upsert([
      { partida_id: partidaId, jogador_id: partida.criador_id },
      { partida_id: partidaId, jogador_id: jogador.id },
    ], { onConflict: 'partida_id,jogador_id', ignoreDuplicates: true });
    if (participantesError) throw new BadRequestException('Partida confirmada, mas não foi possível registrar os participantes.');

    await this.notificacaoService.criar(
      partida.criador_id,
      'PARTIDA',
      'Partida aceita',
      `${jogador.nome} confirmou a partida de ${partida.modalidade}.`,
      { conversa_id: partida.conversa_id, partida_id: partidaId },
    );
    return { message: 'Partida confirmada e adicionada à agenda.', partida: atualizada };
  }

  async atualizarStatusPartida(usuarioId: string, partidaId: string, dto: AtualizarStatusPartidaDto) {
    const supabase = this.supabaseService.getClient();

    const { data: jogador } = await supabase
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();

    const { data: partida } = await supabase
      .from('partida')
      .select('*')
      .eq('id', partidaId)
      .maybeSingle();

    if (!partida) {
      throw new NotFoundException('Partida não encontrada.');
    }

    if (partida.criador_id !== jogador.id && partida.oponente_id !== jogador.id) {
      throw new ForbiddenException('Você não tem permissão para alterar esta partida.');
    }

    const novoStatus = dto.status === 'CONCLUIDA' ? StatusPartidaEnum.CONCLUIDA : StatusPartidaEnum.CANCELADA;

    const { data: partidaAtualizada } = await supabase
      .from('partida')
      .update({ status: novoStatus, data_atualizacao: new Date().toISOString() })
      .eq('id', partidaId)
      .select()
      .single();

    const destinatarioId = partida.criador_id === jogador.id ? partida.oponente_id : partida.criador_id;
    if (destinatarioId) {
      const acao = novoStatus === StatusPartidaEnum.CONCLUIDA ? 'concluída' : 'cancelada';
      await this.notificacaoService.criar(
        destinatarioId,
        'PARTIDA',
        `Partida ${acao}`,
        `${jogador.nome} ${acao} a partida de ${partida.modalidade}.`,
        { partida_id: partidaId, conversa_id: partida.conversa_id },
      );
    }

    return {
      message: `Partida ${novoStatus === StatusPartidaEnum.CONCLUIDA ? 'concluída' : 'cancelada'} com sucesso.`,
      partida: partidaAtualizada,
    };
  }
}
