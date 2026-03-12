import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card,
  Group,
  Text,
  Title,
  SimpleGrid,
  Table,
  Badge,
  Button,
  Stack,
  Center,
  Loader,
  Alert,
  ThemeIcon,
  TextInput,
  Select,
  ActionIcon,
  Checkbox,
  ScrollArea,
  Tooltip,
  Paper,
  Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  ArrowLeft,
  Play,
  Pause,
  CheckCircle,
  RotateCw,
  Users,
  Send,
  MousePointerClick,
  FileWarning,
  RefreshCw,
  AlertTriangle,
  Search,
  X,
  UserPlus,
  Filter,
} from 'lucide-react';
import { api } from '../api';
import type { CampaignDetail as CampaignDetailType, Recipient, LdapSyncResult, LdapUser, LdapFaculty } from '../types';
import { campaignStatusMap, recipientStatusMap, eventTypeMap } from '../utils/statusHelpers';
import dayjs from 'dayjs';

const FACULTY_LABELS: Record<string, string> = {
  engineering: 'Muhendislik',
  humanities: 'Insan Bilimleri',
  rectorate: 'Rektorluk',
};

export function CampaignDetail() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<CampaignDetailType | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [syncLoading, setSyncLoading] = useState(false);
  const [syncResult, setSyncResult] = useState<LdapSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [syncFaculty, setSyncFaculty] = useState<string>('all');
  const [faculties, setFaculties] = useState<LdapFaculty[]>([]);

  // LDAP preview & manual selection
  const [ldapUsers, setLdapUsers] = useState<LdapUser[]>([]);
  const [selectedLdapEmails, setSelectedLdapEmails] = useState<Set<string>>(new Set());
  const [showLdapPanel, setShowLdapPanel] = useState(false);
  const [ldapLoading, setLdapLoading] = useState(false);
  const [ldapSearch, setLdapSearch] = useState('');
  const [addingSelected, setAddingSelected] = useState(false);

  // Removing recipients
  const [removingId, setRemovingId] = useState<string | null>(null);

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
    api.getLdapFaculties().then(r => setFaculties(r.faculties)).catch(() => {});
  }, [id]);

  // ── Filtered sync (by faculty) ──
  const handleSync = async () => {
    if (!id) return;
    setSyncLoading(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await api.syncLdapUsers(id, syncFaculty);
      setSyncResult(result);
      notifications.show({
        title: 'LDAP Senkronizasyonu',
        message: `${result.synced} eklendi, ${result.skipped} atlandi`,
        color: result.errors > 0 ? 'yellow' : 'cyberGreen',
      });
      await fetchRecipients();
      await fetchCampaign();
    } catch {
      setError('LDAP senkronizasyonu basarisiz oldu');
      notifications.show({ title: 'Hata', message: 'LDAP senkronizasyonu basarisiz', color: 'alertRed' });
    } finally {
      setSyncLoading(false);
    }
  };

  // ── Load LDAP users for manual selection ──
  const handleLoadLdapUsers = async () => {
    setLdapLoading(true);
    setShowLdapPanel(true);
    try {
      const result = await api.getLdapUsers(syncFaculty !== 'all' ? syncFaculty : undefined);
      setLdapUsers(result.users);
      setSelectedLdapEmails(new Set());
    } catch {
      notifications.show({ title: 'Hata', message: 'LDAP kullanicilari yuklenemedi', color: 'alertRed' });
    } finally {
      setLdapLoading(false);
    }
  };

  // ── Add selected LDAP users as recipients ──
  const handleAddSelected = async () => {
    if (!id || selectedLdapEmails.size === 0) return;
    setAddingSelected(true);
    try {
      const currentEmails = new Set(recipients.map(r => r.email.toLowerCase()));
      const toAdd = ldapUsers
        .filter(u => selectedLdapEmails.has(u.email) && !currentEmails.has(u.email.toLowerCase()))
        .map(u => ({
          email: u.email,
          firstName: u.firstName || u.fullName || '',
          lastName: u.lastName || '',
        }));

      if (toAdd.length === 0) {
        notifications.show({ title: 'Bilgi', message: 'Secilen kullanicilar zaten listede', color: 'yellow' });
        return;
      }

      await api.addRecipientsBulk(id, toAdd);
      notifications.show({
        title: 'Basarili',
        message: `${toAdd.length} alici eklendi`,
        color: 'cyberGreen',
      });
      setSelectedLdapEmails(new Set());
      setShowLdapPanel(false);
      await fetchRecipients();
      await fetchCampaign();
    } catch {
      notifications.show({ title: 'Hata', message: 'Alicilar eklenemedi', color: 'alertRed' });
    } finally {
      setAddingSelected(false);
    }
  };

  // ── Remove single recipient ──
  const handleRemoveRecipient = async (recipientId: string, email: string) => {
    setRemovingId(recipientId);
    try {
      await api.deleteRecipient(recipientId);
      setRecipients(prev => prev.filter(r => r.id !== recipientId));
      notifications.show({ title: 'Silindi', message: `${email} listeden cikarildi`, color: 'gray' });
      await fetchCampaign();
    } catch {
      notifications.show({ title: 'Hata', message: 'Alici silinemedi', color: 'alertRed' });
    } finally {
      setRemovingId(null);
    }
  };

  // ── Campaign lifecycle actions ──
  const handleAction = async (action: 'start' | 'pause' | 'resume' | 'complete') => {
    if (!id) return;
    if (action === 'start' && recipients.length === 0) {
      setError('Kampanyayi baslatmadan once alici eklemelisiniz (LDAP Senkronize)');
      return;
    }
    setActionLoading(true);
    setError(null);
    const labels: Record<string, string> = {
      start: 'baslatildi', pause: 'duraklatildi', resume: 'devam ettiriliyor', complete: 'tamamlandi',
    };
    const errorLabels: Record<string, string> = {
      start: 'baslatilamadi', pause: 'duraklattilamadi', resume: 'devam ettirilemedi', complete: 'tamamlanamadi',
    };
    try {
      if (action === 'start') await api.startCampaign(id);
      else if (action === 'pause') await api.pauseCampaign(id);
      else if (action === 'resume') await api.resumeCampaign(id);
      else await api.completeCampaign(id);
      notifications.show({ title: 'Basarili', message: `Kampanya ${labels[action]}`, color: 'cyberGreen' });
      await fetchCampaign();
      if (action === 'start') await fetchRecipients();
    } catch {
      setError(`Kampanya ${errorLabels[action]}`);
      notifications.show({ title: 'Hata', message: `Kampanya ${errorLabels[action]}`, color: 'alertRed' });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Filtered recipients (search) ──
  const filteredRecipients = useMemo(() => {
    if (!searchQuery.trim()) return recipients;
    const q = searchQuery.toLowerCase();
    return recipients.filter(r =>
      r.email.toLowerCase().includes(q) ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q) ||
      (r.department || '').toLowerCase().includes(q) ||
      (r.faculty || '').toLowerCase().includes(q)
    );
  }, [recipients, searchQuery]);

  // ── Filtered LDAP users (panel search) ──
  const filteredLdapUsers = useMemo(() => {
    if (!ldapSearch.trim()) return ldapUsers;
    const q = ldapSearch.toLowerCase();
    return ldapUsers.filter(u =>
      u.email.toLowerCase().includes(q) ||
      u.fullName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      (u.department || '').toLowerCase().includes(q)
    );
  }, [ldapUsers, ldapSearch]);

  const toggleLdapSelection = (email: string) => {
    setSelectedLdapEmails(prev => {
      const next = new Set(prev);
      if (next.has(email)) next.delete(email);
      else next.add(email);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLdapEmails.size === filteredLdapUsers.length) {
      setSelectedLdapEmails(new Set());
    } else {
      setSelectedLdapEmails(new Set(filteredLdapUsers.map(u => u.email)));
    }
  };

  if (loading) {
    return <Center h={400}><Loader color="electricBlue" size="lg" /></Center>;
  }

  if (!campaign) {
    return (
      <Center h={400}>
        <Stack align="center" gap="sm">
          <Text c="dimmed" size="lg">{error || 'Kampanya bulunamadi'}</Text>
          <Button component={Link} to="/campaigns" color="electricBlue">Geri Don</Button>
        </Stack>
      </Center>
    );
  }

  const { stats } = campaign;
  const sm = campaignStatusMap[campaign.status];
  const isDraft = campaign.status === 'draft';
  const existingEmails = new Set(recipients.map(r => r.email.toLowerCase()));

  return (
    <Stack gap="lg">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <div>
          <Button
            component={Link}
            to="/campaigns"
            variant="subtle"
            color="electricBlue"
            leftSection={<ArrowLeft size={14} />}
            size="xs"
            mb="xs"
            px={0}
          >
            Kampanyalar
          </Button>
          <Title order={2} c="white">{campaign.name}</Title>
          {campaign.description && <Text size="sm" c="dimmed">{campaign.description}</Text>}
        </div>
        <Group gap="sm">
          {campaign.status === 'draft' && (
            <Button
              color="cyberGreen"
              leftSection={<Play size={16} />}
              onClick={() => handleAction('start')}
              loading={actionLoading}
            >
              Kampanyayi Baslat
            </Button>
          )}
          {campaign.status === 'active' && (
            <>
              <Button variant="light" color="yellow" leftSection={<Pause size={16} />} onClick={() => handleAction('pause')} loading={actionLoading}>
                Duraktat
              </Button>
              <Button color="cyberGreen" leftSection={<CheckCircle size={16} />} onClick={() => handleAction('complete')} loading={actionLoading}>
                Tamamla
              </Button>
            </>
          )}
          {campaign.status === 'paused' && (
            <>
              <Button color="electricBlue" leftSection={<RotateCw size={16} />} onClick={() => handleAction('resume')} loading={actionLoading}>
                Devam Et
              </Button>
              <Button variant="light" color="gray" leftSection={<CheckCircle size={16} />} onClick={() => handleAction('complete')} loading={actionLoading}>
                Tamamla
              </Button>
            </>
          )}
        </Group>
      </Group>

      {error && <Alert color="alertRed" icon={<AlertTriangle size={16} />}>{error}</Alert>}

      {/* Campaign Meta */}
      <Group gap="md">
        <Badge color={sm.color} variant="light" size="lg">{sm.label}</Badge>
        <Text size="sm" c="dimmed">Sablon: {campaign.templateMode === 'specific' ? 'Belirli' : 'Rastgele'}</Text>
        <Text size="sm" c="dimmed">Domain: {campaign.phishDomain || '-'}</Text>
        <Text size="sm" c="dimmed">Olusturulma: {dayjs(campaign.createdAt).format('DD.MM.YYYY HH:mm')}</Text>
      </Group>

      {/* Stats Grid */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Toplam Hedef</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{stats.totalTargets}</Text>
            </div>
            <ThemeIcon variant="light" color="electricBlue" size="lg" radius="md"><Users size={18} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Gonderilen E-posta</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{stats.emailsSent}</Text>
            </div>
            <ThemeIcon variant="light" color="cyberGreen" size="lg" radius="md"><Send size={18} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Tiklama</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{stats.clicked}</Text>
              <Text size="xs" c="dimmed">{stats.clickRate.toFixed(1)}%</Text>
            </div>
            <ThemeIcon variant="light" color="yellow" size="lg" radius="md"><MousePointerClick size={18} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Form Gonderimi</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{stats.submitted}</Text>
              <Text size="xs" c="dimmed">{stats.submitRate.toFixed(1)}%</Text>
            </div>
            <ThemeIcon variant="light" color="alertRed" size="lg" radius="md"><FileWarning size={18} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* ── Recipients Section ── */}
      <Card>
        <Stack gap="md">
          {/* Title row */}
          <Group justify="space-between">
            <Text fw={600} c="white" size="lg">Alicilar ({recipients.length})</Text>
            {isDraft && (
              <Group gap="xs">
                <Select
                  size="xs"
                  w={200}
                  placeholder="Fakulte Filtresi"
                  leftSection={<Filter size={14} />}
                  data={[
                    { value: 'all', label: 'Tum Fakulteler' },
                    ...faculties.map(f => ({
                      value: f.name,
                      label: `${FACULTY_LABELS[f.name] || f.name} (${f.count})`,
                    })),
                  ]}
                  value={syncFaculty}
                  onChange={v => setSyncFaculty(v || 'all')}
                />
                <Button
                  color="electricBlue"
                  leftSection={<RefreshCw size={14} />}
                  onClick={handleSync}
                  loading={syncLoading}
                  size="xs"
                >
                  Toplu Senkronize
                </Button>
                <Button
                  variant="light"
                  color="electricBlue"
                  leftSection={<UserPlus size={14} />}
                  onClick={handleLoadLdapUsers}
                  loading={ldapLoading}
                  size="xs"
                >
                  Tek Tek Sec
                </Button>
              </Group>
            )}
          </Group>

          {syncResult && (
            <Alert color={syncResult.errors > 0 ? 'yellow' : 'cyberGreen'} variant="light">
              LDAP Senkronizasyonu: {syncResult.synced} eklendi, {syncResult.skipped} atlandi, {syncResult.errors} hata
            </Alert>
          )}

          {/* ── LDAP Manual Selection Panel ── */}
          {showLdapPanel && isDraft && (
            <Paper p="md" radius="md" style={{ backgroundColor: '#1A1B1E', border: '1px solid #373A40' }}>
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <Text fw={600} c="white" size="sm">LDAP Dizini — Kullanici Sec</Text>
                  <Badge size="sm" variant="light" color="electricBlue">{ldapUsers.length} kullanici</Badge>
                </Group>
                <Group gap="xs">
                  <Button
                    size="xs"
                    color="cyberGreen"
                    leftSection={<UserPlus size={14} />}
                    onClick={handleAddSelected}
                    loading={addingSelected}
                    disabled={selectedLdapEmails.size === 0}
                  >
                    Secilenleri Ekle ({selectedLdapEmails.size})
                  </Button>
                  <ActionIcon
                    variant="subtle"
                    color="gray"
                    onClick={() => { setShowLdapPanel(false); setSelectedLdapEmails(new Set()); }}
                  >
                    <X size={16} />
                  </ActionIcon>
                </Group>
              </Group>

              <TextInput
                placeholder="Isim, soyisim veya e-posta ile ara..."
                leftSection={<Search size={14} />}
                size="xs"
                mb="sm"
                value={ldapSearch}
                onChange={e => setLdapSearch(e.currentTarget.value)}
              />

              {ldapLoading ? (
                <Center py="md"><Loader size="sm" color="electricBlue" /></Center>
              ) : (
                <ScrollArea h={250}>
                  <Table highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th w={40}>
                          <Checkbox
                            size="xs"
                            checked={filteredLdapUsers.length > 0 && selectedLdapEmails.size === filteredLdapUsers.length}
                            indeterminate={selectedLdapEmails.size > 0 && selectedLdapEmails.size < filteredLdapUsers.length}
                            onChange={toggleSelectAll}
                          />
                        </Table.Th>
                        <Table.Th><Text size="xs" c="dimmed">Ad Soyad</Text></Table.Th>
                        <Table.Th><Text size="xs" c="dimmed">E-posta</Text></Table.Th>
                        <Table.Th><Text size="xs" c="dimmed">Fakulte</Text></Table.Th>
                        <Table.Th><Text size="xs" c="dimmed">Departman</Text></Table.Th>
                        <Table.Th><Text size="xs" c="dimmed">Rol</Text></Table.Th>
                        <Table.Th w={60}></Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {filteredLdapUsers.map(u => {
                        const alreadyAdded = existingEmails.has(u.email.toLowerCase());
                        return (
                          <Table.Tr
                            key={u.dn}
                            style={{ opacity: alreadyAdded ? 0.4 : 1 }}
                          >
                            <Table.Td>
                              <Checkbox
                                size="xs"
                                checked={selectedLdapEmails.has(u.email)}
                                onChange={() => toggleLdapSelection(u.email)}
                                disabled={alreadyAdded}
                              />
                            </Table.Td>
                            <Table.Td><Text size="xs">{u.fullName}</Text></Table.Td>
                            <Table.Td><Text size="xs" c="dimmed">{u.email}</Text></Table.Td>
                            <Table.Td>
                              <Badge size="xs" variant="light" color="electricBlue">
                                {FACULTY_LABELS[u.faculty || ''] || u.faculty || '-'}
                              </Badge>
                            </Table.Td>
                            <Table.Td><Text size="xs" c="dimmed">{u.department || '-'}</Text></Table.Td>
                            <Table.Td><Text size="xs" c="dimmed">{u.title || '-'}</Text></Table.Td>
                            <Table.Td>
                              {alreadyAdded && (
                                <Badge size="xs" variant="light" color="gray">Eklendi</Badge>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        );
                      })}
                    </Table.Tbody>
                  </Table>
                  {filteredLdapUsers.length === 0 && (
                    <Center py="md"><Text size="sm" c="dimmed">Sonuc bulunamadi</Text></Center>
                  )}
                </ScrollArea>
              )}
            </Paper>
          )}

          <Divider color="dark.4" />

          {/* ── Search bar for current recipients ── */}
          <TextInput
            placeholder="Alicilarda ara (isim, soyisim, e-posta, departman)..."
            leftSection={<Search size={16} />}
            value={searchQuery}
            onChange={e => setSearchQuery(e.currentTarget.value)}
            rightSection={
              searchQuery ? (
                <ActionIcon variant="subtle" color="gray" onClick={() => setSearchQuery('')} size="sm">
                  <X size={14} />
                </ActionIcon>
              ) : null
            }
          />

          {searchQuery && (
            <Text size="xs" c="dimmed">{filteredRecipients.length} / {recipients.length} alici gosteriliyor</Text>
          )}

          {/* ── Recipients Table ── */}
          {recipients.length === 0 ? (
            <Center py="xl">
              <Stack align="center" gap="sm">
                <Text c="dimmed">Henuz alici eklenmemis.</Text>
                {isDraft && (
                  <Text size="sm" c="dimmed">
                    Yukardaki "Toplu Senkronize" veya "Tek Tek Sec" butonlarini kullanin.
                  </Text>
                )}
              </Stack>
            </Center>
          ) : (
            <ScrollArea>
              <Table highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>E-posta</Table.Th>
                    <Table.Th>Ad</Table.Th>
                    <Table.Th>Soyad</Table.Th>
                    <Table.Th>Fakulte</Table.Th>
                    <Table.Th>Departman</Table.Th>
                    <Table.Th>Rol</Table.Th>
                    <Table.Th>Durum</Table.Th>
                    <Table.Th>Gonderim</Table.Th>
                    {isDraft && <Table.Th w={50}></Table.Th>}
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {filteredRecipients.map(r => {
                    const rs = recipientStatusMap[r.status];
                    return (
                      <Table.Tr key={r.id}>
                        <Table.Td><Text size="sm">{r.email}</Text></Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">{r.firstName}</Text></Table.Td>
                        <Table.Td><Text size="sm" c="dimmed">{r.lastName}</Text></Table.Td>
                        <Table.Td>
                          {r.faculty ? (
                            <Badge size="xs" variant="light" color="electricBlue">
                              {FACULTY_LABELS[r.faculty] || r.faculty}
                            </Badge>
                          ) : (
                            <Text size="xs" c="dimmed">-</Text>
                          )}
                        </Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{r.department || '-'}</Text></Table.Td>
                        <Table.Td><Text size="xs" c="dimmed">{r.role || '-'}</Text></Table.Td>
                        <Table.Td><Badge color={rs.color} variant="light" size="sm">{rs.label}</Badge></Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {r.sentAt ? dayjs(r.sentAt).format('DD.MM HH:mm') : '-'}
                          </Text>
                        </Table.Td>
                        {isDraft && (
                          <Table.Td>
                            <Tooltip label="Aliciyi Kaldir" position="left">
                              <ActionIcon
                                variant="subtle"
                                color="alertRed"
                                size="sm"
                                loading={removingId === r.id}
                                onClick={() => handleRemoveRecipient(r.id, r.email)}
                              >
                                <X size={14} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        )}
                      </Table.Tr>
                    );
                  })}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          )}
        </Stack>
      </Card>

      {/* Event History */}
      <Card>
        <Text fw={600} c="white" mb="md">Etkinlik Gecmisi</Text>
        {campaign.events.length === 0 ? (
          <Center py="lg"><Text c="dimmed">Henuz etkinlik kaydedilmemis.</Text></Center>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Zaman</Table.Th>
                <Table.Th>Tur</Table.Th>
                <Table.Th>Alici Token</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campaign.events.map(event => {
                const et = eventTypeMap[event.type];
                return (
                  <Table.Tr key={event.id}>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{dayjs(event.createdAt).format('DD.MM.YYYY HH:mm:ss')}</Text>
                    </Table.Td>
                    <Table.Td><Badge color={et.color} variant="light" size="sm">{et.label}</Badge></Table.Td>
                    <Table.Td><Text size="sm" ff="monospace" c="dimmed">{event.recipientToken}</Text></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
