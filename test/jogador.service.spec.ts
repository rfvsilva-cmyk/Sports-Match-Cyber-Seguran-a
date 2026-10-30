import { JogadorService } from '../src/jogador/jogador.service';

describe('JogadorService', () => {
  it('persists only editable profile fields and recalculates profile completion', async () => {
    const currentProfile = { id: 'player-1', usuario_id: 'user-1', nome: 'Nome antigo', cidade: null, bairro: null, esporte_individual: null, nivel_individual: null, perfil_completo: false };
    const single = jest.fn().mockResolvedValue({ data: { ...currentProfile, cidade: 'Cascavel', bairro: 'Centro', esporte_individual: 'Tênis', nivel_individual: 'Intermediário', perfil_completo: true }, error: null });
    const update = jest.fn().mockReturnValue({ eq: jest.fn().mockReturnValue({ select: jest.fn().mockReturnValue({ single }) }) });
    const query = { select: jest.fn(), eq: jest.fn(), maybeSingle: jest.fn().mockResolvedValue({ data: currentProfile }), update };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    const service = new JogadorService({ getClient: () => ({ from: jest.fn().mockReturnValue(query) }) } as any);

    await service.atualizarPerfil('user-1', { nome: '  Jorge  ', cidade: ' Cascavel ', bairro: ' Centro ', esporte_individual: ' Tênis ', nivel_individual: ' Intermediário ', id: 'attempted-overwrite', usuario_id: 'other-user' } as any);

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ nome: '  Jorge  ', cidade: 'Cascavel', bairro: 'Centro', esporte_individual: 'Tênis', nivel_individual: 'Intermediário', perfil_completo: true }));
    expect(update.mock.calls[0][0]).not.toHaveProperty('id');
    expect(update.mock.calls[0][0]).not.toHaveProperty('usuario_id');
  });
});
