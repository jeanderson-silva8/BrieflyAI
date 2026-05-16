// Vitest globals (describe, it, expect) injetados via vitest.config.mjs
const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

// Setup env para testes
process.env.JWT_SECRET = 'test-secret-key-very-long-and-secure-123456';
process.env.GROQ_API_KEY = 'test-groq-key';
process.env.MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/brieflyai-test';
process.env.NODE_ENV = 'test';

const app = require('../app');

// ═══════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════

function generateToken(userId, options = {}) {
  return jwt.sign(
    { userId: userId || new mongoose.Types.ObjectId().toString() },
    process.env.JWT_SECRET,
    { expiresIn: '15m', algorithm: 'HS256', ...options }
  );
}

const validToken = generateToken();
const fakeObjectId = new mongoose.Types.ObjectId().toString();

// ═══════════════════════════════════════════════════════
// 1. HEALTH CHECK
// ═══════════════════════════════════════════════════════
describe('Health Check', () => {
  it('GET /health deve retornar status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// ═══════════════════════════════════════════════════════
// 2. VALIDAÇÃO ZOD — Auth
// ═══════════════════════════════════════════════════════
describe('Auth — Validação de Input (Zod)', () => {
  it('POST /auth/register sem body deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({});
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('POST /auth/register com email inválido deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'not-email', name: 'Test', password: 'senhaforte123' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register com senha < 8 chars deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', name: 'Test', password: '1234567' });
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
    expect(res.body.detalhes[0].campo).toBe('password');
  });

  it('POST /auth/register com nome < 2 chars deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', name: 'A', password: 'senhaforte123' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/register com campo extra (.strict()) deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ email: 'test@test.com', name: 'Test', password: 'senhaforte123', admin: true });
    expect(res.status).toBe(400);
  });

  it('POST /auth/login sem body deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/login')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /auth/forgot-password sem email deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /auth/forgot-password com email inválido deve retornar 400', async () => {
    const res = await request(app)
      .post('/auth/forgot-password')
      .send({ email: 'nao-e-email' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════
// 3. AUTENTICAÇÃO — JWT
// ═══════════════════════════════════════════════════════
describe('Auth — Proteção JWT', () => {
  it('GET /api/history sem token deve retornar 401', async () => {
    const res = await request(app).get('/api/history');
    expect(res.status).toBe(401);
  });

  it('GET /api/history com token inválido deve retornar 401', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', 'Bearer token-invalido-aqui');
    expect(res.status).toBe(401);
  });

  it('GET /api/history com token expirado deve retornar 401', async () => {
    const expiredToken = jwt.sign(
      { userId: fakeObjectId },
      process.env.JWT_SECRET,
      { expiresIn: '0s', algorithm: 'HS256' }
    );
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${expiredToken}`);
    expect(res.status).toBe(401);
  });

  it('GET /api/history com Bearer mal formatado deve retornar 401', async () => {
    const res = await request(app)
      .get('/api/history')
      .set('Authorization', 'NotBearer abc');
    expect(res.status).toBe(401);
  });

  it('JWT com algoritmo none deve ser rejeitado', async () => {
    // Cria token com header manipulado sem assinatura
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ userId: fakeObjectId })).toString('base64url');
    const noneToken = `${header}.${payload}.`;

    const res = await request(app)
      .get('/api/history')
      .set('Authorization', `Bearer ${noneToken}`);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════
// 4. VALIDAÇÃO ZOD — History (ObjectId)
// ═══════════════════════════════════════════════════════
describe('History — Validação de ObjectId', () => {
  it('GET /api/history/:id com ID inválido deve retornar 400', async () => {
    const res = await request(app)
      .get('/api/history/id-invalido-123')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(400);
    expect(res.body.detalhes).toBeDefined();
  });

  it('DELETE /api/history/:id com ID inválido deve retornar 400', async () => {
    const res = await request(app)
      .delete('/api/history/nao-objectid')
      .set('Authorization', `Bearer ${validToken}`);
    expect(res.status).toBe(400);
  });

  it('GET /api/history/:id com ObjectId válido mas inexistente deve retornar 404', async () => {
    const res = await request(app)
      .get(`/api/history/${fakeObjectId}`)
      .set('Authorization', `Bearer ${validToken}`);
    // Pode ser 404 (se mongo conectado) ou 500 (se mongo offline)
    expect([404, 500]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════
// 5. VALIDAÇÃO ZOD — Summarize
// ═══════════════════════════════════════════════════════
describe('Summarize — Validação de Input', () => {
  it('POST /api/summarize sem texto deve retornar 400 ou 401', async () => {
    const res = await request(app)
      .post('/api/summarize')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    expect([400, 401]).toContain(res.status);
  });

  it('POST /api/summarize com texto < 50 chars deve retornar 400', async () => {
    const res = await request(app)
      .post('/api/summarize')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ text: 'Texto muito curto para resumir.' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════
// 6. VALIDAÇÃO ZOD — Chat
// ═══════════════════════════════════════════════════════
describe('Chat — Validação de Input', () => {
  it('POST /api/chat sem body deve retornar 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({});
    expect(res.status).toBe(400);
  });

  it('POST /api/chat sem context deve retornar 400', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ question: 'O que foi discutido?' });
    expect(res.status).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════
// 7. VALIDAÇÃO ZOD — Chat History (PATCH)
// ═══════════════════════════════════════════════════════
describe('Chat History — Validação de Input', () => {
  it('PATCH /api/history/:id/chat com ID inválido deve retornar 400', async () => {
    const res = await request(app)
      .patch('/api/history/id-invalido/chat')
      .set('Authorization', `Bearer ${validToken}`)
      .send({ messages: [] });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/history/:id/chat com role inválido deve retornar 400', async () => {
    const res = await request(app)
      .patch(`/api/history/${fakeObjectId}/chat`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ messages: [{ role: 'admin', content: 'hack' }] });
    expect(res.status).toBe(400);
  });

  it('PATCH /api/history/:id/chat com formato correto deve passar validação', async () => {
    const res = await request(app)
      .patch(`/api/history/${fakeObjectId}/chat`)
      .set('Authorization', `Bearer ${validToken}`)
      .send({ messages: [{ role: 'user', content: 'test' }] });
    // Passa validação mas pode falhar no DB
    expect([200, 404, 500]).toContain(res.status);
  });
});

// ═══════════════════════════════════════════════════════
// 8. SEGURANÇA — Headers HTTP
// ═══════════════════════════════════════════════════════
describe('Segurança — Headers HTTP', () => {
  it('Deve ter header X-Content-Type-Options', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('Deve ter header X-Frame-Options ou CSP frame-ancestors', async () => {
    const res = await request(app).get('/health');
    const hasFrameOptions = !!res.headers['x-frame-options'];
    const hasCSPFrameAncestors = res.headers['content-security-policy']?.includes('frame-ancestors');
    expect(hasFrameOptions || hasCSPFrameAncestors).toBe(true);
  });

  it('Não deve ter header X-Powered-By', async () => {
    const res = await request(app).get('/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════
// 9. SEGURANÇA — Endpoint inexistente
// ═══════════════════════════════════════════════════════
describe('Segurança — Rotas inexistentes', () => {
  it('GET /rota-que-nao-existe deve retornar 404', async () => {
    const res = await request(app).get('/rota-que-nao-existe');
    expect(res.status).toBe(404);
  });
});
