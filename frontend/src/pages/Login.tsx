import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Center,
  Paper,
  Title,
  Text,
  TextInput,
  PasswordInput,
  Button,
  Stack,
  Alert,
} from '@mantine/core';
import { Shield, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch {
      setError('Gecersiz kullanici adi veya sifre');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Center
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--mantine-color-dark-8)',
      }}
    >
      <Paper
        shadow="xl"
        p="xl"
        radius="md"
        w={400}
        style={{
          backgroundColor: 'var(--mantine-color-dark-6)',
          border: '1px solid var(--mantine-color-dark-4)',
        }}
      >
        <Stack align="center" gap="xs" mb="lg">
          <Shield size={48} color="var(--mantine-color-electricBlue-4)" />
          <Title order={2} c="white">
            Phishing Simulator
          </Title>
          <Text size="sm" c="dimmed">
            Yonetim paneline giris yapin
          </Text>
        </Stack>

        {error && (
          <Alert
            icon={<AlertTriangle size={16} />}
            color="red"
            variant="light"
            mb="md"
          >
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <Stack gap="md">
            <TextInput
              label="Kullanici Adi"
              placeholder="admin"
              value={username}
              onChange={(e) => setUsername(e.currentTarget.value)}
              required
              styles={{
                label: { color: 'var(--mantine-color-dark-1)' },
              }}
            />
            <PasswordInput
              label="Sifre"
              placeholder="Sifrenizi girin"
              value={password}
              onChange={(e) => setPassword(e.currentTarget.value)}
              required
              styles={{
                label: { color: 'var(--mantine-color-dark-1)' },
              }}
            />
            <Button
              type="submit"
              fullWidth
              loading={loading}
              color="electricBlue"
              mt="sm"
            >
              Giris Yap
            </Button>
          </Stack>
        </form>
      </Paper>
    </Center>
  );
}
