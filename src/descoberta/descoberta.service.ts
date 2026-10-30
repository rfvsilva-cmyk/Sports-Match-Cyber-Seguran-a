import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { RegistrarSwipeDto, TipoSwipeEnum } from './dto/descoberta.dto';
import { NotificacaoService } from '../notificacao/notificacao.service';

interface FiltrosDescoberta {
  modalidade?: string;
  nivel?: string;
  cidade?: string;
  bairro?: string;
}

@Injectable()
export class DescobertaService {
  constructor(private readonly supabaseService: SupabaseService, private readonly notificacaoService: NotificacaoService) {}

  async buscarFeedDescoberta(usuarioId: string, filtros: FiltrosDescoberta) {
    const supabase = this.supabaseService.getClient();
    const { data: jogadorAtual } = await supabase
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (!jogadorAtual) throw new NotFoundException('Perfil de jogador não encontrado.');
    if (!jogadorAtual.cidade || !jogadorAtual.bairro) {
      throw new BadRequestException('Complete cidade e bairro antes de usar a descoberta.');
    }
    if (!jogadorAtual.modalidade_id) throw new BadRequestException('Selecione uma modalidade do catálogo antes de usar a descoberta.');

    const { data: decisoes } = await supabase
      .from('like')
      .select('id_destino')
      .eq('id_origem', jogadorAtual.id);
    const excludedIds = [...(decisoes || []).map((item) => item.id_destino), jogadorAtual.id];

    let query = supabase
      .from('jogador')
      .select('id, nome, foto_url, bio, cidade, bairro, esporte_individual, nivel_individual, media_avaliacao, total_avaliacoes')
      .eq('perfil_completo', true)
      .eq('cidade', filtros.cidade?.trim() || jogadorAtual.cidade)
      .limit(30);

    if (filtros.modalidade?.trim()) query = query.eq('modalidade_id', filtros.modalidade.trim());
    if (filtros.bairro?.trim()) query = query.eq('bairro', filtros.bairro.trim());
    if (filtros.nivel?.trim()) query = query.ilike('nivel_individual', filtros.nivel.trim());
    if (excludedIds.length) query = query.not('id', 'in', `(${excludedIds.join(',')})`);

    const { data: perfis, error } = await query;
    if (error) throw new BadRequestException('Não foi possível carregar a descoberta.');
    return { total: perfis?.length || 0, perfis: perfis || [] };
  }

  async registrarSwipe(usuarioId: string, dto: RegistrarSwipeDto) {
    const supabase = this.supabaseService.getClient();
    const origem = await this.buscarJogadorPorUsuario(usuarioId);
    if (origem.id === dto.id_destino) throw new BadRequestException('Você não pode avaliar o próprio perfil.');

    const { data: destino } = await supabase.from('jogador').select('*').eq('id', dto.id_destino).maybeSingle();
    if (!destino) throw new NotFoundException('Perfil de destino não encontrado.');

    const { error: swipeError } = await supabase.from('like').insert({
      id_origem: origem.id,
      id_destino: destino.id,
      tipo: dto.tipo,
    });
    if (swipeError) throw new ConflictException('Você já registrou uma decisão para este perfil.');

    if (dto.tipo !== TipoSwipeEnum.LIKE) return { match: false, match_id: null, conversa_id: null };

    const { data: reciproco } = await supabase
      .from('like')
      .select('id')
      .eq('id_origem', destino.id)
      .eq('id_destino', origem.id)
      .eq('tipo', TipoSwipeEnum.LIKE)
      .maybeSingle();
    if (!reciproco) return { match: false, match_id: null, conversa_id: null };

    const [idJogador1, idJogador2] = [origem.id, destino.id].sort();
    let { data: match } = await supabase
      .from('match')
      .select('*')
      .eq('id_jogador1', idJogador1)
      .eq('id_jogador2', idJogador2)
      .maybeSingle();

    if (!match) {
      const created = await supabase
        .from('match')
        .insert({ id_jogador1: idJogador1, id_jogador2: idJogador2 })
        .select()
        .maybeSingle();
      if (created.error && created.error.code !== '23505') {
        throw new BadRequestException('Não foi possível criar o match.');
      }
      match = created.data || (await supabase
        .from('match')
        .select('*')
        .eq('id_jogador1', idJogador1)
        .eq('id_jogador2', idJogador2)
        .single()).data;
    }

    let { data: conversa } = await supabase.from('conversa').select('*').eq('match_id', match.id).maybeSingle();
    let conversaCriada = false;
    if (!conversa) {
      const created = await supabase.from('conversa').insert({ match_id: match.id }).select().maybeSingle();
      if (created.error && created.error.code !== '23505') {
        throw new BadRequestException('Não foi possível preparar a conversa do match.');
      }
      conversa = created.data || (await supabase.from('conversa').select('*').eq('match_id', match.id).single()).data;
      conversaCriada = Boolean(created.data);
    }
    if (conversaCriada) {
      await Promise.all([
        this.notificacaoService.criar(origem.id, 'MATCH', 'Novo match!', `Você e ${destino.nome} agora podem conversar.`, { conversa_id: conversa.id }),
        this.notificacaoService.criar(destino.id, 'MATCH', 'Novo match!', `Você e ${origem.nome} agora podem conversar.`, { conversa_id: conversa.id }),
      ]);
    }

    return {
      match: true,
      match_id: match.id,
      conversa_id: conversa.id,
      oponente: { id: destino.id, nome: destino.nome, foto_url: destino.foto_url },
    };
  }

  private async buscarJogadorPorUsuario(usuarioId: string) {
    const { data } = await this.supabaseService.getClient()
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (!data) throw new NotFoundException('Perfil de jogador não encontrado.');
    return data;
  }
}
