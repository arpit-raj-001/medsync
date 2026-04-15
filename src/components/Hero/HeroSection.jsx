import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './HeroSection.css';

// Brand logos — filename is the brand name
const brands = [
  { name: 'Apollo', logo: '/brands/apollo.png' },
  { name: 'Fortis', logo: '/brands/fortis.png' },
  { name: 'Manipal Hospitals', logo: '/brands/manipal hospitals.png' },
  { name: 'Max Healthcare', logo: '/brands/max healthcare.jpg' },
  { name: 'Medanta', logo: '/brands/medanta.png' },
  { name: 'Narayana Health', logo: '/brands/narayana health.png' },
  { name: 'PharmEasy', logo: '/brands/pharmeasy.png' },
  { name: 'Practo', logo: '/brands/practo.png' },
  { name: 'Tata 1mg', logo: '/brands/tata1mg.png' },
];

const HeroSection = () => {
  const heroRef = useRef(null);
  const [statsVisible, setStatsVisible] = useState(false);
  const [counts, setCounts] = useState({ patients: 0, doctors: 0, rating: 0 });

  // ====== Stat Counter Animation ======
  useEffect(() => {
    if (!statsVisible) return;

    const targets = { patients: 1200, doctors: 300, rating: 4.4 };
    const duration = 2000;
    const fps = 60;
    const totalFrames = Math.round(duration / (1000 / fps));
    let frame = 0;

    const easeOut = (t) => t * (2 - t);

    const interval = setInterval(() => {
      frame++;
      const progress = easeOut(frame / totalFrames);
      setCounts({
        patients: Math.round(targets.patients * progress),
        doctors: Math.round(targets.doctors * progress),
        rating: (targets.rating * progress).toFixed(1),
      });
      if (frame >= totalFrames) clearInterval(interval);
    }, 1000 / fps);

    return () => clearInterval(interval);
  }, [statsVisible]);

  // ====== Intersection Observer for Stats ======
  useEffect(() => {
    const statsEl = document.getElementById('hero-stats');
    if (!statsEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setStatsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    observer.observe(statsEl);
    return () => observer.disconnect();
  }, []);

  // ====== Mouse parallax on floating cards ======
  const handleMouseMove = (e) => {
    const rect = heroRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    const cards = heroRef.current.querySelectorAll('.info-card');
    cards.forEach((card, i) => {
      const factor = (i + 1) * 8;
      card.style.transform = `translate(${x * factor}px, ${y * factor}px)`;
    });
  };

  const handleMouseLeave = () => {
    const cards = heroRef.current?.querySelectorAll('.info-card');
    cards?.forEach((card) => {
      card.style.transform = 'translate(0, 0)';
      card.style.transition = 'transform 0.6s ease-out';
      setTimeout(() => (card.style.transition = ''), 600);
    });
  };

  const navigate = useNavigate();

  // Duplicate brands array for seamless infinite scroll
  const scrollBrands = [...brands, ...brands];

  const startChat = () => {
    // Force reset the chat session for a fresh "Try Now" experience
    localStorage.removeItem('medisync_chat_messages');
    localStorage.removeItem('medisync_chat_options');
    localStorage.removeItem('medisync_chat_stage');
    localStorage.removeItem('medisync_chat_patient');
    navigate('/chat');
  };

  return (
    <section
      className="hero"
      id="hero-section"
      ref={heroRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      <div className="hero-bg-solid" />

      {/* ===== Animated Background ===== */}
      <div className="hero-bg-elements">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
        <div className="pulse-ring pulse-ring-1"></div>
        <div className="pulse-ring pulse-ring-2"></div>
      </div>

      {/* ===== Floating Medical Icons ===== */}
      <div className="floating-icons">
        <div className="float-icon float-icon-1" aria-hidden="true">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <div className="float-icon float-icon-2" aria-hidden="true">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.5">
            <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" y1="19" x2="12" y2="22" />
          </svg>
        </div>
        <div className="float-icon float-icon-3" aria-hidden="true">
          <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#6EE7B7" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
        </div>
        <div className="float-icon float-icon-4" aria-hidden="true">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4" />
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
          </svg>
        </div>
        <div className="float-icon float-icon-5" aria-hidden="true">
          <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="1.5">
            <rect x="3" y="3" width="7" height="9" rx="2" />
            <rect x="14" y="3" width="7" height="5" rx="2" />
            <rect x="14" y="12" width="7" height="9" rx="2" />
            <rect x="3" y="16" width="7" height="5" rx="2" />
          </svg>
        </div>
      </div>

      {/* ===== Main Content ===== */}
      <div className="hero-container">
        {/* Left Column — Text */}
        <div className="hero-content">
          <div className="hero-badge anim-up" style={{ animationDelay: '0s' }}>
            <span className="badge-dot"></span>
            <span>AI-Powered Healthcare Platform</span>
          </div>

          <h1 className="hero-title anim-up" style={{ animationDelay: '0.15s' }}>
            Your Health,
            <span className="title-gradient"> Simplified</span>
            <span className="title-line">& Synced.</span>
          </h1>

          <p className="hero-description anim-up" style={{ animationDelay: '0.3s' }}>
            MediSync brings together AI diagnostics, voice-powered consultations,
            smart scheduling, and centralized medical records — all in one seamless platform
            designed to put <strong>you</strong> in control of your health.
          </p>

          {/* Action Buttons */}
          <div className="hero-actions anim-up" style={{ animationDelay: '0.2s' }}>
            <button className="btn btn-primary btn-large glow-effect group" onClick={startChat}>
              Try Now
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </button>
            <button className="btn btn-outline btn-large" id="btn-watch-demo">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              <span>Watch Demo</span>
            </button>
          </div>

          <div className="hero-stats anim-up" style={{ animationDelay: '0.6s' }} id="hero-stats">
            <div className="stat-item">
              <div className="stat-number-row">
                <span className="stat-number">{counts.patients.toLocaleString()}</span>
                <span className="stat-suffix">+</span>
              </div>
              <span className="stat-label">Active Patients</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number-row">
                <span className="stat-number">{counts.doctors}</span>
                <span className="stat-suffix">+</span>
              </div>
              <span className="stat-label">Verified Doctors</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <div className="stat-number-row">
                <span className="stat-number">{counts.rating}</span>
                <span className="stat-suffix" style={{marginLeft: '4px'}}>⭐</span>
              </div>
              <span className="stat-label">Star Rated</span>
            </div>
          </div>
        </div>

        {/* Right Column — Heart Video + Cards */}
        <div className="hero-visual" id="hero-visual">
          <div className="visual-wrapper">
            {/* Heart Video */}
            <div className="hero-video-container">
              <video
                autoPlay
                loop
                muted
                playsInline
                className="hero-video"
                id="hero-video"
              >
                <source src="/heart-animation.mp4" type="video/mp4" />
              </video>
              <div className="video-fade video-fade-left"></div>
              <div className="video-fade video-fade-right"></div>
            </div>

            {/* Floating info cards */}
            <div className="info-card card-appointment" id="card-appointment">
              <div className="card-icon card-icon-green">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="card-text">
                <span className="card-title">Next Appointment</span>
                <span className="card-value">Today, 3:00 PM</span>
              </div>
            </div>

            <div className="info-card card-vitals" id="card-vitals">
              <div className="card-icon card-icon-teal">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14B8A6" strokeWidth="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div className="card-text">
                <span className="card-title">Heart Rate</span>
                <span className="card-value">
                  72 BPM <span className="status-dot status-healthy"></span>
                </span>
              </div>
            </div>

            <div className="info-card card-medicine" id="card-medicine">
              <div className="card-icon card-icon-light">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2">
                  <path d="M8.5 2H5.5a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h3a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3z" />
                  <path d="M18.5 2h-3a3 3 0 0 0-3 3v1a3 3 0 0 0 3 3h3a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3z" />
                </svg>
              </div>
              <div className="card-text">
                <span className="card-title">Medicine Reminder</span>
                <span className="card-value">2 pills at 6 PM</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== Brand Slider ===== */}
      <div className="brand-slider-section anim-up" style={{ animationDelay: '0.8s' }} id="brand-slider">
        <p className="brand-slider-label">Trusted by leading healthcare institutions</p>
        <div className="brand-slider-track-wrapper">
          {/* Left & right edge fades */}
          <div className="brand-slider-fade brand-slider-fade-left"></div>
          <div className="brand-slider-fade brand-slider-fade-right"></div>

          <div className="brand-slider-track">
            {scrollBrands.map((brand, i) => (
              <div className="brand-slide" key={`${brand.name}-${i}`}>
                <div className="brand-hover-bg"></div>
                <div className="brand-img-wrapper">
                  <img
                    src={brand.logo}
                    alt={brand.name}
                    className="brand-logo-img"
                    loading="lazy"
                  />
                </div>
                <span className="brand-tooltip">{brand.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <svg className="hero-bottom-cutout" viewBox="0 0 1440 100" preserveAspectRatio="none">
        <path d="M0,0 C360,100 1080,100 1440,0 L1440,100 L0,100 Z" fill="#E2F6ED" />
      </svg>
    </section>
  );
};

export default HeroSection;
