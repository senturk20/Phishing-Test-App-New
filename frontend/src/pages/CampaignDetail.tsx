import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { api } from '../api';
import type { CampaignDetail as CampaignDetailType, Recipient, LdapSyncResult } from '../types';
import { campaignStatusMap, recipientStatusMap, eventTypeMap } from '../utils/statusHelpers';
import dayjs from 'dayjs';

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

  const handleSync = async () => {
    if (!id) return;
    setSyncLoading(true);
    setSyncResult(null);
    setError(null);
    try {
      const result = await api.syncLdapUsers(id);
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

      {/* Recipients */}
      <Card>
        <Group justify="space-between" mb="md">
          <Text fw={600} c="white">Alicilar ({recipients.length})</Text>
          {campaign.status === 'draft' && (
            <Button
              color="electricBlue"
              leftSection={<RefreshCw size={16} />}
              onClick={handleSync}
              loading={syncLoading}
              size="sm"
            >
              LDAP Senkronize Et
            </Button>
          )}
        </Group>

        {syncResult && (
          <Alert color={syncResult.errors > 0 ? 'yellow' : 'cyberGreen'} mb="md" variant="light">
            LDAP Senkronizasyonu: {syncResult.synced} eklendi, {syncResult.skipped} atlandi, {syncResult.errors} hata
          </Alert>
        )}

        {recipients.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed">Henuz alici eklenmemis.</Text>
              {campaign.status === 'draft' && (
                <Text size="sm" c="dimmed">
                  "LDAP Senkronize Et" butonuna tiklayarak LDAP dizininden alicilari iceri aktarin.
                </Text>
              )}
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>E-posta</Table.Th>
                <Table.Th>Ad</Table.Th>
                <Table.Th>Soyad</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th>Gonderim Zamani</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {recipients.map(r => {
                const rs = recipientStatusMap[r.status];
                return (
                  <Table.Tr key={r.id}>
                    <Table.Td><Text size="sm">{r.email}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{r.firstName}</Text></Table.Td>
                    <Table.Td><Text size="sm" c="dimmed">{r.lastName}</Text></Table.Td>
                    <Table.Td><Badge color={rs.color} variant="light" size="sm">{rs.label}</Badge></Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {r.sentAt ? dayjs(r.sentAt).format('DD.MM.YYYY HH:mm') : '-'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
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
