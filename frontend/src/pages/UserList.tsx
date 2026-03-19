import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  Group,
  Text,
  Title,
  Table,
  Badge,
  Stack,
  Center,
  Loader,
  Alert,
  TextInput,
  Select,
  Pagination,
} from '@mantine/core';
import {
  Search,
  AlertTriangle,
  Users,
} from 'lucide-react';
import { api } from '../api';
import type { Recipient, LdapFaculty, RecipientStatus } from '../types';

const FACULTY_LABELS: Record<string, string> = {
  engineering: 'Muhendislik',
  humanities: 'Insan Bilimleri',
  rectorate: 'Rektorluk',
};

const STATUS_MAP: Record<RecipientStatus, { label: string; color: string }> = {
  pending: { label: 'Bekliyor', color: 'gray' },
  sent: { label: 'Guvenli', color: 'green' },
  clicked: { label: 'Tikladi', color: 'yellow' },
  submitted: { label: 'Form Gonderdi', color: 'red' },
  failed: { label: 'Hata', color: 'gray' },
};

const PAGE_SIZE = 25;

export function UserList() {
  const [users, setUsers] = useState<Recipient[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [faculty, setFaculty] = useState('');
  const [status, setStatus] = useState('');
  const [faculties, setFaculties] = useState<LdapFaculty[]>([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.getAllUsers({
        page,
        pageSize: PAGE_SIZE,
        faculty: faculty || undefined,
        search: search || undefined,
        status: status || undefined,
      });
      setUsers(result.users);
      setTotal(result.total);
    } catch {
      setError('Kullanici verileri yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [page, faculty, search, status]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  useEffect(() => {
    api.getLdapFaculties()
      .then(data => setFaculties(data.faculties))
      .catch(() => {});
  }, []);

  // Reset to page 1 on filter change
  const handleFilterChange = (setter: (v: string) => void) => (v: string | null) => {
    setter(v || '');
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <Stack gap="lg">
      <Group justify="space-between" align="center">
        <div>
          <Title order={2} c="white">Kullanicilar (LDAP)</Title>
          <Text size="sm" c="dimmed">
            Phishing kampanyalarina eklenmis tum kullanicilarin listesi
          </Text>
        </div>
        <Badge color="electricBlue" variant="light" size="lg" leftSection={<Users size={14} />}>
          {total} kullanici
        </Badge>
      </Group>

      {error && (
        <Alert color="alertRed" icon={<AlertTriangle size={16} />}>
          {error}
        </Alert>
      )}

      {/* Filters */}
      <Card>
        <Group gap="md">
          <TextInput
            placeholder="Ad, soyad veya e-posta ara..."
            leftSection={<Search size={16} />}
            value={search}
            onChange={e => { setSearch(e.currentTarget.value); setPage(1); }}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Fakulte"
            data={[
              { value: '', label: 'Tum Fakulteler' },
              ...faculties.map(f => ({
                value: f.name,
                label: `${FACULTY_LABELS[f.name] || f.name} (${f.count})`,
              })),
            ]}
            value={faculty}
            onChange={handleFilterChange(setFaculty)}
            w={220}
            clearable
          />
          <Select
            placeholder="Durum"
            data={[
              { value: '', label: 'Tum Durumlar' },
              { value: 'sent', label: 'Guvenli' },
              { value: 'clicked', label: 'Tikladi' },
              { value: 'submitted', label: 'Form Gonderdi' },
              { value: 'pending', label: 'Bekliyor' },
            ]}
            value={status}
            onChange={handleFilterChange(setStatus)}
            w={180}
            clearable
          />
        </Group>
      </Card>

      {/* Users Table */}
      <Card>
        {loading ? (
          <Center h={300}>
            <Loader color="electricBlue" />
          </Center>
        ) : users.length === 0 ? (
          <Center h={200}>
            <Text c="dimmed">Kullanici bulunamadi</Text>
          </Center>
        ) : (
          <>
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Ad Soyad</Table.Th>
                  <Table.Th>E-posta</Table.Th>
                  <Table.Th>Fakulte / Departman</Table.Th>
                  <Table.Th>Rol</Table.Th>
                  <Table.Th>Phishing Durumu</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {users.map(user => {
                  const sm = STATUS_MAP[user.status] || STATUS_MAP.pending;
                  return (
                    <Table.Tr key={user.id}>
                      <Table.Td>
                        <Text size="sm" fw={500} c="white">
                          {user.firstName} {user.lastName}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{user.email}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">
                          {FACULTY_LABELS[user.faculty] || user.faculty || '-'}
                          {user.department ? ` / ${user.department}` : ''}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{user.role || '-'}</Text>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={sm.color} variant="light" size="sm">
                          {sm.label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  );
                })}
              </Table.Tbody>
            </Table>

            {totalPages > 1 && (
              <Center mt="md">
                <Pagination
                  total={totalPages}
                  value={page}
                  onChange={setPage}
                  color="electricBlue"
                  size="sm"
                />
              </Center>
            )}
          </>
        )}
      </Card>
    </Stack>
  );
}
