import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './shared/hooks/useAuth';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ChangePasswordPage } from './features/auth/pages/ChangePasswordPage';
import { ClassificationPage } from './features/classification/pages/ClassificationPage';
import { PredictionsPage } from './features/predictions/pages/PredictionsPage';
import { AdminPage } from './features/admin/pages/AdminPage';
import { ProfilePage } from './features/profile/pages/ProfilePage';
import { PartiaisPage } from './features/parciais/pages/PartiaisPage';
import { ViewPredictionsPage } from './features/viewPredictions/pages/ViewPredictionsPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10 * 1000,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth();
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  if (user?.must_change_password) {
    return <Navigate to="/alterar-senha" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/alterar-senha"
        element={
          <RequireAuth>
            <ChangePasswordPage />
          </RequireAuth>
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <ClassificationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/palpites"
        element={
          <ProtectedRoute>
            <PredictionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute>
            <AdminPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/perfil"
        element={
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/parciais"
        element={
          <ProtectedRoute>
            <PartiaisPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/ver-palpites"
        element={
          <ProtectedRoute>
            <ViewPredictionsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
