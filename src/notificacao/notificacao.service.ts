import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export type TipoNotificacao = 'MATCH' | 'MENSAGEM' | 'PARTIDA' | 'AVALIACAO';

@Injectable()
export class NotificacaoService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async criar(jogadorId: string, tipo: TipoNotificacao, titulo: string, corpo: string, dados: Record<string, string> = {}) {
    await this.supabaseService.getClient().from('notificacao').insert({
      jogador_id: jogadorId, tipo, titulo, corpo, dados,
    });
  }

  async listar(usuarioId: string, limite = 30) {
    const jogador = await this.buscarJogador(usuarioId);
    const { data } = await this.supabaseService.getClient()
      .from('notificacao')
      .select('*')
      .eq('jogador_id', jogador.id)
      .order('data_criacao', { ascending: false })
      .limit(Math.min(Math.max(limite, 1), 50));
    return data || [];
  }

  async naoLidas(usuarioId: string) {
    const jogador = await this.buscarJogador(usuarioId);
    const { count } = await this.supabaseService.getClient()
      .from('notificacao')
      .select('*', { count: 'exact', head: true })
      .eq('jogador_id', jogador.id)
      .is('lida_em', null);
    return { total: count || 0 };
  }

  async marcarLida(usuarioId: string, notificacaoId: string) {
    const jogador = await this.buscarJogador(usuarioId);
    const { data } = await this.supabaseService.getClient()
      .from('notificacao')
      .update({ lida_em: new Date().toISOString() })
      .eq('id', notificacaoId)
      .eq('jogador_id', jogador.id)
      .select()
      .maybeSingle();
    if (!data) throw new NotFoundException('Notificação não encontrada.');
    return data;
  }

  async marcarTodasLidas(usuarioId: string) {
    const jogador = await this.buscarJogador(usuarioId);
    await this.supabaseService.getClient().from('notificacao')
      .update({ lida_em: new Date().toISOString() })
      .eq('jogador_id', jogador.id)
      .is('lida_em', null);
    return { message: 'Notificações marcadas como lidas.' };
  }

  private async buscarJogador(usuarioId: string) {
    const { data } = await this.supabaseService.getClient().from('jogador').select('id').eq('usuario_id', usuarioId).maybeSingle();
    if (!data) throw new ForbiddenException('Perfil de jogador não encontrado.');
    return data;
  }
}
