import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Card,
  Group,
  Text,
  Title,
  Table,
  Badge,
  Button,
  Stack,
  Center,
  Loader,
  Alert,
} from '@mantine/core';
import { PlusCircle, AlertTriangle } from 'lucide-react';
import { api } from '../api';
import type { Campaign } from '../types';
import { campaignStatusMap } from '../utils/statusHelpers';
import dayjs from 'dayjs';

export function Campaigns() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.getCampaigns()
      .then(setCampaigns)
      .catch(() => setError('Kampanyalar yuklenemedi'))
      .finally(() => setLoading(false));
  }, []);

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
        <Title order={2} c="white">Kampanyalar</Title>
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

      {campaigns.length === 0 ? (
        <Card>
          <Center py="xl">
            <Stack align="center" gap="sm">
              <Text c="dimmed" size="lg">Henuz kampanya olusturulmamis.</Text>
              <Button component={Link} to="/campaigns/new" color="electricBlue">
                Ilk Kampanyayi Olustur
              </Button>
            </Stack>
          </Center>
        </Card>
      ) : (
        <Card>
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Kampanya Adi</Table.Th>
                <Table.Th>Aciklama</Table.Th>
                <Table.Th>Durum</Table.Th>
                <Table.Th>Hedef Sayisi</Table.Th>
                <Table.Th>Olusturulma</Table.Th>
                <Table.Th>Islemler</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {campaigns.map(campaign => {
                const sm = campaignStatusMap[campaign.status];
                return (
                  <Table.Tr key={campaign.id}>
                    <Table.Td>
                      <Text
                        component={Link}
                        to={`/campaigns/${campaign.id}`}
                        c="electricBlue"
                        fw={500}
                        size="sm"
                        td="none"
                      >
                        {campaign.name}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{campaign.description || '-'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge color={sm.color} variant="light" size="sm">{sm.label}</Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">{campaign.targetCount}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {dayjs(campaign.createdAt).format('DD.MM.YYYY')}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Button
                        component={Link}
                        to={`/campaigns/${campaign.id}`}
                        variant="subtle"
                        color="electricBlue"
                        size="xs"
                      >
                        Detay
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </Stack>
  );
}
