import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Campaign, DashboardStats } from '../types';

export function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.getCampaigns(),
      api.getDashboardStats(),
    ])
      .then(([campaignsData, statsData]) => {
        setCampaigns(campaignsData);
        setStats(statsData);
      })
      .catch(() => setError('Veriler yüklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="loading">Yükleniyor...</div>;
  }

  return (
    <div className="dashboard">
      <div className="page-header">
        <h2>Dashboard</h2>
        <Link to="/campaigns/new" className="btn btn-primary">
          + Yeni Kampanya
        </Link>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Campaign Status Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats?.totalCampaigns ?? 0}</div>
          <div className="stat-label">Toplam Kampanya</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.activeCampaigns ?? 0}</div>
          <div className="stat-label">Aktif</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.completedCampaigns ?? 0}</div>
          <div className="stat-label">Tamamlanan</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.draftCampaigns ?? 0}</div>
          <div className="stat-label">Taslak</div>
        </div>
      </div>

      {/* Email & Engagement Stats */}
      <div className="stats-grid" style={{ marginTop: '1rem' }}>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalRecipients ?? 0}</div>
          <div className="stat-label">Toplam Alici</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats?.totalEmailsSent ?? 0}</div>
          <div className="stat-label">Gonderilen E-posta</div>
        </div>
        <div className="stat-card highlight-warning">
          <div className="stat-value">{stats?.totalClicks ?? 0}</div>
          <div className="stat-label">Tiklama ({(stats?.overallClickRate ?? 0).toFixed(1)}%)</div>
        </div>
        <div className="stat-card highlight-danger">
          <div className="stat-value">{stats?.totalSubmissions ?? 0}</div>
          <div className="stat-label">Form Gonderimi ({(stats?.overallSubmitRate ?? 0).toFixed(1)}%)</div>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="section">
        <h3>Son Kampanyalar</h3>
        {campaigns.length === 0 ? (
          <p className="empty-state">Henuz kampanya olusturulmamis.</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Kampanya Adi</th>
                <th>Durum</th>
                <th>Sablon</th>
                <th>Domain</th>
                <th>Olusturulma</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {campaigns.slice(0, 5).map(campaign => (
                <tr key={campaign.id}>
                  <td>
                    <Link to={`/campaigns/${campaign.id}`}>{campaign.name}</Link>
                  </td>
                  <td>
                    <span className={`badge badge-${campaign.status}`}>
                      {campaign.status === 'draft' && 'Taslak'}
                      {campaign.status === 'active' && 'Aktif'}
                      {campaign.status === 'completed' && 'Tamamlandi'}
                      {campaign.status === 'paused' && 'Duraklatildi'}
                    </span>
                  </td>
                  <td>{campaign.templateMode === 'specific' ? 'Belirli' : 'Rastgele'}</td>
                  <td>{campaign.phishDomain || '-'}</td>
                  <td>{new Date(campaign.createdAt).toLocaleDateString('tr-TR')}</td>
                  <td>
                    <Link to={`/campaigns/${campaign.id}`} className="btn btn-sm">
                      Detay
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
