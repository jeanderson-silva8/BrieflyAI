require('dotenv').config();
const mongoose = require('mongoose');
const logger = require('./utils/logger');
const app = require('./app');

const PORT = process.env.PORT || 3001;

// [BOOT] Validação de variáveis de ambiente críticas — fail-fast
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI', 'GROQ_API_KEY'];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  logger.fatal({ missing: missingEnv }, 'BOOT FATAL — variáveis de ambiente obrigatórias ausentes. Configure-as no painel do Render (ou .env local) antes de prosseguir.');
  process.exit(1);
}

// [BOOT] Avisos para envs opcionais mas recomendadas
if (!process.env.RESEND_API_KEY) {
  logger.warn('RESEND_API_KEY não definida — emails de recuperação não serão enviados');
}
if (!process.env.CLIENT_URL) {
  logger.warn('CLIENT_URL não definida — usando fallback http://localhost:5173');
}

// Conexão com MongoDB e start do servidor
const startServer = () => {
  app.listen(PORT, () => {
    logger.info(`🚀 BrieflyAI Backend rodando na porta ${PORT}`);
  });
};

mongoose.connect(process.env.MONGO_URI, {
  serverSelectionTimeoutMS: 10000,
  socketTimeoutMS: 45000,
})
  .then(() => {
    logger.info('MongoDB conectado com sucesso');
    startServer();
  })
  .catch((err) => {
    logger.warn('MongoDB não conectou. Verifique MONGO_URI no .env');
    logger.warn('Iniciando servidor SEM banco de dados (modo offline)...');
    startServer();
  });
