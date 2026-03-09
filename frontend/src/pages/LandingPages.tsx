import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Group,
  Text,
  Title,
  TextInput,
  Button,
  Stack,
  SimpleGrid,
  Badge,
  Center,
  Loader,
  Modal,
  SegmentedControl,
  ThemeIcon,
  Stepper,
  Tabs,
  ActionIcon,
  Tooltip,
  Box,
  Switch,
  FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Search,
  Eye,
  Rocket,
  Globe,
  MousePointerClick,
  FileText,
  BarChart3,
  Plus,
  Copy,
  Code,
  Pencil,
  Trash2,
  Link as LinkIcon,
  ExternalLink,
  Upload,
} from 'lucide-react';
import Editor from '@monaco-editor/react';
import { api, getPreviewUrl } from '../api';
import type { LandingPage } from '../types';

// ============================================
// HELPERS
// ============================================

const getCategoryFromName = (name: string): string => {
  if (name.includes('Office') || name.includes('Microsoft')) return 'Kurumsal';
  if (name.includes('OBS') || name.includes('Canvas') || name.includes('Universite')) return 'Egitim';
  if (name.includes('HR') || name.includes('IK')) return 'HR';
  return 'Genel';
};

const getCategoryColor = (category: string) => {
  switch (category) {
    case 'Kurumsal': return 'electricBlue';
    case 'Egitim': return 'grape';
    case 'HR': return 'teal';
    default: return 'gray';
  }
};

// ============================================
// COMPONENT
// ============================================

export function LandingPages() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState('Tumu');
  const [searchQuery, setSearchQuery] = useState('');
  const [landingPages, setLandingPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPage, setPreviewPage] = useState<LandingPage | null>(null);

  // Builder modal state
  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderTab, setBuilderTab] = useState<string | null>('clone');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Clone mode state
  const [cloneUrl, setCloneUrl] = useState('');
  const [cloning, setCloning] = useState(false);

  // Upload mode state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploading, setUploading] = useState(false);

  // Editor state (shared between clone result & manual edit)
  const [pageName, setPageName] = useState('');
  const [pageSlug, setPageSlug] = useState('');
  const [htmlCode, setHtmlCode] = useState('');
  const [originalUrl, setOriginalUrl] = useState('');
  const [isCloned, setIsCloned] = useState(false);
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);

  // ============================================
  // DATA FETCHING
  // ============================================

  const fetchPages = useCallback(() => {
    api.getLandingPages()
      .then(setLandingPages)
      .catch(() => notifications.show({ title: 'Hata', message: 'Landing page\'ler yuklenemedi', color: 'alertRed' }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  // ============================================
  // BUILDER ACTIONS
  // ============================================

  const resetBuilder = () => {
    setCloneUrl('');
    setPageName('');
    setPageSlug('');
    setHtmlCode('');
    setOriginalUrl('');
    setIsCloned(false);
    setIsDefault(false);
    setEditingId(null);
    setBuilderTab('clone');
    setUploadFile(null);
    setUploadName('');
  };

  const openBuilder = () => {
    resetBuilder();
    setBuilderOpen(true);
  };

  const handleEdit = (lp: LandingPage) => {
    setEditingId(lp.id);
    setPageName(lp.name);
    setPageSlug(lp.slug || '');
    setHtmlCode(lp.html);
    setOriginalUrl(lp.originalUrl || '');
    setIsCloned(lp.isCloned || false);
    setIsDefault(lp.isDefault);
    setBuilderTab('editor');
    setBuilderOpen(true);
  };

  const handleClone = async () => {
    if (!cloneUrl.trim()) return;
    setCloning(true);

    try {
      const result = await api.cloneSite(cloneUrl.trim());

      // The clone endpoint auto-creates the landing page in the DB.
      // Close builder and refresh the list.
      setBuilderOpen(false);
      resetBuilder();
      setLoading(true);
      fetchPages();

      notifications.show({
        title: 'Klonlama Basarili',
        message: `"${result.title}" sayfasi basariyla klonlandi (${result.assetCount} asset indirildi).`,
        color: 'cyberGreen',
      });
    } catch (err) {
      notifications.show({
        title: 'Klonlama Hatasi',
        message: err instanceof Error ? err.message : 'Sayfa klonlanamadi',
        color: 'alertRed',
      });
    } finally {
      setCloning(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);

    try {
      const result = await api.uploadLandingPageZip(uploadFile, uploadName.trim() || undefined);

      setBuilderOpen(false);
      resetBuilder();
      setUploadFile(null);
      setUploadName('');
      setLoading(true);
      fetchPages();

      notifications.show({
        title: 'Yukleme Basarili',
        message: `"${result.name}" basariyla yuklendi (${result.fileCount} dosya).`,
        color: 'cyberGreen',
      });
    } catch (err) {
      notifications.show({
        title: 'Yukleme Hatasi',
        message: err instanceof Error ? err.message : 'ZIP yuklenemedi',
        color: 'alertRed',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!pageName.trim() || !htmlCode.trim()) {
      notifications.show({ title: 'Hata', message: 'Sayfa adi ve HTML icerigi gereklidir', color: 'alertRed' });
      return;
    }

    setSaving(true);
    try {
      if (editingId) {
        await api.updateLandingPage(editingId, {
          name: pageName.trim(),
          html: htmlCode,
          slug: pageSlug || undefined,
          isDefault,
        });
        notifications.show({ title: 'Guncellendi', message: 'Landing page basariyla guncellendi', color: 'cyberGreen' });
      } else {
        await api.createLandingPage({
          name: pageName.trim(),
          html: htmlCode,
          slug: pageSlug || undefined,
          originalUrl: originalUrl || undefined,
          isCloned,
          isDefault,
        });
        notifications.show({ title: 'Olusturuldu', message: 'Yeni landing page basariyla olusturuldu', color: 'cyberGreen' });
      }
      setBuilderOpen(false);
      resetBuilder();
      setLoading(true);
      fetchPages();
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Islem basarisiz',
        color: 'alertRed',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.deleteLandingPage(id);
      setLandingPages((prev) => prev.filter((lp) => lp.id !== id));
      notifications.show({ title: 'Silindi', message: `"${name}" basariyla silindi`, color: 'cyberGreen' });
    } catch {
      notifications.show({ title: 'Hata', message: 'Silme islemi basarisiz', color: 'alertRed' });
    }
  };

  // ============================================
  // RENDER
  // ============================================

  const categories = ['Tumu', ...Array.from(new Set(landingPages.map(lp => getCategoryFromName(lp.name))))];

  const filtered = landingPages.filter(lp => {
    const category = getCategoryFromName(lp.name);
    const matchesCategory = selectedCategory === 'Tumu' || category === selectedCategory;
    const matchesSearch = lp.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (loading) {
    return <Center h={400}><Loader color="electricBlue" size="lg" /></Center>;
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} c="white">Landing Page Sablonlari</Title>
          <Text size="sm" c="dimmed">Phishing simulasyonlari icin hazir landing page sablonlari</Text>
        </div>
        <Button
          leftSection={<Plus size={16} />}
          color="electricBlue"
          onClick={openBuilder}
        >
          Yeni Sayfa Olustur
        </Button>
      </Group>

      {/* Filters */}
      <Group gap="md">
        <TextInput
          placeholder="Sablon ara..."
          leftSection={<Search size={16} />}
          value={searchQuery}
          onChange={e => setSearchQuery(e.currentTarget.value)}
          w={300}
        />
        <SegmentedControl
          value={selectedCategory}
          onChange={setSelectedCategory}
          data={categories}
          color="electricBlue"
        />
      </Group>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <Center py="xl"><Text c="dimmed">Aramanizla eslesen sablon bulunamadi.</Text></Center>
        </Card>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
          {filtered.map(lp => {
            const category = getCategoryFromName(lp.name);
            return (
              <Card key={lp.id}>
                {/* Scaled-down preview thumbnail */}
                <Box
                  mb="md"
                  style={{
                    borderRadius: 'var(--mantine-radius-md)',
                    backgroundColor: 'var(--mantine-color-dark-5)',
                    overflow: 'hidden',
                    height: 120,
                    position: 'relative',
                  }}
                >
                  <iframe
                    src={getPreviewUrl(lp.id)}
                    title={lp.name}
                    sandbox="allow-same-origin allow-scripts allow-forms"
                    style={{
                      width: '400%',
                      height: '400%',
                      transform: 'scale(0.25)',
                      transformOrigin: 'top left',
                      border: 'none',
                      pointerEvents: 'none',
                    }}
                  />
                </Box>

                <Group justify="space-between" align="flex-start" mb="xs">
                  <Text fw={600} c="white" size="sm" lineClamp={1} style={{ flex: 1 }}>
                    {lp.name}
                  </Text>
                  <Group gap={4}>
                    {lp.isCloned && (
                      <Badge color="grape" variant="light" size="xs">Klon</Badge>
                    )}
                    {lp.isDefault && (
                      <Badge color="cyberGreen" variant="light" size="xs">Varsayilan</Badge>
                    )}
                  </Group>
                </Group>

                <Group gap={4} mb="md">
                  <Badge color={getCategoryColor(category)} variant="light" size="xs">
                    {category}
                  </Badge>
                  {lp.originalUrl && (
                    <Tooltip label={lp.originalUrl}>
                      <Badge
                        color="dark"
                        variant="light"
                        size="xs"
                        leftSection={<ExternalLink size={10} />}
                        style={{ cursor: 'pointer' }}
                      >
                        Kaynak
                      </Badge>
                    </Tooltip>
                  )}
                </Group>

                <Group gap="xs">
                  <Button
                    size="xs"
                    variant="light"
                    color="electricBlue"
                    leftSection={<Eye size={14} />}
                    onClick={() => setPreviewPage(lp)}
                    flex={1}
                  >
                    Onizle
                  </Button>
                  <Tooltip label="Duzenle">
                    <ActionIcon
                      size="lg"
                      variant="light"
                      color="yellow"
                      onClick={() => handleEdit(lp)}
                    >
                      <Pencil size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Tooltip label="Sil">
                    <ActionIcon
                      size="lg"
                      variant="light"
                      color="red"
                      onClick={() => handleDelete(lp.id, lp.name)}
                    >
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Tooltip>
                  <Button
                    size="xs"
                    color="electricBlue"
                    leftSection={<Rocket size={14} />}
                    onClick={() => navigate(`/campaigns/new?landingPageId=${lp.id}`)}
                    flex={1}
                  >
                    Kullan
                  </Button>
                </Group>
              </Card>
            );
          })}
        </SimpleGrid>
      )}

      {/* How it works */}
      <Card>
        <Text fw={600} c="white" mb="lg">Landing Page Nasil Calisir?</Text>
        <Stepper active={-1} color="electricBlue" size="sm">
          <Stepper.Step
            icon={<MousePointerClick size={16} />}
            label="Sablon Secin"
            description="Hedef kitlenize uygun bir sablon secin"
          />
          <Stepper.Step
            icon={<FileText size={16} />}
            label="Ozellestirin"
            description="Logo, renkler ve icerigi duzenleyin"
          />
          <Stepper.Step
            icon={<Rocket size={16} />}
            label="Kampanyaya Ekleyin"
            description="Kampanya olustururken bu sablonu secin"
          />
          <Stepper.Step
            icon={<BarChart3 size={16} />}
            label="Sonuclari Izleyin"
            description="Tiklama ve form gonderim verilerini analiz edin"
          />
        </Stepper>
      </Card>

      {/* ============================================ */}
      {/* PREVIEW MODAL */}
      {/* ============================================ */}
      <Modal
        opened={!!previewPage}
        onClose={() => setPreviewPage(null)}
        title={previewPage ? `Onizleme: ${previewPage.name}` : ''}
        size="xl"
        styles={{
          body: { padding: 0, height: '70vh' },
        }}
      >
        {previewPage && (
          <iframe
            src={getPreviewUrl(previewPage.id)}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Landing Page Preview"
            sandbox="allow-same-origin allow-scripts allow-forms"
          />
        )}
      </Modal>

      {/* ============================================ */}
      {/* BUILDER MODAL */}
      {/* ============================================ */}
      <Modal
        opened={builderOpen}
        onClose={() => { setBuilderOpen(false); resetBuilder(); }}
        title={
          <Group gap="sm">
            {editingId ? <Pencil size={20} /> : <Plus size={20} />}
            <Text fw={600}>{editingId ? 'Sayfayi Duzenle' : 'Yeni Landing Page'}</Text>
          </Group>
        }
        size="95vw"
        styles={{
          body: { height: '80vh', display: 'flex', flexDirection: 'column' },
          content: { backgroundColor: 'var(--mantine-color-dark-7)' },
          header: { backgroundColor: 'var(--mantine-color-dark-7)' },
        }}
      >
        <Tabs value={builderTab} onChange={setBuilderTab} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Tabs.List mb="md">
            {!editingId && (
              <Tabs.Tab value="clone" leftSection={<Copy size={14} />}>
                Site Klonla
              </Tabs.Tab>
            )}
            {!editingId && (
              <Tabs.Tab value="upload" leftSection={<Upload size={14} />}>
                ZIP Yukle
              </Tabs.Tab>
            )}
            <Tabs.Tab value="editor" leftSection={<Code size={14} />}>
              HTML Editoru
            </Tabs.Tab>
            <Tabs.Tab value="preview" leftSection={<Eye size={14} />}>
              Canli Onizleme
            </Tabs.Tab>
          </Tabs.List>

          {/* ---- CLONE TAB ---- */}
          {!editingId && (
            <Tabs.Panel value="clone" style={{ flex: 1 }}>
              <Stack gap="lg" maw={600} mx="auto" mt="xl">
                <Card
                  padding="xl"
                  style={{
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    border: '1px solid var(--mantine-color-dark-4)',
                  }}
                >
                  <Stack gap="md" align="center">
                    <ThemeIcon size={64} radius="xl" variant="light" color="electricBlue">
                      <LinkIcon size={32} />
                    </ThemeIcon>
                    <Title order={3} c="white" ta="center">
                      Web Sayfasi Klonla
                    </Title>
                    <Text size="sm" c="dimmed" ta="center">
                      Hedef sitenin URL adresini girin. Sistem sayfayi indirecek,
                      baglantilari mutlak URL'lere donusturecek ve kimlik bilgisi yakalama
                      scriptini otomatik olarak enjekte edecektir.
                    </Text>

                    <TextInput
                      placeholder="https://login.example.com"
                      leftSection={<Globe size={16} />}
                      value={cloneUrl}
                      onChange={(e) => setCloneUrl(e.currentTarget.value)}
                      w="100%"
                      size="md"
                      onKeyDown={(e) => { if (e.key === 'Enter') handleClone(); }}
                    />

                    <Button
                      fullWidth
                      size="md"
                      color="electricBlue"
                      leftSection={<Copy size={16} />}
                      loading={cloning}
                      onClick={handleClone}
                      disabled={!cloneUrl.trim()}
                    >
                      Sayfayi Klonla
                    </Button>
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>
          )}

          {/* ---- UPLOAD TAB ---- */}
          {!editingId && (
            <Tabs.Panel value="upload" style={{ flex: 1 }}>
              <Stack gap="lg" maw={600} mx="auto" mt="xl">
                <Card
                  padding="xl"
                  style={{
                    backgroundColor: 'var(--mantine-color-dark-6)',
                    border: '1px solid var(--mantine-color-dark-4)',
                  }}
                >
                  <Stack gap="md" align="center">
                    <ThemeIcon size={64} radius="xl" variant="light" color="grape">
                      <Upload size={32} />
                    </ThemeIcon>
                    <Title order={3} c="white" ta="center">
                      ZIP Sablon Yukle
                    </Title>
                    <Text size="sm" c="dimmed" ta="center">
                      Hazir bir landing page sablonunu ZIP dosyasi olarak yukleyin.
                      ZIP icinde bir index.html dosyasi bulunmalidir. Sistem formlari
                      otomatik olarak yakalama endpoint'ine yonlendirecektir.
                    </Text>

                    <TextInput
                      label="Sayfa Adi (Opsiyonel)"
                      placeholder="Ornegin: Office 365 Giris"
                      value={uploadName}
                      onChange={(e) => setUploadName(e.currentTarget.value)}
                      w="100%"
                      size="md"
                      styles={{ label: { color: 'var(--mantine-color-dark-1)' } }}
                    />

                    <FileInput
                      label="ZIP Dosyasi"
                      placeholder="Dosya secin veya surukleyin..."
                      accept=".zip"
                      value={uploadFile}
                      onChange={setUploadFile}
                      w="100%"
                      size="md"
                      leftSection={<FileText size={16} />}
                      styles={{ label: { color: 'var(--mantine-color-dark-1)' } }}
                    />

                    {uploadFile && (
                      <Text size="xs" c="dimmed">
                        Secilen dosya: {uploadFile.name} ({(uploadFile.size / 1024).toFixed(1)} KB)
                      </Text>
                    )}

                    <Button
                      fullWidth
                      size="md"
                      color="grape"
                      leftSection={<Upload size={16} />}
                      loading={uploading}
                      onClick={handleUpload}
                      disabled={!uploadFile}
                    >
                      Sablonu Yukle
                    </Button>
                  </Stack>
                </Card>
              </Stack>
            </Tabs.Panel>
          )}

          {/* ---- EDITOR TAB ---- */}
          <Tabs.Panel value="editor" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <Group gap="md" mb="sm" align="flex-end">
              <TextInput
                label="Sayfa Adi"
                placeholder="Ornegin: Office 365 Giris"
                value={pageName}
                onChange={(e) => setPageName(e.currentTarget.value)}
                flex={1}
                required
                styles={{ label: { color: 'var(--mantine-color-dark-1)' } }}
              />
              <TextInput
                label="Slug"
                placeholder="office-365-giris"
                value={pageSlug}
                onChange={(e) => setPageSlug(e.currentTarget.value)}
                w={200}
                styles={{ label: { color: 'var(--mantine-color-dark-1)' } }}
              />
              <Switch
                label="Varsayilan"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.currentTarget.checked)}
                color="cyberGreen"
                styles={{ label: { color: 'var(--mantine-color-dark-1)' } }}
              />
            </Group>

            <Box
              style={{
                flex: 1,
                border: '1px solid var(--mantine-color-dark-4)',
                borderRadius: 'var(--mantine-radius-md)',
                overflow: 'hidden',
              }}
            >
              <Editor
                height="100%"
                defaultLanguage="html"
                value={htmlCode}
                onChange={(val) => setHtmlCode(val || '')}
                theme="vs-dark"
                options={{
                  minimap: { enabled: false },
                  fontSize: 13,
                  wordWrap: 'on',
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                }}
              />
            </Box>

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                onClick={() => { setBuilderOpen(false); resetBuilder(); }}
              >
                Iptal
              </Button>
              <Button
                color="electricBlue"
                onClick={handleSave}
                loading={saving}
                disabled={!pageName.trim() || !htmlCode.trim()}
              >
                {editingId ? 'Guncelle' : 'Kaydet'}
              </Button>
            </Group>
          </Tabs.Panel>

          {/* ---- PREVIEW TAB ---- */}
          <Tabs.Panel value="preview" style={{ flex: 1 }}>
            {htmlCode ? (
              <Box
                style={{
                  flex: 1,
                  height: '100%',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: 'var(--mantine-radius-md)',
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                }}
              >
                <iframe
                  srcDoc={htmlCode}
                  style={{ width: '100%', height: '100%', border: 'none', minHeight: '500px' }}
                  title="Live Preview"
                  sandbox="allow-same-origin allow-scripts allow-forms"
                />
              </Box>
            ) : (
              <Center h={400}>
                <Stack align="center" gap="sm">
                  <ThemeIcon size={48} variant="light" color="gray" radius="xl">
                    <Eye size={24} />
                  </ThemeIcon>
                  <Text c="dimmed" ta="center">
                    Onizleme icin once bir site klonlayin veya HTML kodu yazin.
                  </Text>
                </Stack>
              </Center>
            )}
          </Tabs.Panel>
        </Tabs>
      </Modal>
    </Stack>
  );
}
