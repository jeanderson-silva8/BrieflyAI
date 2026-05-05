import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Menu, FileText, Home, ChevronRight, Search, Bell, Calendar } from 'lucide-react';
import HistorySidebar from '../components/HistorySidebar';
import UsageMeter from '../components/UsageMeter';
import SummaryInput from '../components/SummaryInput';
import StreamingOutput from '../components/StreamingOutput';
import ChatWithDoc from '../components/ChatWithDoc';
import RightPanel from '../components/RightPanel';
import { useStream } from '../hooks/useStream';
import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeSummary, setActiveSummary] = useState(null);
  const [inputText, setInputText] = useState('');
  const [processingTime, setProcessingTime] = useState(null);
  const startTimeRef = useRef(null);
  const { data, isStreaming, error, summaryId: streamSummaryId, startStream, reset } = useStream();
  const { token, user } = useAuth();

  // Medir tempo de processamento quando streaming termina
  if (startTimeRef.current && !isStreaming && data) {
    const elapsed = ((Date.now() - startTimeRef.current) / 1000).toFixed(1);
    if (processingTime !== elapsed) setProcessingTime(elapsed);
    startTimeRef.current = null;
  }

  const handleSummarize = (text) => {
    setInputText(text);
    setActiveSummary(null);
    setProcessingTime(null);
    startTimeRef.current = Date.now();
    reset();
    startStream('/api/summarize', { text }, token);
  };

  const handleSelectSummary = (summary) => {
    reset();
    setActiveSummary(summary);
    setInputText(summary.inputText || '');
    setProcessingTime(null);
  };

  const handleNewSummary = () => {
    reset();
    setActiveSummary(null);
    setInputText('');
  };

  const displayData = activeSummary ? activeSummary.summaryResult : data;
  const showChat = !!displayData && !isStreaming;

  return (
    <div className="dashboard-layout">
      <HistorySidebar
        onSelectSummary={handleSelectSummary}
        onNewSummary={handleNewSummary}
        activeSummaryId={activeSummary?._id}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="main-content">
        {/* Header */}
        <header className="dashboard-header">
          <motion.div className="dashboard-header-left" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="breadcrumb">
              <Home size={13} />
              <span>/</span>
              <span>Área de Trabalho</span>
              <ChevronRight size={12} />
              <span className="current">{user?.name || 'Usuário'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <button className="menu-toggle" onClick={() => setSidebarOpen(true)}>
                <Menu size={22} />
              </button>
              <h1>Novo Resumo</h1>
            </div>
            <p>Transcreva reuniões e gere insights automáticos com IA</p>
          </motion.div>
          <motion.div className="dashboard-header-right" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <div className="header-search">
              <Search size={16} />
              <input type="text" placeholder="Buscar..." />
            </div>
            <div className="header-icon-btn">
              <Calendar size={16} />
            </div>

            <div className="header-sep" />
            <UsageMeter />
          </motion.div>
        </header>

        {/* Body */}
        <div className="dashboard-body">
          {error && <div className="auth-error" style={{ marginBottom: '1rem' }}>{error}</div>}
          <div className="dashboard-columns">
            {/* Center */}
            <div className="dashboard-center">
              <SummaryInput onSubmit={handleSummarize} isStreaming={isStreaming} disabled={false} text={inputText} onTextChange={setInputText} />
              <StreamingOutput data={displayData} isStreaming={isStreaming} />
              <ChatWithDoc 
                summaryId={activeSummary?._id || streamSummaryId}
                initialMessages={activeSummary?.chatHistory || []}
                context={inputText} 
                visible={showChat} 
              />
              {!displayData && !isStreaming && (
                <div className="empty-state">
                  <div className="empty-state-icon"><FileText size={32} /></div>
                  <h2>Pronto para resumir</h2>
                  <p>Cole o texto de uma reunião ou documento acima e clique em "Resumir com IA" para começar.</p>
                </div>
              )}
            </div>
            {/* Right Panel */}
            <div className="dashboard-right">
              <RightPanel inputText={inputText} summaryData={displayData} processingTime={processingTime} isStreaming={isStreaming} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
