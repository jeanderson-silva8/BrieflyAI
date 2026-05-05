import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Clock, Users, Tag, BarChart3, FileText, Calendar, Hash, TrendingUp, Zap } from 'lucide-react';

// Cores para avatares de participantes
const AVATAR_COLORS = [
  'linear-gradient(135deg,#10b981,#34d399)',
  'linear-gradient(135deg,#3b82f6,#60a5fa)',
  'linear-gradient(135deg,#8b5cf6,#a78bfa)',
  'linear-gradient(135deg,#f59e0b,#fbbf24)',
  'linear-gradient(135deg,#ec4899,#f472b6)',
  'linear-gradient(135deg,#06b6d4,#22d3ee)',
];

// Extrai participantes do texto (busca padrões como "**Nome:**" ou "Nome:")
function extractParticipants(text) {
  if (!text) return [];
  const patterns = [
    /\*\*([A-ZÀ-Ú][a-záàâãéèêíïóôõúç]+(?:\s[A-ZÀ-Ú][a-záàâãéèêíïóôõúç]+)?)\*\*\s*:/g,
    /^([A-ZÀ-Ú][a-záàâãéèêíïóôõúç]+(?:\s[A-ZÀ-Ú][a-záàâãéèêíïóôõúç]+)?)\s*:/gm,
  ];
  const found = new Set();
  for (const pat of patterns) {
    let m;
    while ((m = pat.exec(text)) !== null) {
      const name = m[1].trim();
      if (name.length > 2 && name.length < 40) found.add(name);
    }
  }
  return [...found].slice(0, 6);
}

// Extrai palavras-chave/tags do texto
function extractTags(text) {
  if (!text) return [];
  const keywords = [];
  const lower = text.toLowerCase();
  const tagMap = {
    'reunião': 'Reunião', 'meeting': 'Meeting', 'sprint': 'Sprint', 'review': 'Review',
    'financeiro': 'Financeiro', 'marketing': 'Marketing', 'vendas': 'Vendas',
    'produto': 'Produto', 'tech': 'Tech', 'growth': 'Growth', 'okr': 'OKRs',
    'estratégia': 'Estratégia', 'planejamento': 'Planejamento', 'roadmap': 'Roadmap',
    'investidor': 'Investidores', 'cliente': 'Clientes', 'parceria': 'Parcerias',
    'app': 'App Mobile', 'mobile': 'Mobile', 'api': 'API', 'deploy': 'Deploy',
    'cashback': 'Cashback', 'e-commerce': 'E-commerce', 'saas': 'SaaS',
    'ia': 'IA', 'inteligência artificial': 'IA', 'machine learning': 'ML',
  };
  for (const [key, label] of Object.entries(tagMap)) {
    if (lower.includes(key) && !keywords.includes(label)) keywords.push(label);
  }
  return keywords.slice(0, 5);
}

// Gera título automático a partir do texto e tags
function generateTitle(text, tags) {
  if (!text) return 'Documento sem título';
  // Tentar gerar título a partir das tags extraídas
  if (tags && tags.length >= 2) {
    return tags.slice(0, 3).join(' — ');
  }
  // Fallback: pegar primeira linha limpa
  const lines = text.split('\n').filter(l => l.trim().length > 5);
  for (const line of lines) {
    let clean = line.replace(/\*\*[^*]+\*\*\s*:?\s*/g, '').trim();
    clean = clean.replace(/^[\-\*•]\s*/, '');
    if (clean.length > 10) {
      return clean.length > 55 ? clean.substring(0, 55) + '...' : clean;
    }
  }
  return 'Documento sem título';
}

// Conta ações extraídas do resumo
function countActions(summaryData) {
  if (!summaryData) return 0;
  // Tenta pegar seção de ações
  const acoesMatch = summaryData.match(/## ✅ AÇÕES\n([\s\S]*?)(?=## 📧|$)/i);
  const section = acoesMatch ? acoesMatch[1] : summaryData;
  // Conta linhas que parecem ser action items
  const lines = section.split('\n').filter(l => {
    const t = l.trim();
    return t.match(/^[\-\*•✅🔲⬜☑️✓→➡]\s/) || t.match(/^\d+[\.\)]\s/) || t.match(/^Prazo:/i);
  });
  return Math.max(lines.length, 0);
}

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

export default function RightPanel({ inputText, summaryData, processingTime, isStreaming }) {
  const analysis = useMemo(() => {
    const words = inputText ? inputText.trim().split(/\s+/).filter(Boolean).length : 0;
    const participants = extractParticipants(inputText);
    const tags = extractTags(inputText);
    const title = generateTitle(inputText, tags);
    const actions = countActions(summaryData);
    // Estimar tempo de reunião: ~150 palavras por minuto de conversa
    const estimatedMinutes = Math.max(1, Math.round(words / 150));
    return { words, participants, tags, title, actions, estimatedMinutes };
  }, [inputText, summaryData]);

  const hasData = inputText && inputText.length > 0;
  const now = new Date();
  const dateStr = now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // Gerar barras do mini chart baseado na contagem de palavras (mockado proporcionalmente)
  const chartData = hasData
    ? [30, 50, 25, Math.min(100, analysis.words / 20), 45, Math.min(100, (analysis.words / 10)), 60]
    : [20, 30, 15, 25, 20, 35, 25];

  return (
    <motion.aside initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}
      style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>

      {/* Document Info */}
      <div className="card-elevated right-panel-card">
        <div className="right-panel-header"><Hash size={14} /><span>Metadados</span></div>
        <div style={{ marginBottom: '0.75rem' }}>
          <p style={{ fontSize: '0.6rem', color: '#4a6a8a', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.25rem' }}>Título</p>
          <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#fff', lineHeight: 1.4 }}>
            {hasData ? analysis.title : 'Aguardando documento...'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', fontSize: '0.75rem', color: '#5a7fa8' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Calendar size={12} />{dateStr}</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Clock size={12} />{timeStr}</span>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stat-grid">
        <div className="card-elevated stat-card">
          <Clock size={16} style={{ color: '#3b82f6', marginBottom: '0.25rem' }} />
          <p className="stat-card-value">{hasData ? `${analysis.estimatedMinutes} min` : '—'}</p>
          <p className="stat-card-label">Tempo estimado</p>
        </div>
        <div className="card-elevated stat-card">
          <FileText size={16} style={{ color: '#3b82f6', marginBottom: '0.25rem' }} />
          <p className="stat-card-value">{hasData ? analysis.words.toLocaleString() : '—'}</p>
          <p className="stat-card-label">Palavras</p>
        </div>
        <div className="card-elevated stat-card">
          <Zap size={16} style={{ color: '#3b82f6', marginBottom: '0.25rem' }} />
          <p className="stat-card-value">{summaryData ? analysis.actions : '—'}</p>
          <p className="stat-card-label">Ações extraídas</p>
        </div>
        <div className="card-elevated stat-card">
          <BarChart3 size={16} style={{ color: '#3b82f6', marginBottom: '0.25rem' }} />
          <p className="stat-card-value">
            {isStreaming ? '...' : processingTime ? `${processingTime}s` : hasData ? 'Salvo' : '—'}
          </p>
          <p className="stat-card-label">Processamento</p>
        </div>
      </div>

      {/* Activity Chart */}
      <div className="card-elevated right-panel-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <div className="right-panel-header" style={{ marginBottom: 0 }}><TrendingUp size={14} /><span>Análise</span></div>
          <span style={{ fontSize: '0.6rem', color: '#5a7fa8' }}>Documento atual</span>
        </div>
        <div className="mini-chart">
          {chartData.map((h, i) => (
            <div key={i} className={`mini-chart-bar ${i === 5 ? 'highlight' : ''}`} style={{ height: `${h}%` }} />
          ))}
        </div>
        <div className="mini-chart-labels">
          {DAYS.map(d => <span key={d}>{d}</span>)}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
          <div>
            <p style={{ fontSize: '1.5rem', fontWeight: 700, color: '#fff' }}>
              {hasData ? analysis.words.toLocaleString() : '0'}
            </p>
            <p style={{ fontSize: '0.6rem', color: '#5a7fa8' }}>Palavras processadas</p>
          </div>
          {processingTime ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#34d399' }}>
              <TrendingUp size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>{processingTime}s</span>
            </div>
          ) : hasData ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color: '#6b8cae' }}>
              <TrendingUp size={14} />
              <span style={{ fontSize: '0.75rem', fontWeight: 700 }}>Na nuvem</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Participants */}
      {analysis.participants.length > 0 && (
        <div className="card-elevated right-panel-card">
          <div className="right-panel-header">
            <Users size={14} /><span>Participantes</span>
            <span className="count">{analysis.participants.length}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {analysis.participants.map((name, i) => (
              <div key={name} className="participant-item">
                <div className="participant-avatar" style={{ background: AVATAR_COLORS[i % AVATAR_COLORS.length] }}>
                  {name.split(' ').map(n => n[0]).join('').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p className="participant-name">{name}</p>
                  <p className="participant-role">Participante</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      {analysis.tags.length > 0 && (
        <div className="card-elevated right-panel-card">
          <div className="right-panel-header"><Tag size={14} /><span>Tags</span></div>
          <div className="tag-list">
            {analysis.tags.map((tag, i) => {
              const styles = [
                { background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
                { background: 'rgba(139,92,246,0.1)', borderColor: 'rgba(139,92,246,0.15)', color: '#c4b5fd' },
                { background: 'rgba(6,182,212,0.1)', borderColor: 'rgba(6,182,212,0.15)', color: '#67e8f9' },
              ];
              const s = styles[i % styles.length];
              return (
                <span key={tag} className="badge-tag" style={{ background: s.background, borderColor: s.borderColor, color: s.color }}>
                  {tag}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state quando não há dados */}
      {!hasData && (
        <div className="card-elevated right-panel-card" style={{ textAlign: 'center', padding: '2rem 1.25rem' }}>
          <FileText size={24} style={{ color: 'rgba(59,130,246,0.25)', margin: '0 auto 0.75rem' }} />
          <p style={{ fontSize: '0.8rem', color: '#4a6a8a', lineHeight: 1.5 }}>
            Cole um texto para ver os metadados, participantes e tags extraídos automaticamente
          </p>
        </div>
      )}
    </motion.aside>
  );
}
