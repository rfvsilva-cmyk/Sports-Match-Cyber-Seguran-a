# Atividade de Cyber Segurança — Sports Match

## Escopo

Os testes cobrem as quatro categorias pedidas na atividade:

1. **IDOR / Broken Access Control**
   - conversa e mensagens;
   - notificações;
   - partidas;
   - avaliações;
   - token de Realtime.

2. **Criptografia / Senhas**
   - senhas armazenadas com bcrypt;
   - sessão em cookie `HttpOnly`;
   - `Secure` em produção;
   - token de recuperação aleatório, armazenado somente como SHA-256;
   - token de recuperação expira em 15 minutos e é de uso único;
   - mensagem genérica no fluxo de recuperação para evitar enumeração de contas.

3. **Injeção de código**
   - `ValidationPipe` global com `whitelist` + `forbidNonWhitelisted`;
   - limites de tamanho em campos sensíveis;
   - mensagens sem HTML interpretável pelo React;
   - URL de foto limitada a HTTP/HTTPS;
   - upload de imagens com validação de assinatura binária (magic bytes).

4. **Bots / abuso automatizado**
   - rate limiting nos endpoints de cadastro, login e recuperação de senha;
   - respostas HTTP 429 após o limite;
   - mensagens de recuperação sem revelar se a conta existe.

## Testes automatizados

Execute:

```bash
npm run test:security
npm run test:unit
npm --prefix front-end test
npm run build
```

O teste `test/security-controls.test.cjs` é independente de banco e valida regressões de segurança no código-fonte.

## Testes manuais para apresentar ao professor

### IDOR

Use duas contas de teste, A e B.

1. A cria um match/conversa com outro usuário.
2. Capture o ID da conversa.
3. Autentique como B sem participar dela.
4. Tente:

```http
GET /api/chat/conversa/<id-da-conversa>
```

**Esperado:** `403`.

Repita com:

```http
POST /api/chat/mensagem
PATCH /api/chat/partida/<id>/status
PATCH /api/notificacoes/<id>/ler
```

Usando IDs pertencentes a outro usuário.

**Esperado:** `403` ou `404`, sem alteração dos dados.

### Injeção

Em uma mensagem, use:

```text
<img src=x onerror=alert(document.domain)>
<script>alert(document.domain)</script>
```

A aplicação deve exibir o texto como conteúdo normal, nunca executar JavaScript.

No perfil, tente enviar:

```json
{
  "foto_url": "javascript:alert(document.domain)"
}
```

**Esperado:** `400`.

Tente também enviar campos não permitidos:

```json
{
  "nome": "Teste",
  "id": "outro-id",
  "usuario_id": "outro-usuario",
  "media_avaliacao": 5
}
```

**Esperado:** `400`.

### Upload

Renomeie um arquivo `.txt` para `.png` e tente enviá-lo com `Content-Type: image/png`.

**Esperado:** rejeição por assinatura binária inválida.

### Bots

Faça mais tentativas de login/cadastro/recuperação em sequência a partir do mesmo cliente.

**Esperado:** após o limite, `429 Too Many Requests`.

> Observação: o rate limiter implementado é em memória. Para uma implantação distribuída/serverless de produção, o ideal é migrá-lo para Redis/Upstash ou outro armazenamento compartilhado.

## Evidências para o TCC

Guarde:

- print dos testes `npm run test:security`;
- print do `npm run test:unit`;
- print do teste frontend;
- print do `npm run build`;
- print de uma tentativa IDOR retornando `403`;
- print de payload de injeção sendo rejeitado/escapado;
- print de `429` no teste de bot;
- histórico do GitHub Actions mostrando o workflow verde.

## CI/CD

### Testes em Pull Request

O workflow `.github/workflows/security-pr.yml` roda automaticamente em Pull Requests e também em `main`.

### Deploy

O workflow `.github/workflows/deploy.yml` executa:

1. instalação limpa;
2. testes de segurança;
3. build;
4. deploy para Vercel.

Configure no GitHub o secret:

- `VERCEL_TOKEN`\n- `VERCEL_ORG_ID`\n- `VERCEL_PROJECT_ID`

Se o projeto usar um token com escopo de equipe/organização, dê ao token acesso ao projeto correto.
