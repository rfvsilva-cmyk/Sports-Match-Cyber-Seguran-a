# Sports Match

Sports Match é uma aplicação web responsiva e instalável (PWA) para aproximar pessoas que praticam esportes na mesma região. Uma conta pode descobrir parceiros, dar match, conversar, organizar partidas públicas, participar delas e avaliar os demais jogadores após a atividade.

## Arquitetura

- `front-end/`: SPA React + Vite. O frontend usa somente a API em `/api` e não contém usuários ou fluxos simulados.
- `src/`: API NestJS canônica. Autenticação é por e-mail/senha com sessão em cookie `HttpOnly`.
- `supabase/migrations/`: evolução versionada do PostgreSQL/Supabase.
- `api/index.ts`: adaptador serverless da Vercel. Ele importa a aplicação Nest diretamente do código-fonte, sem depender de `dist/`. `vercel.json` reescreve `/api/*` para ele e todo o resto para a SPA.

O material em `front-end/src/imports/` é apenas referência visual. Não é código de produção.

## Funcionalidades do MVP

1. Cadastro, login, logout e recuperação de senha por e-mail.
2. Perfil com cidade, bairro, modalidade e nível; endereço e coordenadas não são expostos.
3. Descoberta filtrável, interesse e match recíproco.
4. Conversa privada liberada somente depois do match, com Supabase Realtime no chat aberto.
5. Partidas públicas com vagas atômicas, entrada imediata, saída, conclusão e cancelamento pelo organizador.
6. Agenda pessoal e avaliação única de cada participante após a conclusão.
7. Foto de perfil enviada pela API para o bucket controlado `profile-photos`.
8. Notificações persistentes no app para match, mensagem, partida e avaliação.
9. PWA com instalação, cache do shell e leitura de conteúdo já consultado; ações exigem conexão.

## Executar localmente

1. Copie `.env.example` para `.env` e configure os segredos da API.
2. Copie `front-end/.env.example` para `front-end/.env.local` e preencha apenas a URL e a chave anônima do Supabase para Realtime.
3. Execute `npm install` e `npm --prefix front-end install`.
4. Execute `npm run start:dev` para a API e `npm --prefix front-end run dev` para a SPA.

Antes de usar o banco existente, siga [supabase/README.md](supabase/README.md): faça backup, aplique todas as migrações em ordem e habilite Realtime para `mensagem`.

## Validação

No frontend, execute `npm --prefix front-end test` para testes de unidade e
integração, `npm --prefix front-end run test:coverage` para o relatório de
cobertura e `npm --prefix front-end run test:e2e` para os fluxos E2E no
Chromium. Na primeira máquina, instale o navegador uma vez com
`npm --prefix front-end exec playwright install chromium`.

## Build e publicação

`npm run build` gera a API, a SPA e prepara `public/` para o deploy da Vercel. Configure as variáveis do `.env.example` no projeto Vercel; nenhuma chave de serviço deve ser colocada no frontend ou no repositório.


## Segurança e atividade do TCC

A suíte específica da atividade de Cyber Segurança pode ser executada com:

```bash
npm run test:security
```

Ela cobre regressões de IDOR/controle de acesso, injeção, upload de arquivos, bots/brute force, sessão, CORS, headers e exposição de segredos.

O plano de testes e os procedimentos manuais estão em `docs/seguranca-tcc.md`, e o relatório em `docs/RELATORIO_SEGURANCA_TCC.md`.
