const express = require('express');
const router = express.Router();
const multer = require('multer');
const Groq = require('groq-sdk');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const logger = require('../utils/logger');
const { scanFile } = require('../utils/virustotal');

// ═══════════════════════════════════════════════════════
// 🛡️ PROTOCOLO DE SEGURANÇA ENTERPRISE — UPLOAD DE ÁUDIO
// ═══════════════════════════════════════════════════════

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// [SEGURANÇA] Whitelist de extensões de áudio permitidas
const ALLOWED_EXTENSIONS = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.flac', '.mp4', '.mpeg'];
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB (limite da Groq Whisper)

/**
 * [SEGURANÇA] Validação por magic bytes — não confia no Content-Type/extensão.
 * Lê os primeiros 16 bytes e bate contra assinaturas conhecidas de containers de áudio.
 */
function isAllowedAudioMagic(buf) {
  if (!buf || buf.length < 12) return false;
  // ID3 (MP3 com tag)
  if (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) return true;
  // MPEG frame sync (MP3/MPEG sem tag): 0xFFE/0xFFF
  if (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0) return true;
  // RIFF....WAVE
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WAVE') return true;
  // OggS (Ogg/Opus/Vorbis)
  if (buf.slice(0, 4).toString() === 'OggS') return true;
  // fLaC
  if (buf.slice(0, 4).toString() === 'fLaC') return true;
  // EBML (WebM/Matroska): 0x1A45DFA3
  if (buf[0] === 0x1A && buf[1] === 0x45 && buf[2] === 0xDF && buf[3] === 0xA3) return true;
  // ftyp box (MP4/M4A) em offset 4
  if (buf.slice(4, 8).toString() === 'ftyp') return true;
  return false;
}

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

    // [SEGURANÇA] Validação por magic bytes antes de processar
    const fd = fs.openSync(filePath, 'r');
    const head = Buffer.alloc(16);
    fs.readSync(fd, head, 0, 16, 0);
    fs.closeSync(fd);
    if (!isAllowedAudioMagic(head)) {
      try { fs.unlinkSync(filePath); } catch {}
      return res.status(400).json({ error: 'Arquivo enviado não é um áudio válido.' });
    }

    // [SEGURANÇA] Scan VirusTotal (fail-open se chave ausente ou serviço fora)
    const scan = await scanFile(filePath);
    if (scan.scanned && !scan.clean) {
      try { fs.unlinkSync(filePath); } catch {}
      logger.warn({ analysisId: scan.analysisId, malicious: scan.malicious, suspicious: scan.suspicious }, '[TRANSCRIBE] Arquivo rejeitado pelo VirusTotal');
      return res.status(400).json({ error: 'Arquivo rejeitado pela varredura de segurança.' });
    }

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
    logger.error({ code: err.code || 'UNKNOWN' }, '[TRANSCRIBE] Erro na transcrição');

    // Limpar arquivo temporário em caso de erro
    if (req.file?.path) {
      try { fs.unlinkSync(req.file.path); } catch {}
      try { fs.unlinkSync(`${req.file.path}${path.extname(req.file.originalname)}`); } catch {}
    }

    res.status(500).json({ error: 'Erro ao transcrever o áudio.' });
  }
});

module.exports = router;
