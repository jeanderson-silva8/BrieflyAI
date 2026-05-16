import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Wand2, FileText, Type, X, Mic, Upload, Loader2, Square } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function SummaryInput({ onSubmit, isStreaming, disabled, text, onTextChange, token }) {
  const charCount = text.trim().length;
  const isValid = charCount >= 50;

  const [isFocused, setIsFocused] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const handleSubmit = () => {
    if (isValid && !isStreaming && !disabled) onSubmit(text.trim());
  };

  const uploadAudio = async (audioBlob, filename) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, filename);
      const res = await fetch(`${API_URL}/api/transcribe`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      if (!res.ok) throw new Error('Falha na transcrição');
      const data = await res.json();
      onTextChange(text + (text ? '\n\n' : '') + data.text);
    } catch (err) {
      console.error(err);
      alert('Erro ao transcrever o áudio com Groq Whisper.');
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) uploadAudio(file, file.name);
    e.target.value = null;
  };

  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        
        mediaRecorder.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          uploadAudio(audioBlob, 'recording.webm');
          stream.getTracks().forEach(track => track.stop());
        };
        
        mediaRecorder.start();
        setIsRecording(true);
      } catch (err) {
        console.error('Erro de mic:', err);
        alert('Microfone não encontrado ou permissão negada.');
      }
    }
  };

  return (
    <motion.div className="summary-input-container" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <div className="card-elevated" style={{ overflow: 'hidden' }}>
        {/* Toolbar */}
        <div className="input-toolbar">
          <div className="input-toolbar-left">
            <div className="toolbar-item"><FileText size={15} /><span>Transcrição</span></div>
            <div style={{ width: '1px', height: '16px', background: 'rgba(30,58,95,0.3)' }} />
            <div className="toolbar-item"><Type size={13} /><span>{charCount.toLocaleString()} caracteres</span></div>
          </div>
          <div className="input-toolbar-right">
            <input type="file" accept="audio/*" ref={fileInputRef} onChange={handleFileChange} style={{ display: 'none' }} />
            
            <button className="toolbar-icon-btn" title="Upload de áudio" onClick={() => fileInputRef.current?.click()} disabled={isTranscribing || isRecording}>
              {isTranscribing && !isRecording ? <Loader2 size={15} className="spinner" /> : <Upload size={15} />}
            </button>
            
            <button className={`toolbar-icon-btn ${isRecording ? 'recording' : ''}`} title={isRecording ? "Parar gravação" : "Gravar áudio"} onClick={toggleRecording} disabled={isTranscribing && !isRecording}>
              {isRecording ? <Square size={15} fill="currentColor" /> : <Mic size={15} />}
            </button>
            
            {text.length > 0 && (
              <motion.button initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                className="toolbar-icon-btn danger" onClick={() => onTextChange('')}><X size={15} /></motion.button>
            )}
          </div>
        </div>

        {/* Textarea */}
        <div style={{ position: 'relative' }}>
          <textarea className="summary-textarea"
            placeholder={isFocused ? "Cole aqui a transcrição da sua reunião, call ou documento..." : ""}
            value={text} 
            onChange={(e) => onTextChange(e.target.value)} 
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={isStreaming || isTranscribing} spellCheck={false} />
          {text.length === 0 && !isFocused && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '1.5rem', background: 'linear-gradient(135deg,rgba(59,130,246,0.1),rgba(99,102,241,0.1))', border: '1px solid rgba(59,130,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <FileText size={30} style={{ color: 'rgba(59,130,246,0.3)' }} />
              </div>
              <p style={{ fontSize: '0.875rem', color: '#3a5a7f', fontWeight: 500 }}>Cole sua transcrição aqui</p>
              <p style={{ fontSize: '0.75rem', color: '#2a4a6f', marginTop: '0.25rem' }}>Suporta texto, Markdown e transcrições de áudio</p>
            </div>
          )}
        </div>

        {/* Bottom Bar */}
        <div className="input-footer">
          <div className="input-footer-left">
            <span className={`input-status ${isValid ? 'ready' : 'need-more'}`}>
              {isValid ? 'Pronto para resumir' : `Mínimo: ${50 - charCount} caracteres`}
            </span>
            <span className="badge-tag">Reunião</span>
          </div>
          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
            className="btn btn-primary summarize-btn" onClick={handleSubmit}
            disabled={!isValid || isStreaming || disabled}>
            {isStreaming ? (<><span className="spinner" /> Analisando...</>) : (<><Wand2 size={16} strokeWidth={2.5} /> Resumir com IA</>)}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
