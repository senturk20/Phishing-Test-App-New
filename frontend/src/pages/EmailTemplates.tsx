import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Group,
  Text,
  Title,
  TextInput,
  Textarea,
  Select,
  Button,
  Stack,
  SimpleGrid,
  Badge,
  Center,
  Loader,
  Modal,
  SegmentedControl,
  TypographyStylesProvider,
  Stepper,
  Tooltip,
  ActionIcon,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Search,
  Eye,
  Rocket,
  Shield,
  Briefcase,
  DollarSign,
  Mail,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  User,
  Link as LinkIcon,
  Globe,
  AtSign,
  Calendar,
  Building,
  UserCheck,
} from 'lucide-react';
import { api } from '../api';
import type { EmailTemplate } from '../types';

// ============================================
// CATEGORY HELPERS
// ============================================

const CATEGORY_MAP: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  it:      { label: 'IT',     color: 'electricBlue', icon: <Shield size={20} /> },
  hr:      { label: 'HR',     color: 'grape',        icon: <Briefcase size={20} /> },
  finance: { label: 'Finans', color: 'yellow',       icon: <DollarSign size={20} /> },
  general: { label: 'Genel',  color: 'gray',         icon: <Mail size={20} /> },
};

const getCategoryDisplay = (cat: string) =>
  CATEGORY_MAP[cat] || CATEGORY_MAP['general'];

// Legacy fallback for templates without a category field
const inferCategory = (template: EmailTemplate): string => {
  if (template.category && template.category !== 'general') return template.category;
  const n = template.name;
  if (n.includes('IT') || n.includes('VPN')) return 'it';
  if (n.includes('HR') || n.includes('IK')) return 'hr';
  if (n.includes('Finans') || n.includes('Odeme')) return 'finance';
  return 'general';
};

// ============================================
// PLACEHOLDER SYSTEM
// ============================================

const PLACEHOLDERS = [
  { tag: '{{name}}',         label: 'Ad Soyad',       icon: <User size={14} />,      description: 'Alicinin tam adi' },
  { tag: '{{firstName}}',    label: 'Ad',             icon: <UserCheck size={14} />,  description: 'Alicinin adi' },
  { tag: '{{lastName}}',     label: 'Soyad',          icon: <UserCheck size={14} />,  description: 'Alicinin soyadi' },
  { tag: '{{email}}',        label: 'E-posta',        icon: <AtSign size={14} />,     description: 'Alicinin e-postasi' },
  { tag: '{{link}}',         label: 'Tracking Link',  icon: <LinkIcon size={14} />,   description: 'Benzersiz takip linki' },
  { tag: '{{phish_domain}}', label: 'Domain',         icon: <Globe size={14} />,      description: 'Kampanya domaini' },
  { tag: '{{date}}',         label: 'Tarih',          icon: <Calendar size={14} />,   description: 'Bugunku tarih' },
  { tag: '{{department}}',   label: 'Departman',      icon: <Building size={14} />,   description: 'Departman adi' },
];

const CATEGORY_OPTIONS = [
  { value: 'it',      label: 'IT' },
  { value: 'hr',      label: 'HR' },
  { value: 'finance', label: 'Finans' },
  { value: 'general', label: 'Genel' },
];

const FILTER_CATEGORIES = ['Tumu', 'IT', 'HR', 'Finans', 'Genel'];

// ============================================
// COMPONENT
// ============================================

export function EmailTemplates() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('Tumu');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);

  // Create/Edit modal state
  const [createOpened, setCreateOpened] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  const [createLoading, setCreateLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    subject: '',
    body: '',
    category: 'general',
    isDefault: false,
  });
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  const fetchTemplates = () => {
    setLoading(true);
    api.getTemplates()
      .then(setTemplates)
      .catch(() => notifications.show({ title: 'Hata', message: 'Sablonlar yuklenemedi', color: 'alertRed' }))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchTemplates(); }, []);

  // ---- Filtering ----
  const filteredTemplates = templates.filter(template => {
    const cat = getCategoryDisplay(inferCategory(template)).label;
    const matchesCategory = selectedCategory === 'Tumu' || cat === selectedCategory;
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.subject.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getDescription = (body: string): string => {
    const text = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
    return text.length > 100 ? text.substring(0, 100) + '...' : text;
  };

  // ---- Placeholder insertion ----
  const insertPlaceholder = (tag: string) => {
    const textarea = bodyRef.current;
    if (!textarea) {
      setNewTemplate(prev => ({ ...prev, body: prev.body + tag }));
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = newTemplate.body.substring(0, start);
    const after = newTemplate.body.substring(end);
    const updated = before + tag + after;
    setNewTemplate(prev => ({ ...prev, body: updated }));
    // Restore cursor position after React re-render
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + tag.length;
    }, 0);
  };

  // ---- Create / Update template ----
  const handleSave = async () => {
    if (!newTemplate.name.trim() || !newTemplate.subject.trim()) {
      notifications.show({ title: 'Hata', message: 'Ad ve konu alanlari zorunludur', color: 'alertRed' });
      return;
    }
    setCreateLoading(true);
    try {
      const payload = {
        name: newTemplate.name.trim(),
        subject: newTemplate.subject.trim(),
        body: newTemplate.body,
        category: newTemplate.category,
        isDefault: newTemplate.isDefault,
      };
      if (editingId) {
        await api.updateTemplate(editingId, payload);
        notifications.show({ title: 'Basarili', message: 'Sablon guncellendi', color: 'cyberGreen' });
      } else {
        await api.createTemplate(payload);
        notifications.show({ title: 'Basarili', message: 'Sablon olusturuldu', color: 'cyberGreen' });
      }
      setCreateOpened(false);
      resetCreateForm();
      fetchTemplates();
    } catch {
      notifications.show({ title: 'Hata', message: editingId ? 'Sablon guncellenemedi' : 'Sablon olusturulamadi', color: 'alertRed' });
    } finally {
      setCreateLoading(false);
    }
  };

  const resetCreateForm = () => {
    setCreateStep(0);
    setEditingId(null);
    setNewTemplate({ name: '', subject: '', body: '', category: 'general', isDefault: false });
  };

  // ---- Edit template ----
  const handleEdit = (template: EmailTemplate, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingId(template.id);
    setNewTemplate({
      name: template.name,
      subject: template.subject,
      body: template.body,
      category: inferCategory(template),
      isDefault: template.isDefault,
    });
    setCreateStep(0);
    setCreateOpened(true);
  };

  // ---- Delete template ----
  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDeleteLoading(id);
    try {
      await api.deleteTemplate(id);
      notifications.show({ title: 'Basarili', message: 'Sablon silindi', color: 'cyberGreen' });
      if (selectedTemplate?.id === id) setSelectedTemplate(null);
      fetchTemplates();
    } catch {
      notifications.show({ title: 'Hata', message: 'Sablon silinemedi', color: 'alertRed' });
    } finally {
      setDeleteLoading(null);
    }
  };

  // ---- Stepper validation ----
  const canGoToStep = (step: number) => {
    if (step === 1) return newTemplate.name.trim().length > 0 && newTemplate.subject.trim().length > 0;
    if (step === 2) return newTemplate.body.trim().length > 0;
    return true;
  };

  if (loading) {
    return <Center h={400}><Loader color="electricBlue" size="lg" /></Center>;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} c="white">E-posta Sablonlari</Title>
          <Text size="sm" c="dimmed">Phishing simulasyonlari icin hazir e-posta sablonlari</Text>
        </div>
        <Button
          color="electricBlue"
          leftSection={<Plus size={16} />}
          onClick={() => { resetCreateForm(); setCreateOpened(true); }}
        >
          Yeni Sablon Olustur
        </Button>
      </Group>

      {/* Filters */}
      <Group gap="md">
        <TextInput
          placeholder="Sablon veya konu ara..."
          leftSection={<Search size={16} />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          w={300}
        />
        <SegmentedControl
          value={selectedCategory}
          onChange={setSelectedCategory}
          data={FILTER_CATEGORIES}
          color="electricBlue"
        />
      </Group>

      {/* Stats */}
      <SimpleGrid cols={{ base: 1, xs: 3 }}>
        <Card py="sm">
          <Text size="xl" fw={700} c="white" ta="center">{templates.length}</Text>
          <Text size="xs" c="dimmed" ta="center" tt="uppercase">Toplam Sablon</Text>
        </Card>
        <Card py="sm">
          <Text size="xl" fw={700} c="white" ta="center">{Object.keys(CATEGORY_MAP).length}</Text>
          <Text size="xs" c="dimmed" ta="center" tt="uppercase">Kategori</Text>
        </Card>
        <Card py="sm">
          <Text size="xl" fw={700} c="white" ta="center">{templates.filter(t => t.isDefault).length}</Text>
          <Text size="xs" c="dimmed" ta="center" tt="uppercase">Varsayilan</Text>
        </Card>
      </SimpleGrid>

      {/* Templates Grid */}
      {filteredTemplates.length === 0 ? (
        <Card>
          <Center py="xl"><Text c="dimmed">Aramanizla eslesen sablon bulunamadi.</Text></Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, md: 2 }}>
          {filteredTemplates.map(template => {
            const cat = inferCategory(template);
            const display = getCategoryDisplay(cat);
            return (
              <Card
                key={template.id}
                style={{ cursor: 'pointer', transition: 'border-color 150ms ease' }}
                onClick={() => setSelectedTemplate(template)}
              >
                <Group justify="space-between" align="flex-start" mb="sm">
                  <Group gap="sm">
                    <Badge
                      leftSection={display.icon}
                      color={display.color}
                      variant="light"
                      size="lg"
                    >
                      {display.label}
                    </Badge>
                    {template.isDefault && (
                      <Badge color="cyberGreen" variant="light" size="sm">Varsayilan</Badge>
                    )}
                  </Group>
                  <Group gap="xs">
                    <Button size="xs" variant="subtle" color="electricBlue" leftSection={<Eye size={14} />} onClick={e => { e.stopPropagation(); setSelectedTemplate(template); }}>
                      Onizle
                    </Button>
                    <Tooltip label="Duzenle">
                      <ActionIcon
                        variant="subtle"
                        color="yellow"
                        size="sm"
                        onClick={e => handleEdit(template, e)}
                      >
                        <Pencil size={14} />
                      </ActionIcon>
                    </Tooltip>
                    <Button size="xs" color="electricBlue" leftSection={<Rocket size={14} />} onClick={e => { e.stopPropagation(); navigate(`/campaigns/new?templateId=${template.id}`); }}>
                      Kullan
                    </Button>
                    <Tooltip label="Sil">
                      <ActionIcon
                        variant="subtle"
                        color="alertRed"
                        size="sm"
                        loading={deleteLoading === template.id}
                        onClick={e => handleDelete(template.id, e)}
                      >
                        <Trash2 size={14} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Group>
                <Text fw={600} c="white" size="md">{template.name}</Text>
                <Text size="sm" c="electricBlue" mt={2}>{template.subject}</Text>
                <Text size="xs" c="dimmed" mt="xs" lineClamp={2}>{getDescription(template.body)}</Text>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* ============================================ */}
      {/* PREVIEW MODAL */}
      {/* ============================================ */}
      <Modal
        opened={!!selectedTemplate}
        onClose={() => setSelectedTemplate(null)}
        title="E-posta Onizleme"
        size="xl"
      >
        {selectedTemplate && (
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={600} size="lg">{selectedTemplate.name}</Text>
              {selectedTemplate.isDefault && <Badge color="cyberGreen" variant="light">Varsayilan</Badge>}
            </Group>

            <Card withBorder style={{ borderColor: 'var(--app-border)' }}>
              <Stack gap="xs" mb="md">
                <Group gap="xs">
                  <Text size="sm" fw={600} c="dimmed" w={60}>Kimden:</Text>
                  <Text size="sm">guvenlik@sirket-destek.com</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={600} c="dimmed" w={60}>Kime:</Text>
                  <Text size="sm">{'{{email}}'}</Text>
                </Group>
                <Group gap="xs">
                  <Text size="sm" fw={600} c="dimmed" w={60}>Konu:</Text>
                  <Text size="sm" fw={600} c="electricBlue">{selectedTemplate.subject}</Text>
                </Group>
              </Stack>
              <TypographyStylesProvider>
                <div dangerouslySetInnerHTML={{ __html: selectedTemplate.body }} />
              </TypographyStylesProvider>
            </Card>

            <Card withBorder style={{ borderColor: 'var(--mantine-color-yellow-9)' }}>
              <Group gap="xs" mb="xs">
                <AlertTriangle size={16} color="var(--mantine-color-yellow-5)" />
                <Text fw={600} size="sm" c="yellow">Phishing Indikatorleri</Text>
              </Group>
              <Stack gap={4}>
                <Text size="xs" c="dimmed">- Sahte gonderen adresi</Text>
                <Text size="xs" c="dimmed">- Aciliyet yaratan dil</Text>
                <Text size="xs" c="dimmed">- Supheli baglanti</Text>
                <Text size="xs" c="dimmed">- Tehdit iceren ifadeler</Text>
              </Stack>
            </Card>

            <Group justify="flex-end" gap="sm">
              <Button variant="subtle" color="gray" onClick={() => setSelectedTemplate(null)}>
                Kapat
              </Button>
              <Button
                color="electricBlue"
                leftSection={<Rocket size={16} />}
                onClick={() => {
                  navigate(`/campaigns/new?templateId=${selectedTemplate.id}`);
                  setSelectedTemplate(null);
                }}
              >
                Bu Sablonu Kullan
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>

      {/* ============================================ */}
      {/* CREATE TEMPLATE MODAL - 3 STEP */}
      {/* ============================================ */}
      <Modal
        opened={createOpened}
        onClose={() => { setCreateOpened(false); resetCreateForm(); }}
        title={editingId ? 'Sablonu Duzenle' : 'Yeni E-posta Sablonu Olustur'}
        size="xl"
      >
        <Stack gap="lg">
          <Stepper active={createStep} color="electricBlue" size="sm">
            <Stepper.Step label="Meta Bilgiler" description="Ad, konu, kategori" />
            <Stepper.Step label="Icerik" description="HTML icerik editoru" />
            <Stepper.Step label="Onizleme" description="Son kontrol" />
          </Stepper>

          {/* Step 0: Metadata */}
          {createStep === 0 && (
            <Stack gap="md">
              <TextInput
                label="Sablon Adi"
                placeholder="Orn: IT - Sifre Sifirlama"
                required
                value={newTemplate.name}
                onChange={e => setNewTemplate(prev => ({ ...prev, name: e.currentTarget.value }))}
              />
              <TextInput
                label="E-posta Konusu"
                placeholder="Orn: Acil: Sifrenizi Guncellemeniz Gerekmektedir"
                required
                value={newTemplate.subject}
                onChange={e => setNewTemplate(prev => ({ ...prev, subject: e.currentTarget.value }))}
              />
              <Select
                label="Kategori"
                data={CATEGORY_OPTIONS}
                value={newTemplate.category}
                onChange={v => setNewTemplate(prev => ({ ...prev, category: v || 'general' }))}
              />
            </Stack>
          )}

          {/* Step 1: Content Editor with Placeholder Quick Insert */}
          {createStep === 1 && (
            <Stack gap="md">
              <div>
                <Text size="sm" fw={500} mb="xs">Hizli Yer Tutucu Ekle</Text>
                <Group gap={6} wrap="wrap">
                  {PLACEHOLDERS.map(p => (
                    <Tooltip key={p.tag} label={p.description}>
                      <Button
                        size="xs"
                        variant="light"
                        color="electricBlue"
                        leftSection={p.icon}
                        onClick={() => insertPlaceholder(p.tag)}
                      >
                        {p.label}
                      </Button>
                    </Tooltip>
                  ))}
                </Group>
              </div>
              <Textarea
                ref={bodyRef}
                label="E-posta Icerigi (HTML)"
                placeholder={'<p>Sayin {{name}},</p>\n<p>Lutfen <a href="{{link}}">buraya tiklayarak</a> islem yapin.</p>'}
                required
                minRows={12}
                maxRows={20}
                autosize
                value={newTemplate.body}
                onChange={e => setNewTemplate(prev => ({ ...prev, body: e.currentTarget.value }))}
                styles={{
                  input: {
                    fontFamily: 'monospace',
                    fontSize: '13px',
                  },
                }}
              />
              <Text size="xs" c="dimmed">
                HTML kullanarak e-posta icerigi yazabilirsiniz. Yer tutuculari {'{{...}}'} biciminde kullanin.
              </Text>
            </Stack>
          )}

          {/* Step 2: Preview */}
          {createStep === 2 && (
            <Stack gap="md">
              <Card withBorder style={{ borderColor: 'var(--app-border)' }}>
                <Stack gap="xs" mb="md">
                  <Group gap="xs">
                    <Text size="sm" fw={600} c="dimmed" w={80}>Sablon Adi:</Text>
                    <Text size="sm" fw={600}>{newTemplate.name}</Text>
                  </Group>
                  <Group gap="xs">
                    <Text size="sm" fw={600} c="dimmed" w={80}>Konu:</Text>
                    <Text size="sm" c="electricBlue">{newTemplate.subject}</Text>
                  </Group>
                  <Group gap="xs">
                    <Text size="sm" fw={600} c="dimmed" w={80}>Kategori:</Text>
                    <Badge color={getCategoryDisplay(newTemplate.category).color} variant="light" size="sm">
                      {getCategoryDisplay(newTemplate.category).label}
                    </Badge>
                  </Group>
                </Stack>
              </Card>

              <Card withBorder style={{ borderColor: 'var(--app-border)' }}>
                <Text size="sm" fw={600} c="dimmed" mb="sm">E-posta Onizleme:</Text>
                <TypographyStylesProvider>
                  <div dangerouslySetInnerHTML={{ __html: newTemplate.body }} />
                </TypographyStylesProvider>
              </Card>

              {/* Show detected placeholders */}
              <Card withBorder style={{ borderColor: 'var(--app-border)' }}>
                <Text size="sm" fw={600} c="dimmed" mb="xs">Kullanilan Yer Tutucular:</Text>
                <Group gap="xs">
                  {PLACEHOLDERS.filter(p =>
                    newTemplate.body.includes(p.tag) || newTemplate.subject.includes(p.tag)
                  ).map(p => (
                    <Badge key={p.tag} variant="light" color="electricBlue" size="sm" leftSection={p.icon}>
                      {p.tag}
                    </Badge>
                  ))}
                  {PLACEHOLDERS.every(p => !newTemplate.body.includes(p.tag) && !newTemplate.subject.includes(p.tag)) && (
                    <Text size="xs" c="dimmed">Yer tutucu kullanilmamis</Text>
                  )}
                </Group>
              </Card>
            </Stack>
          )}

          {/* Navigation Buttons */}
          <Group justify="space-between">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                if (createStep === 0) {
                  setCreateOpened(false);
                  resetCreateForm();
                } else {
                  setCreateStep(s => s - 1);
                }
              }}
            >
              {createStep === 0 ? 'Iptal' : 'Geri'}
            </Button>
            {createStep < 2 ? (
              <Button
                color="electricBlue"
                onClick={() => setCreateStep(s => s + 1)}
                disabled={!canGoToStep(createStep + 1)}
              >
                Ileri
              </Button>
            ) : (
              <Button
                color="cyberGreen"
                leftSection={editingId ? <Pencil size={16} /> : <Plus size={16} />}
                onClick={handleSave}
                loading={createLoading}
              >
                {editingId ? 'Sablonu Guncelle' : 'Sablon Olustur'}
              </Button>
            )}
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}
