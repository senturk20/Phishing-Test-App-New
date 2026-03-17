import { useState, useEffect, useRef } from 'react';
import {
  Card,
  Group,
  Text,
  Title,
  Button,
  Stack,
  Table,
  ActionIcon,
  Badge,
  Center,
  Loader,
  Alert,
  Progress,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  Upload,
  Trash2,
  FileText,
  AlertTriangle,
  HardDrive,
  File,
} from 'lucide-react';
import { api } from '../api';
import type { Attachment } from '../types';
import dayjs from 'dayjs';

function formatSize(bytes: number): string {
  if (bytes > 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  if (bytes > 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${bytes} B`;
}

function getFileIcon(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'PDF';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'DOC';
  if (mimeType.includes('sheet') || mimeType.includes('excel')) return 'XLS';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'PPT';
  if (mimeType.includes('image')) return 'IMG';
  if (mimeType.includes('zip') || mimeType.includes('rar') || mimeType.includes('7z')) return 'ZIP';
  return 'FILE';
}

export function FileManager() {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = async () => {
    try {
      const data = await api.getAttachments();
      setAttachments(data);
    } catch {
      setError('Dosyalar yuklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAttachments();
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      notifications.show({
        title: 'Hata',
        message: 'Dosya boyutu 25MB sinirini asiyor',
        color: 'alertRed',
      });
      return;
    }

    setUploading(true);
    try {
      const attachment = await api.uploadAttachment(file);
      setAttachments(prev => [attachment, ...prev]);
      notifications.show({
        title: 'Basarili',
        message: `${attachment.originalName} yuklendi`,
        color: 'cyberGreen',
      });
    } catch (err) {
      notifications.show({
        title: 'Hata',
        message: err instanceof Error ? err.message : 'Yukleme basarisiz',
        color: 'alertRed',
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await api.deleteAttachment(id);
      setAttachments(prev => prev.filter(a => a.id !== id));
      notifications.show({
        title: 'Silindi',
        message: `${name} silindi`,
        color: 'yellow',
      });
    } catch {
      notifications.show({
        title: 'Hata',
        message: 'Dosya silinemedi',
        color: 'alertRed',
      });
    }
  };

  const totalSize = attachments.reduce((sum, a) => sum + a.size, 0);

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
          <Title order={2} c="white">Dosya Yonetimi</Title>
          <Text size="sm" c="dimmed">Phishing kampanyalarinda kullanilacak dosyalari yukleyin</Text>
        </div>
        <Button
          leftSection={<Upload size={16} />}
          color="electricBlue"
          loading={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          Dosya Yukle
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleUpload}
        />
      </Group>

      {error && (
        <Alert color="alertRed" icon={<AlertTriangle size={16} />}>
          {error}
        </Alert>
      )}

      {/* Storage Info */}
      <Card>
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <HardDrive size={18} color="var(--mantine-color-electricBlue-4)" />
            <Text fw={600} c="white">Depolama</Text>
          </Group>
          <Text size="sm" c="dimmed">{attachments.length} dosya - {formatSize(totalSize)}</Text>
        </Group>
        <Progress
          value={Math.min((totalSize / (100 * 1024 * 1024)) * 100, 100)}
          color="electricBlue"
          size="sm"
          radius="xl"
        />
        <Text size="xs" c="dimmed" mt={4}>Maks. dosya boyutu: 25MB</Text>
      </Card>

      {/* File List */}
      <Card>
        <Text fw={600} c="white" mb="md">Yuklenen Dosyalar</Text>
        {attachments.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <File size={48} color="var(--mantine-color-dark-3)" />
              <Text c="dimmed">Henuz dosya yuklenmemis</Text>
              <Button
                variant="light"
                color="electricBlue"
                size="sm"
                leftSection={<Upload size={14} />}
                onClick={() => fileInputRef.current?.click()}
              >
                Ilk Dosyayi Yukle
              </Button>
            </Stack>
          </Center>
        ) : (
          <Table highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Dosya</Table.Th>
                <Table.Th>Tur</Table.Th>
                <Table.Th>Boyut</Table.Th>
                <Table.Th>Tarih</Table.Th>
                <Table.Th w={60}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {attachments.map(att => (
                <Table.Tr key={att.id}>
                  <Table.Td>
                    <Group gap="xs">
                      <FileText size={16} color="var(--mantine-color-electricBlue-4)" />
                      <Text size="sm" c="white" fw={500}>{att.originalName}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="electricBlue" size="sm">
                      {getFileIcon(att.mimeType)}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{formatSize(att.size)}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">{dayjs(att.createdAt).format('DD.MM.YYYY HH:mm')}</Text>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon
                      variant="subtle"
                      color="red"
                      onClick={() => handleDelete(att.id, att.originalName)}
                    >
                      <Trash2 size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
