import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Clock, MapPin, Search, PlusCircle, CheckCircle2, XCircle, Video, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import './Dashboard.css';

const AppointmentsDashboard = () => {
  const { user: patientData } = useAuth();
  const [activeTab, setActiveTab] = useState('pending');
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchPatientAppointments = useCallback(async () => {
    if (!patientData) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors(*)')
        .eq('patient_id', patientData.id);
      
      if (!error) setAppointments(data || []);
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [patientData]);

  useEffect(() => {
    fetchPatientAppointments();
  }, [fetchPatientAppointments]);

  const markCompleted = async (id) => {
    await supabase.from('appointments').update({ status: 'completed' }).eq('id', id);
    fetchPatientAppointments();
  };

  const handleCancel = async (id) => {
    await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id);
    fetchPatientAppointments();
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
                {filteredAppointments.length > 0 && (
                  <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={20} color="#10b981" /> My Pending Meetings
                  </h3>
                )}
                {filteredAppointments.map(app => (
                  <div key={app.id} className="dd-item">
                    <div className="dd-item-info">
                      <div className="dd-avatar-mini"><Video size={20} /></div>
                      <div className="dd-item-details">
                        <strong>Dr. {app.doctors?.name || 'Specialist'}</strong>
                        <span>{app.case_id} • 1 Consultation Session</span>
                      </div>
                    </div>
                    
                    <div className="dd-item-meta">
                      <div className="dd-item-time"><Clock size={16} /> {app.appointment_time} • {app.appointment_date}</div>
                      <div className="dd-item-actions">
                        {app.status === 'pending' && app.case_id && (
                          <>
                            <button 
                              className="dd-launch-btn"
                              onClick={() => {
                                localStorage.setItem('medisync_telemeet_context', JSON.stringify({
                                  doctorName: app.doctors?.name,
                                  specialty: app.doctors?.specialty,
                                  time: app.appointment_time,
                                  caseId: app.case_id || app.id,
                                  preReport: app.pre_report || null
                                }));
                                navigate(`/telemeet?room=${app.case_id}`);
                              }}
                            >
                              <Video size={16} /> Join TeleMeet
                            </button>
                            <button className="dash-action-btn-outline" onClick={() => handleReschedule(app)}>Reschedule</button>
                            <button 
                              className="dash-action-btn-red" 
                              style={{ backgroundColor: '#fee2e2', color: '#dc2626', border: 'none', padding: '8px 16px', borderRadius: '12px', fontSize: '13px', fontWeight: 700 }}
                              onClick={() => handleCancel(app.id)}
                            >
                              Cancel
                            </button>
                          </>
                        )}
                        {app.status !== 'pending' && (
                          <button className="dash-action-link">View Session Summary</button>
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
