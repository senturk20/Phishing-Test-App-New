import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
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
  Paper,
  RingProgress,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Send,
  MousePointerClick,
  FileWarning,
  Users,
  TrendingUp,
  PlusCircle,
  AlertTriangle,
  Mail,
  FileText,
} from 'lucide-react';
import { api } from '../api';
import type { Campaign, DashboardStats } from '../types';
import { campaignStatusMap } from '../utils/statusHelpers';
import dayjs from 'dayjs';

const CHART_COLORS = {
  bg: '#25262B',
  border: '#373A40',
  text: '#A6A7AB',
  blue: '#1a80ff',
  green: '#00e673',
  red: '#e60000',
  yellow: '#ffd43b',
};

export function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getCampaigns(), api.getDashboardStats()])
      .then(([c, s]) => { setCampaigns(c); setStats(s); })
      .catch(() => setError('Veriler yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Center h={400}>
        <Loader color="electricBlue" size="lg" />
      </Center>
    );
  }

  const s = stats;
  const clickRate = s?.overallClickRate ?? 0;
  const submitRate = s?.overallSubmitRate ?? 0;

  const barData = campaigns.slice(0, 6).map(c => ({
    name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
    hedef: c.targetCount,
  }));

  const statusCounts = {
    draft: campaigns.filter(c => c.status === 'draft').length,
    active: campaigns.filter(c => c.status === 'active').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
  };
  const pieData = [
    { name: 'Taslak', value: statusCounts.draft, color: '#909296' },
    { name: 'Aktif', value: statusCounts.active, color: CHART_COLORS.blue },
    { name: 'Tamamlandi', value: statusCounts.completed, color: CHART_COLORS.green },
    { name: 'Duraklatildi', value: statusCounts.paused, color: CHART_COLORS.yellow },
  ].filter(d => d.value > 0);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} c="white">Dashboard</Title>
          <Text size="sm" c="dimmed">Phishing simulasyon platformu genel bakis</Text>
        </div>
        <Button
          component={Link}
          to="/campaigns/new"
          leftSection={<PlusCircle size={16} />}
          color="electricBlue"
        >
          Yeni Kampanya
        </Button>
      </Group>

      {error && (
        <Alert color="alertRed" icon={<AlertTriangle size={16} />}>
          {error}
        </Alert>
      )}

      {/* Metric Cards */}
      <SimpleGrid cols={{ base: 1, xs: 2, md: 4 }}>
        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Toplam E-posta</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{s?.totalEmailsSent ?? 0}</Text>
            </div>
            <ThemeIcon variant="light" color="electricBlue" size="lg" radius="md">
              <Send size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Tiklama Orani</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{clickRate.toFixed(1)}%</Text>
              <Text size="xs" c="dimmed">{s?.totalClicks ?? 0} tiklama</Text>
            </div>
            <ThemeIcon variant="light" color="yellow" size="lg" radius="md">
              <MousePointerClick size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Form Gonderim</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{submitRate.toFixed(1)}%</Text>
              <Text size="xs" c="dimmed">{s?.totalSubmissions ?? 0} gonderim</Text>
            </div>
            <ThemeIcon variant="light" color="alertRed" size="lg" radius="md">
              <FileWarning size={18} />
            </ThemeIcon>
          </Group>
        </Card>

        <Card>
          <Group justify="space-between" align="flex-start">
            <div>
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Toplam Alici</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{s?.totalRecipients ?? 0}</Text>
              <Text size="xs" c="dimmed">{s?.totalCampaigns ?? 0} kampanya</Text>
            </div>
            <ThemeIcon variant="light" color="cyberGreen" size="lg" radius="md">
              <Users size={18} />
            </ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Charts Row */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card>
          <Text fw={600} c="white" mb="md">Kampanya Karsilastirmasi</Text>
          {barData.length === 0 ? (
            <Center h={200}><Text c="dimmed">Henuz kampanya yok</Text></Center>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                <XAxis dataKey="name" tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} />
                <RTooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.bg,
                    border: `1px solid ${CHART_COLORS.border}`,
                    borderRadius: 8,
                    color: '#fff',
                  }}
                />
                <Bar dataKey="hedef" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card>
          <Text fw={600} c="white" mb="md">Kampanya Durumlari</Text>
          {pieData.length === 0 ? (
            <Center h={200}><Text c="dimmed">Henuz kampanya yok</Text></Center>
          ) : (
            <Group justify="center" gap="xl">
              <RingProgress
                size={180}
                thickness={20}
                roundCaps
                sections={pieData.map(d => ({
                  value: (d.value / campaigns.length) * 100,
                  color: d.color,
                  tooltip: `${d.name}: ${d.value}`,
                }))}
                label={
                  <Center>
                    <div style={{ textAlign: 'center' }}>
                      <Text size="xl" fw={700} c="white">{campaigns.length}</Text>
                      <Text size="xs" c="dimmed">Toplam</Text>
                    </div>
                  </Center>
                }
              />
              <Stack gap="xs">
                {pieData.map(d => (
                  <Group key={d.name} gap="xs">
                    <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: d.color }} />
                    <Text size="sm" c="dimmed">{d.name}: {d.value}</Text>
                  </Group>
                ))}
              </Stack>
            </Group>
          )}
        </Card>
      </SimpleGrid>

      {/* Quick Actions + Risk */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card>
          <Text fw={600} c="white" mb="md">Hizli Islemler</Text>
          <Stack gap="sm">
            <Button component={Link} to="/campaigns/new" variant="light" color="electricBlue" leftSection={<PlusCircle size={16} />} fullWidth justify="flex-start">
              Yeni Kampanya Olustur
            </Button>
            <Button component={Link} to="/email-templates" variant="light" color="electricBlue" leftSection={<Mail size={16} />} fullWidth justify="flex-start">
              E-posta Sablonlari
            </Button>
            <Button component={Link} to="/landing-pages" variant="light" color="electricBlue" leftSection={<FileText size={16} />} fullWidth justify="flex-start">
              Landing Pages
            </Button>
          </Stack>
        </Card>

        <Card>
          <Group justify="space-between" mb="md">
            <Text fw={600} c="white">Risk Gostergesi</Text>
            <ThemeIcon variant="light" color={submitRate > 30 ? 'alertRed' : submitRate > 10 ? 'yellow' : 'cyberGreen'} size="md" radius="xl">
              <TrendingUp size={14} />
            </ThemeIcon>
          </Group>
          <Stack gap="md">
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" c="dimmed">Tiklama Orani</Text>
                <Text size="sm" fw={600} c={clickRate > 30 ? 'alertRed' : 'yellow'}>{clickRate.toFixed(1)}%</Text>
              </Group>
              <Paper h={8} radius="xl" bg="dark.5">
                <Paper h={8} radius="xl" bg={clickRate > 30 ? 'alertRed' : 'yellow'} w={`${Math.min(clickRate, 100)}%`} />
              </Paper>
            </div>
            <div>
              <Group justify="space-between" mb={4}>
                <Text size="sm" c="dimmed">Form Gonderim Orani</Text>
                <Text size="sm" fw={600} c={submitRate > 20 ? 'alertRed' : submitRate > 5 ? 'yellow' : 'cyberGreen'}>{submitRate.toFixed(1)}%</Text>
              </Group>
              <Paper h={8} radius="xl" bg="dark.5">
                <Paper h={8} radius="xl" bg={submitRate > 20 ? 'alertRed' : submitRate > 5 ? 'yellow' : 'cyberGreen'} w={`${Math.min(submitRate, 100)}%`} />
              </Paper>
            </div>
          </Stack>
        </Card>
      </SimpleGrid>

      {/* Recent Campaigns */}
      <Card>
        <Group justify="space-between" mb="md">
          <Text fw={600} c="white">Son Kampanyalar</Text>
          <Button component={Link} to="/campaigns" variant="subtle" color="electricBlue" size="xs">
            Tumunu Gor
          </Button>
        </Group>

        {campaigns.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed">Henuz kampanya olusturulmamis.</Text>
              <Button component={Link} to="/campaigns/new" color="electricBlue" size="sm">
                Ilk Kampanyayi Olustur
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kampanya Adi</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th>Sablon</Table.Th>
                <Table.Th>Domain</Table.Th>
                <Table.Th>Olusturulma</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campaigns.slice(0, 5).map(campaign => {
                const sm = campaignStatusMap[campaign.status];
                return (
                  <Table.Tr key={campaign.id}>
                    <Table.Td>
                      <Text component={Link} to={`/campaigns/${campaign.id}`} c="electricBlue" fw={500} size="sm" td="none">
                        {campaign.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={sm.color} variant="light" size="sm">{sm.label}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{campaign.templateMode === 'specific' ? 'Belirli' : 'Rastgele'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{campaign.phishDomain || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{dayjs(campaign.createdAt).format('DD.MM.YYYY')}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Button component={Link} to={`/campaigns/${campaign.id}`} variant="subtle" color="electricBlue" size="xs">
                        Detay
                      </Button>
                    </Table.Td>
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
