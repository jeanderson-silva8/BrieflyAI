# ⚡ BrieflyAI
Plataforma Full-Stack B2B de Resumos Inteligentes e Transcrição em Tempo Real impulsionada por Groq.

![React](https://img.shields.io/badge/React-19-blue?logo=react) ![Node.js](https://img.shields.io/badge/Node.js-Express-green?logo=node.js) ![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?logo=mongodb) ![Groq](https://img.shields.io/badge/Groq-LPU_Engine-f55036) ![Vercel](https://img.shields.io/badge/Vercel-Deploy-black?logo=vercel)

🟢 **LIVE DEMO:** [Acesse o BrieflyAI Ao Vivo Aqui](https://briefly-ai-nine.vercel.app/)

## 🛑 O Problema
Profissionais e empresas perdem horas preciosas processando gravações longas de reuniões, aulas ou documentos extensos. Ferramentas tradicionais de IA sofrem com o "efeito carregamento cego": o usuário envia um áudio gigante ou um texto enorme e fica olhando para um _spinner_ por minutos até que o servidor devolva o resultado completo. Muitas vezes, a conexão cai (timeout) antes mesmo da resposta chegar, destruindo a experiência do usuário.

## ✅ A Solução (BrieflyAI)
O BrieflyAI é um motor de processamento de linguagem natural desenhado para **velocidade e feedback visual instantâneo**.

Ele resolve o problema da latência utilizando **SSE (Server-Sent Events)** para criar um fluxo de dados contínuo. Em vez de esperar o processamento total, a IA (alimentada pelos chips LPU ultrarrápidos da Groq) "digita" a resposta na tela do usuário palavra por palavra em tempo real, imitando a fluidez do ChatGPT. O sistema processa texto e áudio de forma assíncrona, armazenando tudo de forma segura no MongoDB, tudo isso envelopado numa interface de luxo, hiper-responsiva, batizada com o "Efeito Vercel" (Glassmorphism, dark mode e animações magnéticas).

## 🧠 Maior Desafio Técnico Superado
Garantir a persistência da conexão em tempo real (Streaming) numa arquitetura Full-Stack serverless/PaaS, sem sacrificar a segurança. Para que a experiência de streaming funcionasse sem interrupções ou vazamento de dados, implementei duas estratégias cruciais:

1. **Arquitetura de Conexão Desacoplada (Vercel + Render):** Como a Vercel corta conexões Serverless em 10s (plano gratuito), o que inviabiliza o SSE, a infraestrutura foi dividida. O Frontend estático e ultrarrápido ficou na Vercel (CDN Edge), enquanto o Backend Node.js foi orquestrado no Render.com, permitindo conexões longas de 30-60s para o streaming contínuo das palavras.
2. **Segurança Nível Enterprise em Streams:** Aplicar o **Protocolo de Segurança Absoluto**. Proteger rotas de streaming é difícil pois elas mantêm conexões abertas. Implementei verificação JWT ultra-restrita (15 min de expiração), Helmet para proteção de headers HTTP, Rate Limiting contra ataques de força bruta, e validação rigorosa de CORS combinando variáveis de ambiente (VITE_API_URL) e fallbacks fixos para garantir que apenas o frontend oficial consumisse a API.

## ✨ Principais Funcionalidades
- **Transcrição de Áudio (Whisper LPU):** Processamento de arquivos de áudio (upload local ou microfone) transformando fala em texto em questão de segundos usando a API Groq.
- **Streaming em Tempo Real (SSE):** Resumos e interações geradas e exibidas na tela palavra por palavra. Fim das telas de carregamento travadas.
- **Chat Contextual com Documento:** O usuário pode conversar diretamente com o resumo gerado, fazendo perguntas específicas sobre o conteúdo, com histórico de chat persistido.
- **Dashboard Premium (Efeito Vercel):** UI de alta fidelidade com micro-interações, feedback visual tátil, painéis translúcidos (Glassmorphism) e design focado em conversão.
- **Autenticação Segura JWT:** Fluxo de login/cadastro encriptado (Bcrypt), com gerenciamento de sessão seguro contra ataques XSS e CSRF.

## 🛠️ Stack Tecnológico & Arquitetura
O ecossistema BrieflyAI segue uma arquitetura baseada nos protocolos construtivos A.N.T e V.L.A.E.G:

### 1. Frontend (CDN Vercel)
- **Framework:** React 19 + Vite.
- **Estilização & UI:** TailwindCSS Customizado, Animações fluidas com Framer Motion e ícones Lucide.
- **Comunicação:** `fetch` configurado para consumir fluxos de dados SSE (`text/event-stream`) de forma assíncrona. Variáveis de ambiente (`VITE_API_URL`) para alternância fácil entre Dev/Prod.

### 2. Backend (Render.com)
- **Motor Lógico:** Node.js + Express.
- **Integração AI:** Groq SDK (Modelos LLaMA 3 para texto e Whisper-large-v3 para áudio) rodando em Hardware LPU para inferência próxima de zero latência.
- **Processamento de Áudio:** `multer` em memória para interceptação segura de uploads antes do envio à IA.
- **Defesa Perimetral:** `helmet`, `express-rate-limit`, e CORS estrito.

### 3. Banco de Dados (Fonte da Verdade)
- **MongoDB Atlas:** Cluster em nuvem para armazenamento NoSQL de Usuários, Histórico de Resumos e Logs de Chat.
- **Mongoose ORM:** Esquemas de dados rigorosos garantindo integridade das inserções.

## 🚀 Como Executar Localmente

### 1. Requisitos
- Node.js (v18+)
- MongoDB (Local ou URL do MongoDB Atlas)
- Chave de API da Groq (`GROQ_API_KEY`)

### 2. Rodando o Backend
Abra um terminal na raiz do projeto:
```bash
cd backend
npm install
```
Crie um arquivo `.env` na pasta `backend` com suas variáveis (exemplo no repositório).
```bash
npm run dev
```
O servidor rodará em: `http://localhost:3001`

### 3. Rodando o Frontend
Em outro terminal, na raiz do projeto:
```bash
cd frontend
npm install
npm run dev
```
Acesse a aplicação em: `http://localhost:5173`

## 📂 Visão Geral da Estrutura
```text
├── backend/          # Node.js, Express, MongoDB Models, Controllers, SSE Routes
├── frontend/         # React, Vite, Componentes (Glassmorphism), Hooks (useStream)
├── vercel.json       # Orquestração de deploy Vercel (Monorepo setup)
└── README.md         # Documentação da arquitetura
```

## 🤝 Autor
**Jeanderson Silva** 😎🤌

Desenvolvedor Full-Stack | Engenheiro Frontend | Arquiteto de Software

Construído desde o mapeamento de arquitetura de alta performance até os deploys em nuvem (Vercel & Render), passando por segurança rigorosa de APIs e refinamento extremo de UI/UX.

Sinta-se à vontade para auditar as configurações de rede, explorar a lógica de streaming SSE ou testar a interatividade da aplicação ao vivo!
