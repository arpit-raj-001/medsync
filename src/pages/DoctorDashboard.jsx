import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { 
  User, 
  Clock, 
  Calendar as CalIcon, 
  Video, 
  FileText, 
  ChevronRight, 
  LogOut, 
  Search,
  Activity,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Info,
  CheckCircle,
  XCircle
} from 'lucide-react';
import DoctorNavbar from '../components/Doctor/DoctorNavbar';
import CalendarUI from '../components/Doctor/CalendarUI';
import PatientDetailModal from '../components/Doctor/PatientDetailModal';
import './DoctorDashboard.css';

const DoctorDashboard = () => {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [loginForm, setLoginForm] = useState({ id: '', password: '' });
    const [doctorData, setDoctorData] = useState(null);
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('home'); // 'home' or 'bookings'
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, ACCEPTED, COMPLETED, CANCELLED
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Modal state
    const [selectedApt, setSelectedApt] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Sync view from URL if present
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const urlView = params.get('view');
        if (urlView) setView(urlView);
    }, []);

    const handleLogin = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('doctors')
                .select('*')
                .eq('id', loginForm.id.trim().toLowerCase())
                .eq('password', loginForm.password.trim())
                .single();

            if (data && !error) {
                setDoctorData(data);
                setIsLoggedIn(true);
            } else {
                alert('Invalid Credentials. For demo use dr001 / gamma1202');
            }
        } catch (err) {
            console.error('Login error:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchAppointments = useCallback(async () => {
        if (!doctorData) return;
        setLoading(true);
        try {
            let query = supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', doctorData.id);

            // Filter by date ONLY on home view (calendar focused)
            if (view === 'home') {
                query = query.eq('appointment_date', selectedDate);
            } else {
                // On dashboard/bookings view, filter by TAB status
                query = query.eq('status', activeTab.toLowerCase());
            }

            const { data, error } = await query.order('appointment_time', { ascending: true });
            if (!error) setAppointments(data);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [doctorData, selectedDate, view, activeTab]);

    useEffect(() => {
        if (isLoggedIn) fetchAppointments();
    }, [isLoggedIn, fetchAppointments]);

    const updateStatus = async (id, newStatus, date, time) => {
        try {
            const { error } = await supabase
                .from('appointments')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;

            // Handle Availability Logic
            if (newStatus === 'accepted') {
                // Block the slot
                await supabase.from('blocked_slots').insert([{
                    doctor_id: doctorData.id,
                    appointment_date: date,
                    appointment_time: time
                }]);
            } else if (newStatus === 'completed' || newStatus === 'cancelled') {
                // Unblock the slot
                await supabase.from('blocked_slots')
                    .delete()
                    .eq('doctor_id', doctorData.id)
                    .eq('appointment_date', date)
                    .eq('appointment_time', time);
            }

            fetchAppointments();
        } catch (err) {
            alert('Failed to update status: ' + err.message);
        }
    };

    if (!isLoggedIn) {
        return (
            <div className="dd-container">
                <div className="dd-login-view">
                    <div className="dd-logo">
                         <div style={{ background: '#0f172a', width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px auto' }}>
                            <Activity color="white" size={32} />
                         </div>
                    </div>
                    <h2>Doctor Portal</h2>
                    <p>Enter your credentials to manage your medical practice.</p>
                    
                    <form onSubmit={handleLogin}>
                        <div className="dd-input-group">
                            <label>Doctor ID</label>
                            <input 
                                type="text" 
                                className="dd-input" 
                                placeholder="e.g. dr001"
                                value={loginForm.id}
                                onChange={(e) => setLoginForm({...loginForm, id: e.target.value})}
                            />
                        </div>
                        <div className="dd-input-group">
                            <label>Password</label>
                            <input 
                                type="password" 
                                className="dd-input" 
                                placeholder="••••••••"
                                value={loginForm.password}
                                onChange={(e) => setLoginForm({...loginForm, password: e.target.value})}
                            />
                        </div>
                        <button type="submit" className="dd-login-btn" disabled={loading}>
                            {loading ? <Loader2 className="animate-spin" style={{margin: '0 auto'}} /> : 'Access Dashboard'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    const renderAppointmentCard = (apt) => (
        <div key={apt.id} className="dd-item" onClick={() => { setSelectedApt(apt); setShowModal(true); }}>
            <div className="dd-item-info">
                <div className="dd-avatar-mini"><User size={20} /></div>
                <div className="dd-item-details">
                    <strong>{apt.patient_name}</strong>
                    <span>{apt.case_id} • 1 Patient Session</span>
                </div>
            </div>
            
            <div className="dd-item-meta">
                <div className="dd-item-time"><Clock size={16} /> {apt.appointment_time}</div>
                <div className="dd-item-actions" onClick={e => e.stopPropagation()}>
                    <button className="dd-icon-btn" onClick={() => { setSelectedApt(apt); setShowModal(true); }} title="View Digital Summary"><Info size={16} /></button>
                    
                    {activeTab === 'PENDING' && (
                        <>
                            <button className="dd-action-btn accept" onClick={() => updateStatus(apt.id, 'accepted', apt.appointment_date, apt.appointment_time)}>Accept</button>
                            <button className="dd-action-btn reject" onClick={() => updateStatus(apt.id, 'cancelled', apt.appointment_date, apt.appointment_time)}>Reject</button>
                        </>
                    )}

                    {activeTab === 'ACCEPTED' && (
                        <>
                            <button className="dd-launch-btn" onClick={() => window.open(`/telemeet?room=${apt.case_id}&role=doctor`, '_blank')}><Video size={16} /> Launch Meet</button>
                            <button className="dd-action-btn complete" onClick={() => updateStatus(apt.id, 'completed', apt.appointment_date, apt.appointment_time)}>Mark Completed</button>
                            <button className="dd-action-btn reject" onClick={() => updateStatus(apt.id, 'cancelled', apt.appointment_date, apt.appointment_time)}>Cancel</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', paddingTop: '72px' }}>
            <DoctorNavbar 
                doctorName={doctorData.name} 
                onLogout={() => setIsLoggedIn(false)} 
            />

            <div className="dd-container">
                {view === 'home' ? (
                    <div className="dd-home-layout">
                        <div className="dd-home-left">
                            <CalendarUI 
                                selectedDate={selectedDate} 
                                onDateSelect={setSelectedDate} 
                            />
                        </div>
                        <div className="dd-home-right">
                             <div className="dd-main-card">
                                 <div className="dd-card-header">
                                     <h3>Daily Schedule: {new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</h3>
                                 </div>
                                 <div className="dd-list">
                                    {appointments.length > 0 ? appointments.map(renderAppointmentCard) : <div className="dd-empty"><p>No sessions found for this day.</p></div>}
                                 </div>
                             </div>
                        </div>
                    </div>
                ) : (
                    <div className="dd-dash-layout">
                        <div className="dd-dash-header">
                             <div className="dd-dash-title">
                                <h1>Clinical Management</h1>
                                <p>Manage your patient sessions and clinical reports across the lifecycle.</p>
                             </div>
                             <div className="dd-dash-stats">
                                <div className="dd-mini-stat">
                                   <label>Active</label>
                                   <strong>{activeTab === 'ACCEPTED' ? appointments.length : '-'}</strong>
                                </div>
                                <div className="dd-mini-stat">
                                   <label>Queue</label>
                                   <strong>{activeTab === 'PENDING' ? appointments.length : '-'}</strong>
                                </div>
                             </div>
                        </div>

                        <div className="dd-tabs">
                             {['PENDING', 'ACCEPTED', 'COMPLETED', 'CANCELLED'].map(tab => (
                                 <button 
                                    key={tab} 
                                    className={`dd-tab ${activeTab === tab ? 'active' : ''}`}
                                    onClick={() => setActiveTab(tab)}
                                 >
                                    {tab}
                                 </button>
                             ))}
                        </div>
                        <div className="dd-main-card">
                             <div className="dd-list">
                                {loading ? <div className="dd-empty"><Loader2 className="animate-spin" /></div> : appointments.length > 0 ? appointments.map(renderAppointmentCard) : <div className="dd-empty"><p>No {activeTab.toLowerCase()} sessions to display.</p></div>}
                             </div>
                        </div>
                    </div>
                )}
            </div>

            <PatientDetailModal 
                isOpen={showModal} 
                onClose={() => setShowModal(false)} 
                appointment={selectedApt} 
            />
        </div>
    );
};

export default DoctorDashboard;
