import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth/AuthContext';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { EnquiriesPage } from './pages/EnquiriesPage';
import { EnquiryDetailPage } from './pages/EnquiryDetailPage';
import { CatalogPage } from './pages/CatalogPage';

function RequireAuth({ children }: { children: JSX.Element }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8 text-gray-400">Loading…</div>;
  return user ? children : <Navigate to="/login" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/enquiries" element={<EnquiriesPage />} />
        <Route path="/enquiries/:id" element={<EnquiryDetailPage />} />
        <Route path="/catalog" element={<CatalogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/enquiries" replace />} />
    </Routes>
  );
}
