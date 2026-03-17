import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Campaigns } from './pages/Campaigns';
import { CampaignDetail } from './pages/CampaignDetail';
import { CampaignNew } from './pages/CampaignNew';
import { LandingPages } from './pages/LandingPages';
import { LandingPage } from './pages/LandingPage';
import { EmailTemplates } from './pages/EmailTemplates';
import { FileManager } from './pages/FileManager';
import { Center, Loader } from '@mantine/core';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <Center style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-dark-8)' }}>
        <Loader color="electricBlue" size="lg" />
      </Center>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();

  return (
    <Routes>
      {/* Login */}
      <Route
        path="/login"
        element={
          isLoading ? (
            <Center style={{ minHeight: '100vh', backgroundColor: 'var(--mantine-color-dark-8)' }}>
              <Loader color="electricBlue" size="lg" />
            </Center>
          ) : isAuthenticated ? (
            <Navigate to="/" replace />
          ) : (
            <Login />
          )
        }
      />

      {/* Admin Panel (protected) */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<CampaignNew />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="landing-pages" element={<LandingPages />} />
        <Route path="email-templates" element={<EmailTemplates />} />
        <Route path="file-manager" element={<FileManager />} />
      </Route>

      {/* Phishing Landing Page (Layout disinda, public) */}
      <Route path="/landing/:campaignId" element={<LandingPage />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
