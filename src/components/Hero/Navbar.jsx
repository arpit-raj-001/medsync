import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Navbar.css';

const Navbar = () => {
  const { user, logout } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMobile = () => {
    setMobileOpen(prev => !prev);
    document.body.style.overflow = !mobileOpen ? 'hidden' : '';
  };

  const closeMobile = () => {
    setMobileOpen(false);
    document.body.style.overflow = '';
  };

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`} id="navbar">
      <div className="nav-container">
        {/* Logo */}
        <a href="#" className="nav-logo" id="nav-logo">
          <div className="logo-icon">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <rect width="32" height="32" rx="8" fill="#10B981" />
              <path d="M16 8v16M8 16h16" stroke="#fff" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </div>
          <span className="logo-text">
            Medi<span className="logo-accent">Sync</span>
          </span>
        </a>

        {/* Nav Links */}
        <ul className={`nav-links ${mobileOpen ? 'mobile-open' : ''}`} id="nav-links">
          {['Home', 'Features', 'Appointments', 'Medications', 'Reports'].map((link, i) => (
            <li key={link}>
              <button
                className={`nav-link ${i === 0 ? 'active' : ''} bg-transparent border-0 cursor-pointer text-base font-semibold transition-colors duration-300 hover:text-[#10B981]`}
                onClick={() => {
                  closeMobile();
                  if (link === 'Home') navigate('/');
                  else if (link === 'Appointments') navigate('/appointments');
                  // Quick scroll for features if on landing
                  else if (link === 'Features') {
                    if (window.location.pathname === '/') window.location.hash = 'features';
                    else navigate('/#features');
                  }
                }}
              >
                {link}
              </button>
            </li>
          ))}
        </ul>

        {/* Actions */}
        <div className="nav-actions">
           {user ? (
             <button className="btn btn-ghost" id="btn-signout" onClick={() => { logout(); navigate('/login'); }}>Sign Out</button>
           ) : (
             <button className="btn btn-ghost" id="btn-portal" onClick={() => navigate('/login')}>Portal Access</button>
           )}
           <button className="btn btn-primary" id="btn-signup" onClick={() => navigate('/chat')}>Get Started</button>
        </div>

        {/* Hamburger */}
        <button
          className={`nav-hamburger ${mobileOpen ? 'active' : ''}`}
          id="nav-hamburger"
          aria-label="Toggle menu"
          onClick={toggleMobile}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;
