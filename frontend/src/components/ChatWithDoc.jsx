import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageSquare, Send, User, Sparkles, Loader2, CheckSquare, Globe, AlignLeft, Lightbulb } from 'lucide-react';
import { useStream } from '../hooks/useStream';
import { useAuth } from '../hooks/useAuth';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function ChatWithDoc({ summaryId, initialMessages = [], context, visible }) {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState(initialMessages);
  const { data: aiResponse, isStreaming, startStream, reset } = useStream();
  const { token } = useAuth();
  const endRef = useRef(null);

  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const slashCommands = [
    { id: 'tarefas', icon: <CheckSquare size={14} />, title: 'Tarefas', desc: 'Extrair ações e responsáveis', prompt: 'Liste todas as ações e responsáveis citados neste documento.' },
    { id: 'traduzir', icon: <Globe size={14} />, title: 'Traduzir', desc: 'Inglês corporativo', prompt: 'Traduza as informações essenciais deste documento para Inglês corporativo.' },
    { id: 'curto', icon: <AlignLeft size={14} />, title: 'Resumo Curto', desc: 'Apenas 1 parágrafo', prompt: 'Resuma todo este conteúdo em apenas um parágrafo executivo.' },
    { id: 'insights', icon: <Lightbulb size={14} />, title: 'Insights', desc: 'Ideias principais', prompt: 'Quais são as 3 ideias principais ou conclusões mais importantes deste texto?' }
  ];

  const filteredCommands = slashCommands.filter(c => c.id.includes(slashFilter.toLowerCase()));

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, aiResponse]);

  // Limpa ou recarrega o chat sempre que o documento analisado (context) for trocado
  useEffect(() => {
    setMessages(initialMessages);
    setQuestion('');
  }, [context]);

  // Salva no backend
  const saveChatToDB = async (updatedMessages) => {
    if (!summaryId) return;
    try {
      await fetch(`${API_URL}/api/history/${summaryId}/chat`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ messages: updatedMessages })
      });
    } catch(err) { console.error('Erro ao salvar chat:', err); }
  };

  useEffect(() => {
    if (aiResponse && !isStreaming) {
      const newMsgs = [...messages, { role: 'ai', content: aiResponse }];
      setMessages(newMsgs);
      saveChatToDB(newMsgs);
      reset();
    }
  }, [isStreaming]);

  const handleSend = () => {
    if (!question.trim() || isStreaming) return;
    const newMsgs = [...messages, { role: 'user', content: question.trim() }];
    setMessages(newMsgs);
    saveChatToDB(newMsgs);
    startStream('/api/chat', { question: question.trim(), context }, token);
    setQuestion('');
    setShowSlash(false);
  };

  const handleSelectCommand = (cmd) => {
    setShowSlash(false);
    setQuestion('');
    const newMsgs = [...messages, { role: 'user', content: cmd.prompt }];
    setMessages(newMsgs);
    saveChatToDB(newMsgs);
    startStream('/api/chat', { question: cmd.prompt, context }, token);
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuestion(val);
    if (val.startsWith('/')) {
      setShowSlash(true);
      setSlashFilter(val.slice(1));
      setSelectedIndex(0);
    } else {
      setShowSlash(false);
    }
  };

  const handleKeyDown = (e) => {
    if (showSlash && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev + 1) % filteredCommands.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleSelectCommand(filteredCommands[selectedIndex]);
      } else if (e.key === 'Escape') {
        setShowSlash(false);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault(); 
      handleSend(); 
    }
  };

  if (!visible) return null;

  return (
    <motion.div className="chat-container card-elevated" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-icon"><MessageSquare size={18} /></div>
        <div>
          <h3>Pergunte ao documento</h3>
          <p>Baseado no conteúdo resumido</p>
        </div>
        <div className="chat-status">
          <div className="chat-status-dot" />
          <span>Online</span>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !isStreaming && (
          <div style={{ textAlign: 'center', color: '#4a6a8a', fontSize: '0.85rem', padding: '2rem 0' }}>
            Faça perguntas sobre o conteúdo resumido
          </div>
        )}
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.3 }}
              style={{ display: 'flex', gap: '0.75rem', flexDirection: msg.role === 'user' ? 'row-reverse' : 'row' }}>
              <div style={{
                width: '32px', height: '32px', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                background: msg.role === 'user' ? 'linear-gradient(135deg,#3b82f6,#6366f1)' : 'linear-gradient(135deg,#1a3050,#0d1a30)',
                border: msg.role === 'user' ? 'none' : '1px solid rgba(30,58,95,0.5)'
              }}>
                {msg.role === 'user' ? <User size={15} color="#fff" /> : <Sparkles size={15} color="#60a5fa" />}
              </div>
              <div className={`chat-bubble ${msg.role}`}>{msg.content}</div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isStreaming && aiResponse && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#1a3050,#0d1a30)', border: '1px solid rgba(30,58,95,0.5)', flexShrink: 0 }}>
              <Sparkles size={15} color="#60a5fa" />
            </div>
            <div className="chat-bubble ai">{aiResponse}<span className="streaming-cursor" /></div>
          </div>
        )}
        {isStreaming && !aiResponse && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '2.75rem' }}>
            <Loader2 size={14} style={{ color: '#3b82f6' }} className="spinner" />
            <span style={{ fontSize: '0.75rem', color: '#4a6a8a' }}>Pensando...</span>
          </motion.div>
        )}
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="chat-input-container" style={{ position: 'relative' }}>
        <AnimatePresence>
          {showSlash && (
            <motion.div className="slash-menu-container" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }}>
              <div className="slash-menu-title">Comandos Mágicos</div>
              {filteredCommands.length > 0 ? (
                filteredCommands.map((cmd, idx) => (
                  <div key={cmd.id} className={`slash-item ${idx === selectedIndex ? 'selected' : ''}`} onClick={() => handleSelectCommand(cmd)}>
                    <div className="slash-icon">{cmd.icon}</div>
                    <div className="slash-item-content">
                      <span className="slash-item-title">{cmd.title}</span>
                      <span className="slash-item-desc">{cmd.desc}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div style={{ padding: '0.5rem', fontSize: '0.8rem', color: '#5a7fa8', textAlign: 'center' }}>Nenhum comando encontrado</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="chat-input-wrap">
          <input className="chat-input" placeholder="Faça uma pergunta ou digite '/' para comandos..." value={question}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            disabled={isStreaming} />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            className="btn btn-primary chat-send-btn" onClick={handleSend}
            disabled={!question.trim() || isStreaming}>
            <Send size={16} />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
