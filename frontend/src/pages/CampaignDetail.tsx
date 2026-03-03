import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { CampaignDetail as CampaignDetailType, Recipient, LdapSyncResult } from '../types';

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetailType | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<LdapSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchCampaign = async () => {
    if (!id) return;
    try {
      const data = await api.getCampaign(id);
      setCampaign(data);
    } catch {
      setError('Kampanya yuklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipients = async () => {
    if (!id) return;
    try {
      const data = await api.getRecipients(id);
      setRecipients(data);
    } catch {
      console.error('Failed to fetch recipients');
    }
  };

  useEffect(() => {
    fetchCampaign();
    fetchRecipients();
  }, [id]);

  // --- LDAP Sync ---
  const handleSync = async () => {
    if (!id) return;
    setSyncLoading(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await api.syncLdapUsers(id);
      setSyncResult(result);
      await fetchRecipients();
      await fetchCampaign();
    } catch {
      setError('LDAP senkronizasyonu basarisiz oldu');
    } finally {
      setSyncLoading(false);
    }
  };

  // --- Campaign Actions ---
  const handleStart = async () => {
    if (!id) return;
    if (recipients.length === 0) {
      setError('Kampanyayi baslatmadan once alici eklemelisiniz (LDAP Senkronize)');
      return;
    }
    setActionLoading(true);
    setError(null);
    try {
      await api.startCampaign(id);
      await fetchCampaign();
      await fetchRecipients();
    } catch {
      setError('Kampanya baslatilamadi');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePause = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.pauseCampaign(id);
      await fetchCampaign();
    } catch {
      setError('Kampanya duraklattilamadi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResume = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.resumeCampaign(id);
      await fetchCampaign();
    } catch {
      setError('Kampanya devam ettirilemedi');
    } finally {
      setActionLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!id) return;
    setActionLoading(true);
    try {
      await api.completeCampaign(id);
      await fetchCampaign();
    } catch {
      setError('Kampanya tamamlanamadi');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Yukleniyor...</div>;
  }

  if (!campaign) {
    return (
      <div className="error-page">
        <h2>Hata</h2>
        <p>{error || 'Kampanya bulunamadi'}</p>
        <Link to="/campaigns" className="btn">Geri Don</Link>
      </div>
    );
  }

  const { stats } = campaign;

  return (
    <div className="campaign-detail">
      <div className="page-header">
        <div>
          <Link to="/campaigns" className="back-link">&larr; Kampanyalar</Link>
          <h2>{campaign.name}</h2>
          <p className="text-muted">{campaign.description}</p>
        </div>
        <div className="action-buttons">
          {campaign.status === 'draft' && (
            <button className="btn btn-primary" onClick={handleStart} disabled={actionLoading}>
              {actionLoading ? 'Baslatiliyor...' : 'Kampanyayi Baslat'}
            </button>
          )}
          {campaign.status === 'active' && (
            <>
              <button className="btn btn-secondary" onClick={handlePause} disabled={actionLoading}>
                {actionLoading ? 'Isleniyor...' : 'Duraktat'}
              </button>
              <button className="btn btn-primary" onClick={handleComplete} disabled={actionLoading}>
                Tamamla
              </button>
            </>
          )}
          {campaign.status === 'paused' && (
            <>
              <button className="btn btn-primary" onClick={handleResume} disabled={actionLoading}>
                {actionLoading ? 'Isleniyor...' : 'Devam Et'}
              </button>
              <button className="btn btn-secondary" onClick={handleComplete} disabled={actionLoading}>
                Tamamla
              </button>
            </>
          )}
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Campaign Meta */}
      <div className="campaign-meta">
        <span className={`badge badge-${campaign.status}`}>
          {campaign.status === 'draft' && 'Taslak'}
          {campaign.status === 'active' && 'Aktif'}
          {campaign.status === 'completed' && 'Tamamlandi'}
          {campaign.status === 'paused' && 'Duraklatildi'}
        </span>
        <span>Sablon: {campaign.templateMode === 'specific' ? 'Belirli' : 'Rastgele'}</span>
        <span>Domain: {campaign.phishDomain || '-'}</span>
        <span>Olusturulma: {new Date(campaign.createdAt).toLocaleString('tr-TR')}</span>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalTargets}</div>
          <div className="stat-label">Toplam Hedef</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.emailsSent}</div>
          <div className="stat-label">Gonderilen E-posta</div>
        </div>
        <div className="stat-card highlight-warning">
          <div className="stat-value">{stats.clicked}</div>
          <div className="stat-label">Tiklama ({stats.clickRate.toFixed(1)}%)</div>
        </div>
        <div className="stat-card highlight-danger">
          <div className="stat-value">{stats.submitted}</div>
          <div className="stat-label">Form Gonderimi ({stats.submitRate.toFixed(1)}%)</div>
        </div>
      </div>

      {/* Recipients Section with LDAP Sync */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3>Alicilar ({recipients.length})</h3>
          {campaign.status === 'draft' && (
            <button
              className="btn btn-primary"
              onClick={handleSync}
              disabled={syncLoading}
            >
              {syncLoading ? 'Senkronize ediliyor...' : 'LDAP Senkronize Et'}
            </button>
          )}
        </div>

        {/* Sync Result Banner */}
        {syncResult && (
          <div className="alert" style={{
            background: syncResult.errors > 0 ? '#fff3cd' : '#d4edda',
            border: `1px solid ${syncResult.errors > 0 ? '#ffc107' : '#28a745'}`,
            color: '#333',
            padding: '12px 16px',
            borderRadius: '4px',
            marginBottom: '1rem',
          }}>
            LDAP Senkronizasyonu: {syncResult.synced} eklendi, {syncResult.skipped} atlandi, {syncResult.errors} hata
          </div>
        )}

        {recipients.length === 0 ? (
          <div className="empty-state" style={{ padding: '2rem', textAlign: 'center', background: '#f8f9fa', borderRadius: '8px' }}>
            <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Henuz alici eklenmemis.</p>
            {campaign.status === 'draft' && (
              <p style={{ color: '#666' }}>
                Kampanyayi baslatmadan once "LDAP Senkronize Et" butonuna tiklayarak
                LDAP dizininden alicilari iceri aktarin.
              </p>
            )}
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>E-posta</th>
                <th>Ad</th>
                <th>Soyad</th>
                <th>Durum</th>
                <th>Gonderim Zamani</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map(r => (
                <tr key={r.id}>
                  <td>{r.email}</td>
                  <td>{r.firstName}</td>
                  <td>{r.lastName}</td>
                  <td>
                    <span className={`badge badge-${r.status}`}>
                      {r.status === 'pending' && 'Bekliyor'}
                      {r.status === 'sent' && 'Gonderildi'}
                      {r.status === 'clicked' && 'Tikladi'}
                      {r.status === 'submitted' && 'Form Gonderdi'}
                      {r.status === 'failed' && 'Basarisiz'}
                    </span>
                  </td>
                  <td>{r.sentAt ? new Date(r.sentAt).toLocaleString('tr-TR') : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Event History */}
      <div className="section">
        <h3>Etkinlik Gecmisi</h3>
        {campaign.events.length === 0 ? (
          <p className="empty-state">Henuz etkinlik kaydedilmemis.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Tur</th>
                <th>Alici Token</th>
              </tr>
            </thead>
            <tbody>
              {campaign.events.map(event => (
                <tr key={event.id}>
                  <td>{new Date(event.createdAt).toLocaleString('tr-TR')}</td>
                  <td>
                    <span className={`badge badge-${event.type}`}>
                      {event.type === 'clicked' && 'Tiklandi'}
                      {event.type === 'submitted' && 'Gonderildi'}
                    </span>
                  </td>
                  <td className="text-mono">{event.recipientToken}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
