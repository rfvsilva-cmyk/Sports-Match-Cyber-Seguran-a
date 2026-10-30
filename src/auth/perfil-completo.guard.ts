import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class PerfilCompletoGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const usuario = context.switchToHttp().getRequest().user;
    const jogador = Array.isArray(usuario?.jogador) ? usuario.jogador[0] : usuario?.jogador;
    if (!jogador) throw new ForbiddenException('Acesso negado. Perfil não encontrado.');
    if (!jogador.perfil_completo) {
      throw new ForbiddenException('Complete cidade, bairro, modalidade e nível para acessar esta funcionalidade.');
    }
    return true;
  }
}
