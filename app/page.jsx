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
  FileSpreadsheet,
  Zap,
  CheckCircle2,
  Clock,
  Layers,
  Inbox,
  ArrowUpRight,
  Shield,
  Send,
  X,
  ExternalLink,
  ChevronRight,
  User,
  Filter
} from 'lucide-react';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [history, setHistory] = useState([]);
  const [activities, setActivities] = useState([]);
  const [activityStats, setActivityStats] = useState({ totalForwarded: 0, destinationMailbox: 'loneewolf15@protonmail.com' });
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  // Form State
  const [count, setCount] = useState(1);
  const [category, setCategory] = useState('all');
  const [label, setLabel] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'inbox' | 'preview' | 'history'

  // Per-Alias Mailbox & Content Reader States
  const [selectedAliasForMails, setSelectedAliasForMails] = useState(null);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [aliasFilterId, setAliasFilterId] = useState('all');

  // Previews
  const [previewList, setPreviewList] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Feedback & Alerts
  const [toast, setToast] = useState(null);
  const [copiedEmail, setCopiedEmail] = useState(null);
  const [rateLimitMessage, setRateLimitMessage] = useState(null);
  const [showDeleteAllModal, setShowDeleteAllModal] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedEmail(text);
    showToast(`Copied ${text} to clipboard!`);
    setTimeout(() => setCopiedEmail(null), 2500);
  };

  // Fetch status, aliases, and live forwarded activities
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const [statusRes, aliasesRes, activitiesRes] = await Promise.all([
        fetch('/api/status'),
        fetch('/api/aliases'),
        fetch('/api/activities')
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData);
      }
      if (aliasesRes.ok) {
        const aData = await aliasesRes.json();
        setAliases(aData.aliases || []);
      }
      if (activitiesRes.ok) {
        const actData = await activitiesRes.json();
        setActivities(actData.activities || []);
        setActivityStats({
          totalForwarded: actData.totalForwarded || 0,
          destinationMailbox: actData.destinationMailbox || 'loneewolf15@protonmail.com'
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Failed to sync with SimpleLogin server', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

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
    } else if (activeTab === 'inbox') {
      refreshData();
    }
  }, [activeTab, fetchHistory, fetchPreview, refreshData]);

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
        showToast(`Created ${data.createdCount} new alias(es)!`);
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
        if (selectedAliasForMails?.id === id) {
          setSelectedAliasForMails(null);
        }
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
        setSelectedAliasForMails(null);
        setSelectedEmail(null);
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
  const totalMailsForwarded = aliases.reduce((acc, a) => acc + (a.nb_forward || 0), 0);

  // Filter activities for global tab
  const filteredActivities = aliasFilterId === 'all'
    ? activities
    : activities.filter(a => a.aliasId === aliasFilterId || a.aliasEmail === aliasFilterId);

  // Activities strictly for selectedAliasForMails modal
  const aliasSpecificActivities = selectedAliasForMails
    ? activities.filter(a => (
        String(a.aliasId) === String(selectedAliasForMails.id) ||
        (a.aliasEmail && a.aliasEmail.toLowerCase() === selectedAliasForMails.alias.toLowerCase()) ||
        (a.to && a.to.toLowerCase() === selectedAliasForMails.alias.toLowerCase())
      ))
    : [];

  return (
    <>
      <div className="bg-grid" />
      <div className="container">
        {/* Header with Destination Mailbox Indicator */}
        <header className="header">
          <div className="brand-wrapper">
            <span className="brand-flag" role="img" aria-label="Nigeria">🇳🇬</span>
            <div>
              <h1 className="brand-title">NaijaAlias</h1>
              <p className="brand-subtitle">
                Nigerian Identity & SimpleLogin Aliases
              </p>
            </div>
          </div>

          {/* Primary Mailbox Route (Apple-style Translucent Chrome) */}
          <div className="mailbox-target-pill">
            <div className="mailbox-icon-wrap" title="Primary Destination Mailbox">
              <Shield size={14} />
            </div>
            <div>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                Forwarding Destination
              </div>
              <div className="mailbox-target-address">
                loneewolf15@protonmail.com
              </div>
            </div>
            <span className="mailbox-verified-badge">
              ✓ Active
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
        </header>

        {/* Dashboard Top Metrics */}
        <section className="dashboard-metrics">
          {/* Metric 1: Active Quota */}
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

          {/* Metric 2: Mails Forwarded (Elevated) */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer' }}
            onClick={() => setActiveTab('inbox')}
            title="Click to view all forwarded emails"
          >
            <div className="metric-label">
              <span>Mails Forwarded</span>
              <Inbox size={16} color="var(--cyan)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: totalMailsForwarded > 0 ? '#67e8f9' : 'var(--text-main)' }}>
                {totalMailsForwarded}
              </span>
              <span className="metric-value-sub">Delivered to loneewolf15</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--cyan)', marginTop: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>View live forwarded log</span>
              <ArrowUpRight size={13} />
            </div>
          </div>

          {/* Metric 3: Available Spots */}
          <div className="metric-card">
            <div className="metric-label">
              <span>Available Slots</span>
              <Zap size={16} color="var(--amber)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: availableSlots > 0 ? '#fde68a' : 'var(--rose)' }}>
                {availableSlots}
              </span>
              <span className="metric-value-sub">Ready to allocate</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
              Free Tier limit: 10 active aliases
            </div>
          </div>

          {/* Metric 4: Historical Uniqueness */}
          <div className="metric-card">
            <div className="metric-label">
              <span>Unique Identities</span>
              <Layers size={16} color="var(--violet)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#c4b5fd' }}>
                {status?.stats?.totalHistoricalCreated || 0}
              </span>
              <span className="metric-value-sub">Created across cycles</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px' }}>
              Zero duplicate combinations ever recreated
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
              <label className="form-label">Quantity</label>
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
                  Wait approx 60 seconds, then click <strong>Auto-Fill</strong> to complete the batch!
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Konsta UI / iOS Segmented Tabs */}
        <div className="segmented-tabs-wrapper">
          <button
            className={`segmented-tab ${activeTab === 'active' ? 'active' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            <Mail size={15} />
            <span>Active Aliases</span>
            <span className="tab-count-pill">{aliases.length}</span>
          </button>

          <button
            className={`segmented-tab ${activeTab === 'inbox' ? 'active' : ''}`}
            onClick={() => setActiveTab('inbox')}
          >
            <Inbox size={15} />
            <span>Forwarded Mails Log</span>
            <span className="tab-count-pill" style={{ background: totalMailsForwarded > 0 ? 'rgba(6, 182, 212, 0.2)' : undefined, color: totalMailsForwarded > 0 ? '#67e8f9' : undefined }}>
              {totalMailsForwarded}
            </span>
          </button>

          <button
            className={`segmented-tab ${activeTab === 'preview' ? 'active' : ''}`}
            onClick={() => setActiveTab('preview')}
          >
            <Sparkles size={15} />
            <span>Offline Preview</span>
          </button>

          <button
            className={`segmented-tab ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <FileSpreadsheet size={15} />
            <span>Historical Ledger</span>
          </button>
        </div>

        {/* TAB 1: Active Aliases Board */}
        {activeTab === 'active' && (
          <div>
            {aliases.length === 0 ? (
              <div className="empty-state">
                <Mail className="empty-icon" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  No Active Aliases Found
                </h3>
                <p style={{ maxWidth: '440px', margin: '0 auto 20px auto', fontSize: '14px', lineHeight: 1.5 }}>
                  You currently have all 10 free spots available on SimpleLogin. Use the generator controls above to create authentic Nigerian email aliases!
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
                  const forwards = item.nb_forward || 0;

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

                      {/* Card Footer: Per-Alias Mailbox Trigger */}
                      <div className="card-footer-clean">
                        <button
                          onClick={() => setSelectedAliasForMails(item)}
                          className={`received-count-badge ${forwards > 0 ? 'has-mails' : ''}`}
                          style={{ cursor: 'pointer', border: forwards > 0 ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-subtle)' }}
                          title={`Click to open isolated mailbox for ${item.full_name}`}
                        >
                          <Inbox size={13} />
                          <span>{forwards === 1 ? '1 Mail Received' : `${forwards} Mails Received`}</span>
                          {forwards > 0 && <ChevronRight size={13} style={{ marginLeft: '2px', opacity: 0.8 }} />}
                        </button>

                        <button
                          onClick={() => setSelectedAliasForMails(item)}
                          className="view-mails-btn"
                          title={`Preview mails for ${item.full_name}`}
                        >
                          <span>{forwards > 0 ? 'Open Mailbox' : 'Mailbox'}</span>
                          <ArrowUpRight size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Forwarded Mail Feed / Live Inbox (With Per-Alias Filter) */}
        {activeTab === 'inbox' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="feed-header-banner">
              <div className="feed-header-left">
                <div className="feed-icon-circle">
                  <Inbox size={22} />
                </div>
                <div>
                  <div className="feed-title">
                    Emails Forwarded to loneewolf15@protonmail.com
                  </div>
                  <div className="feed-subtitle">
                    Real-time log of messages received by your Nigerian aliases and delivered straight to your Proton mailbox.
                  </div>
                </div>
              </div>

              <button
                onClick={refreshData}
                disabled={loading}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Check New Mails
              </button>
            </div>

            {/* Per-Alias Filter Bar (Konsta UI Segmented Filter) */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Filter size={12} /> Filter by Alias:
              </div>
              <div className="alias-filter-bar">
                <button
                  className={`alias-filter-pill ${aliasFilterId === 'all' ? 'active' : ''}`}
                  onClick={() => setAliasFilterId('all')}
                >
                  All Aliases ({activities.length})
                </button>
                {aliases.map(a => {
                  const countForAlias = activities.filter(act => String(act.aliasId) === String(a.id) || act.aliasEmail === a.alias).length;
                  return (
                    <button
                      key={a.id}
                      className={`alias-filter-pill ${aliasFilterId === a.id ? 'active' : ''}`}
                      onClick={() => setAliasFilterId(a.id)}
                    >
                      <span>{a.full_name}</span>
                      <span style={{ fontSize: '10px', opacity: 0.8 }}>({countForAlias})</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {filteredActivities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-dim)' }}>
                <Inbox size={42} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <h4 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '6px' }}>
                  No Mails Found for this Selection
                </h4>
                <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
                  {aliasFilterId === 'all'
                    ? 'When someone sends an email to any of your active Nigerian aliases, SimpleLogin forwards it to loneewolf15@protonmail.com and records the delivery details here!'
                    : 'This specific alias has not received any forwarded messages yet.'}
                </p>
              </div>
            ) : (
              <div className="activity-list">
                {filteredActivities.map((act, idx) => (
                  <div
                    key={idx}
                    className="activity-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEmail(act)}
                    title="Click to view full mail contents and reply"
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '6px' }}>
                        <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 600 }}>
                          From:
                        </span>
                        <span className="activity-from-pill">
                          {act.from}
                        </span>
                      </div>

                      <div className="activity-to-alias">
                        <span>Received by:</span>
                        <strong style={{ color: 'var(--text-main)' }}>{act.aliasName}</strong>
                        <span style={{ fontFamily: 'var(--font-mono)', color: '#a7f3d0' }}>({act.to || act.aliasEmail})</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className="activity-delivery-tag">
                          <Check size={12} />
                          Delivered to loneewolf15
                        </span>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          {act.timestamp ? new Date(act.timestamp * 1000).toLocaleString() : 'Recent'}
                        </span>
                      </div>
                      <ChevronRight size={16} color="var(--text-dim)" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: Offline Name Preview */}
        {activeTab === 'preview' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Upcoming Simulated Identifiers</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  Preview authentic Nigerian names and proposed alias slugs before creating them on SimpleLogin.
                </p>
              </div>

              <button
                onClick={() => fetchPreview()}
                disabled={loadingPreview}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw size={13} className={loadingPreview ? 'spin' : ''} /> Roll New Names
              </button>
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

        {/* TAB 4: Historical Ledger */}
        {activeTab === 'history' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ fontSize: '17px', fontWeight: 700 }}>Historical Uniqueness Ledger</h3>
                <p style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                  All historically generated names and aliases are saved here so they are never recreated in future batches.
                </p>
              </div>

              <a
                href="/api/history?format=csv"
                download
                className="btn btn-primary btn-sm"
              >
                <FileSpreadsheet size={14} /> Export All as CSV
              </a>
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

        {/* MODAL 1: Per-Alias Isolated Mailbox Drawer (Apple Design Sheet) */}
        {selectedAliasForMails && (
          <div className="modal-overlay" onClick={() => setSelectedAliasForMails(null)}>
            <div className="mail-reader-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="mail-reader-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="avatar-circle">
                    {selectedAliasForMails.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                      {selectedAliasForMails.full_name}
                    </div>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#a7f3d0' }}>
                      {selectedAliasForMails.alias}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <a
                    href={`https://mail.proton.me/u/0/almost-all-mail#keyword=${encodeURIComponent(selectedAliasForMails.alias.split('@')[0])}`}
                    target="_blank"
                    rel="noreferrer"
                    className="proton-jump-btn"
                    title="Search and read this alias in ProtonMail"
                  >
                    <ExternalLink size={13} />
                    <span>Open in Proton</span>
                  </a>
                  <button onClick={() => setSelectedAliasForMails(null)} className="copy-btn">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="mail-reader-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)' }}>
                    Isolated Mailbox &bull; {aliasSpecificActivities.length} {aliasSpecificActivities.length === 1 ? 'Message' : 'Messages'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--emerald)' }}>
                    Routing to loneewolf15@protonmail.com
                  </div>
                </div>

                {aliasSpecificActivities.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                    <Inbox size={38} style={{ margin: '0 auto 10px auto', opacity: 0.3 }} />
                    <h4 style={{ color: 'var(--text-main)', fontSize: '15px', marginBottom: '4px' }}>
                      No Messages for this Alias
                    </h4>
                    <p style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
                      Emails sent to <strong>{selectedAliasForMails.alias}</strong> will appear here exclusively.
                    </p>
                  </div>
                ) : (
                  <div className="activity-list">
                    {aliasSpecificActivities.map((act, idx) => (
                      <div
                        key={idx}
                        className="activity-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedEmail({ ...act, aliasName: selectedAliasForMails.full_name, aliasEmail: selectedAliasForMails.alias })}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                              From:
                            </span>
                            <span className="activity-from-pill">
                              {act.from}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            Received via SimpleLogin Relay
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {act.timestamp ? new Date(act.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                          </span>
                          <span className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '11px' }}>
                            Read Contents
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* MODAL 2: Full Email Content Reader */}
        {selectedEmail && (
          <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
            <div className="mail-reader-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="mail-reader-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Inbox size={18} color="var(--cyan)" />
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>Email Content &amp; Delivery Trace</span>
                </div>
                <button onClick={() => setSelectedEmail(null)} className="copy-btn">
                  <X size={18} />
                </button>
              </div>

              <div className="mail-reader-body">
                {/* Subject Banner */}
                <div className="email-subject-box">
                  <div className="email-subject-title">
                    Message from {selectedEmail.from}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                    Delivered via SimpleLogin to your ProtonMail inbox
                  </div>

                  <div className="email-meta-grid">
                    <div className="email-meta-item">
                      <span className="email-meta-label">From</span>
                      <span className="email-meta-val" title={selectedEmail.from}>{selectedEmail.from}</span>
                    </div>

                    <div className="email-meta-item">
                      <span className="email-meta-label">To (Your Alias)</span>
                      <span className="email-meta-val" title={selectedEmail.to || selectedEmail.aliasEmail}>
                        {selectedEmail.aliasName} ({selectedEmail.to || selectedEmail.aliasEmail})
                      </span>
                    </div>

                    <div className="email-meta-item">
                      <span className="email-meta-label">Delivered To</span>
                      <span className="email-meta-val">loneewolf15@protonmail.com</span>
                    </div>

                    <div className="email-meta-item">
                      <span className="email-meta-label">Date &amp; Time</span>
                      <span className="email-meta-val">
                        {selectedEmail.timestamp ? new Date(selectedEmail.timestamp * 1000).toLocaleString() : 'Recent'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct Action Bar */}
                <div className="email-action-bar">
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                      Full Encrypted Message Payload
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                      The raw message was forwarded directly to your ProtonMail inbox.
                    </div>
                  </div>

                  <a
                    href={`https://mail.proton.me/u/0/almost-all-mail#keyword=${encodeURIComponent((selectedEmail.to || selectedEmail.aliasEmail || '').split('@')[0])}`}
                    target="_blank"
                    rel="noreferrer"
                    className="proton-jump-btn"
                  >
                    <ExternalLink size={14} />
                    <span>Read Full Body in ProtonMail</span>
                  </a>
                </div>

                {/* Anonymous Reverse-Alias Reply Box */}
                {selectedEmail.reverse_alias_address && (
                  <div>
                    <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.04em', marginBottom: '8px' }}>
                      Reply Privately Without Exposing Your Real Email:
                    </div>
                    <div className="reply-address-box">
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#67e8f9', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {selectedEmail.reverse_alias_address}
                      </span>
                      <a
                        href={`mailto:${selectedEmail.reverse_alias_address}`}
                        className="btn btn-secondary btn-sm"
                        style={{ gap: '6px' }}
                      >
                        <Send size={12} />
                        <span>Reply</span>
                      </a>
                    </div>
                  </div>
                )}

                {/* Educational Privacy Architecture Notice */}
                <div className="privacy-notice-box">
                  <strong>🔒 Zero-Retention Privacy Architecture:</strong> SimpleLogin functions strictly as an anonymous proxy relay. To protect your confidentiality, message bodies are encrypted on-the-fly and immediately passed to <code>loneewolf15@protonmail.com</code> without retaining copies on SimpleLogin cloud. Clicking <strong>Read Full Body in ProtonMail</strong> takes you right to the email.
                </div>
              </div>
            </div>
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
