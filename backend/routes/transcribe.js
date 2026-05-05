const express = require('express');
const router = express.Router();
const multer = require('multer');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');

// ═══════════════════════════════════════════════════════
// 🛡️ PROTOCOLO DE SEGURANÇA ENTERPRISE — UPLOAD DE ÁUDIO
// ═══════════════════════════════════════════════════════

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// [SEGURANÇA] Whitelist de extensões de áudio permitidas
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.mp4', '.mpeg'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (limite da Groq Whisper)

// [SEGURANÇA] Filtro de arquivo — rejeita extensões não permitidas
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (ALLOWED_EXTENSIONS.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Formato de arquivo não permitido. Use: ${ALLOWED_EXTENSIONS.join(', ')}`), false);
  }
};

const upload = multer({
  dest: path.join(__dirname, '../../.tmp/uploads'),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter
});

router.post('/', authMiddleware, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    const filePath = req.file.path;
    const extension = path.extname(req.file.originalname).toLowerCase() || '.mp3';
    const newFilePath = `${filePath}${extension}`;
    fs.renameSync(filePath, newFilePath);

    const transcription = await groq.audio.transcriptions.create({
      file: fs.createReadStream(newFilePath),
      model: 'whisper-large-v3',
      language: 'pt',
      temperature: 0.0,
    });

    // Apagar arquivo temporário imediatamente
    fs.unlinkSync(newFilePath);

    res.json({ text: transcription.text });
  } catch (err) {
    // [SEGURANÇA] Log Seguro
    console.error('[TRANSCRIBE] Erro na transcrição:', err.code || 'UNKNOWN');

    // Limpar arquivo temporário em caso de erro
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
      try { fs.unlinkSync(`${req.file.path}${path.extname(req.file.originalname)}`); } catch {}
    }

    res.status(500).json({ error: 'Erro ao transcrever o áudio.' });
  }
});

module.exports = router;
