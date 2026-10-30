import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CriarAvaliacaoDto } from './dto/avaliacao.dto';
import { NotificacaoService } from '../notificacao/notificacao.service';

@Injectable()
export class AvaliacaoService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly notificacaoService: NotificacaoService,
  ) {}

  async avaliarPartida(usuarioId: string, dto: CriarAvaliacaoDto) {
    const supabase = this.supabaseService.getClient();
    const { data: avaliador } = await supabase.from('jogador').select('*').eq('usuario_id', usuarioId).maybeSingle();
    if (!avaliador) throw new NotFoundException('Perfil de jogador não encontrado.');

    const { data: partida } = await supabase.from('partida').select('id,status').eq('id', dto.partida_id).maybeSingle();
    if (!partida) throw new NotFoundException('Partida não encontrada.');
    if (partida.status !== 'CONCLUIDA') throw new BadRequestException('Apenas partidas concluídas podem ser avaliadas.');

    const { data: participacoes } = await supabase
      .from('partida_participante')
      .select('jogador_id')
      .eq('partida_id', dto.partida_id);
    const participanteIds = (participacoes || []).map((participacao) => participacao.jogador_id);
    if (!participanteIds.includes(avaliador.id)) throw new ForbiddenException('Você não participou desta partida.');
    if (dto.avaliado_id === avaliador.id || !participanteIds.includes(dto.avaliado_id)) {
      throw new BadRequestException('Escolha outro participante desta partida para avaliar.');
    }

    const { data: existente } = await supabase
      .from('avaliacao')
      .select('id')
      .eq('partida_id', dto.partida_id)
      .eq('avaliador_id', avaliador.id)
      .eq('avaliado_id', dto.avaliado_id)
      .maybeSingle();
    if (existente) throw new ConflictException('Você já avaliou este participante nesta partida.');

    const { data: avaliacao, error } = await supabase
      .from('avaliacao')
      .insert({
        partida_id: dto.partida_id,
        avaliador_id: avaliador.id,
        avaliado_id: dto.avaliado_id,
        nota: dto.nota,
        comentario: dto.comentario?.trim() || null,
      })
      .select()
      .single();
    if (error) throw new BadRequestException('Não foi possível registrar a avaliação.');

    const { data: avaliacoes } = await supabase.from('avaliacao').select('nota').eq('avaliado_id', dto.avaliado_id);
    const total = (avaliacoes || []).length;
    const media = total ? Math.round(((avaliacoes || []).reduce((sum, item) => sum + item.nota, 0) / total) * 10) / 10 : dto.nota;
    await supabase.from('jogador').update({ media_avaliacao: media, total_avaliacoes: total }).eq('id', dto.avaliado_id);
    await this.notificacaoService.criar(
      dto.avaliado_id,
      'AVALIACAO',
      'Nova avaliação recebida',
      `${avaliador.nome} avaliou sua participação na partida.`,
      { partida_id: dto.partida_id },
    );

    return { message: 'Avaliação enviada com sucesso.', avaliacao, avaliado: { id: dto.avaliado_id, media, total } };
  }

  async buscarAvaliacoesDoJogador(jogadorId: string) {
    const supabase = this.supabaseService.getClient();
    const { data: jogador } = await supabase.from('jogador').select('*').eq('id', jogadorId).maybeSingle();
    if (!jogador) throw new NotFoundException('Jogador não encontrado.');
    const { data: avaliacoes } = await supabase
      .from('avaliacao')
      .select('*, avaliador:avaliador_id(id,nome,foto_url), partida:partida_id(modalidade,data_hora)')
      .eq('avaliado_id', jogadorId)
      .order('data_criacao', { ascending: false });
    return { media_avaliacao: jogador.media_avaliacao, total_avaliacoes: jogador.total_avaliacoes, avaliacoes: avaliacoes || [] };
  }
}
