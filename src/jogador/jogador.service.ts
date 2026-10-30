import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { AtualizarPerfilDto } from './dto/atualizar-perfil.dto';

@Injectable()
export class JogadorService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private readonly bucketFotos = 'profile-photos';

  async buscarMeuPerfil(usuarioId: string) {
    const { data: jogador } = await this.supabaseService.getClient()
      .from('jogador')
      .select('*')
      .eq('usuario_id', usuarioId)
      .maybeSingle();
    if (!jogador) throw new NotFoundException('Perfil de jogador não encontrado.');
    return jogador;
  }

  async buscarPerfilPublico(jogadorId: string) {
    const { data: jogador } = await this.supabaseService.getClient()
      .from('jogador')
      .select('id,nome,foto_url,bio,cidade,bairro,esporte_individual,nivel_individual,media_avaliacao,total_avaliacoes,perfil_completo')
      .eq('id', jogadorId)
      .maybeSingle();
    if (!jogador) throw new NotFoundException('Jogador não encontrado.');
    return jogador;
  }

  async atualizarPerfil(usuarioId: string, dto: AtualizarPerfilDto) {
    const supabase = this.supabaseService.getClient();
    const jogadorAtual = await this.buscarMeuPerfil(usuarioId);
    const cidade = dto.cidade !== undefined ? dto.cidade.trim() : jogadorAtual.cidade;
    const bairro = dto.bairro !== undefined ? dto.bairro.trim() : jogadorAtual.bairro;
    let modalidadeId = dto.modalidade_id !== undefined ? dto.modalidade_id : jogadorAtual.modalidade_id;
    let modalidade = jogadorAtual.esporte_individual;
    if (dto.modalidade_id !== undefined) {
      const { data: catalogo } = await supabase.from('modalidade').select('id,nome').eq('id', dto.modalidade_id).eq('ativa', true).maybeSingle();
      if (!catalogo) throw new NotFoundException('Modalidade inválida.');
      modalidadeId = catalogo.id;
      modalidade = catalogo.nome;
    }
    // Compatibility with existing accounts and API clients predating the
    // modality catalog. New frontend flows always submit modalidade_id.
    if (dto.modalidade_id === undefined && dto.esporte_individual !== undefined) {
      modalidade = dto.esporte_individual.trim();
    }
    const nivel = dto.nivel_individual !== undefined ? dto.nivel_individual.trim() : jogadorAtual.nivel_individual;
    const perfilCompleto = Boolean(cidade && bairro && (modalidadeId || modalidade) && nivel);
    const camposEditaveis = Object.fromEntries(
      (['nome', 'foto_url', 'bio', 'cidade', 'bairro', 'nivel_individual'] as const)
        .filter((campo) => dto[campo] !== undefined)
        .map((campo) => [campo, dto[campo]]),
    );

    const { data: jogador, error } = await supabase
      .from('jogador')
      .update({
        ...camposEditaveis,
        cidade,
        bairro,
        esporte_individual: modalidade,
        modalidade_id: modalidadeId,
        nivel_individual: nivel,
        perfil_completo: perfilCompleto,
        data_atualizacao: new Date().toISOString(),
      })
      .eq('usuario_id', usuarioId)
      .select()
      .single();

    if (error || !jogador) throw new NotFoundException('Não foi possível atualizar o perfil.');
    return {
      message: perfilCompleto
        ? 'Perfil atualizado. A descoberta está liberada.'
        : 'Perfil atualizado. Informe cidade, bairro, modalidade e nível para liberar a descoberta.',
      jogador,
    };
  }

  async enviarFoto(usuarioId: string, foto: { buffer: Buffer; mimetype: string }) {
    const jogador = await this.buscarMeuPerfil(usuarioId);
    const extensoes: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    };
    const extensao = extensoes[foto.mimetype];
    if (!extensao || !foto.buffer?.length || !this.isValidImageSignature(foto.buffer, foto.mimetype)) {
      throw new BadRequestException('Formato de imagem inválido.');
    }

    const caminho = `${jogador.id}/avatar.${extensao}`;
    const storage = this.supabaseService.getClient().storage.from(this.bucketFotos);
    const { error: uploadError } = await storage.upload(caminho, foto.buffer, {
      contentType: foto.mimetype,
      upsert: true,
      cacheControl: '3600',
    });
    if (uploadError) throw new BadRequestException('Não foi possível enviar a foto.');

    const { data: urlData } = storage.getPublicUrl(caminho);
    const fotoUrl = `${urlData.publicUrl}?v=${Date.now()}`;
    const { data: atualizado, error: updateError } = await this.supabaseService.getClient()
      .from('jogador')
      .update({ foto_url: fotoUrl, data_atualizacao: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
      .select()
      .single();
    if (updateError || !atualizado) throw new BadRequestException('Não foi possível salvar a foto do perfil.');
    return { message: 'Foto atualizada com sucesso.', jogador: atualizado };
  }

  private isValidImageSignature(buffer: Buffer, mimetype: string): boolean {
    if (mimetype === 'image/jpeg') {
      return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
    }
    if (mimetype === 'image/png') {
      return buffer.length >= 8 &&
        buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    }
    if (mimetype === 'image/webp') {
      return buffer.length >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return false;
  }

  async removerFoto(usuarioId: string) {
    const jogador = await this.buscarMeuPerfil(usuarioId);
    const prefixo = `/storage/v1/object/public/${this.bucketFotos}/`;
    const url = jogador.foto_url?.split('?')[0] || '';
    const indice = url.indexOf(prefixo);
    if (indice >= 0) {
      const caminho = url.slice(indice + prefixo.length);
      await this.supabaseService.getClient().storage.from(this.bucketFotos).remove([caminho]);
    }
    const { data: atualizado, error } = await this.supabaseService.getClient()
      .from('jogador')
      .update({ foto_url: null, data_atualizacao: new Date().toISOString() })
      .eq('usuario_id', usuarioId)
      .select()
      .single();
    if (error || !atualizado) throw new BadRequestException('Não foi possível remover a foto do perfil.');
    return { message: 'Foto removida.', jogador: atualizado };
  }
}
