import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './auth/AuthContext';
import { AppLayout } from './components/layout/AppLayout';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import AddExpensePage from './pages/AddExpensePage';
import AddPaymentPage from './pages/AddPaymentPage';
import BillFormPage from './pages/BillFormPage';
import BudgetPage from './pages/BudgetPage';
import HomePage from './pages/HomePage';
import NewProjectPage from './pages/NewProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import ProjectsPage from './pages/ProjectsPage';
import ReceiptPage from './pages/ReceiptPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import SuppliersPage from './pages/SuppliersPage';
import LoginPage from './pages/auth/LoginPage';
import SignupPage from './pages/auth/SignupPage';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

/** Only logged-in users see the app; everyone else goes to the login page. */
function RequireAuth() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-base text-slate-600" aria-busy="true">
        Loading…
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <AppLayout />;
}

export default function App() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <ScrollToTop />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route element={<RequireAuth />}>
          <Route index element={<HomePage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="projects/new" element={<NewProjectPage />} />
          <Route path="projects/:id" element={<ProjectDetailPage />} />
          <Route path="projects/:id/edit" element={<NewProjectPage />} />
          <Route path="projects/:id/budget" element={<BudgetPage />} />
          <Route path="payments/new" element={<AddPaymentPage />} />
          <Route path="payments/:id/edit" element={<AddPaymentPage />} />
          <Route path="receipts/:id" element={<ReceiptPage />} />
          <Route path="expenses/new" element={<AddExpensePage />} />
          <Route path="expenses/:id/edit" element={<AddExpensePage />} />
          <Route path="bills/new" element={<BillFormPage />} />
          <Route path="bills/:id/edit" element={<BillFormPage />} />
          <Route path="suppliers" element={<SuppliersPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </ErrorBoundary>
  );
}
