import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  LayoutDashboard, 
  UserCircle, 
  Video, 
  LogOut, 
  PlusCircle,
  Activity
} from 'lucide-react';
import './DoctorNavbar.css';

const DoctorNavbar = ({ onLogout, doctorName }) => {
  const navigate = useNavigate();

  return (
    <nav className="doc-navbar">
      <div className="doc-nav-container">
        {/* Logo Section */}
        <div className="doc-nav-logo" onClick={() => navigate('/doctor-portal')}>
          <div className="doc-logo-box">
             <Activity size={24} color="white" />
          </div>
          <span>MediSync <small>PRO</small></span>
        </div>

        {/* Navigation Links */}
        <div className="doc-nav-links">
          <button className="doc-nav-link" onClick={() => navigate('/doctor-portal')}>
            <Home size={20} />
            <span>Home</span>
          </button>
          <button className="doc-nav-link" onClick={() => navigate('/doctor-portal?view=bookings')}>
            <LayoutDashboard size={20} />
            <span>My Bookings</span>
          </button>
          <button className="doc-nav-link" onClick={() => navigate('/telemeet')}>
            <Video size={20} />
            <span>Join Meet</span>
          </button>
        </div>

        {/* Profile & Logout */}
        <div className="doc-nav-actions">
          <div className="doc-profile-info">
             <div className="doc-profile-avatar">
                <UserCircle size={32} />
             </div>
             <div className="doc-profile-text">
                <strong>{doctorName || 'Doctor'}</strong>
                <span>Verified Provider</span>
             </div>
          </div>
          <button className="doc-logout-btn" onClick={onLogout}>
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </nav>
  );
};

export default DoctorNavbar;
