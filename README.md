# ⚡ BrieflyAI
Plataforma Full-Stack B2B de Resumos Inteligentes e Transcrição em Tempo Real impulsionada por Groq.

![React](https://img.shields.io/badge/React-19-blue?logo=react) ![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb) ![Groq](https://img.shields.io/badge/Groq-LPU_Engine-f55036) ![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?logo=vercel) ![CI](https://img.shields.io/badge/CI-GitHub_Actions-2088FF?logo=githubactions)

🟢 **LIVE DEMO:** [Acesse o BrieflyAI Ao Vivo Aqui](https://briefly-ai-nine.vercel.app/)
🛡️ **Auditoria Enterprise:** [Veja a Auditoria de Segurança Aplicada a Este Projeto](docs/AUDIT_REPORT_2026-05-16.md)

## 🛑 O Problema
Profissionais e empresas perdem horas processando gravações longas de reuniões, aulas ou documentos extensos. Ferramentas tradicionais de IA sofrem do "efeito carregamento cego": o usuário envia um áudio grande ou um texto enorme e fica olhando para um _spinner_ por minutos até o servidor devolver o resultado completo. Muitas vezes a conexão cai (timeout) antes de qualquer resposta chegar, destruindo a experiência.

## ✅ A Solução (BrieflyAI)
O BrieflyAI é um motor de processamento de linguagem natural desenhado para **velocidade e feedback visual instantâneo**.

Resolve o problema da latência usando **SSE (Server-Sent Events)** sobre HTTP/1.1 para criar um fluxo contínuo de tokens. Em vez de esperar o processamento total, a IA (alimentada pelos chips LPU da Groq) "digita" a resposta na tela palavra por palavra em tempo real. O sistema processa texto e áudio, persiste no MongoDB e entrega tudo numa interface "Efeito Vercel" — Glassmorphism, dark mode refinado e animações magnéticas.

## 🧠 Maior Desafio Técnico Superado
Manter conexões SSE longas (30–60s) numa arquitetura Vercel + Render sem sacrificar segurança nem UX.

**Arquitetura de Conexão Desacoplada:** A Vercel corta funções serverless em 10s no plano gratuito — inviabilizando SSE direto. A infraestrutura foi dividida: frontend estático ultrarrápido na Vercel (CDN Edge) e backend Node.js no Render.com com conexões longas. O fetch do frontend consome `text/event-stream` enquanto o backend faz streaming token-a-token vindo da Groq SDK, sem buffering intermediário.

**Segurança aplicada a streams:** rotas SSE são especialmente difíceis porque a conexão permanece aberta — o handler global de erro não captura falhas que acontecem após `res.write`. A solução: validação Zod estrita **antes** de qualquer `flushHeaders`, rate limit por usuário em camada anterior, correlation ID para rastrear streams interrompidos, e fechamento explícito do stream em qualquer caminho de erro do `try/catch` local. Access token em memória React mitiga XSS; refresh token em cookie httpOnly + sameSite=strict mitiga CSRF.

## 📐 Decisões Arquiteturais (Trade-offs)
Documentadas em [`docs/adr/`](docs/adr/):

- **JWT HS256 em vez de sessão server-side** — escalabilidade horizontal sem sticky session. Trade-off: revogação não é instantânea, mitigado por access token de 15min + refresh rotation com detecção de reuso. ([ADR-001](docs/adr/ADR-001-jwt-vs-session.md))
- **MongoDB em vez de PostgreSQL** — schema flexível, TTL nativo aproveitado em refresh tokens e audit logs. Trade-off: sem transactions cross-collection sem replica set. ([ADR-002](docs/adr/ADR-002-mongo-vs-postgres.md))
- **SSE em vez de WebSocket** — comunicação unidirecional, reusa autenticação Bearer existente, não exige infra extra. Trade-off: limite de conexões concorrentes por origem (~6). ([ADR-003](docs/adr/ADR-003-sse-vs-websocket.md))
- **Access token em memória + refresh em cookie httpOnly** em vez de localStorage — XSS não vê o token. Trade-off: reload perde a sessão por ~200ms até o refresh silencioso completar. ([ADR-004](docs/adr/ADR-004-token-em-memoria.md))
- **`throw` + `asyncHandler` em vez de try/catch por controller** — ~30% menos código, respostas padronizadas, stack trace nunca vaza em prod. ([ADR-005](docs/adr/ADR-005-throw-asynchandler.md))
- **bcrypt cost 12 em vez de Argon2id** — sem dependência native; adequado para o volume atual. Considerado upgrade para Argon2id se o projeto escalar.

## 🧪 Testes
```bash
cd backend
npm test          # 28 testes: auth, autorização, IDOR, refresh rotation, validação Zod
```

Cobertura de cenários adversariais:

- Acesso sem token / token inválido / token expirado / Bearer mal formatado → 401
- Usuário A acessando recurso do usuário B → 404 (não vaza existência)
- Refresh token revogado → 401 + revogação da família inteira
- Payloads sem campos obrigatórios, com campos extras, com IDs mal formados → 400 + detalhes Zod
- `alg: none` no JWT → rejeitado (allowlist explícita `['HS256']`)
- Tentativa de excluir/editar resumo de outro usuário → 404

CI roda em [`.github/workflows/ci.yml`](.github/workflows/ci.yml): build, test e `npm audit` em backend e frontend a cada PR.

<a id="seg-camadas"></a>
## 🔒 Segurança — camadas e status

> *Tabela scannável: o que existe em cada camada, com âncora no código. Para entender o **encadeamento** de auth (como JWT em memória + refresh httpOnly + rotation + family revoke trabalham juntos contra XSS/CSRF/roubo de token), ver a seção [Arquitetura de Auth](#arq-auth) abaixo.*

| Camada | Implementação | Status |
|---|---|---|
| Hash de senha | bcrypt cost 12 + verificação HIBP (k-anonymity) no register e reset | ✅ |
| Tokens | JWT HS256 (15min, `algorithms` explícito) + Refresh rotation + detecção de reuso revoga família | ✅ |
| Cookies | `httpOnly`, `secure` (prod), `sameSite=strict`, `path=/auth`, `maxAge=7d` | ✅ |
| Autorização | Filtro por `userId` (do JWT) em 100% das rotas autenticadas; IDs sensíveis nunca vêm do payload | ✅ |
| Validação | Zod `.strict()` em todos os endpoints; ObjectId regex em params; output do LLM validado com schema | ✅ |
| Headers | Helmet com CSP `defaultSrc 'none'`, HSTS preload, `Referrer-Policy: no-referrer`, CORP same-site | ✅ |
| CSP frontend | `frontend/vercel.json` com CSP/HSTS/X-Frame-Options/Permissions-Policy | ✅ |
| Rate limiting | Global 200/15min + auth 5/min (IP) + resumos 5/dia (userId) + chat 60/dia (userId) | ✅ |
| Upload | Allowlist de extensão + magic bytes (ID3/RIFF/OggS/fLaC/EBML/ftyp) + scan **VirusTotal v3** | ✅ |
| CSRF | Bearer no header + sameSite=strict no cookie de refresh + CORS allowlist | ✅ |
| Prompt injection | Inputs do LLM envolvidos em `<user_input>`/`<context>`/`<question>` com instrução anti-injection no system | ✅ |
| Logging | Pino estruturado (JSON em prod, pretty em dev), `maskEmail()` para PII, correlation ID por request | ✅ |
| Audit log | Coleção `audit_logs` imutável (TTL 365d) — login success/failure, register, logout, refresh reuse, password reset, summary delete | ✅ |
| Soft delete | `deletedAt: Date` em Summary; queries filtram automaticamente | ✅ |
| Error handling | `throw` + `asyncHandler` + handler global; stack trace nunca vaza em prod | ✅ |
| Observabilidade | `/metrics` Prometheus (protegido por `METRICS_TOKEN`) + correlation ID end-to-end + React Error Boundary | ✅ |
| Container | Dockerfile multi-stage, Alpine, usuário não-root, `.dockerignore` | ✅ |

**O que NÃO está implementado:**

- MFA / 2FA
- Account lockout por e-mail (apenas rate limit por IP em `/auth`)
- Argon2id (usamos bcrypt cost 12)
- Encryption at rest em nível de aplicação (usa default do MongoDB Atlas)
- Testes adversariais 1-para-1 com cada linha do THREAT_MODEL (item 11B do checklist)
- Job de hard delete pós-30d após soft delete

Para reportar vulnerabilidades, veja [`SECURITY.md`](SECURITY.md). Para modelagem completa de ameaças, veja [`THREAT_MODEL.md`](THREAT_MODEL.md). Para a política de retenção LGPD, veja [`docs/DATA_RETENTION.md`](docs/DATA_RETENTION.md).

## ✨ Principais Funcionalidades
- **Transcrição de Áudio (Whisper LPU):** upload local ou microfone, processamento via Groq Whisper-large-v3 em segundos.
- **Streaming em Tempo Real (SSE):** resumos e chat renderizados token a token. Fim das telas de carregamento travadas.
- **Chat Contextual com Documento:** o usuário conversa com o resumo gerado; histórico persistido por documento.
- **Histórico paginado (cursor-based):** lista de resumos com `nextCursor` + `hasMore`, sem array completo na resposta.
- **Dashboard Premium (Efeito Vercel):** UI de alta fidelidade com micro-interações, Glassmorphism e dark mode.
- **Direito LGPD:** endpoints `DELETE /auth/account` (esquecimento) e `GET /auth/account/export` (portabilidade).

<a id="arq-auth"></a>
## 🔒 Arquitetura de Auth — como o fluxo resiste a XSS, CSRF e roubo de token (o porquê e o encadeamento)

> *Deep-dive narrativo: por que cada peça existe e como as peças se encadeiam. A tabela [Segurança — camadas e status](#seg-camadas) acima lista o **que** existe; esta seção explica **por que** assim.*


No BrieflyAI, as sessões seguem um protocolo desenhado para resistir aos vetores clássicos de XSS, CSRF e roubo de token:

1. **Access token em memória:** o JWT (15min) vive apenas no `useState` do `AuthContext`. Reload da página perde o token — **isso é desejável**. Nenhum script injetado consegue `localStorage.getItem(...)` o que não existe.
2. **Refresh silencioso no mount:** ao montar o `AuthContext`, o frontend chama `POST /auth/refresh` automaticamente; se o cookie httpOnly ainda for válido, a sessão é restaurada sem o usuário relogar.
3. **Refresh Token Rotation com detecção de reuso:** cada refresh consome o token atual e emite um novo na mesma família (`familyId`). Se um refresh já revogado for tentado de novo (= sinal de comprometimento), **toda a família é revogada** e o usuário precisa relogar.
4. **Cookie blindado:** `httpOnly` + `secure` (prod) + `sameSite=strict` + `path=/auth` + `maxAge=7d`. Não acessível via JS, não enviado em cross-site, escopado só a `/auth`.
5. **CORS allowlist:** valida `Origin` contra lista fixa + regex Vercel preview; nunca `*`. Combinado com `sameSite=strict`, fecha o vetor CSRF do `/refresh`.
6. **Audit log forense:** login/logout/refresh-reuse/reset registrados com `userId`, `ip`, `userAgent`, `requestId` numa coleção imutável com TTL de 365 dias.

## 🛠️ Stack Tecnológico & Arquitetura

### 1. Frontend (CDN Vercel)
- **Framework:** React 19 + Vite.
- **Estilização & UI:** TailwindCSS customizado ("Efeito Vercel"), animações com Framer Motion, ícones Lucide.
- **Comunicação:** `fetch` com `credentials: 'include'` consumindo `text/event-stream`. `VITE_API_URL` para alternar Dev/Prod.
- **Resiliência:** React Error Boundary global; `vercel.json` com CSP, HSTS, X-Frame-Options, Permissions-Policy.

### 2. Backend (Render.com)
- **Motor Lógico:** Node.js + Express 5.
- **Integração AI:** Groq SDK — LLaMA 3.1/3.3 para texto, Whisper-large-v3 para áudio.
- **Upload:** Multer (≤25MB) + validação por extensão + magic bytes + scan VirusTotal v3 antes da Groq.
- **Defesa Perimetral:** Helmet com CSP estrita, `express-rate-limit`, CORS allowlist, `cookie-parser`, Zod `.strict()`, Pino estruturado, classes de erro + `asyncHandler`, correlation ID, audit log imutável, soft delete.
- **Observabilidade:** `/metrics` (prom-client) protegido por token Bearer; `/health/live` + `/health/ready` separados.

### 3. Banco de Dados
- **MongoDB Atlas:** cluster em nuvem; coleções `users`, `summaries`, `refreshtokens`, `auditlogs`.
- **Mongoose ORM:** schemas tipados; TTL indexes em refresh tokens e audit logs; índices compostos `(userId, createdAt)`.

## 📂 Visão Geral da Estrutura
```text
├── backend/           # Node.js, Express, models, middleware (auth, validate, rate limit, requestId),
│                      # utils (errors, logger, audit, hibp, virustotal, metrics), routes, tests, Dockerfile
├── frontend/          # React 19, Vite, components (ErrorBoundary, HistorySidebar...), context (AuthContext),
│                      # vercel.json (CSP/HSTS)
├── docs/
│   ├── adr/           # 5 ADRs: JWT, MongoDB, SSE, token em memória, asyncHandler
│   ├── API.md         # Referência de endpoints
│   ├── DATA_RETENTION.md   # Política LGPD
│   └── DISASTER_RECOVERY.md
├── .github/workflows/ # CI: test + npm audit em backend e frontend
├── SECURITY.md        # Política de disclosure
├── THREAT_MODEL.md    # STRIDE + mitigações
└── README.md

```

## 👑 Autor

**Jeanderson Silva** 🤓✍️

*Desenvolvedor Full-Stack | Engenheiro Frontend | Arquiteto de Software*

Construído desde o mapeamento de arquitetura de streaming em tempo real (SSE) até os deploys em nuvem (Vercel & Render), passando por segurança rigorosa de APIs e refinamento extremo de UI/UX.

Sinta-se à vontade para auditar as configurações de rede, explorar a lógica de streaming SSE ou testar a interatividade da aplicação ao vivo!
