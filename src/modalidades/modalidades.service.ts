import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class ModalidadesService {
  constructor(private readonly supabase: SupabaseService, private readonly config: ConfigService) {}
  async listar() {
    const { data, error } = await this.supabase.getClient().from('modalidade').select('id,slug,nome').eq('ativa', true).order('nome');
    if (error) throw new BadRequestException('Não foi possível carregar as modalidades.');
    return data || [];
  }
  async solicitar(usuarioId: string, nome: string) {
    const client = this.supabase.getClient(); const sugestao = nome.trim().replace(/\s+/g, ' ');
    if (sugestao.length < 2) throw new BadRequestException('Informe uma modalidade válida.');
    const { data: jogador } = await client.from('jogador').select('id,nome').eq('usuario_id', usuarioId).maybeSingle();
    if (!jogador) throw new BadRequestException('Perfil de jogador não encontrado.');
    const { data: existente } = await client.from('modalidade').select('id').ilike('nome', sugestao).maybeSingle();
    if (existente) throw new BadRequestException('Essa modalidade já está disponível.');
    const { data, error } = await client.from('solicitacao_modalidade').insert({ jogador_id: jogador.id, nome_sugerido: sugestao }).select().single();
    if (error) throw new BadRequestException('Não foi possível registrar sua sugestão.');
    const key = this.config.get<string>('RESEND_API_KEY'), from = this.config.get<string>('RESEND_FROM_EMAIL'), to = this.config.get<string>('ADMIN_NOTIFICATION_EMAIL');
    if (key && from && to) await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to, subject: 'Nova modalidade sugerida — Sports Match', html: `<p><strong>${jogador.nome}</strong> sugeriu: <strong>${sugestao}</strong>.</p>` }) });
    return { message: 'Sugestão enviada para análise. Obrigado!', solicitacao: data };
  }
}
