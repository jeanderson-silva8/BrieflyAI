import { useState, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export function useStream() {
  const [data, setData] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [summaryId, setSummaryId] = useState(null);
  const abortRef = useRef(null);

  const startStream = useCallback(async (endpoint, body, token) => {
    setData('');
    setError(null);
    setIsStreaming(true);
    setSummaryId(null);

    abortRef.current = new AbortController();

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body),
        signal: abortRef.current.signal
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || errData.message || `Erro ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.error) {
                setError(parsed.error);
                break;
              }
              if (parsed.content) {
                accumulated += parsed.content;
                setData(accumulated);
              }
              if (parsed.done && parsed.summaryId) {
                setSummaryId(parsed.summaryId);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
  }, []);

  const reset = useCallback(() => {
    setData('');
    setError(null);
    setIsStreaming(false);
    setSummaryId(null);
  }, []);

  return { data, isStreaming, error, summaryId, startStream, stopStream, reset };
}
