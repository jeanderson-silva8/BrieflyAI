import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Copy, Check, Download, Share2, MoreHorizontal, FileText, ListChecks, Mail, Loader2 } from 'lucide-react';

const TABS = [
  { id: 'resumo', label: 'Resumo', icon: FileText },
  { id: 'acoes', label: 'Ações', icon: ListChecks },
  { id: 'email', label: 'E-mail', icon: Mail },
];

function parseSections(text) {
  const sections = { resumo: '', acoes: '', email: '' };
  if (!text) return sections;
  const resumoMatch = text.match(/## 📋 RESUMO\n([\s\S]*?)(?=## ✅|$)/i);
  const acoesMatch = text.match(/## ✅ AÇÕES\n([\s\S]*?)(?=## 📧|$)/i);
  const emailMatch = text.match(/## 📧 E-MAIL DE FOLLOW-UP\n([\s\S]*?)$/i);
  sections.resumo = resumoMatch ? resumoMatch[1].trim() : text;
  sections.acoes = acoesMatch ? acoesMatch[1].trim() : '';
  sections.email = emailMatch ? emailMatch[1].trim() : '';
  return sections;
}

export default function StreamingOutput({ data, isStreaming }) {
  const [activeTab, setActiveTab] = useState('resumo');
  const [copiedTab, setCopiedTab] = useState(null);
  const sections = useMemo(() => parseSections(data), [data]);

  const handleCopy = async (tab) => {
    const text = sections[tab];
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  if (!data && !isStreaming) return null;

  return (
    <motion.div className="streaming-container card-elevated" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      {/* Tabs Header */}
      <div className="streaming-tabs">
        <div className="streaming-tabs-left">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} className={`streaming-tab ${isActive ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                <Icon size={16} strokeWidth={isActive ? 2 : 1.5} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
        <div className="streaming-tabs-right">
          <AnimatePresence>
            {sections[activeTab] && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                className={`streaming-action-btn ${copiedTab === activeTab ? 'expanded' : ''}`}
                onClick={() => handleCopy(activeTab)} title="Copiar">
                {copiedTab === activeTab ? <><Check size={14} /> Copiado!</> : <Copy size={14} />}
              </motion.button>
            )}
          </AnimatePresence>
          <button className="action-btn-pdf" title="Exportar Documento (PDF)" onClick={() => window.print()}>
            <Download size={14} /> Exportar
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="streaming-body">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
            {!data && isStreaming ? (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                  <Loader2 size={16} style={{ color: '#3b82f6' }} className="spinner" />
                  <span style={{ fontSize: '0.875rem', color: '#4a6a8a' }}>Aguardando conteúdo...</span>
                </div>
                <div className="skeleton">
                  <div className="skeleton-line" /><div className="skeleton-line" />
                  <div className="skeleton-line" /><div className="skeleton-line" />
                </div>
              </div>
            ) : (
              <div className="streaming-text blur-reveal">
                {sections[activeTab] || (isStreaming ? 'Gerando...' : 'Nenhum conteúdo nesta seção.')}
                {isStreaming && <span className="streaming-cursor" />}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
