import { useEffect, useState, useMemo } from 'react';
import {
  Card,
  Group,
  Text,
  Title,
  Stack,
  Center,
  Loader,
  Alert,
  Badge,
  Paper,
  SimpleGrid,
  ThemeIcon,
  useMantineColorScheme,
} from '@mantine/core';
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  MailOpen,
  MousePointerClick,
  Download,
  FileWarning,
} from 'lucide-react';
import { api } from '../api';
import type { DepartmentStat } from '../types';

const CHART_COLORS = {
  blue: '#1a80ff',
  cyan: '#22b8cf',
  green: '#00e673',
  red: '#e60000',
  yellow: '#ffd43b',
  orange: '#ff6b35',
};

const FACULTY_LABELS: Record<string, string> = {
  engineering: 'Muhendislik Fakultesi',
  humanities: 'Insan ve Toplum Bilimleri',
  rectorate: 'Rektorluk',
  'Ozel Gonderim': 'Ozel Gonderim',
};

const DEPT_COLORS = ['#1a80ff', '#e60000', '#ffd43b', '#00e673', '#b84dff', '#ff6b35', '#22b8cf', '#909296'];

function RiskBadge({ rate }: { rate: number }) {
  if (rate > 50) return <Badge color="red" variant="light" size="sm" leftSection={<ShieldAlert size={12} />}>Yuksek Risk</Badge>;
  if (rate > 25) return <Badge color="yellow" variant="light" size="sm" leftSection={<Shield size={12} />}>Orta Risk</Badge>;
  return <Badge color="green" variant="light" size="sm" leftSection={<ShieldCheck size={12} />}>Dusuk Risk</Badge>;
}

function MetricBar({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  return (
    <div>
      <Group justify="space-between" mb={4}>
        <Group gap={6}>
          {icon}
          <Text size="xs" c="dimmed">{label}</Text>
        </Group>
        <Text size="xs" fw={600} style={{ color }}>
          {value.toFixed(1)}%
        </Text>
      </Group>
      <Paper h={6} radius="xl" style={{ backgroundColor: 'var(--app-track-bg)' }}>
        <Paper h={6} radius="xl" style={{ backgroundColor: color }} w={`${Math.min(value, 100)}%`} />
      </Paper>
    </div>
  );
}

export function DepartmentAnalysis() {
  const { colorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';
  const surfaceBg = isDark ? '#1A1B1E' : '#f8f9fa';
  const surfaceBorder = isDark ? '#373A40' : '#dee2e6';

  const [deptStats, setDeptStats] = useState<DepartmentStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getDepartmentStats()
      .then(setDeptStats)
      .catch(() => setError('Departman verileri yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

  // Sort departments by submission rate (most vulnerable first)
  const sorted = useMemo(() =>
    [...deptStats].sort((a, b) => b.submissionRate - a.submissionRate),
    [deptStats]
  );

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
          <Title order={2} c="white">Departman Analizi</Title>
          <Text size="sm" c="dimmed">
            Fakulte bazli zafiyet ve risk siralaması — en savunmasizdan en guvenliye
          </Text>
        </div>
        <Badge color="electricBlue" variant="light" size="lg">
          {deptStats.length} departman
        </Badge>
      </Group>

      {error && (
        <Alert color="alertRed" icon={<AlertTriangle size={16} />}>
          {error}
        </Alert>
      )}

      {sorted.length === 0 ? (
        <Card>
          <Center h={200}>
            <Text c="dimmed">Henuz departman verisi yok. Kampanya olusturup LDAP senkronizasyonu yapin.</Text>
          </Center>
        </Card>
      ) : (
        <>
          {/* Risk Ranking Summary */}
          <Card>
            <Text fw={600} c="white" mb="md">Risk Siralaması</Text>
            <Stack gap="sm">
              {sorted.map((d, i) => {
                const label = FACULTY_LABELS[d.faculty] || d.faculty;
                const riskColor = d.submissionRate > 50 ? CHART_COLORS.red : d.submissionRate > 25 ? CHART_COLORS.yellow : CHART_COLORS.green;
                return (
                  <Paper key={d.faculty} p="sm" radius="md" style={{ backgroundColor: surfaceBg, border: `1px solid ${surfaceBorder}` }}>
                    <Group justify="space-between">
                      <Group gap="sm">
                        <Text size="lg" fw={700} c="dimmed" w={28} ta="center">{i + 1}</Text>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: DEPT_COLORS[i % DEPT_COLORS.length] }} />
                        <div>
                          <Text size="sm" fw={500} c="white">{label}</Text>
                          <Text size="xs" c="dimmed">{d.totalRecipients} kullanici</Text>
                        </div>
                      </Group>
                      <Group gap="md">
                        <Text size="lg" fw={700} style={{ color: riskColor, fontVariantNumeric: 'tabular-nums' }}>
                          {d.submissionRate.toFixed(1)}%
                        </Text>
                        <RiskBadge rate={d.submissionRate} />
                      </Group>
                    </Group>
                  </Paper>
                );
              })}
            </Stack>
          </Card>

          {/* Detailed Department Cards */}
          <SimpleGrid cols={{ base: 1, md: 2 }}>
            {sorted.map((d, i) => {
              const label = FACULTY_LABELS[d.faculty] || d.faculty;
              return (
                <Card key={d.faculty} style={{ borderTop: `3px solid ${DEPT_COLORS[i % DEPT_COLORS.length]}` }}>
                  <Group justify="space-between" mb="md">
                    <div>
                      <Text fw={600} c="white" size="lg">{label}</Text>
                      <Text size="xs" c="dimmed">{d.totalRecipients} kullanici kayitli</Text>
                    </div>
                    <RiskBadge rate={d.submissionRate} />
                  </Group>

                  {/* Summary Numbers */}
                  <SimpleGrid cols={4} mb="md">
                    <Paper p="xs" radius="md" style={{ backgroundColor: surfaceBg }} ta="center">
                      <ThemeIcon variant="light" color="cyan" size="sm" radius="xl" mx="auto" mb={4}>
                        <MailOpen size={12} />
                      </ThemeIcon>
                      <Text size="lg" fw={700} c="white">{d.totalOpened}</Text>
                      <Text size="10px" c="dimmed">Acilma</Text>
                    </Paper>
                    <Paper p="xs" radius="md" style={{ backgroundColor: surfaceBg }} ta="center">
                      <ThemeIcon variant="light" color="yellow" size="sm" radius="xl" mx="auto" mb={4}>
                        <MousePointerClick size={12} />
                      </ThemeIcon>
                      <Text size="lg" fw={700} c="white">{d.totalClicked}</Text>
                      <Text size="10px" c="dimmed">Tiklama</Text>
                    </Paper>
                    <Paper p="xs" radius="md" style={{ backgroundColor: surfaceBg }} ta="center">
                      <ThemeIcon variant="light" color="orange" size="sm" radius="xl" mx="auto" mb={4}>
                        <Download size={12} />
                      </ThemeIcon>
                      <Text size="lg" fw={700} c="white">{d.totalFileDownloads}</Text>
                      <Text size="10px" c="dimmed">Indirme</Text>
                    </Paper>
                    <Paper p="xs" radius="md" style={{ backgroundColor: surfaceBg }} ta="center">
                      <ThemeIcon variant="light" color="red" size="sm" radius="xl" mx="auto" mb={4}>
                        <FileWarning size={12} />
                      </ThemeIcon>
                      <Text size="lg" fw={700} c="white">{d.totalSubmitted}</Text>
                      <Text size="10px" c="dimmed">Gonderim</Text>
                    </Paper>
                  </SimpleGrid>

                  {/* Rate Bars */}
                  <Stack gap="sm">
                    <MetricBar
                      label="Acilma Orani"
                      value={d.openRate}
                      color={CHART_COLORS.cyan}
                      icon={<MailOpen size={12} color={CHART_COLORS.cyan} />}
                    />
                    <MetricBar
                      label="Tiklama Orani"
                      value={d.clickRate}
                      color={CHART_COLORS.yellow}
                      icon={<MousePointerClick size={12} color={CHART_COLORS.yellow} />}
                    />
                    <MetricBar
                      label="Dosya Indirme Orani"
                      value={d.fileDownloadRate}
                      color={CHART_COLORS.orange}
                      icon={<Download size={12} color={CHART_COLORS.orange} />}
                    />
                    <MetricBar
                      label="Form Gonderim Orani"
                      value={d.submissionRate}
                      color={d.submissionRate > 25 ? CHART_COLORS.red : CHART_COLORS.green}
                      icon={<FileWarning size={12} color={d.submissionRate > 25 ? CHART_COLORS.red : CHART_COLORS.green} />}
                    />
                  </Stack>
                </Card>
              );
            })}
          </SimpleGrid>
        </>
      )}
    </Stack>
  );
}
