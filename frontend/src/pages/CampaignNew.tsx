import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { api } from '../api';
import type { Frequency, SendingMode, EmailTemplate, LandingPage } from '../types';

const CATEGORIES = [
  { value: 'it', label: 'IT' },
  { value: 'hr', label: 'HR' },
  { value: 'finance', label: 'Finans' },
  { value: 'general', label: 'Genel' },
];

const DOMAINS = [
  { value: 'random', label: '-- Rastgele --' },
  { value: 'secure-login.com', label: 'secure-login.com' },
  { value: 'account-verify.net', label: 'account-verify.net' },
  { value: 'mail-update.org', label: 'mail-update.org' },
];

const WEEKDAYS = [
  { value: 'sun', label: 'Paz' },
  { value: 'mon', label: 'Pzt' },
  { value: 'tue', label: 'Sal' },
  { value: 'wed', label: 'Çar' },
  { value: 'thu', label: 'Per' },
  { value: 'fri', label: 'Cum' },
  { value: 'sat', label: 'Cmt' },
];

export function CampaignNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);

  const [form, setForm] = useState({
    name: '',
    targetGroupId: '',
    frequency: 'once' as Frequency,
    startDate: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    timezone: 'Europe/Istanbul',
    sendingMode: 'all' as SendingMode,
    spreadDays: 3,
    spreadUnit: 'days' as 'hours' | 'days',
    businessHoursStart: '09:00',
    businessHoursEnd: '17:00',
    businessDays: ['mon', 'tue', 'wed', 'thu', 'fri'],
    trackActivityDays: 7,
    category: 'it',
    templateMode: 'random' as 'random' | 'specific',
    templateId: '',
    phishDomain: 'random',
    landingPageId: '',
    addClickersToGroup: '',
    sendReportEmail: true,
  });

  const updateForm = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesData, landingPagesData] = await Promise.all([
          api.getTemplates(),
          api.getLandingPages(),
        ]);
        setTemplates(templatesData);
        setLandingPages(landingPagesData);

        // Pre-select landing page from URL parameter if provided
        const landingPageId = searchParams.get('landingPageId');
        if (landingPageId) {
          updateForm('landingPageId', landingPageId);
        }

        // Pre-select template from URL parameter if provided
        const templateId = searchParams.get('templateId');
        if (templateId) {
          updateForm('templateMode', 'specific');
          updateForm('templateId', templateId);
        }
      } catch (err) {
        console.error('Failed to fetch data:', err);
      }
    };
    fetchData();
  }, [searchParams]);

  const toggleBusinessDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      businessDays: prev.businessDays.includes(day)
        ? prev.businessDays.filter(d => d !== day)
        : [...prev.businessDays, day],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Kampanya adı gerekli');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const campaign = await api.createCampaign({
        name: form.name,
        description: '',
        targetCount: 0,
        frequency: form.frequency,
        startDate: form.startDate,
        startTime: form.startTime,
        timezone: form.timezone,
        sendingMode: form.sendingMode,
        spreadDays: form.spreadDays,
        spreadUnit: form.spreadUnit,
        businessHoursStart: form.businessHoursStart,
        businessHoursEnd: form.businessHoursEnd,
        businessDays: form.businessDays,
        trackActivityDays: form.trackActivityDays,
        category: form.category,
        templateMode: form.templateMode,
        templateId: form.templateMode === 'specific' ? form.templateId : undefined,
        phishDomain: form.phishDomain,
        landingPageId: form.landingPageId || undefined,
        addClickersToGroup: form.addClickersToGroup || undefined,
        sendReportEmail: form.sendReportEmail,
      });
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      setError('Kampanya oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="campaign-new-page">
      <div className="page-header">
        <div>
          <h2>Yeni Phishing Kampanyası Oluştur</h2>
        </div>
        <Link to="/campaigns" className="btn btn-secondary">
          ← Kampanyalara Dön
        </Link>
      </div>

      <div className="info-banner">
        <span className="info-icon">ℹ</span>
        Kampanya aktive edildikten veya oluşturulduktan 10 dakika sonra başlayacaktır.
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form onSubmit={handleSubmit} className="campaign-form">
        {/* Temel Bilgiler */}
        <div className="form-section">
          <h3 className="section-title">Temel Bilgiler</h3>

          <div className="form-row">
            <label>Kampanya Adı *</label>
            <input
              type="text"
              value={form.name}
              onChange={e => updateForm('name', e.target.value)}
              placeholder="Örn: Q1 2024 Güvenlik Farkındalık Testi"
              disabled={loading}
            />
          </div>

          <div className="form-row">
            <label>Hedef Grup</label>
            <select
              value={form.targetGroupId}
              onChange={e => updateForm('targetGroupId', e.target.value)}
              disabled={loading}
            >
              <option value="">-- Kullanıcı Grubu Seçin --</option>
              <option value="all">Tüm Kullanıcılar</option>
              <option value="it">IT Departmanı</option>
              <option value="hr">İnsan Kaynakları</option>
              <option value="finance">Finans</option>
              <option value="management">Yönetim</option>
            </select>
          </div>
        </div>

        {/* Zamanlama */}
        <div className="form-section">
          <h3 className="section-title">Zamanlama</h3>

          <div className="form-row">
            <label>Sıklık</label>
            <div className="radio-group">
              {[
                { value: 'once', label: 'Tek Seferlik' },
                { value: 'weekly', label: 'Haftalık' },
                { value: 'biweekly', label: '2 Haftalık' },
                { value: 'monthly', label: 'Aylık' },
                { value: 'quarterly', label: '3 Aylık' },
              ].map(opt => (
                <label key={opt.value} className="radio-label">
                  <input
                    type="radio"
                    name="frequency"
                    value={opt.value}
                    checked={form.frequency === opt.value}
                    onChange={e => updateForm('frequency', e.target.value as Frequency)}
                    disabled={loading}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div className="form-row">
            <label>Başlangıç Zamanı</label>
            <div className="input-group-row">
              <input
                type="date"
                value={form.startDate}
                onChange={e => updateForm('startDate', e.target.value)}
                disabled={loading}
              />
              <input
                type="time"
                value={form.startTime}
                onChange={e => updateForm('startTime', e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {/* Gönderim Ayarları */}
        <div className="form-section">
          <h3 className="section-title">Gönderim Ayarları</h3>

          <div className="form-row">
            <label>Gönderim Modu</label>
            <div className="radio-group vertical">
              <label className="radio-label">
                <input
                  type="radio"
                  name="sendingMode"
                  value="all"
                  checked={form.sendingMode === 'all'}
                  onChange={() => updateForm('sendingMode', 'all')}
                  disabled={loading}
                />
                Kampanya başladığında tüm e-postaları gönder
              </label>
              <label className="radio-label">
                <input
                  type="radio"
                  name="sendingMode"
                  value="spread"
                  checked={form.sendingMode === 'spread'}
                  onChange={() => updateForm('sendingMode', 'spread')}
                  disabled={loading}
                />
                <span>E-postaları</span>
                <input
                  type="number"
                  className="inline-input"
                  value={form.spreadDays}
                  onChange={e => updateForm('spreadDays', parseInt(e.target.value) || 1)}
                  min={1}
                  max={30}
                  disabled={loading || form.sendingMode !== 'spread'}
                />
                <select
                  className="inline-select"
                  value={form.spreadUnit}
                  onChange={e => updateForm('spreadUnit', e.target.value as 'hours' | 'days')}
                  disabled={loading || form.sendingMode !== 'spread'}
                >
                  <option value="hours">saat</option>
                  <option value="days">iş günü</option>
                </select>
                <span>içinde yay</span>
              </label>
            </div>
          </div>

          {form.sendingMode === 'spread' && (
            <div className="form-row nested">
              <label>Çalışma Saatleri</label>
              <div className="business-hours">
                <div className="time-range">
                  <input
                    type="time"
                    value={form.businessHoursStart}
                    onChange={e => updateForm('businessHoursStart', e.target.value)}
                    disabled={loading}
                  />
                  <span>-</span>
                  <input
                    type="time"
                    value={form.businessHoursEnd}
                    onChange={e => updateForm('businessHoursEnd', e.target.value)}
                    disabled={loading}
                  />
                </div>
                <div className="weekday-picker">
                  {WEEKDAYS.map(day => (
                    <label key={day.value} className={`weekday ${form.businessDays.includes(day.value) ? 'active' : ''}`}>
                      <input
                        type="checkbox"
                        checked={form.businessDays.includes(day.value)}
                        onChange={() => toggleBusinessDay(day.value)}
                        disabled={loading}
                      />
                      {day.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div className="form-row">
            <label>Aktivite Takip Süresi</label>
            <div className="inline-field">
              <input
                type="number"
                className="small-input"
                value={form.trackActivityDays}
                onChange={e => updateForm('trackActivityDays', parseInt(e.target.value) || 1)}
                min={1}
                max={90}
                disabled={loading}
              />
              <span>gün (gönderim tamamlandıktan sonra)</span>
            </div>
          </div>
        </div>

        {/* E-posta İçeriği */}
        <div className="form-section">
          <h3 className="section-title">E-posta İçeriği</h3>

          <div className="form-row">
            <label>Kategori</label>
            <div className="category-select">
              <select
                value={form.category}
                onChange={e => updateForm('category', e.target.value)}
                disabled={loading}
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.value} value={cat.value}>{cat.label}</option>
                ))}
              </select>
              <select
                value={form.templateMode}
                onChange={e => updateForm('templateMode', e.target.value as 'random' | 'specific')}
                disabled={loading}
              >
                <option value="random">-- Rastgele Şablon (her kullanıcıya farklı) --</option>
                <option value="specific">-- Belirli Şablon Seç --</option>
              </select>
              <button type="button" className="btn btn-sm btn-outline">
                Önizleme
              </button>
            </div>
          </div>

          {form.templateMode === 'specific' && (
            <div className="form-row">
              <label>E-posta Şablonu</label>
              <select
                value={form.templateId}
                onChange={e => updateForm('templateId', e.target.value)}
                disabled={loading}
              >
                <option value="">-- Şablon Seçin --</option>
                {templates.map(template => (
                  <option key={template.id} value={template.id}>
                    {template.name} {template.isDefault ? '(Varsayılan)' : ''}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Phishing Ayarları */}
        <div className="form-section">
          <h3 className="section-title">Phishing Ayarları</h3>

          <div className="form-row">
            <label>Phish Link Domain</label>
            <select
              value={form.phishDomain}
              onChange={e => updateForm('phishDomain', e.target.value)}
              disabled={loading}
            >
              {DOMAINS.map(d => (
                <option key={d.value} value={d.value}>{d.label}</option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Landing Page</label>
            <select
              value={form.landingPageId}
              onChange={e => updateForm('landingPageId', e.target.value)}
              disabled={loading}
            >
              <option value="">-- Landing Page Seçin --</option>
              {landingPages.map(lp => (
                <option key={lp.id} value={lp.id}>
                  {lp.name} {lp.isDefault ? '(Varsayılan)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <label>Tıklayanları Gruba Ekle</label>
            <select
              value={form.addClickersToGroup}
              onChange={e => updateForm('addClickersToGroup', e.target.value)}
              disabled={loading}
            >
              <option value="">-- Grup Seçin --</option>
              <option value="clicked">Tıklayanlar</option>
              <option value="risk">Riskli Kullanıcılar</option>
              <option value="training">Eğitim Gerekli</option>
            </select>
          </div>
        </div>

        {/* Raporlama */}
        <div className="form-section">
          <h3 className="section-title">Raporlama</h3>

          <div className="form-row">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={form.sendReportEmail}
                onChange={e => updateForm('sendReportEmail', e.target.checked)}
                disabled={loading}
              />
              Her Phishing Güvenlik Testinden sonra yöneticilere e-posta raporu gönder
            </label>
          </div>
        </div>

        {/* Submit */}
        <div className="form-actions">
          <Link to="/campaigns" className="btn btn-secondary">
            İptal
          </Link>
          <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
            {loading ? 'Oluşturuluyor...' : 'Kampanya Oluştur'}
          </button>
        </div>
      </form>
    </div>
  );
}
