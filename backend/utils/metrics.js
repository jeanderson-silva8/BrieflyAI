const client = require('prom-client');

const register = new client.Registry();
client.collectDefaultMetrics({ register, prefix: 'brieflyai_' });

const httpRequests = new client.Counter({
  name: 'brieflyai_http_requests_total',
  help: 'Total de requisições HTTP',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpDuration = new client.Histogram({
  name: 'brieflyai_http_request_duration_seconds',
  help: 'Latência das requisições HTTP',
  labelNames: ['method', 'route', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5, 10, 30],
  registers: [register]
});

const llmCalls = new client.Counter({
  name: 'brieflyai_llm_calls_total',
  help: 'Chamadas ao LLM Groq',
  labelNames: ['type', 'status'],
  registers: [register]
});

function metricsMiddleware(req, res, next) {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route?.path
      ? `${req.baseUrl || ''}${req.route.path}`
      : (req.path?.split('?')[0] || 'unknown');
    const labels = { method: req.method, route, status: String(res.statusCode) };
    httpRequests.inc(labels);
    const sec = Number(process.hrtime.bigint() - start) / 1e9;
    httpDuration.observe(labels, sec);
  });
  next();
}

module.exports = { register, metricsMiddleware, llmCalls };
