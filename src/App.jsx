import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LandingPage from './pages/LandingPage';
import ChatFlow from './components/ChatFlow/ChatFlow';
import AppointmentsDashboard from './pages/AppointmentsDashboard';
import TeleMeet from './pages/TeleMeet';
import MigrateDoctors from './pages/MigrateDoctors';
import DoctorDashboard from './pages/DoctorDashboard';
import LoginPage from './pages/LoginPage';
import Navbar from './components/Hero/Navbar';
import DoctorNavbar from './components/Doctor/DoctorNavbar';

// Simple Error Boundary to prevent blank screen
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("MediSync Crash:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', background: '#fef2f2', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <h1 style={{ color: '#dc2626' }}>Oops! Something went wrong.</h1>
          <p style={{ color: '#4b5563', maxWidth: '600px' }}>
            The application encountered an unexpected error. This usually happens due to missing API keys or corrupted session data.
          </p>
          <pre style={{ background: '#f8fafc', padding: '20px', borderRadius: '8px', border: '1px solid #e2e8f0', overflow: 'auto', maxWidth: '90vw', marginTop: '20px', textAlign: 'left', fontSize: '13px' }}>
            {this.state.error?.toString()}
          </pre>
          <button 
            onClick={() => { localStorage.clear(); window.location.href = '/'; }}
            style={{ marginTop: '24px', padding: '12px 24px', background: '#dc2626', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}
          >
            Clear Cache & Restart App
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Protected Route Wrapper
const ProtectedRoute = ({ children, allowedRole }) => {
  const { user, role, loading } = useAuth();

  if (loading) return <div>Loading identity...</div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRole && role !== allowedRole) return <Navigate to="/" />;
  
  return children;
};

// Navbar selection wrapper
const DynamicNavbar = () => {
    const { isDoctor } = useAuth();
    if (isDoctor) return <DoctorNavbar />;
    return <Navbar />;
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <DynamicNavbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/chat" element={<ChatFlow />} />
            <Route 
               path="/appointments" 
               element={<ProtectedRoute allowedRole="patient"><AppointmentsDashboard /></ProtectedRoute>} 
            />
            <Route path="/telemeet" element={<TeleMeet />} />
            <Route path="/migrate" element={<MigrateDoctors />} />
            <Route 
               path="/doctor-portal" 
               element={<ProtectedRoute allowedRole="doctor"><DoctorDashboard /></ProtectedRoute>} 
            />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
