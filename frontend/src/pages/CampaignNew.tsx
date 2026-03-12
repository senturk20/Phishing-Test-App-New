import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import {
  Card,
  Group,
  Text,
  Title,
  TextInput,
  Select,
  Button,
  Stack,
  Alert,
  Radio,
  Checkbox,
  NumberInput,
  SimpleGrid,
  Chip,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ArrowLeft,
  Rocket,
  Info,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../api';
import type { Frequency, SendingMode, EmailTemplate, LandingPage, LdapFaculty } from '../types';

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

const FACULTY_LABELS: Record<string, string> = {
  engineering: 'Muhendislik Fakultesi',
  humanities: 'Insan ve Toplum Bilimleri',
  rectorate: 'Rektorluk',
  all: 'Tum Fakulteler',
};

const WEEKDAYS = [
  { value: 'sun', label: 'Paz' },
  { value: 'mon', label: 'Pzt' },
  { value: 'tue', label: 'Sal' },
  { value: 'wed', label: 'Car' },
  { value: 'thu', label: 'Per' },
  { value: 'fri', label: 'Cum' },
  { value: 'sat', label: 'Cmt' },
];

const CLICKER_GROUPS = [
  { value: '', label: '-- Grup Secin --' },
  { value: 'clicked', label: 'Tiklayanlar' },
  { value: 'risk', label: 'Riskli Kullanicilar' },
  { value: 'training', label: 'Egitim Gerekli' },
];

export function CampaignNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [faculties, setFaculties] = useState<LdapFaculty[]>([]);

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
        const [templatesData, landingPagesData, facultiesData] = await Promise.all([
          api.getTemplates(),
          api.getLandingPages(),
          api.getLdapFaculties().catch(() => ({ faculties: [], total: 0 })),
        ]);
        setTemplates(templatesData);
        setLandingPages(landingPagesData);
        setFaculties(facultiesData.faculties);

        const landingPageId = searchParams.get('landingPageId');
        if (landingPageId) updateForm('landingPageId', landingPageId);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Kampanya adi gerekli');
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
      notifications.show({
        title: 'Basarili',
        message: 'Kampanya olusturuldu',
        color: 'cyberGreen',
      });
      navigate(`/campaigns/${campaign.id}`);
    } catch {
      setError('Kampanya olusturulamadi');
      notifications.show({
        title: 'Hata',
        message: 'Kampanya olusturulamadi',
        color: 'alertRed',
      });
    } finally {
      setLoading(false);
    }
  };

  const templateOptions = templates.map(t => ({
    value: t.id,
    label: `${t.name}${t.isDefault ? ' (Varsayilan)' : ''}`,
  }));

  const landingPageOptions = [
    { value: '', label: '-- Landing Page Secin --' },
    ...landingPages.map(lp => ({
      value: lp.id,
      label: `${lp.name}${lp.isDefault ? ' (Varsayilan)' : ''}`,
    })),
  ];

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} c="white">Yeni Phishing Kampanyasi</Title>
          <Text size="sm" c="dimmed">Kampanya ayarlarini yapilandirin</Text>
        </div>
        <Button
          component={Link}
          to="/campaigns"
          variant="subtle"
          color="electricBlue"
          leftSection={<ArrowLeft size={16} />}
        >
          Kampanyalara Don
        </Button>
      </Group>

      <Alert color="electricBlue" icon={<Info size={16} />} variant="light">
        Kampanya aktive edildikten veya olusturulduktan 10 dakika sonra baslayacaktir.
      </Alert>

      {error && (
        <Alert color="alertRed" icon={<AlertTriangle size={16} />}>
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">
          {/* Temel Bilgiler */}
          <Card>
            <Text fw={600} c="white" size="lg" mb="md">Temel Bilgiler</Text>
            <Stack gap="md">
              <TextInput
                label="Kampanya Adi"
                placeholder="Orn: Q1 2024 Guvenlik Farkindalik Testi"
                required
                value={form.name}
                onChange={e => updateForm('name', e.currentTarget.value)}
                disabled={loading}
              />
              <Select
                label="Hedef Fakulte / Departman"
                placeholder="-- Hedef Fakulte Secin --"
                data={[
                  { value: '', label: '-- Hedef Fakulte Secin --' },
                  { value: 'all', label: `Tum Fakulteler (${faculties.reduce((s, f) => s + f.count, 0)} kisi)` },
                  ...faculties.map(f => ({
                    value: f.name,
                    label: `${FACULTY_LABELS[f.name] || f.name} (${f.count} kisi)`,
                  })),
                ]}
                value={form.targetGroupId}
                onChange={v => updateForm('targetGroupId', v || '')}
                disabled={loading}
              />
            </Stack>
          </Card>

          {/* Zamanlama */}
          <Card>
            <Text fw={600} c="white" size="lg" mb="md">Zamanlama</Text>
            <Stack gap="md">
              <Radio.Group
                label="Siklik"
                value={form.frequency}
                onChange={v => updateForm('frequency', v as Frequency)}
              >
                <Group mt="xs" gap="md">
                  <Radio value="once" label="Tek Seferlik" disabled={loading} />
                  <Radio value="weekly" label="Haftalik" disabled={loading} />
                  <Radio value="biweekly" label="2 Haftalik" disabled={loading} />
                  <Radio value="monthly" label="Aylik" disabled={loading} />
                  <Radio value="quarterly" label="3 Aylik" disabled={loading} />
                </Group>
              </Radio.Group>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput
                  label="Baslangic Tarihi"
                  type="date"
                  value={form.startDate}
                  onChange={e => updateForm('startDate', e.currentTarget.value)}
                  disabled={loading}
                />
                <TextInput
                  label="Baslangic Saati"
                  type="time"
                  value={form.startTime}
                  onChange={e => updateForm('startTime', e.currentTarget.value)}
                  disabled={loading}
                />
              </SimpleGrid>
            </Stack>
          </Card>

          {/* Gonderim Ayarlari */}
          <Card>
            <Text fw={600} c="white" size="lg" mb="md">Gonderim Ayarlari</Text>
            <Stack gap="md">
              <Radio.Group
                label="Gonderim Modu"
                value={form.sendingMode}
                onChange={v => updateForm('sendingMode', v as SendingMode)}
              >
                <Stack mt="xs" gap="sm">
                  <Radio value="all" label="Kampanya basladiginda tum e-postalari gonder" disabled={loading} />
                  <Group gap="xs" align="center">
                    <Radio value="spread" label="E-postalari" disabled={loading} />
                    <NumberInput
                      w={80}
                      size="xs"
                      value={form.spreadDays}
                      onChange={v => updateForm('spreadDays', Number(v) || 1)}
                      min={1}
                      max={30}
                      disabled={loading || form.sendingMode !== 'spread'}
                    />
                    <Select
                      w={100}
                      size="xs"
                      data={[
                        { value: 'hours', label: 'saat' },
                        { value: 'days', label: 'is gunu' },
                      ]}
                      value={form.spreadUnit}
                      onChange={v => updateForm('spreadUnit', (v || 'days') as 'hours' | 'days')}
                      disabled={loading || form.sendingMode !== 'spread'}
                    />
                    <Text size="sm" c="dimmed">icinde yay</Text>
                  </Group>
                </Stack>
              </Radio.Group>

              {form.sendingMode === 'spread' && (
                <>
                  <Divider />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <TextInput
                      label="Calisma Baslangic"
                      type="time"
                      value={form.businessHoursStart}
                      onChange={e => updateForm('businessHoursStart', e.currentTarget.value)}
                      disabled={loading}
                    />
                    <TextInput
                      label="Calisma Bitis"
                      type="time"
                      value={form.businessHoursEnd}
                      onChange={e => updateForm('businessHoursEnd', e.currentTarget.value)}
                      disabled={loading}
                    />
                  </SimpleGrid>
                  <div>
                    <Text size="sm" fw={500} mb="xs">Is Gunleri</Text>
                    <Chip.Group
                      multiple
                      value={form.businessDays}
                      onChange={v => updateForm('businessDays', v)}
                    >
                      <Group gap="xs">
                        {WEEKDAYS.map(day => (
                          <Chip key={day.value} value={day.value} disabled={loading}>
                            {day.label}
                          </Chip>
                        ))}
                      </Group>
                    </Chip.Group>
                  </div>
                </>
              )}

              <NumberInput
                label="Aktivite Takip Suresi (gun)"
                description="Gonderim tamamlandiktan sonra"
                value={form.trackActivityDays}
                onChange={v => updateForm('trackActivityDays', Number(v) || 1)}
                min={1}
                max={90}
                disabled={loading}
                w={200}
              />
            </Stack>
          </Card>

          {/* E-posta Icerigi */}
          <Card>
            <Text fw={600} c="white" size="lg" mb="md">E-posta Icerigi</Text>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Kategori"
                  data={CATEGORIES}
                  value={form.category}
                  onChange={v => updateForm('category', v || 'it')}
                  disabled={loading}
                />
                <Select
                  label="Sablon Modu"
                  data={[
                    { value: 'random', label: 'Rastgele Sablon (her kullaniciya farkli)' },
                    { value: 'specific', label: 'Belirli Sablon Sec' },
                  ]}
                  value={form.templateMode}
                  onChange={v => updateForm('templateMode', (v || 'random') as 'random' | 'specific')}
                  disabled={loading}
                />
              </SimpleGrid>

              {form.templateMode === 'specific' && (
                <Select
                  label="E-posta Sablonu"
                  placeholder="-- Sablon Secin --"
                  data={templateOptions}
                  value={form.templateId}
                  onChange={v => updateForm('templateId', v || '')}
                  disabled={loading}
                  searchable
                />
              )}
            </Stack>
          </Card>

          {/* Phishing Ayarlari */}
          <Card>
            <Text fw={600} c="white" size="lg" mb="md">Phishing Ayarlari</Text>
            <Stack gap="md">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select
                  label="Phish Link Domain"
                  data={DOMAINS}
                  value={form.phishDomain}
                  onChange={v => updateForm('phishDomain', v || 'random')}
                  disabled={loading}
                />
                <Select
                  label="Landing Page"
                  data={landingPageOptions}
                  value={form.landingPageId}
                  onChange={v => updateForm('landingPageId', v || '')}
                  disabled={loading}
                />
              </SimpleGrid>
              <Select
                label="Tiklayanlari Gruba Ekle"
                data={CLICKER_GROUPS}
                value={form.addClickersToGroup}
                onChange={v => updateForm('addClickersToGroup', v || '')}
                disabled={loading}
                w={300}
              />
            </Stack>
          </Card>

          {/* Raporlama */}
          <Card>
            <Text fw={600} c="white" size="lg" mb="md">Raporlama</Text>
            <Checkbox
              label="Her Phishing Guvenlik Testinden sonra yoneticilere e-posta raporu gonder"
              checked={form.sendReportEmail}
              onChange={e => updateForm('sendReportEmail', e.currentTarget.checked)}
              disabled={loading}
            />
          </Card>

          {/* Actions */}
          <Group justify="flex-end" gap="md">
            <Button
              component={Link}
              to="/campaigns"
              variant="subtle"
              color="gray"
              disabled={loading}
            >
              Iptal
            </Button>
            <Button
              type="submit"
              color="electricBlue"
              leftSection={<Rocket size={16} />}
              loading={loading}
              size="md"
            >
              Kampanya Olustur
            </Button>
          </Group>
        </Stack>
      </form>
    </Stack>
  );
}
