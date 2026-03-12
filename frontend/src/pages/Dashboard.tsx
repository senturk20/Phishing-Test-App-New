import { useEffect, useState, useMemo } from 'react';
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
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import {
  Send,
  MailOpen,
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
import type { Campaign, DashboardStats, DepartmentStat } from '../types';
import { campaignStatusMap } from '../utils/statusHelpers';
import dayjs from 'dayjs';

const CHART_COLORS = {
  bg: '#25262B',
  border: '#373A40',
  text: '#A6A7AB',
  blue: '#1a80ff',
  cyan: '#22b8cf',
  green: '#00e673',
  red: '#e60000',
  yellow: '#ffd43b',
};

const DEPT_PIE_COLORS = ['#1a80ff', '#e60000', '#ffd43b', '#00e673', '#b84dff', '#ff6b35'];

const FACULTY_LABELS: Record<string, string> = {
  engineering: 'Muhendislik',
  humanities: 'Insan Bilimleri',
  rectorate: 'Rektorluk',
  'Ozel Gonderim': 'Ozel Gonderim',
};

export function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deptStats, setDeptStats] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignStats, setCampaignStats] = useState<Record<string, { sent: number; opened: number; clicked: number; submitted: number }>>({});

  // Fetch dashboard data
  useEffect(() => {
    Promise.all([
      api.getCampaigns(),
      api.getDashboardStats(),
      api.getDepartmentStats().catch(() => []),
    ])
      .then(([c, s, d]) => { setCampaigns(c); setStats(s); setDeptStats(d); })
      .catch(() => setError('Veriler yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  // Fetch per-campaign stats for bar chart
  useEffect(() => {
    const top = campaigns.slice(0, 6);
    if (top.length === 0) return;
    Promise.all(top.map(c => api.getCampaign(c.id).catch(() => null))).then(details => {
      const map: Record<string, { sent: number; opened: number; clicked: number; submitted: number }> = {};
      details.forEach(d => {
        if (d) map[d.id] = { sent: d.stats.emailsSent, opened: d.stats.opened ?? 0, clicked: d.stats.clicked, submitted: d.stats.submitted };
      });
      setCampaignStats(map);
    });
  }, [campaigns]);

  // Derived data — always computed, never conditionally
  const s = stats;
  const openRate = s?.overallOpenRate ?? 0;
  const clickRate = s?.overallClickRate ?? 0;
  const submitRate = s?.overallSubmitRate ?? 0;

  const barData = useMemo(() => campaigns.slice(0, 6).map(c => {
    const cs = campaignStats[c.id];
    return {
      name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
      hedef: c.targetCount || 0,
      gonderilen: cs?.sent ?? 0,
      acilma: cs?.opened ?? 0,
      tiklama: cs?.clicked ?? 0,
      gonderim: cs?.submitted ?? 0,
    };
  }), [campaigns, campaignStats]);

  const statusCounts = useMemo(() => ({
    draft: campaigns.filter(c => c.status === 'draft').length,
    active: campaigns.filter(c => c.status === 'active').length,
    completed: campaigns.filter(c => c.status === 'completed').length,
    paused: campaigns.filter(c => c.status === 'paused').length,
  }), [campaigns]);

  const pieData = useMemo(() => [
    { name: 'Taslak', value: statusCounts.draft, color: '#909296' },
    { name: 'Aktif', value: statusCounts.active, color: CHART_COLORS.blue },
    { name: 'Tamamlandi', value: statusCounts.completed, color: CHART_COLORS.green },
    { name: 'Duraklatildi', value: statusCounts.paused, color: CHART_COLORS.yellow },
  ].filter(d => d.value > 0), [statusCounts]);

  // ── Loading state ──
  if (loading) {
    return (
      <Center h={400}>
        <Loader color="electricBlue" size="lg" />
      </Center>
    );
  }

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
      <SimpleGrid cols={{ base: 1, xs: 2, md: 5 }}>
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
              <Text size="xs" tt="uppercase" fw={600} c="dimmed">Acilma Orani</Text>
              <Text size="xl" fw={700} c="white" mt={4}>{openRate.toFixed(1)}%</Text>
              <Text size="xs" c="dimmed">{s?.totalOpened ?? 0} acilma</Text>
            </div>
            <ThemeIcon variant="light" color="cyan" size="lg" radius="md">
              <MailOpen size={18} />
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
                <YAxis tick={{ fill: CHART_COLORS.text, fontSize: 11 }} allowDecimals={false} />
                <RTooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.bg,
                    border: `1px solid ${CHART_COLORS.border}`,
                    borderRadius: 8,
                    color: '#fff',
                  }}
                />
                <Legend wrapperStyle={{ color: CHART_COLORS.text, fontSize: 11 }} />
                <Bar dataKey="hedef" name="Hedef" fill={CHART_COLORS.blue} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gonderilen" name="Gonderilen" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
                <Bar dataKey="acilma" name="Acilma" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
                <Bar dataKey="tiklama" name="Tiklama" fill={CHART_COLORS.yellow} radius={[4, 4, 0, 0]} />
                <Bar dataKey="gonderim" name="Form Gonderim" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} />
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

      {/* Department Vulnerability Analysis */}
      <Card>
        <Text fw={600} c="white" mb="md">Fakulte Bazli Zafiyet Analizi</Text>
        <Text size="xs" c="dimmed" mb="md">
          Gonderim Orani = (Form Gonderim / Tiklama) x 100
        </Text>
        {deptStats.length === 0 ? (
          <Center h={250}><Text c="dimmed">Henuz fakulte verisi yok</Text></Center>
        ) : (
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={deptStats.map(d => ({
                    name: FACULTY_LABELS[d.faculty] || d.faculty,
                    value: d.totalRecipients,
                    submissionRate: d.submissionRate,
                    totalClicked: d.totalClicked,
                    totalSubmitted: d.totalSubmitted,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={110}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {deptStats.map((_, i) => (
                    <Cell key={i} fill={DEPT_PIE_COLORS[i % DEPT_PIE_COLORS.length]} />
                  ))}
                </Pie>
                <RTooltip
                  contentStyle={{
                    backgroundColor: CHART_COLORS.bg,
                    border: `1px solid ${CHART_COLORS.border}`,
                    borderRadius: 8,
                    color: '#fff',
                    fontSize: 12,
                  }}
                  formatter={(_value: number, _name: string, props: { payload: { submissionRate: number; totalClicked: number; totalSubmitted: number; value: number } }) => {
                    const p = props.payload;
                    const rate = typeof p.submissionRate === 'number' ? p.submissionRate.toFixed(1) : '0.0';
                    return [
                      `${p.value} alici — ${rate}% gonderim (${p.totalSubmitted ?? 0}/${p.totalClicked ?? 0} tiklayandan)`,
                      'Fakulte',
                    ];
                  }}
                />
                <Legend
                  wrapperStyle={{ color: CHART_COLORS.text, fontSize: 12 }}
                  iconType="circle"
                />
              </PieChart>
            </ResponsiveContainer>

            <Stack gap="md" justify="center">
              {deptStats.map((d, i) => {
                const label = FACULTY_LABELS[d.faculty] || d.faculty;
                const rate = typeof d.submissionRate === 'number' ? d.submissionRate : 0;
                const riskColor = rate > 50 ? CHART_COLORS.red : rate > 25 ? CHART_COLORS.yellow : CHART_COLORS.green;
                return (
                  <Paper key={d.faculty} p="sm" radius="md" style={{ backgroundColor: '#1A1B1E', border: `1px solid ${CHART_COLORS.border}` }}>
                    <Group justify="space-between" mb={6}>
                      <Group gap="xs">
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: DEPT_PIE_COLORS[i % DEPT_PIE_COLORS.length] }} />
                        <Text size="sm" fw={500} c="white">{label}</Text>
                      </Group>
                      <Text size="sm" fw={700} style={{ color: riskColor }}>
                        {rate.toFixed(1)}%
                      </Text>
                    </Group>
                    <Paper h={6} radius="xl" bg="dark.5">
                      <Paper h={6} radius="xl" bg={riskColor} w={`${Math.min(rate, 100)}%`} />
                    </Paper>
                    <Group justify="space-between" mt={4}>
                      <Text size="xs" c="dimmed">{d.totalRecipients} alici</Text>
                      <Text size="xs" c="dimmed">{d.totalClicked} tiklama / {d.totalSubmitted} gonderim</Text>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </SimpleGrid>
        )}
      </Card>

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
                <Text size="sm" c="dimmed">Acilma Orani</Text>
                <Text size="sm" fw={600} c={openRate > 60 ? 'cyan' : 'cyan'}>{openRate.toFixed(1)}%</Text>
              </Group>
              <Paper h={8} radius="xl" bg="dark.5">
                <Paper h={8} radius="xl" bg="cyan" w={`${Math.min(openRate, 100)}%`} />
              </Paper>
            </div>
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
