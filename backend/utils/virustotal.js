const fs = require('fs');
const logger = require('./logger');

/**
 * VirusTotal v3 — scan de arquivo via API.
 *
 * Comportamento:
 *  - Sem `VIRUSTOTAL_API_KEY`: fail-open (não bloqueia) — apropriado para dev.
 *  - Com chave: upload, polling do veredito até `timeoutMs`.
 *  - Bloqueia se ≥ `MALICIOUS_THRESHOLD` engines marcarem como malicious/suspicious.
 *  - Erro de rede / timeout: fail-open com warn (transcrição não é bloqueada por queda da VT).
 *
 * Limite VT Free: 4 req/min, 500/dia, 15.5k/mês — folgado para o uso atual.
 */
const VT_BASE = 'https://www.virustotal.com/api/v3';
const MALICIOUS_THRESHOLD = 1; // 1 engine já é sinal forte para áudios

async function scanFile(filePath, { timeoutMs = 30000 } = {}) {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) return { scanned: false, clean: true, reason: 'no_api_key' };

  try {
    const buf = fs.readFileSync(filePath);
    const form = new FormData();
    form.append('file', new Blob([buf]), 'upload.bin');

    const uploadRes = await fetch(`${VT_BASE}/files`, {
      method: 'POST',
      headers: { 'x-apikey': apiKey },
      body: form
    });

    if (!uploadRes.ok) {
      logger.warn({ status: uploadRes.status }, 'VirusTotal upload falhou — fail-open');
      return { scanned: false, clean: true, reason: 'upload_failed' };
    }

    const { data } = await uploadRes.json();
    const analysisId = data?.id;
    if (!analysisId) return { scanned: false, clean: true, reason: 'no_analysis_id' };

    const start = Date.now();
    let delay = 2000;
    while (Date.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, delay));
      delay = Math.min(delay * 1.5, 6000);

      const pollRes = await fetch(`${VT_BASE}/analyses/${analysisId}`, {
        headers: { 'x-apikey': apiKey }
      });
      if (!pollRes.ok) continue;
      const poll = await pollRes.json();
      const status = poll?.data?.attributes?.status;
      if (status !== 'completed') continue;

      const stats = poll.data.attributes.stats || {};
      const bad = (stats.malicious || 0) + (stats.suspicious || 0);
      return {
        scanned: true,
        clean: bad < MALICIOUS_THRESHOLD,
        malicious: stats.malicious || 0,
        suspicious: stats.suspicious || 0,
        analysisId
      };
    }

    logger.warn({ analysisId }, 'VirusTotal análise não completou no timeout — fail-open');
    return { scanned: false, clean: true, reason: 'timeout' };
  } catch (err) {
    logger.warn({ err: err.message }, 'VirusTotal erro — fail-open');
    return { scanned: false, clean: true, reason: 'error' };
  }
}

module.exports = { scanFile };
