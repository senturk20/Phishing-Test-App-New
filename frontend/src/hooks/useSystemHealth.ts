import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';

interface SystemHealth {
  database: 'connected' | 'disconnected' | 'checking';
  ldap: 'connected' | 'disconnected' | 'checking';
}

export function useSystemHealth(intervalMs = 30_000) {
  const [health, setHealth] = useState<SystemHealth>({
    database: 'checking',
    ldap: 'checking',
  });

  const check = useCallback(async () => {
    try {
      const result = await api.healthCheck();
      setHealth(prev => ({ ...prev, database: result.ok ? 'connected' : 'disconnected' }));
    } catch {
      setHealth(prev => ({ ...prev, database: 'disconnected' }));
    }

    try {
      const result = await api.testLdapConnection();
      // After envelope unwrap, result is { connected: boolean, message: string }
      setHealth(prev => ({ ...prev, ldap: result.connected ? 'connected' : 'disconnected' }));
    } catch {
      setHealth(prev => ({ ...prev, ldap: 'disconnected' }));
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, intervalMs);
    return () => clearInterval(id);
  }, [check, intervalMs]);

  return health;
}
