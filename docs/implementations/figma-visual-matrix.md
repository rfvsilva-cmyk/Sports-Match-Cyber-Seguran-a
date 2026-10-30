# Matriz visual — Sports Match e Figma

Este documento é a referência da Onda 0. Ele define o que deve ser preservado
em cada rota atual e qual tela do export do Figma serve apenas como inspiração
visual.

## Regra de uso

- A coluna **Referência Figma** nunca autoriza copiar a lógica, rotas, mocks
  ou estados do arquivo exportado.
- A implementação parte da rota existente e mantém a API indicada.
- Quando o Figma tiver uma tela sem equivalente funcional, ela não será
  adicionada nesta etapa.

| Rota atual | Função existente preservada | Referência Figma | API/contrato preservado |
| --- | --- | --- | --- |
| `/login` | Login por e-mail e senha; sessão e redirecionamento por perfil completo | `Login.tsx` | `POST /auth/login`, `GET /auth/sessao` |
| `/cadastro` | Cadastro por nome, e-mail, senha e confirmação | `Signup.tsx` | `POST /auth/cadastro` |
| `/recuperar-senha` | Solicitar redefinição de senha | Login/Signup: mesma identidade visual de formulários | `POST /auth/recuperar-senha` |
| `/redefinir-senha` | Redefinir senha por token | Login/Signup: mesma identidade visual de formulários | `POST /auth/redefinir-senha` |
| `/perfil` | Completar e editar perfil de jogador | `ProfileSetup.tsx` e `Profile.tsx` | `GET /jogador/meu-perfil`, `PUT /jogador/perfil`, `GET /modalidades`, `POST /modalidades/solicitacoes` |
| `/descobrir` | Filtrar perfis, like, dislike e abrir conversa em um match | `SwipeScreen.tsx` e `UserProfile.tsx` | `GET /descoberta/feed`, `POST /descoberta/swipe` |
| `/conversas` | Listar matches/conversas reais | `Matches.tsx` | `GET /chat/conversas` |
| `/conversas/:conversationId` | Histórico, mensagens e Realtime da conversa | `Chat.tsx` | `GET /chat/conversa/:id`, `POST /chat/mensagem`, token Realtime |
| `/partidas` | Ver, criar, entrar, sair, concluir ou cancelar partidas públicas | `CreateGame.tsx`, `MyGames.tsx` e cartões de `Agenda.tsx` | `GET/POST /partidas`, `POST /partidas/:id/participacoes`, `POST /partidas/:id/sair`, `PATCH /partidas/:id/status` |
| `/agenda` | Exibir partidas do usuário e iniciar avaliação quando permitido | `Agenda.tsx` | `GET /partidas/minhas`, `POST /avaliacao` |
| Modal de avaliação atual | Avaliar outro participante após conclusão | `RatePlayer.tsx` | `POST /avaliacao` |
| Navegação autenticada | Navegar entre descoberta, conversas, partidas, agenda e perfil | `Navigation.tsx` | Rotas atuais; nenhuma rota de arena |
| Notificações (futura) | Não existe ainda; será criada somente na Onda 5 | `Notifications.tsx` | Contrato ainda será definido na Onda 5 |
| Foto de perfil (futura) | Campo de URL existe; upload ainda não existe | Avatar/perfil do Figma | Contrato de upload será definido na Onda 4 |

## Referências do Figma fora do escopo atual

Os arquivos abaixo podem inspirar detalhes de layout, mas não viram rota,
endpoint ou modelo de dados sem decisão explícita posterior:

- `CreateMatch.tsx`, `MatchDetails.tsx`, `MatchResult.tsx`,
  `RescheduleMatch.tsx` e `CancelMatch.tsx`: podem servir de referência
  visual para o fluxo de partida privada no chat já existente; a lógica será
  conectada aos contratos atuais, sem criar uma arquitetura paralela.
- `MyGames.tsx`: não representa uma área de arena; será usado apenas como
  referência visual para cartões e ações de partidas que já existem.
- Elementos de perfil/arena, seleção de conta e `MOCK_PROFILES`: fora do
  produto e proibidos em telas de produção.

## Critério de fechamento por tela

Uma tela só passa para a próxima quando:

1. preserva o comportamento e a rota atuais;
2. consome somente dados reais da API atual;
3. não contém mock, perfil fictício ou ação de fachada;
4. foi comparada visualmente à referência Figma em viewport móvel e desktop;
5. foi validada no fluxo correspondente.
