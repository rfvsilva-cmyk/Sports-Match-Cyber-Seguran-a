# Implementação — Sports Match Web/PWA

## Direção consolidada

O protótipo visual não é a aplicação. A produção é uma SPA React integrada à API NestJS e ao Supabase, com rotas protegidas, estados de carregamento/vazio/erro e regras de autorização no servidor.

## Entregue nesta reconstrução

## Próximos Objetivos
1. **Deploy Inicial:** Commitar as alterações atuais para disparar o deploy na Vercel com o que já temos agora.
2. **Ambiente Local 100%:** Garantir que o ambiente local esteja funcionando perfeitamente para testes e desenvolvimento.

- `src/` foi consolidado como API canônica; a cópia integral em `back-end/`, componentes de demonstração e Pusher foram removidos.
- Sessão por cookie `HttpOnly`, persistência via `GET /auth/sessao`, logout, recuperação e redefinição de senha.
- Perfil público limitado a cidade/bairro, modalidade e nível; não usa geolocalização exata.
- Descoberta com interesse recíproco, criação idempotente de match/conversa e chat privado.
- Partidas públicas, criador incluído como participante, entrada imediata transacional, saída, conclusão, cancelamento e avaliações pós-partida.
- Realtime restrito ao chat ativo via Supabase Realtime; não há push notification ou fila offline no MVP.
- PWA com assets locais, manifest, service worker único, cache do shell e cache de leitura por usuário limpo no logout.
- Rewrites da Vercel para servir a SPA e encaminhar `/api/*` à função serverless.

## Aplicação em produção

1. Faça backup no Supabase.
2. Revise e aplique `supabase/migrations/20260916_001_real_web_app.sql` no SQL Editor.
3. Habilite `mensagem` na publicação `supabase_realtime`.
4. Cadastre os segredos descritos em `.env.example` na Vercel e os valores `VITE_*` em `front-end/.env.production`/Vercel.
5. Execute `npm run build` e publique.
6. Valide com duas contas: cadastro → perfil → match → mensagem em tempo real → criar/entrar em partida → concluir → avaliar.

## Fora do MVP

Rankings, métricas avançadas, premium, torneios, notificações push e sincronização de ações offline permanecem fora do escopo.
