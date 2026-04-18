import React from 'react';
import './Footer.css';

const Footer = () => {
  return (
    <footer className="footer" id="main-footer">
      <div className="footer-container">
        <div className="footer-grid">
          
          {/* Section 1: Brand Authority */}
          <div className="footer-brand">
            <a href="#" className="footer-logo">
              <div className="logo-box">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                  <path d="M16 8v16M8 16h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
                </svg>
              </div>
              <span className="logo-text-footer">MediSync</span>
            </a>
            <p className="footer-description">
              The living sanctuary for modern clinical care. We leverage medical AI to simplify complexity and prioritize healing experiences.
            </p>
            <div className="footer-socials">
              {['twitter', 'linkedin', 'github'].map((platform) => (
                <a key={platform} href="#" className="social-link" aria-label={platform}>
                  {platform === 'twitter' && <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.84 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/></svg>}
                  {platform === 'linkedin' && <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.454C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.225 0z"/></svg>}
                  {platform === 'github' && <svg width="20" height="20" fill="currentColor" viewBox="0 0 24 24"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>}
                </a>
              ))}
            </div>
          </div>

          <div className="footer-col">
            <h3>Solutions</h3>
            <ul className="footer-links">
              <li><a href="#">Provider Portal</a></li>
              <li><a href="#">Resource Center</a></li>
              <li><a href="#">Predictive Analytics</a></li>
              <li><a href="#">Patient Dashboard</a></li>
            </ul>
          </div>

          <div className="footer-col">
            <h3>Company</h3>
            <ul className="footer-links">
              <li><a href="#">Our Mission</a></li>
              <li><a href="#">HIPAA Compliance</a></li>
              <li><a href="#">Terms of Service</a></li>
              <li><a href="#">Privacy Policy</a></li>
            </ul>
          </div>

          <div className="footer-brand">
            <div className="footer-newsletter">
                <div className="newsletter-text">
                    <h3>Subscribe</h3>
                    <p>Join 2,000+ practitioners getting medical AI insights.</p>
                </div>
                <div className="newsletter-form">
                    <input type="email" placeholder="Email address" className="newsletter-input" />
                    <button className="newsletter-submit">Join</button>
                </div>
            </div>
          </div>

        </div>

        <div className="footer-bottom">
          <p className="copyright">
            © 2024 MediSync Platform. The living sanctuary for modern care.
          </p>
          <p style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
            Last Updated: April 18, 2026 @ 05:15 PM IST (V3-PROD)
          </p>
          <div className="status-row">
            <div className="status-badge">
              <span className="status-dot"></span>
              <span className="status-text">Active: Operational</span>
            </div>
            <button className="lang-selector">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                <span>English (US)</span>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
