'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Mail,
  Trash2,
  Copy,
  Check,
  RefreshCw,
  Plus,
  Sparkles,
  ShieldCheck,
  AlertCircle,
  ExternalLink,
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  X,
  Clock,
  Layers,
  Globe,
  Database,
  ArrowRight
} from 'lucide-react';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  // Form State
  const [count, setCount] = useState(1);
  const [category, setCategory] = useState('all');
  const [label, setLabel] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'preview' | 'history'

  // Previews
  const [previewList, setPreviewList] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Feedback & Alerts
  const [toast, setToast] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(null);
  const [rateLimitMessage, setRateLimitMessage] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);
  const [showVercelModal, setShowVercelModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    showToast(`Copied ${text} to clipboard!`);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  // Fetch status and aliases
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, aliasesRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/aliases')
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData);
      }
      if (aliasesRes.ok) {
        const aData = await aliasesRes.json();
        setAliases(aData.aliases || []);
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Failed to sync with SimpleLogin server', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/history');
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    }
  }, []);

  // Fetch preview
  const fetchPreview = useCallback(async (customCount, customCategory) => {
    try {
      setLoadingPreview(true);
      const pCount = customCount || count;
      const pCat = customCategory || category;
      const res = await fetch(`/api/preview?count=${pCount}&category=${pCat}`);
      if (res.ok) {
        const data = await res.json();
        setPreviewList(data.pairs || []);
      }
    } catch (err) {
      console.error('Preview error:', err);
    } finally {
      setLoadingPreview(false);
    }
  }, [count, category]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistory();
    } else if (activeTab === 'preview') {
      fetchPreview();
    }
  }, [activeTab, fetchHistory, fetchPreview]);

  // Handle Generate
  const handleGenerate = async (fillRemaining = false) => {
    setGenerating(true);
    setRateLimitMessage(null);

    try {
      const res = await fetch('/api/aliases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: fillRemaining ? undefined : count,
          category,
          label,
          fillRemaining
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to generate aliases', 'error');
        return;
      }

      if (data.createdCount > 0) {
        showToast(`Successfully created ${data.createdCount} new alias(es)!`);
      }

      if (data.hitRateLimit) {
        setRateLimitMessage(data.message);
      }

      refreshData();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setGenerating(false);
    }
  };

  // Handle Delete Single
  const handleDeleteSingle = async (id, email) => {
    if (!window.confirm(`Are you sure you want to delete alias ${email}?`)) {
      return;
    }
    setDeletingId(id);
    try {
      const res = await fetch(`/api/aliases?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Deleted ${email}`);
        setAliases(prev => prev.filter(a => a.id !== id));
        refreshData();
      } else {
        showToast(data.error || 'Delete failed', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingId(null);
    }
  };

  // Handle Delete All
  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      const res = await fetch('/api/aliases?all=true', {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'All aliases deleted! 10 spots freed up.');
        setAliases([]);
        setShowDeleteAllModal(false);
        refreshData();
      } else {
        showToast(data.error || 'Failed to delete all', 'error');
      }
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setDeletingAll(false);
    }
  };

  const quotaMax = status?.account?.quotaMax || 10;
  const activeCount = aliases.length;
  const availableSlots = Math.max(0, quotaMax - activeCount);
  const quotaPercent = Math.min(100, Math.round((activeCount / quotaMax) * 100));

  return (
    <>
      <div className="bg-grid" />
      <div className="container">
        {/* Header */}
        <header className="header">
          <div className="brand-wrapper">
            <span className="brand-flag" role="img" aria-label="Nigeria">🇳🇬</span>
            <div>
              <h1 className="brand-title">NaijaAlias</h1>
              <p className="brand-subtitle">
                Authentic Nigerian Identity & SimpleLogin Aliases
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowVercelModal(true)}
              className="btn btn-secondary btn-sm"
              title="Vercel Deployment Guide"
            >
              <Globe size={14} /> Host on Vercel
            </button>

            <div className="header-status-pill">
              <span className={`status-dot ${status?.connected ? '' : 'disconnected'}`} />
              <span className="status-account-email">
                {status?.account?.email || 'SimpleLogin Free Tier'}
              </span>
              <span className="plan-badge">
                {status?.account?.isPremium ? 'PRO' : 'FREE (10 MAX)'}
              </span>
              <button
                onClick={refreshData}
                disabled={loading}
                className="copy-btn"
                title="Sync with SimpleLogin"
                style={{ marginLeft: '4px' }}
              >
                <RefreshCw size={14} className={loading ? 'spin' : ''} />
              </button>
            </div>
          </div>
        </header>

        {/* Dashboard Metrics */}
        <section className="dashboard-metrics">
          <div className="metric-card">
            <div className="metric-label">
              <span>Active Quota</span>
              <ShieldCheck size={16} color="var(--emerald)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge">{activeCount}</span>
              <span className="metric-value-sub">/ {quotaMax} Spots In Use</span>
            </div>
            <div className="quota-bar-track">
              <div
                className={`quota-bar-fill ${activeCount >= 10 ? 'full' : activeCount >= 7 ? 'warning' : ''}`}
                style={{ width: `${quotaPercent}%` }}
              />
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">
              <span>Available Slots</span>
              <Zap size={16} color="var(--cyan)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: availableSlots > 0 ? 'var(--cyan)' : 'var(--rose)' }}>
                {availableSlots}
              </span>
              <span className="metric-value-sub">Ready to allocate</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
              SimpleLogin Free Plan limit: 10 active aliases
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">
              <span>Historical Creations</span>
              <Database size={16} color="var(--violet)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#c4b5fd' }}>
                {status?.stats?.totalHistoricalCreated || 0}
              </span>
              <span className="metric-value-sub">Unique Identities</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
              Duplicate prevention: Zero re-created names
            </div>
          </div>

          <div className="metric-card">
            <div className="metric-label">
              <span>Nigerian Name Bank</span>
              <Layers size={16} color="var(--amber)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#fde68a' }}>
                {status?.stats?.namePools?.totalFirstNames ? `${status.stats.namePools.totalFirstNames}+` : '1,400+'}
              </span>
              <span className="metric-value-sub">Yoruba • Igbo • Edo • Common</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
              {status?.stats?.namePools?.uniqueCombinations?.toLocaleString() || '1,000,000+'} possible pairs
            </div>
          </div>
        </section>

        {/* Generator Controls Panel */}
        <section className="glass-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <Sparkles size={20} color="var(--emerald)" />
              Alias Generator Controls
            </h2>

            <div className="panel-actions">
              {activeCount > 0 && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="btn btn-danger btn-sm"
                  title="Delete all active aliases to reset your 10 free spots"
                >
                  <Trash2 size={14} />
                  Flush All ({activeCount}) & Reset Quota
                </button>
              )}
            </div>
          </div>

          <div className="gen-grid">
            <div className="form-group">
              <label className="form-label">Cultural Heritage</label>
              <select
                className="form-select"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                <option value="all">🇳🇬 All Nigerian Cultures (Balanced)</option>
                <option value="yoruba">👑 Yoruba Heritage</option>
                <option value="igbo">🦅 Igbo Heritage</option>
                <option value="edo">⚔️ Edo (Benin) Heritage</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Quantity to Generate</label>
              <div className="pill-group">
                {[1, 3, 5].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`count-pill ${count === num ? 'active' : ''}`}
                    onClick={() => setCount(num)}
                  >
                    +{num}
                  </button>
                ))}
                <button
                  type="button"
                  className={`count-pill ${count === 10 ? 'active' : ''}`}
                  onClick={() => setCount(10)}
                >
                  10
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Custom Label / Prefix (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Work, Crypto, Shopping"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="btn-row">
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating || availableSlots <= 0}
              className="btn btn-primary"
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="spin" /> Generating...
                </>
              ) : (
                <>
                  <Plus size={16} /> Generate {count} Alias{count > 1 ? 'es' : ''}
                </>
              )}
            </button>

            {availableSlots > 0 && availableSlots <= 10 && (
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="btn btn-fill"
                title="Automatically generate aliases to fill remaining quota"
              >
                <Zap size={16} /> Auto-Fill All {availableSlots} Remaining Spot{availableSlots > 1 ? 's' : ''}
              </button>
            )}

            <button
              onClick={() => {
                setActiveTab('preview');
                fetchPreview();
              }}
              className="btn btn-secondary"
            >
              <Clock size={16} /> Preview Names Offline
            </button>

            {availableSlots <= 0 && (
              <span style={{ fontSize: '13px', color: 'var(--rose)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <AlertCircle size={15} /> Quota Full (10/10). Delete existing aliases below to free up space.
              </span>
            )}
          </div>

          {rateLimitMessage && (
            <div className="rate-limit-banner">
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>SimpleLogin Rate Limit Reached (5 aliases/min):</strong> {rateLimitMessage}
                <div style={{ marginTop: '4px', fontSize: '12px', opacity: 0.9 }}>
                  Wait approx 60 seconds, then you can click <strong>Auto-Fill</strong> to complete the rest!
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Tabs & Content */}
        <div className="tabs-nav">
          <button
            className={`tab-btn ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <Mail size={16} /> Active Aliases ({aliases.length})
          </button>
          <button
            className={`tab-btn ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Sparkles size={16} /> Offline Name Preview
          </button>
          <button
            className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FileSpreadsheet size={16} /> Historical Ledger & CSV
          </button>
        </div>

        {/* TAB 1: Active Aliases */}
        {activeTab === 'active' && (
          <div>
            {aliases.length === 0 ? (
              <div className="empty-state">
                <Mail className="empty-icon" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  No Active Aliases Found
                </h3>
                <p style={{ maxWidth: '440px', margin: '0 auto 20px auto', fontSize: '14px', lineHeight: 1.5 }}>
                  You currently have all 10 free spots available on your SimpleLogin plan. Use the generator controls above to create authentic Nigerian email aliases!
                </p>
                <button
                  onClick={() => handleGenerate(true)}
                  disabled={generating}
                  className="btn btn-primary"
                >
                  <Zap size={16} /> Generate 10 Fresh Aliases Now
                </button>
              </div>
            ) : (
              <div className="alias-grid">
                {aliases.map((item, index) => {
                  const initials = item.full_name
                    ? item.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'NA';
                  const catClass = (item.category || 'common').toLowerCase();

                  return (
                    <div key={item.id || index} className="alias-card">
                      <div>
                        <div className="card-top">
                          <div className="card-identity">
                            <div className="avatar-circle">{initials}</div>
                            <div>
                              <div className="alias-name">{item.full_name}</div>
                              <span className={`category-tag ${catClass}`}>
                                {item.category || 'Nigerian'}
                              </span>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteSingle(item.id, item.alias)}
                            disabled={deletingId === item.id}
                            className="copy-btn"
                            title="Delete this alias on SimpleLogin"
                            style={{ color: 'var(--rose)' }}
                          >
                            {deletingId === item.id ? (
                              <RefreshCw size={15} className="spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </div>

                        <div className="email-copy-box">
                          <span className="email-text" title={item.alias}>
                            {item.alias}
                          </span>
                          <button
                            onClick={() => copyToClipboard(item.alias)}
                            className={`copy-btn ${copiedEmail === item.alias ? 'copied' : ''}`}
                            title="Copy email alias"
                          >
                            {copiedEmail === item.alias ? (
                              <Check size={16} />
                            ) : (
                              <Copy size={16} />
                            )}
                          </button>
                        </div>
                      </div>

                      <div className="card-footer">
                        <span>Forwards to: {item.forward_to || 'Primary Mailbox'}</span>
                        <span>{item.nb_forward ? `${item.nb_forward} received` : '0 forwards'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Offline Name Preview */}
        {activeTab === 'preview' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Upcoming Simulated Identifiers</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  Preview authentic Nigerian names and suggested slugs before consuming SimpleLogin quota.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => fetchPreview()}
                  disabled={loadingPreview}
                  className="btn btn-secondary btn-sm"
                >
                  <RefreshCw size={13} className={loadingPreview ? 'spin' : ''} /> Roll New Names
                </button>
              </div>
            </div>

            <div className="history-table-wrapper">
              <table className="history-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Full Name</th>
                    <th>First Name</th>
                    <th>Last Name</th>
                    <th>Proposed Alias Email</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {previewList.map((p, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.fullName}</td>
                      <td>{p.firstName}</td>
                      <td>{p.lastName}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', color: '#a7f3d0' }}>
                        {p.suggestedEmail}
                      </td>
                      <td>
                        <button
                          onClick={() => copyToClipboard(p.suggestedEmail)}
                          className="copy-btn"
                          title="Copy email"
                        >
                          <Copy size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: Historical Ledger */}
        {activeTab === 'history' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Historical Uniqueness Ledger</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  All historically generated names and aliases are saved here so they are never recreated in future batches.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '8px' }}>
                <a
                  href="/api/history?format=csv"
                  download
                  className="btn btn-primary btn-sm"
                >
                  <FileSpreadsheet size={14} /> Export All as CSV
                </a>
              </div>
            </div>

            {history.length === 0 ? (
              <p style={{ color: 'var(--text-dim)', textAlign: 'center', padding: '40px 0' }}>
                No history recorded yet. Aliases created will appear here permanently.
              </p>
            ) : (
              <div className="history-table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Full Name</th>
                      <th>Email Alias</th>
                      <th>Category</th>
                      <th>Created At</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{h.full_name}</td>
                        <td style={{ fontFamily: 'var(--font-mono)', color: '#a7f3d0' }}>
                          {h.alias}
                        </td>
                        <td>
                          <span className={`category-tag ${(h.category || 'common').toLowerCase()}`}>
                            {h.category || 'Nigerian'}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          {h.created_at ? new Date(h.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td>
                          <button
                            onClick={() => copyToClipboard(h.alias)}
                            className="copy-btn"
                            title="Copy email"
                          >
                            <Copy size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Toast Feedback */}
        {toast && (
          <div className={`toast ${toast.type === 'error' ? 'error' : ''}`}>
            {toast.type === 'error' ? (
              <AlertCircle size={18} color="var(--rose)" />
            ) : (
              <CheckCircle2 size={18} color="var(--emerald)" />
            )}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Delete All Modal */}
        {showDeleteAllModal && (
          <div className="modal-overlay" onClick={() => !deletingAll && setShowDeleteAllModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <h3 className="modal-title" style={{ color: 'var(--rose)' }}>
                <Trash2 size={20} />
                Delete All Active Aliases?
              </h3>
              <p className="modal-desc">
                This will delete all <strong>{activeCount}</strong> active aliases currently on your SimpleLogin account, freeing up all 10 spots for fresh creations.
                <br /><br />
                <span style={{ color: 'var(--emerald)' }}>
                  ✓ All used Nigerian names remain stored in your history ledger so they will NOT be duplicated in your next batch.
                </span>
              </p>

              <div className="modal-actions">
                <button
                  onClick={() => setShowDeleteAllModal(false)}
                  disabled={deletingAll}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="btn btn-danger"
                >
                  {deletingAll ? (
                    <>
                      <RefreshCw size={15} className="spin" /> Deleting from SimpleLogin...
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} /> Yes, Delete All & Reset Quota
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Vercel Hosting Modal */}
        {showVercelModal && (
          <div className="modal-overlay" onClick={() => setShowVercelModal(false)}>
            <div className="modal-content" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <h3 className="modal-title">
                  <Globe size={20} color="var(--cyan)" />
                  How to Host on Vercel
                </h3>
                <button onClick={() => setShowVercelModal(false)} className="copy-btn">
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
                <p style={{ marginBottom: '12px' }}>
                  This web application is 100% serverless-ready for Vercel. All SimpleLogin API requests and file operations execute cleanly within serverless functions.
                </p>

                <div style={{ background: 'rgba(0,0,0,0.4)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: '14px' }}>
                  <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                    1. Push to GitHub:
                  </div>
                  <code style={{ fontFamily: 'var(--font-mono)', color: 'var(--emerald)', fontSize: '12px' }}>
                    git push origin main
                  </code>

                  <div style={{ fontWeight: 700, color: 'var(--text-main)', margin: '12px 0 6px 0' }}>
                    2. Import into Vercel:
                  </div>
                  <p>Go to <a href="https://vercel.com/new" target="_blank" rel="noreferrer" style={{ color: 'var(--cyan)' }}>vercel.com/new</a> and select this repository.</p>

                  <div style={{ fontWeight: 700, color: 'var(--text-main)', margin: '12px 0 6px 0' }}>
                    3. Add Environment Variable:
                  </div>
                  <p>In Vercel Project Settings &rarr; <strong>Environment Variables</strong>, add:</p>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.05)', padding: '6px 10px', borderRadius: '4px', marginTop: '4px' }}>
                    <code style={{ fontFamily: 'var(--font-mono)', color: '#fde68a' }}>SIMPLELOGIN_API_KEY</code>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>your SimpleLogin token</span>
                  </div>
                </div>

                <p style={{ color: 'var(--emerald)' }}>
                  ✓ After deploying, your custom domain or <code>.vercel.app</code> URL will let you manage, generate, and delete aliases directly from any device!
                </p>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button onClick={() => setShowVercelModal(false)} className="btn btn-primary">
                  Got It!
                </button>
              </div>
            </div>
          </div>
        )}

      </div>

      <style jsx global>{`
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
