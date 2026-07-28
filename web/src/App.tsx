import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './shared/hooks/AuthProvider';
import { useAuth } from './shared/hooks/useAuth';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ChangePasswordPage } from './features/auth/pages/ChangePasswordPage';
import { ClassificationPage } from './features/classification/pages/ClassificationPage';
import { PredictionsPage } from './features/predictions/pages/PredictionsPage';
import { AdminPage } from './features/admin/pages/AdminPage';
import { ProfilePage } from './features/profile/pages/ProfilePage';
import { RoundPage, type RoundTab } from './features/round/pages/RoundPage';
import { ChampionsPage } from './features/champions/pages/ChampionsPage';

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

/** The old Galera and Parciais routes keep working, landing on the matching tab. */
export function RedirectToRound({ tab }: { tab: RoundTab }) {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  params.set('aba', tab);
  return <Navigate to={{ pathname: '/rodada', search: `?${params}` }} replace />;
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
        path="/rodada"
        element={
          <ProtectedRoute>
            <RoundPage />
          </ProtectedRoute>
        }
      />
      <Route path="/parciais" element={<RedirectToRound tab="parciais" />} />
      <Route path="/ver-palpites" element={<RedirectToRound tab="galera" />} />
      <Route
        path="/hall-dos-campeoes"
        element={
          <ProtectedRoute>
            <ChampionsPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Base path para GitHub Pages (ex: /bolao-app). Em dev é ''.
const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basename}>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
