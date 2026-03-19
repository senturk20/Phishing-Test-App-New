import { useState, useEffect, useMemo } from 'react';
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
  Stepper,
  Badge,
  Paper,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ArrowLeft,
  ArrowRight,
  Rocket,
  Info,
  AlertTriangle,
  FileText,
  Users,
  Settings,
  CheckCircle,
} from 'lucide-react';
import { api } from '../api';
import type { Frequency, SendingMode, EmailTemplate, LandingPage, LdapFaculty, Attachment } from '../types';

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
  { value: 'clicked', label: 'Tiklayanlar' },
  { value: 'risk', label: 'Riskli Kullanicilar' },
  { value: 'training', label: 'Egitim Gerekli' },
];

// Summary row helper
function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Group justify="space-between" py={6} style={{ borderBottom: '1px solid var(--app-border)' }}>
      <Text size="sm" c="dimmed">{label}</Text>
      <Text size="sm" fw={500} c="white">{value}</Text>
    </Group>
  );
}

export function CampaignNew() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [faculties, setFaculties] = useState<LdapFaculty[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [activeStep, setActiveStep] = useState(0);

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
    attachmentId: '',
    addClickersToGroup: '',
    sendReportEmail: true,
  });

  const updateForm = <K extends keyof typeof form>(key: K, value: typeof form[K]) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setStepError(null);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [templatesData, landingPagesData, facultiesData, attachmentsData] = await Promise.all([
          api.getTemplates(),
          api.getLandingPages(),
          api.getLdapFaculties().catch(() => ({ faculties: [], total: 0 })),
          api.getAttachments().catch(() => []),
        ]);
        setTemplates(templatesData);
        setLandingPages(landingPagesData);
        setFaculties(facultiesData.faculties);
        setAttachments(attachmentsData);

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

  // ── Derived labels for summary ──
  const targetGroupLabel = useMemo(() => {
    if (!form.targetGroupId) return '';
    if (form.targetGroupId === 'all') {
      return `Tum Fakulteler (${faculties.reduce((s, f) => s + f.count, 0)} kisi)`;
    }
    const fac = faculties.find(f => f.name === form.targetGroupId);
    return fac
      ? `${FACULTY_LABELS[fac.name] || fac.name} (${fac.count} kisi)`
      : FACULTY_LABELS[form.targetGroupId] || form.targetGroupId;
  }, [form.targetGroupId, faculties]);

  const templateLabel = useMemo(() => {
    if (form.templateMode === 'random') return 'Rastgele Sablon';
    const tpl = templates.find(t => t.id === form.templateId);
    return tpl ? tpl.name : 'Secilmedi';
  }, [form.templateMode, form.templateId, templates]);

  const landingPageLabel = useMemo(() => {
    if (!form.landingPageId) return 'Secilmedi';
    const lp = landingPages.find(p => p.id === form.landingPageId);
    return lp ? lp.name : 'Secilmedi';
  }, [form.landingPageId, landingPages]);

  const attachmentLabel = useMemo(() => {
    if (!form.attachmentId) return 'Yok';
    const att = attachments.find(a => a.id === form.attachmentId);
    return att ? att.originalName : 'Secilmedi';
  }, [form.attachmentId, attachments]);

  // ── Step validation ──
  const validateStep = (step: number): boolean => {
    setStepError(null);
    if (step === 0) {
      if (!form.name.trim()) {
        setStepError('Kampanya adi gerekli');
        return false;
      }
    }
    if (step === 2) {
      if (!form.targetGroupId) {
        setStepError('Hedef fakulte / departman secimi zorunludur');
        return false;
      }
    }
    return true;
  };

  const goToStep = (target: number) => {
    // Validate current step before advancing
    if (target > activeStep) {
      // Validate all steps from current up to target-1
      for (let s = activeStep; s < target; s++) {
        if (!validateStep(s)) {
          setActiveStep(s);
          return;
        }
      }
    }
    setStepError(null);
    setActiveStep(target);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.name.trim()) {
      setError('Kampanya adi gerekli');
      setActiveStep(0);
      return;
    }
    if (!form.targetGroupId) {
      setError('Hedef fakulte / departman secimi zorunludur');
      setActiveStep(2);
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
        attachmentId: form.attachmentId || undefined,
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

  const landingPageOptions = landingPages.map(lp => ({
    value: lp.id,
    label: `${lp.name}${lp.isDefault ? ' (Varsayilan)' : ''}`,
  }));

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

      {/* Step Indicator */}
      <Stepper
        active={activeStep}
        onStepClick={goToStep}
        color="electricBlue"
        size="sm"
        styles={{
          stepIcon: { backgroundColor: 'var(--app-surface)', borderColor: 'var(--app-border)' },
          separator: { backgroundColor: 'var(--app-border)' },
        }}
      >
        <Stepper.Step icon={<Settings size={16} />} label="Temel Bilgiler" />
        <Stepper.Step icon={<FileText size={16} />} label="Icerik & Dosya" />
        <Stepper.Step icon={<Users size={16} />} label="Hedef & Gonderim" />
        <Stepper.Step icon={<CheckCircle size={16} />} label="Ozet & Olustur" />
      </Stepper>

      <form onSubmit={handleSubmit}>
        <Stack gap="lg">

          {/* ───── Step 0: Temel Bilgiler ───── */}
          {activeStep === 0 && (
            <>
              <Card>
                <Text fw={600} c="white" size="lg" mb="md">Kampanya Bilgileri</Text>
                <Stack gap="md">
                  <TextInput
                    label="Kampanya Adi"
                    placeholder="Orn: Q1 2024 Guvenlik Farkindalik Testi"
                    required
                    value={form.name}
                    onChange={e => updateForm('name', e.currentTarget.value)}
                    disabled={loading}
                    error={stepError && !form.name.trim() ? stepError : undefined}
                  />
                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <Select
                      label="Kategori"
                      data={CATEGORIES}
                      value={form.category}
                      onChange={v => updateForm('category', v || 'it')}
                      disabled={loading}
                    />
                    <Select
                      label="Phish Link Domain"
                      data={DOMAINS}
                      value={form.phishDomain}
                      onChange={v => updateForm('phishDomain', v || 'random')}
                      disabled={loading}
                    />
                  </SimpleGrid>
                </Stack>
              </Card>

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

              {stepError && (
                <Alert color="alertRed" icon={<AlertTriangle size={14} />} py="xs">
                  {stepError}
                </Alert>
              )}

              <Group justify="flex-end">
                <Button
                  rightSection={<ArrowRight size={16} />}
                  color="electricBlue"
                  onClick={() => goToStep(1)}
                >
                  Sonraki: Icerik & Dosya
                </Button>
              </Group>
            </>
          )}

          {/* ───── Step 1: Icerik & Dosya ───── */}
          {activeStep === 1 && (
            <>
              <Card>
                <Text fw={600} c="white" size="lg" mb="md">E-posta Sablonu</Text>
                <Stack gap="md">
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

                  {form.templateMode === 'specific' && (
                    <Select
                      label="E-posta Sablonu"
                      placeholder="-- Sablon Secin --"
                      data={templateOptions}
                      value={form.templateId || null}
                      onChange={v => updateForm('templateId', v || '')}
                      allowDeselect={false}
                      disabled={loading}
                      searchable
                    />
                  )}

                  <Select
                    label="Landing Page"
                    placeholder="-- Landing Page Secin --"
                    data={landingPageOptions}
                    value={form.landingPageId || null}
                    onChange={v => updateForm('landingPageId', v || '')}
                    allowDeselect
                    clearable
                    disabled={loading}
                  />
                </Stack>
              </Card>

              <Card>
                <Text fw={600} c="white" size="lg" mb="md">Ek Dosya (Download Portal)</Text>
                <Stack gap="md">
                  <Select
                    label="Dosya Secimi"
                    description="Secilirse e-posta linki dosya indirme portalina yonlendirir"
                    placeholder="-- Dosya Ekleme --"
                    data={attachments.map(a => ({
                      value: a.id,
                      label: `${a.originalName} (${a.size > 1024 * 1024 ? (a.size / (1024 * 1024)).toFixed(1) + ' MB' : (a.size / 1024).toFixed(1) + ' KB'})`,
                    }))}
                    value={form.attachmentId || null}
                    onChange={v => updateForm('attachmentId', v || '')}
                    allowDeselect
                    clearable
                    disabled={loading}
                  />
                  {form.attachmentId && (
                    <Alert color="yellow" variant="light" icon={<Info size={14} />} py="xs">
                      <Text size="xs">
                        Sablonunuzda {'{{downloadLink}}'} veya {'{{downloadButton}}'} etiketini kullandiginizdan emin olun.
                      </Text>
                    </Alert>
                  )}
                </Stack>
              </Card>

              <Group justify="space-between">
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<ArrowLeft size={16} />}
                  onClick={() => goToStep(0)}
                >
                  Onceki
                </Button>
                <Button
                  rightSection={<ArrowRight size={16} />}
                  color="electricBlue"
                  onClick={() => goToStep(2)}
                >
                  Sonraki: Hedef & Gonderim
                </Button>
              </Group>
            </>
          )}

          {/* ───── Step 2: Hedef & Gonderim ───── */}
          {activeStep === 2 && (
            <>
              <Card>
                <Text fw={600} c="white" size="lg" mb="md">Hedef Secimi</Text>
                <Stack gap="md">
                  <Select
                    label="Hedef Fakulte / Departman"
                    placeholder="-- Hedef Fakulte Secin --"
                    data={[
                      { value: 'all', label: `Tum Fakulteler (${faculties.reduce((s, f) => s + f.count, 0)} kisi)` },
                      ...faculties.map(f => ({
                        value: f.name,
                        label: `${FACULTY_LABELS[f.name] || f.name} (${f.count} kisi)`,
                      })),
                    ]}
                    value={form.targetGroupId || null}
                    onChange={v => updateForm('targetGroupId', v || '')}
                    allowDeselect={false}
                    disabled={loading}
                    error={stepError && !form.targetGroupId ? stepError : undefined}
                  />
                  <Select
                    label="Tiklayanlari Gruba Ekle"
                    placeholder="-- Grup Secin --"
                    data={CLICKER_GROUPS}
                    value={form.addClickersToGroup || null}
                    onChange={v => updateForm('addClickersToGroup', v || '')}
                    allowDeselect
                    clearable
                    disabled={loading}
                  />
                </Stack>
              </Card>

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

              <Card>
                <Text fw={600} c="white" size="lg" mb="md">Raporlama</Text>
                <Checkbox
                  label="Her Phishing Guvenlik Testinden sonra yoneticilere e-posta raporu gonder"
                  checked={form.sendReportEmail}
                  onChange={e => updateForm('sendReportEmail', e.currentTarget.checked)}
                  disabled={loading}
                />
              </Card>

              {stepError && (
                <Alert color="alertRed" icon={<AlertTriangle size={14} />} py="xs">
                  {stepError}
                </Alert>
              )}

              <Group justify="space-between">
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<ArrowLeft size={16} />}
                  onClick={() => goToStep(1)}
                >
                  Onceki
                </Button>
                <Button
                  rightSection={<ArrowRight size={16} />}
                  color="electricBlue"
                  onClick={() => goToStep(3)}
                >
                  Sonraki: Ozet & Olustur
                </Button>
              </Group>
            </>
          )}

          {/* ───── Step 3: Ozet & Olustur (Confirmation) ───── */}
          {activeStep === 3 && (
            <>
              <Card>
                <Group justify="space-between" mb="md">
                  <Text fw={600} c="white" size="lg">Kampanya Ozeti</Text>
                  <Badge
                    color="cyberGreen"
                    variant="light"
                    size="lg"
                    leftSection={<Users size={14} />}
                  >
                    Secilen Grup: {targetGroupLabel || 'Secilmedi'}
                  </Badge>
                </Group>

                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
                  {/* Left column: Basic + Content */}
                  <Paper p="md" radius="md" style={{ backgroundColor: 'var(--app-shell-bg)' }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="sm">Temel Bilgiler</Text>
                    <Stack gap={0}>
                      <SummaryRow label="Kampanya Adi" value={form.name} />
                      <SummaryRow label="Kategori" value={CATEGORIES.find(c => c.value === form.category)?.label || form.category} />
                      <SummaryRow label="Domain" value={form.phishDomain === 'random' ? 'Rastgele' : form.phishDomain} />
                      <SummaryRow label="Siklik" value={form.frequency === 'once' ? 'Tek Seferlik' : form.frequency} />
                      <SummaryRow label="Baslangic" value={`${form.startDate} ${form.startTime}`} />
                    </Stack>
                  </Paper>

                  <Paper p="md" radius="md" style={{ backgroundColor: 'var(--app-shell-bg)' }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="sm">Icerik & Dosya</Text>
                    <Stack gap={0}>
                      <SummaryRow label="Sablon" value={templateLabel} />
                      <SummaryRow label="Landing Page" value={landingPageLabel} />
                      <SummaryRow label="Ek Dosya" value={attachmentLabel} />
                    </Stack>
                  </Paper>

                  <Paper p="md" radius="md" style={{ backgroundColor: 'var(--app-shell-bg)' }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="sm">Hedef & Gonderim</Text>
                    <Stack gap={0}>
                      <SummaryRow
                        label="Hedef Grup"
                        value={
                          <Badge color="electricBlue" variant="light" size="sm">
                            {targetGroupLabel}
                          </Badge>
                        }
                      />
                      <SummaryRow label="Gonderim Modu" value={form.sendingMode === 'all' ? 'Toplu Gonderim' : `${form.spreadDays} ${form.spreadUnit === 'hours' ? 'saat' : 'is gunu'} icinde yay`} />
                      <SummaryRow label="Aktivite Takip" value={`${form.trackActivityDays} gun`} />
                    </Stack>
                  </Paper>

                  <Paper p="md" radius="md" style={{ backgroundColor: 'var(--app-shell-bg)' }}>
                    <Text size="xs" tt="uppercase" fw={700} c="dimmed" mb="sm">Raporlama</Text>
                    <Stack gap={0}>
                      <SummaryRow label="E-posta Raporu" value={form.sendReportEmail ? 'Evet' : 'Hayir'} />
                      <SummaryRow label="Tiklayan Grubu" value={
                        form.addClickersToGroup
                          ? (CLICKER_GROUPS.find(g => g.value === form.addClickersToGroup)?.label || form.addClickersToGroup)
                          : 'Yok'
                      } />
                    </Stack>
                  </Paper>
                </SimpleGrid>
              </Card>

              <Group justify="space-between">
                <Button
                  variant="subtle"
                  color="gray"
                  leftSection={<ArrowLeft size={16} />}
                  onClick={() => goToStep(2)}
                >
                  Onceki
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
            </>
          )}

        </Stack>
      </form>
    </Stack>
  );
}
