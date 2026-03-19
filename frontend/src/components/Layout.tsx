import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  AppShell,
  Group,
  Text,
  UnstyledButton,
  Stack,
  Badge,
  Tooltip,
  Burger,
  Box,
  ActionIcon,
  useMantineColorScheme,
} from '@mantine/core';
import {
  LayoutDashboard,
  Target,
  FileText,
  Mail,
  Shield,
  Database,
  Server,
  Paperclip,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Users,
  BarChart3,
  Sun,
  Moon,
} from 'lucide-react';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { useAuth } from '../contexts/AuthContext';

interface NavItem {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  end?: boolean;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    title: 'OPERASYON',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/campaigns', icon: Target, label: 'Kampanyalar' },
    ],
  },
  {
    title: 'KUTUPHANE',
    items: [
      { to: '/email-templates', icon: Mail, label: 'E-posta Sablonlari' },
      { to: '/landing-pages', icon: FileText, label: 'Landing Pages' },
      { to: '/file-manager', icon: Paperclip, label: 'Dosya Yonetimi' },
    ],
  },
  {
    title: 'HEDEF KITLE',
    items: [
      { to: '/users', icon: Users, label: 'Kullanicilar (LDAP)' },
      { to: '/department-analysis', icon: BarChart3, label: 'Departman Analizi' },
    ],
  },
];

const statusColor = (s: string) =>
  s === 'connected' ? 'cyberGreen' : s === 'disconnected' ? 'alertRed' : 'yellow';
const statusLabel = (s: string) =>
  s === 'connected' ? 'Bagli' : s === 'disconnected' ? 'Baglanti Yok' : 'Kontrol...';

export function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpened, setMobileOpened] = useState(false);
  const health = useSystemHealth();
  const { admin, logout } = useAuth();
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  const renderNavItem = ({ to, icon: Icon, label, end }: NavItem) => (
    <NavLink
      key={to + label}
      to={to}
      end={end}
      onClick={() => setMobileOpened(false)}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <Tooltip label={label} position="right" disabled={!collapsed} withArrow>
          <UnstyledButton
            px="md"
            py={8}
            w="100%"
            style={{
              borderRadius: 'var(--mantine-radius-md)',
              backgroundColor: isActive ? 'var(--mantine-color-electricBlue-4)' : 'transparent',
              color: isActive ? 'var(--app-nav-active-text)' : 'var(--app-nav-text)',
              transition: 'background-color 150ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'var(--app-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Group gap="sm" wrap="nowrap">
              <Icon size={18} />
              {!collapsed && <Text size="sm" fw={500}>{label}</Text>}
            </Group>
          </UnstyledButton>
        </Tooltip>
      )}
    </NavLink>
  );

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{
        width: collapsed ? 72 : 240,
        breakpoint: 'sm',
        collapsed: { mobile: !mobileOpened },
      }}
      padding="lg"
      styles={{
        main: { backgroundColor: 'var(--app-shell-bg)' },
        header: {
          backgroundColor: 'var(--app-surface)',
          borderBottom: '1px solid var(--app-border)',
        },
        navbar: {
          backgroundColor: 'var(--app-surface)',
          borderRight: '1px solid var(--app-border)',
        },
      }}
    >
      {/* Header */}
      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between">
          <Group gap="sm">
            <Burger
              opened={mobileOpened}
              onClick={() => setMobileOpened(!mobileOpened)}
              hiddenFrom="sm"
              size="sm"
              color="var(--app-text-secondary)"
            />
            <Shield size={24} color="var(--mantine-color-electricBlue-4)" />
            <Text fw={700} size="lg" c="white">
              Phishing Simulator
            </Text>
          </Group>

          <Group gap="md">
            {/* Theme Toggle */}
            <Tooltip label={isDark ? 'Acik Tema' : 'Koyu Tema'}>
              <ActionIcon
                variant="subtle"
                color={isDark ? 'yellow' : 'electricBlue'}
                size="lg"
                radius="md"
                onClick={() => toggleColorScheme()}
                aria-label="Tema Degistir"
              >
                {isDark ? <Sun size={18} /> : <Moon size={18} />}
              </ActionIcon>
            </Tooltip>

            <Tooltip label={`Veritabani: ${statusLabel(health.database)}`}>
              <Badge
                leftSection={<Database size={12} />}
                color={statusColor(health.database)}
                variant="light"
                size="sm"
              >
                DB
              </Badge>
            </Tooltip>
            <Tooltip label={`LDAP: ${statusLabel(health.ldap)}`}>
              <Badge
                leftSection={<Server size={12} />}
                color={statusColor(health.ldap)}
                variant="light"
                size="sm"
              >
                LDAP
              </Badge>
            </Tooltip>
            {admin && (
              <Group gap={6}>
                <User size={14} color="var(--app-text-dimmed)" />
                <Text size="sm" c="dimmed" fw={500}>
                  {admin.username}
                </Text>
              </Group>
            )}
          </Group>
        </Group>
      </AppShell.Header>

      {/* Sidebar */}
      <AppShell.Navbar p="sm">
        <AppShell.Section grow>
          <Stack gap={2}>
            {NAV_GROUPS.map((group, gi) => (
              <Box key={group.title}>
                {gi > 0 && (
                  <Box
                    my={8}
                    style={{ borderTop: '1px solid var(--app-border)' }}
                  />
                )}
                {!collapsed && (
                  <Text
                    size="10px"
                    fw={700}
                    tt="uppercase"
                    px="md"
                    mb={4}
                    mt={gi === 0 ? 0 : 4}
                    style={{ letterSpacing: '0.08em', color: 'var(--app-nav-section-text)' }}
                  >
                    {group.title}
                  </Text>
                )}
                <Stack gap={2}>
                  {group.items.map(renderNavItem)}
                </Stack>
              </Box>
            ))}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Box pt="sm" style={{ borderTop: '1px solid var(--app-border)' }}>
            <Tooltip label="Cikis Yap" position="right" disabled={!collapsed}>
              <UnstyledButton
                w="100%"
                px="md"
                py="xs"
                mb={4}
                onClick={logout}
                style={{
                  borderRadius: 'var(--mantine-radius-md)',
                  color: 'var(--mantine-color-red-4)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--app-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Group gap="sm" justify={collapsed ? 'center' : 'flex-start'}>
                  <LogOut size={18} />
                  {!collapsed && <Text size="xs">Cikis Yap</Text>}
                </Group>
              </UnstyledButton>
            </Tooltip>
            <UnstyledButton
              w="100%"
              px="md"
              py="xs"
              onClick={() => setCollapsed(!collapsed)}
              style={{
                borderRadius: 'var(--mantine-radius-md)',
                color: 'var(--app-text-dimmed)',
              }}
            >
              <Group gap="sm" justify={collapsed ? 'center' : 'flex-start'}>
                {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                {!collapsed && <Text size="xs">Daralt</Text>}
              </Group>
            </UnstyledButton>
          </Box>
        </AppShell.Section>
      </AppShell.Navbar>

      {/* Main Content */}
      <AppShell.Main>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  );
}
