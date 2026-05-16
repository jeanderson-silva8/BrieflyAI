const pino = require('pino');

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/**
 * Logger estruturado com Pino.
 * - Produção: JSON (para ser ingerido por serviços de observabilidade)
 * - Desenvolvimento: Formato legível com pino-pretty
 */
const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PRODUCTION ? 'info' : 'debug'),
  // [SEGURANÇA] Redação automática — defesa em profundidade. Mesmo se alguém
  // logar req.body por acidente, senha/token nunca chegam ao log.
  redact: {
    paths: [
      'password', '*.password', '*.*.password',
      'passwordHash', '*.passwordHash',
      'token', '*.token', '*.*.token',
      'accessToken', 'refreshToken', '*.accessToken', '*.*.refreshToken',
      'rawToken', '*.rawToken',
      'authorization', 'req.headers.authorization', 'headers.authorization',
      'cookie', 'req.headers.cookie', 'headers.cookie',
      'apiKey', '*.apiKey',
      'resetPasswordToken', '*.resetPasswordToken'
    ],
    censor: '[REDACTED]'
  },
  ...(IS_PRODUCTION
    ? {
        // JSON puro para produção (Datadog, ELK, CloudWatch)
        formatters: {
          level: (label) => ({ level: label }),
          bindings: () => ({}) // Remove pid/hostname dos logs
        },
        timestamp: pino.stdTimeFunctions.isoTime
      }
    : {
        // Formato legível para dev
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname'
          }
        }
      })
});

module.exports = logger;
