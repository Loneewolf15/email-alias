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
  Filter,
  Eye,
  Globe,
  Radio,
  FileText,
  Code
} from 'lucide-react';

export default function Dashboard() {
  const [status, setStatus] = useState(null);
  const [aliases, setAliases] = useState([]);
  const [history, setHistory] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);

  // Selected Provider Filter & Form Provider
  // 'all' | 'inbox' | 'simplelogin' | 'addy'
  const [selectedProvider, setSelectedProvider] = useState('all');
  const [generatorProvider, setGeneratorProvider] = useState('inbox'); // default to Direct In-App Inbox

  // Form State
  const [count, setCount] = useState(1);
  const [category, setCategory] = useState('all');
  const [label, setLabel] = useState('');
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'inbox' | 'preview' | 'history'

  // Per-Alias Mailbox & Direct In-App Content Reader States
  const [selectedAliasForMails, setSelectedAliasForMails] = useState(null);
  const [aliasInboxMessages, setAliasInboxMessages] = useState([]);
  const [loadingAliasMails, setLoadingAliasMails] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [viewBodyMode, setViewBodyMode] = useState('html'); // 'html' | 'text'

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
        fetch(`/api/aliases?provider=${selectedProvider}`),
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
      }
    } catch (err) {
      console.error('Fetch error:', err);
      showToast('Failed to sync with alias services', 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedProvider]);

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

  // Open per-alias mailbox drawer & load messages
  const handleOpenAliasMailbox = async (aliasItem) => {
    setSelectedAliasForMails(aliasItem);
    setAliasInboxMessages([]);
    setLoadingAliasMails(true);

    try {
      const res = await fetch(`/api/messages?aliasId=${encodeURIComponent(aliasItem.id)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.provider === 'inbox') {
          setAliasInboxMessages(data.messages || []);
        } else if (data.provider === 'simplelogin') {
          setAliasInboxMessages(data.activities || []);
        }
      }
    } catch (err) {
      console.error('Error fetching mailbox for alias:', err);
    } finally {
      setLoadingAliasMails(false);
    }
  };

  // Open specific message and load full body
  const handleOpenMessage = async (msg, aliasItem) => {
    if (aliasItem.provider === 'inbox') {
      try {
        const res = await fetch(`/api/messages?aliasId=${encodeURIComponent(aliasItem.id)}&messageId=${encodeURIComponent(msg.id)}`);
        if (res.ok) {
          const data = await res.json();
          setSelectedEmail({
            ...msg,
            fullDetails: data.message,
            aliasName: aliasItem.full_name,
            aliasEmail: aliasItem.alias,
            provider: 'inbox'
          });
          return;
        }
      } catch (e) {
        console.error('Error fetching full message:', e);
      }
    }

    // Default for SimpleLogin relay activities
    setSelectedEmail({
      ...msg,
      aliasName: aliasItem.full_name,
      aliasEmail: aliasItem.alias,
      provider: aliasItem.provider
    });
  };

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
          count: fillRemaining ? 10 : count,
          category,
          label,
          provider: generatorProvider,
          fillRemaining
        })
      });

      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to generate aliases', 'error');
        return;
      }

      if (data.createdCount > 0) {
        showToast(`Created ${data.createdCount} new alias(es) on ${generatorProvider.toUpperCase()}!`);
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
  const handleDeleteSingle = async (item) => {
    if (!window.confirm(`Delete alias ${item.alias}?`)) {
      return;
    }
    setDeletingId(item.id);
    try {
      const res = await fetch(`/api/aliases?id=${encodeURIComponent(item.id)}&provider=${encodeURIComponent(item.provider || 'simplelogin')}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`Deleted ${item.alias}`);
        setAliases(prev => prev.filter(a => a.id !== item.id));
        if (selectedAliasForMails?.id === item.id) {
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
      const res = await fetch(`/api/aliases?all=true&provider=${encodeURIComponent(selectedProvider)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || 'Aliases deleted successfully.');
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

  // Provider Stats
  const inboxInfo = status?.providers?.inbox;
  const slInfo = status?.providers?.simplelogin;
  const addyInfo = status?.providers?.addy;
  const totalHistorical = status?.stats?.totalHistoricalCreated || 0;

  // Active counts
  const inboxActive = aliases.filter(a => a.provider === 'inbox').length;
  const slActive = aliases.filter(a => a.provider === 'simplelogin').length;
  const addyActive = aliases.filter(a => a.provider === 'addy').length;

  return (
    <>
      <div className="bg-grid" />
      <div className="container">
        {/* Header with Multi-Provider Indicator */}
        <header className="header">
          <div className="brand-wrapper">
            <span className="brand-flag" role="img" aria-label="Nigeria">🇳🇬</span>
            <div>
              <h1 className="brand-title">NaijaAlias</h1>
              <p className="brand-subtitle">
                Nigerian Identity &bull; Direct In-App Inbox &bull; SimpleLogin &bull; addy.io
              </p>
            </div>
          </div>

          {/* Provider Destination Chips (Apple Glass Style) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* In-App Direct Chip */}
            <div className="mailbox-target-pill" title="Read full email bodies directly in-app with zero custom domain">
              <div className="mailbox-icon-wrap" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                <Eye size={13} />
              </div>
              <div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                  In-App Direct Reader
                </div>
                <div className="mailbox-target-address" style={{ fontSize: '11px', color: '#34d399' }}>
                  Direct HTML Body &bull; 0 Domain Needed
                </div>
              </div>
              <span className="provider-badge inbox" style={{ fontSize: '9px', padding: '2px 6px' }}>
                Instant
              </span>
            </div>

            {/* SimpleLogin Chip */}
            <div className="mailbox-target-pill" title="SimpleLogin Relay">
              <div className="mailbox-icon-wrap" style={{ background: 'rgba(139, 92, 246, 0.15)', color: '#c4b5fd' }}>
                <Shield size={13} />
              </div>
              <div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                  SimpleLogin Relay
                </div>
                <div className="mailbox-target-address" style={{ fontSize: '11px' }}>
                  loneewolf15@protonmail.com
                </div>
              </div>
              <span className="provider-badge simplelogin" style={{ fontSize: '9px', padding: '2px 6px' }}>
                10 Free
              </span>
            </div>

            {/* addy.io Chip */}
            <div className="mailbox-target-pill" title="addy.io Relay (Limit Booster)">
              <div className="mailbox-icon-wrap" style={{ background: 'rgba(245, 158, 11, 0.15)', color: '#fde68a' }}>
                <Zap size={13} />
              </div>
              <div>
                <div style={{ fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.04em' }}>
                  addy.io Booster
                </div>
                <div className="mailbox-target-address" style={{ fontSize: '11px' }}>
                  anonymoux7x@gmail.com
                </div>
              </div>
              <span className="provider-badge addy" style={{ fontSize: '9px', padding: '2px 6px' }}>
                +20/Day
              </span>
            </div>

            <button
              onClick={refreshData}
              disabled={loading}
              className="copy-btn"
              title="Sync all providers"
              style={{ padding: '8px' }}
            >
              <RefreshCw size={14} className={loading ? 'spin' : ''} />
            </button>
          </div>
        </header>

        {/* Dashboard Metrics (4 Core Engines) */}
        <section className="dashboard-metrics">
          {/* Card 1: Direct In-App Inbox */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', borderTop: '2px solid rgba(16, 185, 129, 0.5)' }}
            onClick={() => { setSelectedProvider('inbox'); setGeneratorProvider('inbox'); }}
          >
            <div className="metric-label">
              <span>Direct In-App Inbox</span>
              <span className="provider-badge inbox">Direct Body</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#34d399' }}>{inboxActive}</span>
              <span className="metric-value-sub">Active Inboxes</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span>Read complete HTML/text inside app &bull; Zero domain required</span>
            </div>
          </div>

          {/* Card 2: SimpleLogin Quota */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', borderTop: '2px solid rgba(139, 92, 246, 0.5)' }}
            onClick={() => { setSelectedProvider('simplelogin'); setGeneratorProvider('simplelogin'); }}
          >
            <div className="metric-label">
              <span>SimpleLogin Relay</span>
              <span className="provider-badge simplelogin">ProtonMail</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#c4b5fd' }}>{slInfo?.activeCount || slActive}</span>
              <span className="metric-value-sub">/ {slInfo?.quotaMax || 10} Slots</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
              Forwards to loneewolf15@protonmail.com
            </div>
          </div>

          {/* Card 3: addy.io Quota (Limit Booster) */}
          <div
            className="metric-card"
            style={{ cursor: 'pointer', borderTop: '2px solid rgba(245, 158, 11, 0.5)' }}
            onClick={() => { setSelectedProvider('addy'); setGeneratorProvider('addy'); }}
          >
            <div className="metric-label">
              <span>addy.io Booster</span>
              <span className="provider-badge addy">+20 Aliases</span>
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#fde68a' }}>{addyInfo?.activeCount || addyActive}</span>
              <span className="metric-value-sub">/ 20+ Active</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
              Forwards to anonymoux7x@gmail.com
            </div>
          </div>

          {/* Card 4: Historical Uniqueness */}
          <div className="metric-card">
            <div className="metric-label">
              <span>Historical Ledger</span>
              <Layers size={16} color="var(--cyan)" />
            </div>
            <div className="metric-value-row">
              <span className="metric-value-huge" style={{ color: '#67e8f9' }}>{totalHistorical}</span>
              <span className="metric-value-sub">Identities Tracked</span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '12px' }}>
              Zero duplicate combinations ever recreated
            </div>
          </div>
        </section>

        {/* Generator Controls Panel */}
        <section className="glass-panel">
          <div className="panel-header">
            <h2 className="panel-title">
              <Sparkles size={20} color="var(--emerald)" />
              Generate Nigerian Aliases
            </h2>

            <div className="panel-actions">
              {aliases.length > 0 && (
                <button
                  onClick={() => setShowDeleteAllModal(true)}
                  className="btn btn-danger btn-sm"
                  title="Flush aliases to reset quota"
                >
                  <Trash2 size={14} />
                  Flush ({aliases.length}) &amp; Reset
                </button>
              )}
            </div>
          </div>

          {/* Choose Generator Engine */}
          <div style={{ marginBottom: '16px' }}>
            <label className="form-label" style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Radio size={14} color="var(--emerald)" /> Select Target Engine:
            </label>
            <div className="provider-selector-bar">
              <button
                type="button"
                className={`provider-btn-pill ${generatorProvider === 'inbox' ? 'active inbox' : ''}`}
                onClick={() => setGeneratorProvider('inbox')}
              >
                <Eye size={13} />
                <span>📬 In-App Direct Inbox (Full Body Reader &bull; No Domain)</span>
              </button>

              <button
                type="button"
                className={`provider-btn-pill ${generatorProvider === 'simplelogin' ? 'active simplelogin' : ''}`}
                onClick={() => setGeneratorProvider('simplelogin')}
              >
                <Shield size={13} />
                <span>🔒 SimpleLogin (Relay to ProtonMail &bull; 10 Limit)</span>
              </button>

              <button
                type="button"
                className={`provider-btn-pill ${generatorProvider === 'addy' ? 'active addy' : ''}`}
                onClick={() => setGeneratorProvider('addy')}
              >
                <Zap size={13} />
                <span>⚡ addy.io (Relay to Gmail &bull; +20 Limit Booster)</span>
              </button>
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
                {[1, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    className={`count-pill ${count === num ? 'active' : ''}`}
                    onClick={() => setCount(num)}
                  >
                    +{num}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Custom Tag / Note (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Work, Shopping, Crypto"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
              />
            </div>
          </div>

          <div className="btn-row">
            <button
              onClick={() => handleGenerate(false)}
              disabled={generating}
              className="btn btn-primary"
            >
              {generating ? (
                <>
                  <RefreshCw size={16} className="spin" /> Generating...
                </>
              ) : (
                <>
                  <Plus size={16} /> Generate {count} Alias{count > 1 ? 'es' : ''} on {generatorProvider.toUpperCase()}
                </>
              )}
            </button>

            {generatorProvider === 'simplelogin' && (slInfo?.availableSlots || 0) > 0 && (
              <button
                onClick={() => handleGenerate(true)}
                disabled={generating}
                className="btn btn-fill"
                title="Fill remaining SimpleLogin slots"
              >
                <Zap size={16} /> Fill Remaining {slInfo.availableSlots} SimpleLogin Spots
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
          </div>

          {rateLimitMessage && (
            <div className="rate-limit-banner">
              <AlertCircle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Rate Limit Notice:</strong> {rateLimitMessage}
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
            <span>Relayed Log</span>
            <span className="tab-count-pill">{activities.length}</span>
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

        {/* TAB 1: Active Aliases Board (with Provider Filter) */}
        {activeTab === 'active' && (
          <div>
            {/* Filter by Provider Pills */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
              <div className="provider-selector-bar" style={{ margin: 0 }}>
                <button
                  className={`provider-btn-pill ${selectedProvider === 'all' ? 'active' : ''}`}
                  onClick={() => setSelectedProvider('all')}
                >
                  <Globe size={13} />
                  <span>All Providers ({aliases.length})</span>
                </button>
                <button
                  className={`provider-btn-pill ${selectedProvider === 'inbox' ? 'active inbox' : ''}`}
                  onClick={() => setSelectedProvider('inbox')}
                >
                  <Eye size={13} />
                  <span>In-App Inbox ({inboxActive})</span>
                </button>
                <button
                  className={`provider-btn-pill ${selectedProvider === 'simplelogin' ? 'active simplelogin' : ''}`}
                  onClick={() => setSelectedProvider('simplelogin')}
                >
                  <Shield size={13} />
                  <span>SimpleLogin ({slActive})</span>
                </button>
                <button
                  className={`provider-btn-pill ${selectedProvider === 'addy' ? 'active addy' : ''}`}
                  onClick={() => setSelectedProvider('addy')}
                >
                  <Zap size={13} />
                  <span>addy.io ({addyActive})</span>
                </button>
              </div>

              <div style={{ fontSize: '13px', color: 'var(--text-dim)' }}>
                Showing <strong>{aliases.length}</strong> active alias{aliases.length === 1 ? '' : 'es'}
              </div>
            </div>

            {aliases.length === 0 ? (
              <div className="empty-state">
                <Mail className="empty-icon" />
                <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '8px' }}>
                  No Active Aliases for {selectedProvider.toUpperCase()}
                </h3>
                <p style={{ maxWidth: '440px', margin: '0 auto 20px auto', fontSize: '14px', lineHeight: 1.5 }}>
                  Use the generator controls above to create authentic Nigerian email aliases on your chosen engine!
                </p>
                <button
                  onClick={() => handleGenerate(false)}
                  disabled={generating}
                  className="btn btn-primary"
                >
                  <Plus size={16} /> Generate Aliases Now
                </button>
              </div>
            ) : (
              <div className="alias-grid">
                {aliases.map((item, index) => {
                  const initials = item.full_name
                    ? item.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                    : 'NA';
                  const catClass = (item.category || 'common').toLowerCase();
                  const isInbox = item.provider === 'inbox';
                  const isSimpleLogin = item.provider === 'simplelogin';
                  const isAddy = item.provider === 'addy';

                  return (
                    <div key={item.id || index} className="alias-card">
                      <div>
                        <div className="card-top">
                          <div className="card-identity">
                            <div className="avatar-circle">{initials}</div>
                            <div>
                              <div className="alias-name">{item.full_name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }}>
                                <span className={`category-tag ${catClass}`}>
                                  {item.category || 'Nigerian'}
                                </span>
                                <span className={`provider-badge ${item.provider || 'simplelogin'}`}>
                                  {isInbox ? 'Direct In-App' : isAddy ? 'addy.io' : 'SimpleLogin'}
                                </span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteSingle(item)}
                            disabled={deletingId === item.id}
                            className="copy-btn"
                            title="Delete this alias"
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
                        {isInbox ? (
                          <button
                            onClick={() => handleOpenAliasMailbox(item)}
                            className="received-count-badge has-mails"
                            style={{ cursor: 'pointer', border: '1px solid rgba(16, 185, 129, 0.4)' }}
                            title="Open direct in-app email reader for this alias"
                          >
                            <Eye size={13} />
                            <span>Read Full Mails (In-App)</span>
                            <ChevronRight size={13} style={{ marginLeft: '2px', opacity: 0.8 }} />
                          </button>
                        ) : isSimpleLogin ? (
                          <button
                            onClick={() => handleOpenAliasMailbox(item)}
                            className={`received-count-badge ${item.nb_forward > 0 ? 'has-mails' : ''}`}
                            style={{ cursor: 'pointer' }}
                            title="View forwarding details & ProtonMail jump"
                          >
                            <Inbox size={13} />
                            <span>{item.nb_forward || 0} Delivered to Proton</span>
                            <ChevronRight size={13} style={{ marginLeft: '2px', opacity: 0.8 }} />
                          </button>
                        ) : (
                          <div className="received-count-badge">
                            <Zap size={13} />
                            <span>{item.nb_forward || 0} Delivered to Gmail</span>
                          </div>
                        )}

                        <button
                          onClick={() => handleOpenAliasMailbox(item)}
                          className="view-mails-btn"
                          title={`Open isolated mailbox for ${item.full_name}`}
                        >
                          <span>{isInbox ? 'Read Inbox' : 'Details'}</span>
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

        {/* TAB 2: Relayed Mail Feed / SimpleLogin Log */}
        {activeTab === 'inbox' && (
          <div className="glass-panel" style={{ padding: '24px' }}>
            <div className="feed-header-banner">
              <div className="feed-header-left">
                <div className="feed-icon-circle">
                  <Inbox size={22} />
                </div>
                <div>
                  <div className="feed-title">
                    Relayed Messages Activity Feed
                  </div>
                  <div className="feed-subtitle">
                    Real-time log of relayed emails forwarded through SimpleLogin to loneewolf15@protonmail.com.
                  </div>
                </div>
              </div>

              <button
                onClick={refreshData}
                disabled={loading}
                className="btn btn-secondary btn-sm"
              >
                <RefreshCw size={13} className={loading ? 'spin' : ''} /> Check Updates
              </button>
            </div>

            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-dim)' }}>
                <Inbox size={42} style={{ margin: '0 auto 12px auto', opacity: 0.4 }} />
                <h4 style={{ fontSize: '16px', color: 'var(--text-main)', marginBottom: '6px' }}>
                  No Relayed Messages Recorded Yet
                </h4>
                <p style={{ fontSize: '13px', maxWidth: '420px', margin: '0 auto' }}>
                  When someone sends an email to any of your active relay aliases, delivery details appear here instantly.
                </p>
              </div>
            ) : (
              <div className="activity-list">
                {activities.map((act, idx) => (
                  <div
                    key={idx}
                    className="activity-item"
                    style={{ cursor: 'pointer' }}
                    onClick={() => setSelectedEmail(act)}
                    title="Click to view delivery trace"
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
                  Preview authentic Nigerian names and proposed alias slugs before creating them.
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
                      <th>Provider</th>
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
                          <span className={`provider-badge ${h.provider || 'inbox'}`}>
                            {h.provider || 'inbox'}
                          </span>
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

        {/* MODAL 1: Per-Alias Isolated Mailbox Drawer (Direct In-App Reading) */}
        {selectedAliasForMails && (
          <div className="modal-overlay" onClick={() => setSelectedAliasForMails(null)}>
            <div className="mail-reader-sheet" onClick={(e) => e.stopPropagation()}>
              <div className="mail-reader-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div className="avatar-circle">
                    {selectedAliasForMails.full_name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                        {selectedAliasForMails.full_name}
                      </div>
                      <span className={`provider-badge ${selectedAliasForMails.provider || 'simplelogin'}`}>
                        {selectedAliasForMails.provider === 'inbox' ? 'Direct In-App' : selectedAliasForMails.provider === 'addy' ? 'addy.io' : 'SimpleLogin'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', fontFamily: 'var(--font-mono)', color: '#a7f3d0' }}>
                      {selectedAliasForMails.alias}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedAliasForMails.provider === 'simplelogin' && (
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
                  )}
                  <button
                    onClick={() => handleOpenAliasMailbox(selectedAliasForMails)}
                    className="copy-btn"
                    title="Refresh mailbox messages"
                  >
                    <RefreshCw size={14} className={loadingAliasMails ? 'spin' : ''} />
                  </button>
                  <button onClick={() => setSelectedAliasForMails(null)} className="copy-btn">
                    <X size={18} />
                  </button>
                </div>
              </div>

              <div className="mail-reader-body">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-dim)' }}>
                    Isolated Mailbox &bull; {aliasInboxMessages.length} {aliasInboxMessages.length === 1 ? 'Message' : 'Messages'}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--emerald)' }}>
                    {selectedAliasForMails.provider === 'inbox'
                      ? '✓ Direct In-App Reader Active (Click any mail to view full body)'
                      : selectedAliasForMails.provider === 'addy'
                      ? 'Forwarding to anonymoux7x@gmail.com'
                      : 'Forwarding to loneewolf15@protonmail.com'}
                  </div>
                </div>

                {loadingAliasMails ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                    <RefreshCw size={24} className="spin" style={{ margin: '0 auto 10px auto' }} />
                    <p>Checking incoming messages for this alias...</p>
                  </div>
                ) : aliasInboxMessages.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-dim)' }}>
                    <Inbox size={38} style={{ margin: '0 auto 10px auto', opacity: 0.3 }} />
                    <h4 style={{ color: 'var(--text-main)', fontSize: '15px', marginBottom: '4px' }}>
                      No Messages for this Alias Yet
                    </h4>
                    <p style={{ fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
                      Emails sent to <strong>{selectedAliasForMails.alias}</strong> will appear here instantly.
                    </p>
                  </div>
                ) : (
                  <div className="activity-list">
                    {aliasInboxMessages.map((msg, idx) => (
                      <div
                        key={idx}
                        className="activity-item"
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleOpenMessage(msg, selectedAliasForMails)}
                      >
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700 }}>
                              From:
                            </span>
                            <span className="activity-from-pill">
                              {msg.from || msg.mail_from}
                            </span>
                          </div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                            {msg.subject || msg.mail_subject || 'No Subject'}
                          </div>
                          {msg.excerpt && (
                            <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', maxWidth: '480px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {msg.excerpt}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {msg.date || 'Recent'}
                          </span>
                          <span className="btn btn-secondary btn-sm" style={{ padding: '4px 10px', fontSize: '11px' }}>
                            Read Full Body
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

        {/* MODAL 2: Full Email Content Reader (With Complete HTML / Plaintext Body) */}
        {selectedEmail && (
          <div className="modal-overlay" onClick={() => setSelectedEmail(null)}>
            <div className="mail-reader-sheet" style={{ maxWidth: '820px' }} onClick={(e) => e.stopPropagation()}>
              <div className="mail-reader-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Inbox size={18} color="var(--cyan)" />
                  <span style={{ fontSize: '15px', fontWeight: 700 }}>
                    {selectedEmail.subject || selectedEmail.mail_subject || 'Message Details'}
                  </span>
                </div>
                <button onClick={() => setSelectedEmail(null)} className="copy-btn">
                  <X size={18} />
                </button>
              </div>

              <div className="mail-reader-body">
                {/* Email Metadata Grid */}
                <div className="email-subject-box">
                  <div className="email-subject-title">
                    {selectedEmail.subject || selectedEmail.mail_subject || 'No Subject'}
                  </div>

                  <div className="email-meta-grid">
                    <div className="email-meta-item">
                      <span className="email-meta-label">From</span>
                      <span className="email-meta-val">{selectedEmail.from || selectedEmail.mail_from}</span>
                    </div>

                    <div className="email-meta-item">
                      <span className="email-meta-label">Recipient Alias</span>
                      <span className="email-meta-val">
                        {selectedEmail.aliasName} ({selectedEmail.aliasEmail || selectedEmail.to})
                      </span>
                    </div>

                    <div className="email-meta-item">
                      <span className="email-meta-label">Engine</span>
                      <span className="email-meta-val" style={{ textTransform: 'uppercase' }}>
                        {selectedEmail.provider || 'inbox'}
                      </span>
                    </div>

                    <div className="email-meta-item">
                      <span className="email-meta-label">Date &amp; Time</span>
                      <span className="email-meta-val">
                        {selectedEmail.date || (selectedEmail.timestamp ? new Date(selectedEmail.timestamp * 1000).toLocaleString() : 'Recent')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Direct In-App HTML Body Render */}
                {selectedEmail.provider === 'inbox' && (selectedEmail.body || selectedEmail.fullDetails?.body) ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-dim)', fontWeight: 700, letterSpacing: '0.04em' }}>
                        Message Content (Read Directly In App):
                      </span>
                      <div className="pill-group" style={{ margin: 0 }}>
                        <button
                          type="button"
                          className={`count-pill ${viewBodyMode === 'html' ? 'active' : ''}`}
                          onClick={() => setViewBodyMode('html')}
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                        >
                          <Code size={11} /> Rich HTML
                        </button>
                        <button
                          type="button"
                          className={`count-pill ${viewBodyMode === 'text' ? 'active' : ''}`}
                          onClick={() => setViewBodyMode('text')}
                          style={{ padding: '2px 8px', fontSize: '11px' }}
                        >
                          <FileText size={11} /> Plain Text
                        </button>
                      </div>
                    </div>

                    {viewBodyMode === 'html' ? (
                      <div
                        className="html-body-container"
                        dangerouslySetInnerHTML={{
                          __html: selectedEmail.fullDetails?.body || selectedEmail.body
                        }}
                      />
                    ) : (
                      <div className="email-body-card">
                        <pre className="email-body-text">
                          {(selectedEmail.fullDetails?.body || selectedEmail.body || '').replace(/<[^>]*>?/gm, '')}
                        </pre>
                      </div>
                    )}
                  </div>
                ) : (
                  /* Relay Message Notice for SimpleLogin */
                  <div className="email-action-bar">
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
                        Relayed Message
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                        This message was encrypted and forwarded straight to your destination inbox.
                      </div>
                    </div>

                    {selectedEmail.provider === 'simplelogin' ? (
                      <a
                        href={`https://mail.proton.me/u/0/almost-all-mail#keyword=${encodeURIComponent((selectedEmail.to || selectedEmail.aliasEmail || '').split('@')[0])}`}
                        target="_blank"
                        rel="noreferrer"
                        className="proton-jump-btn"
                      >
                        <ExternalLink size={14} />
                        <span>Read Full Body in ProtonMail</span>
                      </a>
                    ) : (
                      <a
                        href="https://mail.google.com"
                        target="_blank"
                        rel="noreferrer"
                        className="proton-jump-btn"
                        style={{ background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)' }}
                      >
                        <ExternalLink size={14} />
                        <span>Open Gmail</span>
                      </a>
                    )}
                  </div>
                )}
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
                Flush &amp; Reset Aliases?
              </h3>
              <p className="modal-desc">
                This will delete active aliases from <strong>{selectedProvider.toUpperCase()}</strong>, freeing up slots for fresh batches.
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
                      <RefreshCw size={15} className="spin" /> Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 size={15} /> Yes, Flush &amp; Reset
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
