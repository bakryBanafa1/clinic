import React, { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './context/AuthContext';
import MainLayout from './components/layout/MainLayout';
import Login from './pages/login';
import Dashboard from './pages/dashboard';
import PatientsList from './pages/patients';
import PatientProfile from './pages/patients/PatientProfile';
import DoctorsList from './pages/doctors';
import AppointmentsList from './pages/appointments';
import QueuePage from './pages/queue';
import ClinicSettings from './pages/settings';
import BillingPage from './pages/billing';
import VisitsPage from './pages/visits';
import FollowUpPage from './pages/followup';
import ReportsPage from './pages/reports';
import WhatsAppConnection from './pages/whatsapp';

const PrivateRoute = ({ children }) => {
  const { user } = useContext(AuthContext);
  return user ? children : <Navigate to="/login" replace />;
};

function App() {
  const { user } = useContext(AuthContext);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        
        <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
          <Route index element={<Dashboard />} />
          <Route path="patients" element={<PatientsList />} />
          <Route path="patients/:id" element={<PatientProfile />} />
          <Route path="doctors" element={<DoctorsList />} />
          <Route path="appointments" element={<AppointmentsList />} />
          <Route path="appointments/new" element={<AppointmentsList />} />
          <Route path="queue" element={<QueuePage />} />
          <Route path="settings" element={<ClinicSettings />} />
          <Route path="billing" element={<BillingPage />} />
          <Route path="visits" element={<VisitsPage />} />
          <Route path="followup" element={<FollowUpPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="whatsapp" element={<WhatsAppConnection />} />
          {/* We will add more routes here soon */}
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
