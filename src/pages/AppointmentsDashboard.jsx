import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Search, PlusCircle, CheckCircle2, XCircle, Video } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';

const mockAppointments = [
  // Removed Dr. Aarav (pending) to keep it real
  {
    id: 'APT-09381',
    doctorName: 'Dr. Priya Patel',
    specialty: 'Dermatologist',
    date: '2024-03-22',
    time: '02:00 PM',
    mode: 'Telehealth Video',
    status: 'completed',
    clinic: 'City Clinic, Mumbai',
    fee: '₹800'
  },
  {
    id: 'APT-08271',
    doctorName: 'Dr. Rahul Verma',
    specialty: 'General Physician',
    date: '2024-02-14',
    time: '09:00 AM',
    mode: 'In-Person Visit',
    status: 'cancelled',
    clinic: 'MediCare Center, Bengaluru',
    fee: '₹500'
  }
];

const AppointmentsDashboard = () => {
  const [activeTab, setActiveTab] = useState('pending');
  const navigate = useNavigate();

  const [appointments, setAppointments] = useState(() => {
    // Dynamic initialization logic
    try {
      const saved = localStorage.getItem('medisync_appointments');
      let loaded = saved ? JSON.parse(saved) : mockAppointments;
      
      // Auto complete check
      const now = new Date();
      loaded = loaded.map(app => {
        if (app.status === 'pending') {
          const appDateTime = new Date(`${app.date} ${app.time}`);
          if (now > appDateTime) {
            app.status = 'completed';
          }
        }
        return app;
      });
      return loaded;
    } catch (e) {
      console.error("Local storage parse error (appointments):", e);
      return mockAppointments;
    }
  });

  // Save to local storage on change
  React.useEffect(() => {
    localStorage.setItem('medisync_appointments', JSON.stringify(appointments));
  }, [appointments]);

  const markCompleted = (id) => {
    setAppointments(prev => prev.map(app => 
      app.id === id ? { ...app, status: 'completed' } : app
    ));
  };

  const handleCancel = (id) => {
    setAppointments(prev => prev.map(app => 
      app.id === id ? { ...app, status: 'cancelled' } : app
    ));
  };

  const handleReschedule = async (app) => {
    try {
      // Find doctor in doctors.json to get full details for Booking.jsx
      const res = await fetch('/doctors.json');
      const allDoctors = await res.json();
      const doctor = allDoctors.find(d => d.name === app.doctorName && d.specialty === app.specialty);
      
      if (doctor) {
        localStorage.setItem('medisync_selected_doctor', JSON.stringify(doctor));
        localStorage.setItem('medisync_chat_stage', 'booking');
        localStorage.setItem('medisync_rescheduling_id', app.id);
        navigate('/chat');
      } else {
        alert("Doctor details not found. Please start a new triage.");
        navigate('/chat');
      }
    } catch (e) {
      console.error("Reschedule Error:", e);
      navigate('/chat');
    }
  };

  const filteredAppointments = appointments.filter(app => app.status === activeTab);

  return (
    <div className="dash-container">
      {/* Header */}
      <header className="dash-header">
        <div className="dash-logo-box">
          <div className="dash-logo-icon" onClick={() => navigate('/')}>
             <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M16 8v16M8 16h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
             </svg>
          </div>
          <span className="dash-logo-text" onClick={() => navigate('/')}>Medi<span style={{color: '#059669'}}>Sync</span></span>
        </div>
      </header>

      <main className="dash-main">
        
        {/* Top CTA Banner */}
        <div className="dash-banner">
           <div className="dash-banner-content">
             <h2>Need to see a doctor?</h2>
             <p>
               Skip the waiting room. Use our Dual-LLM AI Triage to describe your symptoms, get matched with the right specialist, and book instantly.
             </p>
           </div>
           <button 
             onClick={() => navigate('/chat')}
             className="dash-banner-btn"
           >
             <PlusCircle size={20} />
             Start AI Triage
           </button>
        </div>

        {/* Dashboard Content */}
        <div className="dash-content">
          
          {/* Tabs */}
          <div className="dash-tabs">
             <button 
               onClick={() => setActiveTab('pending')}
               className={`dash-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
             >
               Pending ({appointments.filter(a => a.status === 'pending').length})
             </button>
             <button 
               onClick={() => setActiveTab('completed')}
               className={`dash-tab-btn ${activeTab === 'completed' ? 'active' : ''}`}
             >
               Completed
             </button>
             <button 
               onClick={() => setActiveTab('cancelled')}
               className={`dash-tab-btn ${activeTab === 'cancelled' ? 'active' : ''}`}
             >
               Cancelled
             </button>
          </div>

          <div className="dash-list-area">
            {filteredAppointments.length === 0 ? (
              <div className="dash-empty">
                <Calendar size={48} style={{margin: '0 auto 16px auto'}} />
                <h3>No {activeTab} appointments</h3>
                <p>You don't have any appointments in this category.</p>
              </div>
            ) : (
              <div>
                {filteredAppointments.map(app => (
                  <div key={app.id} className="dash-item">
                    <div className="dash-item-inner">
                      
                      <div className="dash-item-left">
                         <div className="dash-item-icon">
                           <Calendar size={20} />
                         </div>
                         <div className="dash-item-info">
                           <div className="dash-item-title-row">
                             <h3>{app.doctorName}</h3>
                             <span className="dash-item-badge">
                               {app.specialty}
                             </span>
                           </div>
                           <p className="dash-item-datetime">
                             <span><Calendar size={14} color="#94a3b8" /> {app.date}</span>
                             <span><Clock size={14} color="#94a3b8" /> {app.time}</span>
                           </p>
                           <p className="dash-item-location">
                             <MapPin size={14} color="#94a3b8" /> {app.clinic} • {app.mode}
                           </p>
                         </div>
                      </div>

                      <div className="dash-item-right">
                         <div className="dash-status-row">
                           {app.status === 'pending' && <span className="dash-status-badge pending"><Clock size={14} /> Pending</span>}
                           {app.status === 'completed' && <span className="dash-status-badge completed"><CheckCircle2 size={14} /> Completed</span>}
                           {app.status === 'cancelled' && <span className="dash-status-badge cancelled"><XCircle size={14} /> Cancelled</span>}
                         </div>
                         {app.status === 'pending' && (
                           <div className="dash-actions-row">
                             {app.mode === 'Telehealth Video' && app.meetId && (
                                <button 
                                  onClick={() => {
                                    localStorage.setItem('medisync_telemeet_context', JSON.stringify({
                                      doctorName: app.doctorName,
                                      specialty: app.specialty,
                                      time: app.time,
                                      caseId: app.id,
                                      preReport: app.preReport || null
                                    }));
                                    navigate(`/telemeet?room=${app.meetId}`);
                                  }}
                                  className="dash-action-btn-solid"
                                  style={{ background: 'linear-gradient(135deg, #0ea5e9, #0369a1)', display: 'flex', alignItems: 'center', gap: '6px' }}
                                >
                                  <Video size={14} /> TeleMeet
                                </button>
                              )}
                             <button 
                               onClick={() => handleReschedule(app)} 
                               className="dash-action-btn-outline"
                             >
                               Reschedule
                             </button>
                             <button 
                               onClick={() => handleCancel(app.id)} 
                               className="dash-action-btn-red"
                               style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}
                             >
                               Cancel
                             </button>
                             <button onClick={() => markCompleted(app.id)} className="dash-action-btn-solid">Mark Completed</button>
                           </div>
                         )}
                         {app.status !== 'pending' && (
                           <button className="dash-action-link">View Summary</button>
                         )}
                      </div>

                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AppointmentsDashboard;
