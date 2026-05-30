import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider, useAuth } from './context/AuthContext';

import Landing from './pages/Landing';

import CustomerLogin from './pages/customer/Login';
import CustomerRegister from './pages/customer/Register';
import CustomerDashboard from './pages/customer/Dashboard';
import CustomerExplore from './pages/customer/Explore';
import CustomerBarbershop from './pages/customer/BarbershopView';
import CustomerBooking from './pages/customer/Booking';
import CustomerAppointments from './pages/customer/Appointments';
import CustomerHistory from './pages/customer/History';
import CustomerProfile from './pages/customer/Profile';
import CustomerQueue from './pages/customer/QueueView';

import BarbershopLogin from './pages/barbershop/Login';
import BarbershopRegister from './pages/barbershop/Register';
import BarbershopDashboard from './pages/barbershop/Dashboard';
import BarbershopAppointments from './pages/barbershop/Appointments';
import BarbershopBarbers from './pages/barbershop/Barbers';
import BarbershopServices from './pages/barbershop/Services';
import BarbershopQueue from './pages/barbershop/Queue';
import BarbershopSettings from './pages/barbershop/Settings';
import BarbershopReviews from './pages/barbershop/Reviews';
import BarbershopPromos from './pages/barbershop/Promos';

import BarberLogin from './pages/barber/Login';
import BarberDashboard from './pages/barber/Dashboard';
import BarberProfile from './pages/barber/Profile';
import BarberReviews from './pages/barber/Reviews';
import BarberServicesPage from './pages/barber/Services';
import BarberHistory from './pages/barber/History';

import AdminLogin from './pages/admin/Login';
import AdminDashboard from './pages/admin/Dashboard';
import AdminBarbershops from './pages/admin/Barbershops';
import AdminCustomers from './pages/admin/Customers';
import AdminReports from './pages/admin/Reports';
import AdminSettings from './pages/admin/Settings';
import AdminProfile from './pages/admin/Profile';

const Loader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#080e1a', color: '#d4af37', fontSize: 18 }}>
    Loading...
  </div>
);

function ProtectedCustomer({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user || user.type !== 'customer') return <Navigate to="/customer/login" replace />;
  return children;
}
function ProtectedBarbershop({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user || user.type !== 'barbershop') return <Navigate to="/barbershop/login" replace />;
  return children;
}
function ProtectedBarber({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user || user.type !== 'barber') return <Navigate to="/barber/login" replace />;
  return children;
}
function ProtectedAdmin({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loader />;
  if (!user || user.type !== 'admin') return <Navigate to="/admin-login" replace />;
  return children;
}

function AppRoutes() {
  const { user } = useAuth();
  const dashFor = (t) => {
    if (t === 'customer') return '/customer/dashboard';
    if (t === 'barber') return '/barber/dashboard';
    if (t === 'barbershop') return '/barbershop/dashboard';
    if (t === 'admin') return '/admin/dashboard';
    return '/';
  };
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      <Route path="/admin-login" element={user?.type === 'admin' ? <Navigate to="/admin/dashboard" /> : <AdminLogin />} />
      <Route path="/admin/dashboard" element={<ProtectedAdmin><AdminDashboard /></ProtectedAdmin>} />
      <Route path="/admin/barbershops" element={<ProtectedAdmin><AdminBarbershops /></ProtectedAdmin>} />
      <Route path="/admin/customers" element={<ProtectedAdmin><AdminCustomers /></ProtectedAdmin>} />
      <Route path="/admin/reports" element={<ProtectedAdmin><AdminReports /></ProtectedAdmin>} />
      <Route path="/admin/settings" element={<ProtectedAdmin><AdminSettings /></ProtectedAdmin>} />
      <Route path="/admin/profile" element={<ProtectedAdmin><AdminProfile /></ProtectedAdmin>} />

      <Route path="/customer/login" element={user ? <Navigate to={dashFor(user.type)} /> : <CustomerLogin />} />
      <Route path="/customer/register" element={user ? <Navigate to={dashFor(user.type)} /> : <CustomerRegister />} />
      <Route path="/customer/dashboard" element={<ProtectedCustomer><CustomerDashboard /></ProtectedCustomer>} />
      <Route path="/customer/explore" element={<ProtectedCustomer><CustomerExplore /></ProtectedCustomer>} />
      <Route path="/customer/barbershop/:id" element={<ProtectedCustomer><CustomerBarbershop /></ProtectedCustomer>} />
      <Route path="/customer/book/:shopId" element={<ProtectedCustomer><CustomerBooking /></ProtectedCustomer>} />
      <Route path="/customer/appointments" element={<ProtectedCustomer><CustomerAppointments /></ProtectedCustomer>} />
      <Route path="/customer/history" element={<ProtectedCustomer><CustomerHistory /></ProtectedCustomer>} />
      <Route path="/customer/profile" element={<ProtectedCustomer><CustomerProfile /></ProtectedCustomer>} />
      <Route path="/customer/queue/:shopId" element={<ProtectedCustomer><CustomerQueue /></ProtectedCustomer>} />

      <Route path="/barbershop/login" element={user ? <Navigate to={dashFor(user.type)} /> : <BarbershopLogin />} />
      <Route path="/barbershop/register" element={user ? <Navigate to={dashFor(user.type)} /> : <BarbershopRegister />} />
      <Route path="/barbershop/dashboard" element={<ProtectedBarbershop><BarbershopDashboard /></ProtectedBarbershop>} />
      <Route path="/barbershop/appointments" element={<ProtectedBarbershop><BarbershopAppointments /></ProtectedBarbershop>} />
      <Route path="/barbershop/barbers" element={<ProtectedBarbershop><BarbershopBarbers /></ProtectedBarbershop>} />
      <Route path="/barbershop/services" element={<ProtectedBarbershop><BarbershopServices /></ProtectedBarbershop>} />
      <Route path="/barbershop/queue" element={<ProtectedBarbershop><BarbershopQueue /></ProtectedBarbershop>} />
      <Route path="/barbershop/settings" element={<ProtectedBarbershop><BarbershopSettings /></ProtectedBarbershop>} />
      <Route path="/barbershop/reviews" element={<ProtectedBarbershop><BarbershopReviews /></ProtectedBarbershop>} />
      <Route path="/barbershop/promos" element={<ProtectedBarbershop><BarbershopPromos /></ProtectedBarbershop>} />

      <Route path="/barber/login" element={user ? <Navigate to={dashFor(user.type)} /> : <BarberLogin />} />
      <Route path="/barber/dashboard" element={<ProtectedBarber><BarberDashboard /></ProtectedBarber>} />
      <Route path="/barber/profile" element={<ProtectedBarber><BarberProfile /></ProtectedBarber>} />
      <Route path="/barber/reviews" element={<ProtectedBarber><BarberReviews /></ProtectedBarber>} />
      <Route path="/barber/services" element={<ProtectedBarber><BarberServicesPage /></ProtectedBarber>} />
      <Route path="/barber/history" element={<ProtectedBarber><BarberHistory /></ProtectedBarber>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{
          style: { background: '#1a2234', color: '#f0f0f0', border: '1px solid #2d3748' },
          success: { iconTheme: { primary: '#d4af37', secondary: '#1a2234' } }
        }} />
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
