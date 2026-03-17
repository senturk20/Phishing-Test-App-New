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
} from '@mantine/core';
import {
  LayoutDashboard,
  Target,
  PlusCircle,
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
} from 'lucide-react';
import { useSystemHealth } from '../hooks/useSystemHealth';
import { useAuth } from '../contexts/AuthContext';

const NAV_ITEMS = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/campaigns', icon: Target, label: 'Kampanyalar' },
  { to: '/campaigns/new', icon: PlusCircle, label: 'Yeni Kampanya' },
  { to: '/landing-pages', icon: FileText, label: 'Landing Pages' },
  { to: '/email-templates', icon: Mail, label: 'E-posta Sablonlari' },
  { to: '/file-manager', icon: Paperclip, label: 'Dosya Yonetimi' },
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

  const navLinks = NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      onClick={() => setMobileOpened(false)}
      style={{ textDecoration: 'none' }}
    >
      {({ isActive }) => (
        <UnstyledButton
          px="md"
          py="sm"
          w="100%"
          style={{
            borderRadius: 'var(--mantine-radius-md)',
            backgroundColor: isActive ? 'var(--mantine-color-electricBlue-4)' : 'transparent',
            color: isActive ? '#fff' : 'var(--mantine-color-dark-1)',
            transition: 'background-color 150ms ease',
          }}
          onMouseEnter={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
          }}
          onMouseLeave={(e) => {
            if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          <Group gap="sm" wrap="nowrap">
            <Icon size={20} />
            {!collapsed && <Text size="sm" fw={500}>{label}</Text>}
          </Group>
        </UnstyledButton>
      )}
    </NavLink>
  ));

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
        main: { backgroundColor: 'var(--mantine-color-dark-7)' },
        header: {
          backgroundColor: 'var(--mantine-color-dark-6)',
          borderBottom: '1px solid var(--mantine-color-dark-4)',
        },
        navbar: {
          backgroundColor: 'var(--mantine-color-dark-6)',
          borderRight: '1px solid var(--mantine-color-dark-4)',
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
              color="var(--mantine-color-dark-1)"
            />
            <Shield size={24} color="var(--mantine-color-electricBlue-4)" />
            <Text fw={700} size="lg" c="white">
              Phishing Simulator
            </Text>
          </Group>

          <Group gap="md">
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
                <User size={14} color="var(--mantine-color-dark-2)" />
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
          <Stack gap={4}>
            {navLinks}
          </Stack>
        </AppShell.Section>

        <AppShell.Section>
          <Box pt="sm" style={{ borderTop: '1px solid var(--mantine-color-dark-4)' }}>
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
                  e.currentTarget.style.backgroundColor = 'var(--mantine-color-dark-5)';
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
                color: 'var(--mantine-color-dark-2)',
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
