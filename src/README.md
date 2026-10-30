# API Sports Match

`src/` é a única fonte canônica da API NestJS. A API usa Supabase pelo SDK com chave de serviço exclusiva do servidor.

## Contratos principais

- `POST /auth/cadastro`, `POST /auth/login`, `POST /auth/logout`, `GET /auth/sessao`
- `POST /auth/recuperar-senha`, `POST /auth/redefinir-senha`
- `GET|PUT /jogador/meu-perfil|perfil`
- `GET /descoberta/feed`, `POST /descoberta/swipe`
- `GET /chat/conversas`, `GET /chat/conversa/:id`, `POST /chat/mensagem`
- `GET /chat/conversa/:id/realtime-token`
- `GET|POST /partidas`, `GET /partidas/minhas`, `POST /partidas/:id/participacoes`, `POST /partidas/:id/sair`, `PATCH /partidas/:id/status`
- `POST /avaliacao`, `GET /avaliacao/jogador/:id`

Rotas autenticadas aceitam a sessão no cookie `sports_match_session`; o suporte a `Authorization: Bearer` foi mantido apenas para clientes de API confiáveis. O token não é retornado no corpo de login/cadastro.

## Variáveis exigidas

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=server-only
SUPABASE_JWT_SECRET=server-only
JWT_SECRET=long-random-value
FRONTEND_URL=https://your-app.vercel.app
```

Para recuperação de senha por e-mail, configure também `RESEND_API_KEY` e `RESEND_FROM_EMAIL`.
