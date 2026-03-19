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
  Box,
  useMantineColorScheme,
} from '@mantine/core';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  Send,
  MailOpen,
  MousePointerClick,
  FileWarning,
  TrendingUp,
  PlusCircle,
  AlertTriangle,
  Download,
  ChevronRight,
} from 'lucide-react';
import { api } from '../api';
import type { Campaign, DashboardStats, DepartmentStat } from '../types';
import { campaignStatusMap } from '../utils/statusHelpers';
import dayjs from 'dayjs';

// Semantic colors stay constant — they're used for data, not surfaces
const DATA_COLORS = {
  blue: '#1a80ff',
  cyan: '#22b8cf',
  green: '#00e673',
  red: '#e60000',
  yellow: '#ffd43b',
  orange: '#ff6b35',
};

function useChartColors() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  return {
    ...DATA_COLORS,
    bg: isDark ? '#25262B' : '#ffffff',
    border: isDark ? '#373A40' : '#dee2e6',
    text: isDark ? '#A6A7AB' : '#495057',
    tooltipBg: isDark ? '#25262B' : '#ffffff',
    tooltipColor: isDark ? '#fff' : '#1a1a1a',
    surfaceBg: isDark ? '#1A1B1E' : '#f8f9fa',
    surfaceBorder: isDark ? '#373A40' : '#dee2e6',
  };
}

const DEPT_PIE_COLORS = ['#1a80ff', '#e60000', '#ffd43b', '#00e673', '#b84dff', '#ff6b35'];

const FACULTY_LABELS: Record<string, string> = {
  engineering: 'Muhendislik',
  humanities: 'Insan Bilimleri',
  rectorate: 'Rektorluk',
  'Ozel Gonderim': 'Ozel Gonderim',
};

// ── Funnel step component ──
function FunnelStep({
  label,
  count,
  rate,
  color,
  icon,
  maxWidth,
  isLast,
}: {
  label: string;
  count: number;
  rate: number | null;
  color: string;
  icon: React.ReactNode;
  maxWidth: string;
  isLast?: boolean;
}) {
  return (
    <Box>
      <Box
        style={{
          width: maxWidth,
          margin: '0 auto',
          background: `linear-gradient(135deg, ${color}18, ${color}08)`,
          border: `1px solid ${color}40`,
          borderRadius: 10,
          padding: '12px 20px',
          transition: 'all 0.2s',
        }}
      >
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <ThemeIcon
              variant="light"
              size="lg"
              radius="md"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {icon}
            </ThemeIcon>
            <div>
              <Text size="sm" fw={600} c="white">{label}</Text>
              <Text size="xs" c="dimmed">
                {rate !== null ? `%${rate.toFixed(1)}` : `${count} kisi`}
              </Text>
            </div>
          </Group>
          <Text size="xl" fw={700} style={{ color, fontVariantNumeric: 'tabular-nums' }}>
            {count}
          </Text>
        </Group>
      </Box>
      {!isLast && (
        <Center my={4}>
          <ChevronRight size={16} color="var(--mantine-color-dark-3)" style={{ transform: 'rotate(90deg)' }} />
        </Center>
      )}
    </Box>
  );
}

export function Dashboard() {
  const CHART_COLORS = useChartColors();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deptStats, setDeptStats] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [campaignStats, setCampaignStats] = useState<Record<string, { sent: number; opened: number; clicked: number; submitted: number; fileDownloaded: number }>>({});

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

  useEffect(() => {
    const top = campaigns.slice(0, 6);
    if (top.length === 0) return;
    Promise.all(top.map(c => api.getCampaign(c.id).catch(() => null))).then(details => {
      const map: Record<string, { sent: number; opened: number; clicked: number; submitted: number; fileDownloaded: number }> = {};
      details.forEach(d => {
        if (d) map[d.id] = { sent: d.stats.emailsSent, opened: d.stats.opened ?? 0, clicked: d.stats.clicked, submitted: d.stats.submitted, fileDownloaded: d.stats.fileDownloaded ?? 0 };
      });
      setCampaignStats(map);
    });
  }, [campaigns]);

  const s = stats;
  const openRate = s?.overallOpenRate ?? 0;
  const clickRate = s?.overallClickRate ?? 0;
  const submitRate = s?.overallSubmitRate ?? 0;
  const fileDownloadRate = s?.overallFileDownloadRate ?? 0;

  const barData = useMemo(() => campaigns.slice(0, 6).map(c => {
    const cs = campaignStats[c.id];
    return {
      name: c.name.length > 15 ? c.name.substring(0, 15) + '...' : c.name,
      gonderilen: cs?.sent ?? 0,
      acilma: cs?.opened ?? 0,
      tiklama: cs?.clicked ?? 0,
      dosyaIndirme: cs?.fileDownloaded ?? 0,
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

      {/* ── Phishing Funnel + Summary ── */}
      <SimpleGrid cols={{ base: 1, md: 2 }}>
        <Card>
          <Group justify="space-between" mb="md">
            <Text fw={600} c="white">Phishing Hunisi</Text>
            <Badge color="electricBlue" variant="light" size="sm">
              {s?.totalCampaigns ?? 0} kampanya
            </Badge>
          </Group>
          <Stack gap={0}>
            <FunnelStep
              label="Gonderim"
              count={s?.totalEmailsSent ?? 0}
              rate={null}
              color={CHART_COLORS.blue}
              icon={<Send size={18} />}
              maxWidth="100%"
            />
            <FunnelStep
              label="Acilma"
              count={s?.totalOpened ?? 0}
              rate={openRate}
              color={CHART_COLORS.cyan}
              icon={<MailOpen size={18} />}
              maxWidth="88%"
            />
            <FunnelStep
              label="Tiklama"
              count={s?.totalClicks ?? 0}
              rate={clickRate}
              color={CHART_COLORS.yellow}
              icon={<MousePointerClick size={18} />}
              maxWidth="72%"
            />
            <FunnelStep
              label="Dosya Indirme"
              count={s?.totalFileDownloads ?? 0}
              rate={fileDownloadRate}
              color={CHART_COLORS.orange}
              icon={<Download size={18} />}
              maxWidth="58%"
            />
            <FunnelStep
              label="Form Gonderim"
              count={s?.totalSubmissions ?? 0}
              rate={submitRate}
              color={CHART_COLORS.red}
              icon={<FileWarning size={18} />}
              maxWidth="44%"
              isLast
            />
          </Stack>
        </Card>

        {/* Right side: Campaign Status Ring + Risk */}
        <Stack gap="lg">
          <Card>
            <Text fw={600} c="white" mb="md">Kampanya Durumlari</Text>
            {pieData.length === 0 ? (
              <Center h={140}><Text c="dimmed">Henuz kampanya yok</Text></Center>
            ) : (
              <Group justify="center" gap="xl">
                <RingProgress
                  size={150}
                  thickness={18}
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
                      <div style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: d.color }} />
                      <Text size="sm" c="dimmed">{d.name}: {d.value}</Text>
                    </Group>
                  ))}
                </Stack>
              </Group>
            )}
          </Card>

          <Card>
            <Group justify="space-between" mb="md">
              <Text fw={600} c="white">Risk Gostergesi</Text>
              <ThemeIcon variant="light" color={submitRate > 30 ? 'alertRed' : submitRate > 10 ? 'yellow' : 'cyberGreen'} size="md" radius="xl">
                <TrendingUp size={14} />
              </ThemeIcon>
            </Group>
            <Stack gap="sm">
              {[
                { label: 'Acilma Orani', value: openRate, color: 'cyan' },
                { label: 'Tiklama Orani', value: clickRate, color: clickRate > 30 ? 'red' : 'yellow' },
                { label: 'Dosya Indirme', value: fileDownloadRate, color: 'orange' },
                { label: 'Form Gonderim', value: submitRate, color: submitRate > 20 ? 'red' : submitRate > 5 ? 'yellow' : 'green' },
              ].map(item => (
                <div key={item.label}>
                  <Group justify="space-between" mb={4}>
                    <Text size="xs" c="dimmed">{item.label}</Text>
                    <Text size="xs" fw={600} style={{ color: CHART_COLORS[item.color as keyof typeof CHART_COLORS] || item.color }}>
                      {item.value.toFixed(1)}%
                    </Text>
                  </Group>
                  <Paper h={6} radius="xl" style={{ backgroundColor: 'var(--app-track-bg)' }}>
                    <Paper
                      h={6}
                      radius="xl"
                      bg={item.color}
                      w={`${Math.min(item.value, 100)}%`}
                    />
                  </Paper>
                </div>
              ))}
            </Stack>
          </Card>
        </Stack>
      </SimpleGrid>

      {/* ── Campaign Comparison Chart ── */}
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
                  backgroundColor: CHART_COLORS.tooltipBg,
                  border: `1px solid ${CHART_COLORS.border}`,
                  borderRadius: 8,
                  color: CHART_COLORS.tooltipColor,
                }}
              />
              <Legend wrapperStyle={{ color: CHART_COLORS.text, fontSize: 11 }} />
              <Bar dataKey="gonderilen" name="Gonderilen" fill={CHART_COLORS.green} radius={[4, 4, 0, 0]} />
              <Bar dataKey="acilma" name="Acilma" fill={CHART_COLORS.cyan} radius={[4, 4, 0, 0]} />
              <Bar dataKey="tiklama" name="Tiklama" fill={CHART_COLORS.yellow} radius={[4, 4, 0, 0]} />
              <Bar dataKey="dosyaIndirme" name="Dosya Indirme" fill={CHART_COLORS.orange} radius={[4, 4, 0, 0]} />
              <Bar dataKey="gonderim" name="Form Gonderim" fill={CHART_COLORS.red} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      {/* ── Department Vulnerability Analysis ── */}
      <Card>
        <Text fw={600} c="white" mb="md">Fakulte Bazli Zafiyet Analizi</Text>
        <Text size="xs" c="dimmed" mb="md">
          Gonderim Orani = (Form Gonderim / Tiklama) x 100
        </Text>
        {deptStats.length === 0 ? (
          <Center h={200}><Text c="dimmed">Henuz fakulte verisi yok</Text></Center>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
            {deptStats.map((d, i) => {
              const label = FACULTY_LABELS[d.faculty] || d.faculty;
              const rate = typeof d.submissionRate === 'number' ? d.submissionRate : 0;
              const riskColor = rate > 50 ? CHART_COLORS.red : rate > 25 ? CHART_COLORS.yellow : CHART_COLORS.green;
              return (
                <Paper key={d.faculty} p="md" radius="md" style={{ backgroundColor: CHART_COLORS.surfaceBg, border: `1px solid ${CHART_COLORS.surfaceBorder}` }}>
                  <Group justify="space-between" mb={8}>
                    <Group gap="xs">
                      <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: DEPT_PIE_COLORS[i % DEPT_PIE_COLORS.length] }} />
                      <Text size="sm" fw={500} c="white">{label}</Text>
                    </Group>
                    <Text size="lg" fw={700} style={{ color: riskColor }}>
                      {rate.toFixed(1)}%
                    </Text>
                  </Group>
                  <Paper h={6} radius="xl" style={{ backgroundColor: 'var(--app-track-bg)' }}>
                    <Paper h={6} radius="xl" bg={riskColor} w={`${Math.min(rate, 100)}%`} />
                  </Paper>
                  <Group justify="space-between" mt={6}>
                    <Text size="xs" c="dimmed">{d.totalRecipients} alici</Text>
                    <Text size="xs" c="dimmed">{d.totalClicked} tiklama / {d.totalSubmitted} gonderim</Text>
                  </Group>
                </Paper>
              );
            })}
          </SimpleGrid>
        )}
      </Card>

      {/* ── Recent Campaigns ── */}
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
