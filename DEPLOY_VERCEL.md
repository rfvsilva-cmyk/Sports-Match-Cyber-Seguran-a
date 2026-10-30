# Deploy do Sports Match na Vercel

Esta versão mantém **frontend Vite + API NestJS no mesmo projeto Vercel**, mas remove a dependência problemática do `dist/main.js` dentro da Function.

## O que foi corrigido

- `api/index.js` foi substituído por `api/index.ts`.
- A Function agora importa a aplicação Nest diretamente de `src/`, para a Vercel rastrear e empacotar as dependências corretamente.
- O bootstrap comum ficou em `src/bootstrap.ts`.
- `src/main.ts` voltou a ser um entrypoint NestJS normal para desenvolvimento/execução local.
- Foi removido o `includeFiles` específico do `iterare`.
- Instalação ficou determinística com `npm ci` no backend e no frontend.
- Node foi fixado em `22.x` para uma base LTS conservadora com NestJS 10 e Vite 8.
- `iterare` foi fixado exatamente em `1.2.1`.
- O frontend não executa mais `npm install` de novo durante o build.

## Configuração do projeto Vercel

### Root Directory

Use a raiz do repositório, onde estão:

- `package.json`
- `vercel.json`
- `src/`
- `api/`
- `front-end/`

**Não configure `front-end` como Root Directory.**

### Framework Preset

Pode permanecer como **Other**. O `vercel.json` controla o build combinado do frontend e da API.

### Build

O próprio `vercel.json` define:

- Install Command: `npm ci && npm --prefix front-end ci`
- Build Command: `npm run build`
- Output Directory: `public`

Evite sobrescrever esses três valores manualmente no painel com comandos diferentes.

## Variáveis de ambiente

Configure no projeto Vercel, para Production e Preview quando necessário:

### Backend

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `SUPABASE_JWT_SECRET` (necessário para token do Realtime)
- `FRONTEND_URL` (URL do frontend; pode conter mais de uma origem separada por vírgula)

### Opcionais para recuperação de senha

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

### Frontend / build Vite

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

`VITE_API_BASE_URL` pode ficar sem configurar porque o frontend já usa `/api` por padrão.

## Primeiro teste após o deploy

Abra:

`https://SEU-DOMINIO/api/health`

O esperado é uma resposta JSON equivalente a:

```json
{
  "status": "ok",
  "service": "sports-match-api"
}
```

Depois teste cadastro e sessão.

## Se um deploy antigo continuar aparecendo

Faça um novo deployment sem reutilizar Build Cache. O erro antigo de `Cannot find module './iterate'` vinha da Function que carregava `../dist/main.js`; a versão atual não usa mais esse caminho.
