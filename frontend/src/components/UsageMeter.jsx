import { useState, useEffect } from 'react';
import { Gauge } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

const API_URL = 'http://localhost:3001';
const DAILY_LIMIT = 5;

export default function UsageMeter() {
  const [used, setUsed] = useState(0);
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    fetch(`${API_URL}/api/history`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        const today = new Date().toDateString();
        const todayCount = data.filter(s => new Date(s.createdAt).toDateString() === today).length;
        setUsed(todayCount);
      }).catch(() => {});
  }, [token]);

  const remaining = Math.max(0, DAILY_LIMIT - used);
  const pct = (used / DAILY_LIMIT) * 100;
  const level = pct < 60 ? 'low' : pct < 100 ? 'medium' : 'high';

  return (
    <div className="usage-meter">
      <Gauge size={16} style={{ color: 'var(--text-secondary)' }} />
      <span className="usage-meter-label">Uso diário</span>
      <div className="usage-meter-bar">
        <div className={`usage-meter-fill ${level}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="usage-meter-count">{used}/{DAILY_LIMIT}</span>
    </div>
  );
}
