import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useSearchParams, useNavigate, Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
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
    const { user: doctorData, logout } = useAuth();
    const navigate = useNavigate();
    
    const [allAppointments, setAllAppointments] = useState([]); // All appointments for calendar dots
    const [appointments, setAppointments] = useState([]); // Filtered for current view
    const [loading, setLoading] = useState(false);
    const [view, setView] = useState('home'); // 'home' or 'bookings'
    const [activeTab, setActiveTab] = useState('PENDING'); // PENDING, ACCEPTED, COMPLETED, CANCELLED
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    
    // Modal state
    const [selectedApt, setSelectedApt] = useState(null);
    const [showModal, setShowModal] = useState(false);

    // Sync view from URL if present
    const [searchParams, setSearchParams] = useSearchParams();

    // Sync view from URL if present
    useEffect(() => {
        const urlView = searchParams.get('view');
        if (urlView) setView(urlView);
    }, [searchParams]);

    const fetchAllData = useCallback(async () => {
        if (!doctorData) return;
        setLoading(true);
        try {
            // 1. Fetch ALL appointments for calendar dots (Active & Pending)
            const { data: allData, error: allErr } = await supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', doctorData.id)
                .in('status', ['pending', 'accepted']);
            
            if (!allErr) setAllAppointments(allData || []);

            // 2. Fetch FILTERED appointments for the current view
            let query = supabase
                .from('appointments')
                .select('*')
                .eq('doctor_id', doctorData.id);

            // Home View: Sort by date/time and filter by selected date
            if (view === 'home') {
                query = query.eq('appointment_date', selectedDate);
            } else {
                // Bookings View: Filter by tab status
                query = query.eq('status', activeTab.toLowerCase());
            }

            const { data, error } = await query.order('appointment_date', { ascending: true }).order('appointment_time', { ascending: true });
            if (!error) setAppointments(data || []);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    }, [doctorData, selectedDate, view, activeTab]);

    useEffect(() => {
        if (doctorData) fetchAllData();
    }, [doctorData, fetchAllData]);

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

            fetchAllData();
        } catch (err) {
            alert('Failed to update status: ' + err.message);
        }
    };

    if (!doctorData) return <Navigate to="/login" />;

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
                    
                    {(activeTab === 'PENDING' || activeTab === 'ACCEPTED' || view === 'home') && (
                        <>
                            <button className="dd-launch-btn" onClick={(e) => { e.stopPropagation(); window.open(`/telemeet?room=${apt.case_id}&role=doctor`, '_blank'); }}><Video size={16} /> Launch Meet</button>
                            <button className="dd-action-btn complete" onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'completed', apt.appointment_date, apt.appointment_time); }}>Mark Completed</button>
                            <button className="dd-action-btn reject" onClick={(e) => { e.stopPropagation(); updateStatus(apt.id, 'cancelled', apt.appointment_date, apt.appointment_time); }}>Cancel Meet</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    return (
        <div style={{ background: '#f8fafc', minHeight: '100vh', paddingTop: '72px' }}>

            <div className="dd-view-toggle">
                <button 
                    className={`dd-toggle-btn ${view === 'home' ? 'active' : ''}`}
                    onClick={() => setView('home')}
                >
                    <CalIcon size={18} /> Schedule & Calendar
                </button>
                <button 
                    className={`dd-toggle-btn ${view === 'bookings' ? 'active' : ''}`}
                    onClick={() => setView('bookings')}
                >
                    <Activity size={18} /> Clinical Management
                </button>
            </div>

            <div className="dd-container">
                {view === 'home' ? (
                    <div className="dd-home-layout">
                        <div className="dd-home-left">
                            <CalendarUI 
                                selectedDate={selectedDate} 
                                onDateSelect={setSelectedDate} 
                                appointmentCounts={allAppointments.reduce((acc, apt) => {
                                    acc[apt.appointment_date] = (acc[apt.appointment_date] || 0) + 1;
                                    return acc;
                                }, {})}
                            />
                        </div>
                        <div className="dd-home-right">
                             <div className="dd-main-card">
                                 <div className="dd-card-header">
                                     <h3>Upcoming Meets: {new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}</h3>
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
