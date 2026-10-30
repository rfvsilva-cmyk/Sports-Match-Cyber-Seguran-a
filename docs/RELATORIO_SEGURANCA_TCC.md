# Relatório de Segurança — Sports Match

## Atividade do professor

Categorias avaliadas:
- IDOR / controle de acesso;
- Criptografia e senhas;
- Injeção de código;
- Bots/automação;
- automação de testes em Pull Request;
- CI/CD para deploy.

## Alterações aplicadas

### 1. IDOR / Broken Access Control
Foram reforçados/registrados testes para garantir que:
- uma conversa só pode ser lida pelos participantes do match;
- mensagens só podem ser enviadas por participante da conversa;
- notificações só podem ser marcadas pelo respectivo jogador;
- partidas só podem ser encerradas pelo organizador;
- propostas de partidas só podem ser aceitas pelo jogador convidado;
- avaliações exigem participação na partida e não podem avaliar o próprio jogador;
- tokens de Realtime são emitidos somente para participantes da conversa.

### 2. Senhas e sessões
- bcrypt continua sendo usado para hash das senhas;
- JWT de sessão permanece somente em cookie HttpOnly;
- cookie é Secure em produção e SameSite=Lax;
- recuperação de senha deixou de usar JWT reutilizável;
- tokens de recuperação agora são aleatórios, armazenados apenas como SHA-256;
- token expira em 15 minutos e é de uso único;
- nova solicitação invalida o token anterior;
- resposta de recuperação é genérica para evitar enumeração de contas.

### 3. Injeção
- ValidationPipe global com whitelist + forbidNonWhitelisted;
- limites de tamanho adicionados a campos de autenticação e chat;
- URL de foto aceita somente HTTP/HTTPS;
- upload de imagens valida MIME e assinatura binária (magic bytes);
- teste estático verifica ausência de sinks perigosos como innerHTML/dangerouslySetInnerHTML/eval.

### 4. Bots
- rate limiting adicionado a cadastro, login, recuperação e redefinição de senha;
- excesso de tentativas retorna HTTP 429;
- recuperação de senha mantém resposta genérica.

**Limitação:** o rate limiter atual é em memória. Para produção distribuída/serverless, o ideal é Redis/Upstash ou serviço equivalente.

### 5. Hardening
- CORS com credenciais deixou de aceitar qualquer origem;
- cabeçalhos de segurança adicionados no backend e no Vercel;
- HSTS configurado no Vercel;
- segredos de servidor permanecem fora de variáveis VITE.

## Automação

### Pull Request
`.github/workflows/security-pr.yml` executa:
1. npm ci;
2. testes de segurança;
3. testes unitários;
4. testes frontend;
5. build.

### Deploy
`.github/workflows/deploy.yml` executa testes + build e publica no Vercel quando há push em `main`.

Secrets necessários no GitHub:
- VERCEL_TOKEN
- VERCEL_ORG_ID
- VERCEL_PROJECT_ID

## Evidência automatizada executada

Comando:

`node --test test/security-controls.test.cjs`

Resultado:

**14 testes passaram, 0 falharam.**

Os testes automatizados cobrem IDOR, injeção, upload, bots, sessão, CORS, headers e exposição de segredos.
