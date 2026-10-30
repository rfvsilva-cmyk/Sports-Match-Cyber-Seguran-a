# Plano de implementação — identidade, partidas e agenda

## Objetivo

Melhorar a experiência do Sports Match sem trocar a arquitetura existente
(React/Vite, NestJS, sessão por cookie e Supabase). O Figma segue apenas como
referência visual: não entram mocks, arena ou uma segunda arquitetura.

## Decisões de experiência já alinhadas

| Área | Responsabilidade |
| --- | --- |
| Explorar partidas | Vitrine de partidas públicas criadas na plataforma: descobrir, filtrar, entrar e criar. |
| Minha agenda | Somente partidas confirmadas em que o jogador participa, separadas entre próximas e passadas. |
| Conversas | Propostas privadas diretas entre dois matches; entram na agenda só após aceite. |
| Avaliações | Pertencem ao detalhe de uma partida passada/concluída, nunca à lista geral. |
| Modalidade | Opção do cadastro de modalidades, escolhida sempre por `select`. |
| Vagas | Controle numérico limitado, mínimo 2, com stepper; não é texto livre. |

## Decisões a confirmar antes das ondas dependentes

1. Trocar os nomes do menu para `Explorar` e `Minha agenda`.
2. Permitir, fora do chat, criar `Pública` ou `Privada por link`. A privada por
   link pode ter várias vagas e não aparece na vitrine; isso é diferente da
   proposta direta do chat, que é sempre entre o match.
3. Permitir avaliação somente quando a partida estiver concluída e sua data/hora
   já tiver passado.

## Ondas

### Onda 0 — Marca oficial

**Objetivo:** remover a marca genérica `SM` e usar a logo oficial.

1. Usar como fonte única `front-end/src/imports/logo-app-sports-match.png`.
2. Trocar a marca textual do cabeçalho autenticado, do modal de instalação PWA
   e de qualquer outro ponto que mostre o quadrado `SM`.
3. Preservar links, texto alternativo, responsividade e área de toque.
4. Não editar `public/assets/logo-app-sports-match-B8ZkkCL6.png`: o nome com
   hash é somente um arquivo gerado pelo build Vite.

**Saída:** concluída em 22/09/2026. Nenhuma marca genérica visível; a logo
oficial funciona em desktop e celular.

### Onda 1 — Controles padronizados

**Objetivo:** nenhuma escolha fechada pode ser digitada livremente.

1. Mapear perfil, filtros, criar partida pública, proposta no chat, avaliação e
   autenticação.
2. Converter toda modalidade em `select` carregado por `GET /modalidades`,
   incluindo obrigatoriamente `Nova partida` da tela pública.
3. Converter `Vagas totais` em stepper acessível, mínimo 2 e máximo validado
   pelo backend.
4. Manter texto livre apenas para local, descrição, bio e comentário.
5. Validar os limites no cliente e no servidor.

**Saída:** concluída em 22/09/2026. Modalidade não é digitável na criação de
partidas públicas nem no chat; vagas inválidas são limitadas no controle e
validadas também pela API.

### Onda 2 — Navegação e linguagem

**Objetivo:** separar a vitrine pública da agenda pessoal sem quebrar URLs.

1. Exibir `Explorar partidas` na navegação atual de `/partidas`, com títulos `Partidas
   públicas` e textos de descoberta.
2. Exibir `Minha agenda` em `/agenda`.
3. Preservar inicialmente as rotas atuais para compatibilidade.
4. Reescrever estados vazios conforme cada objetivo.

**Saída:** concluída em 22/09/2026. Fica claro onde criar/entrar em jogos
públicos e onde consultar os próprios compromissos, mantendo `/partidas` e
`/agenda` compatíveis.

### Onda 3 — Criação pública e privada por link

**Objetivo:** concluir a criação fora do chat com visibilidade e convite.

1. Adicionar visibilidade (`PUBLICA`/`PRIVADA_LINK`) e token de convite não
   enumerável em migration.
2. Adaptar criação, consulta e entrada na API, preservando a proposta privada
   já existente no chat.
3. Formulário com visibilidade, modalidade, local, data, vagas e descrição.
4. Após criar, informar alcance público ou oferecer `Copiar link` para convite.
5. Criar rota de convite que respeite sessão, capacidade e autorização.

**Saída:** concluída em 23/09/2026. Partida pública aparece na vitrine; a
privada por link não aparece nela, possui convite não enumerável, permite
entrada autenticada e seu organizador pode copiar novamente o link no detalhe
da agenda.

### Onda 4 — Estado da proposta no chat

**Objetivo:** ninguém deve ter dúvida sobre uma solicitação já enviada.

1. Remetente vê `Proposta pendente de confirmação por <nome>`.
2. Convidado vê resumo, recebe notificação e pode aceitar.
3. Bloquear propostas duplicadas na mesma conversa enquanto houver pendência.
4. Após aceite, atualizar ambos os chats, notificar remetente e incluir a
   partida na agenda dos dois.
5. Manter contadores de mensagens não lidas separados de notificações de
   partida.

**Saída:** concluída em 22/09/2026. Propostas exibem estado para remetente e
convidado, notificam o destinatário, entram na agenda após aceite e a API
bloqueia uma segunda proposta enquanto existe pendência.

### Onda 5 — Minha agenda, detalhe e avaliação

**Objetivo:** agenda confiável dos compromissos do usuário.

1. Separar `Próximas` e `Passadas` por status e data; partidas pendentes não
   entram na agenda e canceladas ficam fora da visão principal.
2. Abrir detalhe da partida com modalidade, local, data, visibilidade, criador
   e participantes.
3. Mostrar avaliação somente nesse detalhe, para partida passada e concluída.
4. Reaproveitar avaliação existente, vinculada à partida e participante certos.

**Saída:** concluída em 22/09/2026. A agenda separa pendentes, próximas e
passadas; abre o detalhe da partida, permite aceitar no modal uma proposta
recebida e oferece avaliação somente para partidas passadas ou concluídas.

### Onda 6 — Testes, migration e publicação

1. Testar selects, stepper, nomenclatura, estados do chat, convite, agenda e
   avaliação.
2. Cobrir E2E de criar/entrar em pública, convite privado, aceite pelo chat e
   avaliação de passada.
3. Validar no backend visibilidade, capacidade, autorização e duplicidade.
4. Aplicar migrations após validação; executar builds e suítes.
5. Fazer commit na `main` e validar em produção após o deploy automático.

**Saída:** concluída em 22/09/2026. Jornadas críticas cobertas, migrations
remotas alinhadas e build de produção validado sem alterações pendentes.

## Ordem

`Onda 0 → Onda 1 → Onda 2 → Onda 3 → Onda 4 → Onda 5 → Onda 6`.

As ondas 3 a 5 só começam depois das três decisões acima serem confirmadas.
