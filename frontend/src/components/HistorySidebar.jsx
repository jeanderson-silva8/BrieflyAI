import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Plus, LogOut, Settings, LayoutDashboard, History, FileText, Zap, ChevronDown, Trash2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, circle: 'icon-circle-blue' },
  { id: 'history', label: 'Histórico', icon: History, circle: 'icon-circle-purple' },
  { id: 'templates', label: 'Templates', icon: FileText, circle: 'icon-circle-cyan' },
  { id: 'integrations', label: 'Integrações', icon: Zap, circle: 'icon-circle-amber' },
];

export default function HistorySidebar({ onSelectSummary, onNewSummary, activeSummaryId, isOpen, onClose }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const { user, token, logout } = useAuth();

  const fetchHistory = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/history`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setHistory(Array.isArray(data) ? data : (data.items || []));
      }
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHistory(); }, [token]);

  const handleSelect = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/history/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { onSelectSummary(await res.json()); if (window.innerWidth < 768) onClose(); }
    } catch (err) { console.error(err); }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_URL}/api/history/${id}`, { 
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` } 
      });
      if (res.ok) { 
        fetchHistory(); 
        if (activeSummaryId === id) onSelectSummary(null);
      } else {
        alert(`Erro ao excluir (Status ${res.status}): ${await res.text()}`);
      }
    } catch (err) { 
      console.error(err); 
      alert('Erro de rede ao tentar excluir.');
    }
  };

  const formatDate = (d) => new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  const isToday = (d) => {
    const date = new Date(d);
    const today = new Date();
    return date.getDate() === today.getDate() && 
           date.getMonth() === today.getMonth() && 
           date.getFullYear() === today.getFullYear();
  };

  const historyToday = history.filter(h => isToday(h.createdAt));
  const historyPast = history.filter(h => !isToday(h.createdAt));
  const isHistoryTab = activeTab === 'history';
  const displayHistory = isHistoryTab ? historyPast : historyToday;

  return (
    <>
      <div className={`sidebar-overlay ${isOpen ? 'visible' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <div style={{ width: '40px', height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="36" height="36" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <linearGradient id="pillGrad" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="#4f46e5" />
                    <stop offset="100%" stopColor="#1e1b4b" />
                  </linearGradient>
                  <linearGradient id="pillStroke" x1="100%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="rgba(255,255,255,0.8)" />
                    <stop offset="50%" stopColor="rgba(255,255,255,0.1)" />
                    <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                  </linearGradient>
                </defs>
                <g transform="rotate(-40 32 32)">
                  <rect x="22" y="16" width="36" height="14" rx="7" fill="url(#pillGrad)" stroke="url(#pillStroke)" strokeWidth="1.5" />
                  <rect x="6" y="34" width="36" height="14" rx="7" fill="url(#pillGrad)" stroke="url(#pillStroke)" strokeWidth="1.5" />
                </g>
              </svg>
            </div>
            <div>
              <h2>BrieflyAI</h2>
              <div className="logo-sub">Enterprise</div>
            </div>
          </div>
        </div>

        <div className="sidebar-content">
          {/* New Summary CTA */}
          <div style={{ padding: '0 0.25rem', marginBottom: '1.5rem' }}>
            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              className="btn btn-primary new-summary-btn"
              onClick={() => { onNewSummary(); if (window.innerWidth < 768) onClose(); }}>
              <Plus size={18} strokeWidth={2.5} /> Novo Resumo
            </motion.button>
          </div>

          {/* Navigation */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', marginBottom: '1.5rem' }}>
            <button onClick={() => setActiveTab(isHistoryTab ? 'dashboard' : 'history')}
              className={`sidebar-nav-btn ${isHistoryTab ? 'active' : ''}`}>
              <div className={`icon-circle ${isHistoryTab ? 'icon-circle-purple' : 'icon-circle-default'}`}>
                <History size={18} strokeWidth={isHistoryTab ? 2.5 : 1.5} />
              </div>
              <span>Histórico</span>
            </button>
          </nav>

          {/* History Section */}
          <div className="sidebar-section-title">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span><Clock size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '4px' }} />
                {isHistoryTab ? 'Histórico Antigo' : 'Recentes (Hoje)'}
              </span>
            </div>
          </div>

          {loading && <div style={{ textAlign: 'center', padding: '1rem', color: '#4a6a8a', fontSize: '0.8rem' }}>Carregando...</div>}
          {!loading && displayHistory.length === 0 && <div style={{ textAlign: 'center', padding: '1rem', color: '#4a6a8a', fontSize: '0.75rem' }}>
            {isHistoryTab ? 'Nenhum histórico anterior' : 'Nenhuma pesquisa hoje'}
          </div>}

          {displayHistory.map((item, idx) => (
            <motion.div key={item._id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }}
              className={`sidebar-item ${activeSummaryId === item._id ? 'active' : ''}`}
              onClick={() => handleSelect(item._id)}
              style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: '0.5rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflow: 'hidden', flex: 1, padding: '0.2rem 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <span style={{ fontSize: '0.9rem' }}>{item.emoji || '📄'}</span>
                  <span className="sidebar-item-title" style={{ flex: 1 }}>{item.title || 'Sem título'}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="sidebar-item-date">{formatDate(item.createdAt)}</span>
                  {item.tags && item.tags.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      {item.tags.map((t, i) => (
                        <span key={i} className={`badge-tag ${i%2!==0?'badge-tag-purple':''}`} style={{ fontSize: '0.55rem', padding: '0.15rem 0.35rem', borderRadius: '4px', border: 'none', fontWeight: 600 }}>{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <button 
                onClick={(e) => { e.stopPropagation(); handleDelete(item._id); }}
                style={{ background: 'none', border: 'none', color: '#4a6a8a', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'flex', alignItems: 'center' }}
                onMouseOver={(e) => e.currentTarget.style.color = '#ef4444'}
                onMouseOut={(e) => e.currentTarget.style.color = '#4a6a8a'}
                title="Excluir resumo"
              >
                <Trash2 size={14} />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <button className="sidebar-footer-btn danger" onClick={logout}>
            <div className="icon-circle icon-circle-default"><LogOut size={18} strokeWidth={1.5} /></div>
            <span>Sair</span>
          </button>
        </div>
      </aside>
    </>
  );
}
