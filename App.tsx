import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import BusinessShell from './components/BusinessShell';
import Home from './pages/Home';
import BookingPage from './pages/user/BookingPage';
import SuccessPage from './pages/user/SuccessPage';
import MyBookingsPage from './pages/user/MyBookingsPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import ResetPasswordForm from './pages/admin/AdminResetPassword';
import AboutProject from './pages/AboutProject';
import Welcome from './pages/Welcome';
import NotFound, { BusinessNotFound } from './pages/NotFound';
import { LanguageProvider } from './services/LanguageContext';
import { useBusiness } from './services/BusinessContext';
import { DEFAULT_BUSINESS_SLUG, USE_HASH_ROUTER } from './constants';

// .../<negocio>/admin entra directo al panel
const AdminRedirect: React.FC = () => {
  const { path } = useBusiness();
  return <Navigate to={path('/admin/dashboard')} replace />;
};

// Nueva contraseña desde el enlace del correo, dentro del negocio (con su nombre y de ahí al panel)
const BusinessResetPassword: React.FC = () => {
  const { business, path } = useBusiness();
  return <ResetPasswordForm business={business} loginPath={path('/admin/login')} panelPath={path('/admin/dashboard')} />;
};

// Con dirección limpia (dominio propio) o con # (GitHub Pages), según VITE_ROUTER
const AppRouter: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  USE_HASH_ROUTER ? (
    <HashRouter>{children}</HashRouter>
  ) : (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '')}>{children}</BrowserRouter>
  );

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <AppRouter>
        <Routes>
          <Route
            path="/"
            element={DEFAULT_BUSINESS_SLUG ? <Navigate to={`/${DEFAULT_BUSINESS_SLUG}`} replace /> : <Welcome />}
          />
          {/* Cada negocio vive en su propia dirección: .../<nombre-del-negocio> */}
          <Route path="/:slug" element={<BusinessShell />}>
            <Route index element={<Home />} />
            <Route path="booking" element={<BookingPage />} />
            <Route path="success" element={<SuccessPage />} />
            <Route path="mis-reservas" element={<MyBookingsPage />} />
            <Route path="about" element={<AboutProject />} />
            <Route path="admin/login" element={<AdminLogin />} />
            <Route path="admin/dashboard" element={<AdminDashboard />} />
            <Route path="admin/restablecer" element={<BusinessResetPassword />} />
            <Route path="admin" element={<AdminRedirect />} />
            <Route path="*" element={<BusinessNotFound />} />
          </Route>
          <Route path="/restablecer" element={<ResetPasswordForm business={null} loginPath="/" panelPath="/" />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </AppRouter>
    </LanguageProvider>
  );
};

export default App;
