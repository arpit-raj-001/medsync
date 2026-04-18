import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { ChevronLeft, CheckCircle2, Calendar as CalIcon, Clock, CreditCard, Video, Users, MapPin, UserSquare2, ShieldCheck, Loader2 } from 'lucide-react';
import L from 'leaflet';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const Booking = ({ doctor, onBack, isRescheduling, reschedulingId }) => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState(null);
  const [mode, setMode] = useState('in-person');
  const [paymentStep, setPaymentStep] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);
  
  const [blockedSlots, setBlockedSlots] = useState([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);

  // Generate 5 days starting from TOMORROW
  const dates = Array.from({length: 5}).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() + (i + 1));
    return {
      day: d.toLocaleDateString('en-US', { weekday: 'short' }),
      date: d.getDate(),
      full: d.toISOString().split('T')[0] // YYYY-MM-DD format for dashboard
    };
  });

  // Fetch blocked slots whenever date or doctor changes
  useEffect(() => {
    const fetchBlockedSlots = async () => {
      const selectedFullDate = dates.find(d => d.date === selectedDate)?.full;
      if (!selectedFullDate || !doctor.id) return;

      setIsLoadingSlots(true);
      try {
        const { data, error } = await supabase
          .from('blocked_slots')
          .select('appointment_time')
          .eq('doctor_id', doctor.id)
          .eq('appointment_date', selectedFullDate);

        if (!error && data) {
          setBlockedSlots(data.map(s => s.appointment_time));
        }
      } catch (err) {
        console.error('Error fetching slots:', err);
      } finally {
        setIsLoadingSlots(false);
      }
    };

    fetchBlockedSlots();
  }, [selectedDate, doctor.id]);

  useEffect(() => {
    if (dates.length > 0) {
      setSelectedDate(dates[0].date);
    }
  }, []);

  const handleBook = () => {
    if (!selectedTime || !selectedDate) return;
    if (isRescheduling) {
      handlePay(); // Skip payment step
    } else {
      setPaymentStep(true);
    }
  };

  // Generate unique Meet ID (which is also our Case ID now)
  const generateMeetId = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'MS-';
    for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
  };

  const [meetId, setMeetId] = useState('');

  const handlePay = async () => {
    setIsSubmitting(true);
    setError(null);

    // Generate meet ID for telehealth appointments
    const appointmentMeetId = mode === 'video' ? generateMeetId() : null;
    const caseId = appointmentMeetId || `CS-${Math.floor(100000 + Math.random() * 900000)}`;
    setMeetId(appointmentMeetId || '');

    // Grab pre-report data BEFORE it gets cleared
    let preReportData = null;
    try {
      const raw = localStorage.getItem('medisync_chat_patient');
      if (raw) preReportData = JSON.parse(raw);
    } catch (e) {
      console.warn('Could not parse pre-report data:', e);
    }

    const appointmentDate = dates.find(d => d.date === selectedDate)?.full || dates[0].full;

    try {
      // 1. Save to Supabase
      const { data, error: dbError } = await supabase
        .from('appointments')
        .insert([{
          case_id: caseId,
          patient_id: user?.id || '0001',
          patient_name: user?.name || 'Anonymous Patient',
          doctor_id: doctor.id,
          appointment_date: appointmentDate,
          appointment_time: selectedTime,
          mode: mode === 'video' ? 'Telehealth Video' : 'In-Person Visit',
          status: 'pending',
          pre_report: preReportData
        }]);

      if (dbError) throw dbError;

      // 1.5 Auto-block the slot (since we've removed doctor acceptance)
      await supabase.from('blocked_slots').insert([{
        doctor_id: doctor.id,
        appointment_date: appointmentDate,
        appointment_time: selectedTime
      }]);

      // 2. Keep local copy for immediate UI responsiveness if needed
      const newAppointment = {
        id: isRescheduling ? reschedulingId : caseId,
        doctorName: doctor.name,
        specialty: doctor.specialty,
        date: appointmentDate,
        time: selectedTime,
        mode: mode === 'video' ? 'Telehealth Video' : 'In-Person Visit',
        status: 'pending',
        clinic: doctor.clinicName,
        fee: `₹${doctor.consultationFee}`,
        meetId: appointmentMeetId,
        preReport: preReportData
      };

      const saved = localStorage.getItem('medisync_appointments');
      let appointmentsList = saved ? JSON.parse(saved) : [];
      if (isRescheduling) {
        appointmentsList = appointmentsList.map(app => app.id === reschedulingId ? newAppointment : app);
      } else {
        appointmentsList.unshift(newAppointment);
      }
      localStorage.setItem('medisync_appointments', JSON.stringify(appointmentsList));

      // 3. Cleanup chat state
      if (!isRescheduling) {
        localStorage.removeItem('medisync_chat_messages');
        localStorage.removeItem('medisync_chat_options');
        localStorage.removeItem('medisync_chat_stage');
        localStorage.removeItem('medisync_chat_patient');
      }
      
      setConfirmed(true);
    } catch (err) {
      console.error('Supabase integration error:', err);
      setError('Failed to securely save appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (confirmed) {
    return (
      <div className="bk-confirm-view">
        <div className="bk-success-icon">
           <CheckCircle2 size={64} />
        </div>
        <h1>Booking {isRescheduling ? 'Updated' : 'Confirmed'}!</h1>
        <p>
          Your {mode === 'video' ? 'Telehealth' : 'In-Person'} appointment with <strong>{doctor.name}</strong> has been {isRescheduling ? 'updated' : 'scheduled'} for <strong>{selectedTime}</strong>.
        </p>

        {meetId && (
          <div style={{ 
            background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', 
            border: '2px solid #93c5fd', 
            borderRadius: '16px', 
            padding: '20px 28px', 
            margin: '20px 0', 
            textAlign: 'center' 
          }}>
            <p style={{ fontSize: '12px', fontWeight: 700, color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>
              Your TeleMeet ID
            </p>
            <p style={{ fontSize: '28px', fontWeight: 900, color: '#0f172a', letterSpacing: '0.15em', fontFamily: 'monospace' }}>
              {meetId}
            </p>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
              A confirmation has been saved directly to your dashboard.
            </p>
          </div>
        )}

        <div className="bk-confirm-actions">
          <a href="/" className="pr-btn secondary" style={{textDecoration: 'none'}}>Return Home</a>
          <a href="/appointments" className="pr-btn primary" style={{textDecoration: 'none'}}>View Dashboard</a>
        </div>
      </div>
    );
  }

  return (
    <div className="bk-wrapper">
      
      {/* Left Column: Doctor Details */}
      <div className="bk-left">
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '16px' }}>
             <button 
              onClick={onBack}
              style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
            >
              <ChevronLeft size={16} /> <span style={{fontSize: '13px', fontWeight: 600}}>Back</span>
            </button>
        </div>
        <div className="bk-doc-header">
          <div className="bk-doc-avatar">
            {doctor.image ? (
              <img src={doctor.image} alt={doctor.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <UserSquare2 size={64} opacity={0.5} />
            )}
          </div>
          <h2 style={{margin: '0 0 4px 0', fontSize: '20px', fontWeight: 800}}>{doctor.name}</h2>
          <p style={{margin: 0, color: '#059669', fontSize: '14px', fontWeight: 700}}>{doctor.education}</p>
        </div>

        <div className="bk-stat-row">
          <div className="bk-stat-box">
             <span>Rating</span>
             <strong>{doctor.rating}★</strong>
          </div>
          <div className="bk-stat-box">
             <span>Exp.</span>
             <strong>{doctor.experience} yr</strong>
          </div>
        </div>

        <div className="bk-desc">
          <h4>About</h4>
          <p>{doctor.about}</p>
        </div>
        
        <div className="bk-map-container">
          <h4 style={{fontSize: '14px', fontWeight: 700, marginBottom: '12px'}}>Location</h4>
          <div className="bk-map-box">
            <MapContainer center={[doctor.location.lat, doctor.location.lng]} zoom={13} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 1 }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <Marker position={[doctor.location.lat, doctor.location.lng]}>
                <Popup>{doctor.clinicName}</Popup>
              </Marker>
            </MapContainer>
          </div>
          <p style={{fontSize: '12px', color: '#64748b', display: 'flex', gap: '4px', marginTop: '8px'}}>
             <MapPin size={14} /> {doctor.address}
          </p>
        </div>
      </div>

      {/* Right Column: Checkout/Booking Flow */}
      <div className="bk-right">
        {!paymentStep ? (
          <div className="bk-right-card">
             <h3 className="bk-title">
               <CalIcon color="#10b981" /> {isRescheduling ? 'Update Visit Time' : 'Schedule Appointment'}
             </h3>

             <div className="bk-modes">
                <div 
                  onClick={() => setMode('in-person')}
                  className={`bk-mode-btn ${mode === 'in-person' ? 'active' : ''}`}
                >
                   <Users size={24} />
                   <strong>In-Person Visit</strong>
                </div>
                <div 
                  onClick={() => setMode('video')}
                  className={`bk-mode-btn ${mode === 'video' ? 'active' : ''}`}
                >
                   <Video size={24} />
                   <strong>Telehealth Video</strong>
                </div>
             </div>

             <h4 className="bk-section-title">Select Date</h4>
             <div className="bk-dates">
                {dates.map((d, i) => (
                  <div 
                    key={i}
                    onClick={() => setSelectedDate(d.date)}
                    className={`bk-date-btn ${selectedDate === d.date ? 'active' : ''}`}
                  >
                    <span>{d.day}</span>
                    <strong>{d.date}</strong>
                  </div>
                ))}
             </div>

             <h4 className="bk-section-title">Available Times</h4>
             <div className="bk-times">
               {isLoadingSlots ? (
                 <div style={{padding: '20px', textAlign: 'center', width: '100%'}}><Loader2 className="animate-spin" opacity={0.5} /></div>
               ) : doctor.slots.map((s, i) => {
                 const isBlocked = blockedSlots.includes(s.time);
                 return (
                   <button
                     key={i}
                     disabled={!s.isAvailable || isBlocked}
                     onClick={() => setSelectedTime(s.time)}
                     className={`bk-time-btn ${selectedTime === s.time ? 'active' : ''}`}
                   >
                     {selectedTime === s.time && <Clock size={14} />} {s.time}
                     {isBlocked && <span style={{fontSize: '9px', opacity: 0.7, marginLeft: '4px'}}>(Full)</span>}
                   </button>
                 );
               })}
             </div>

             <div className="bk-checkout-btm">
               <div>
                 <span>Consultation Fee</span>
                 <strong>₹{doctor.consultationFee}</strong>
               </div>
                 <button 
                  onClick={handleBook}
                  disabled={!selectedTime}
                  className="bk-proceed-btn"
                >
                  {isRescheduling ? 'Confirm New Time' : 'Proceed to Payment'}
                </button>
             </div>
          </div>
        ) : (
          <div className="bk-right-card">
             <h3 className="bk-title">
               <CreditCard color="#10b981" /> Complete Booking
             </h3>
             <p style={{color: '#64748b', marginBottom: '32px'}}>Please choose how you would like to pay for your ₹{doctor.consultationFee} consultation.</p>
             
             <div className="bk-option">
                <div className="bk-option-left">
                  <div className="bk-radio"><div className="bk-radio-inner"></div></div>
                  <strong>Pay at Clinic (Cash)</strong>
                </div>
                <span className="bk-tag">Demo Default</span>
             </div>
             
             <p className="checkout-footer" style={{fontSize: '12px', marginTop: '16px', color: '#64748b'}}>
               {isRescheduling 
                 ? "No additional fees will be charged for rescheduling this visit." 
                 : "Cancellation is free up to 24 hours before the appointment."}
             </p>
             
             <div className="bk-option" style={{opacity: 0.5, borderColor: '#e2e8f0', background: 'white', cursor: 'not-allowed'}}>
                <div className="bk-option-left">
                  <div className="bk-radio" style={{borderColor: '#e2e8f0'}}><div style={{display: 'none'}}></div></div>
                  <strong style={{color: '#64748b'}}>Credit / Debit Card (Coming Soon)</strong>
                </div>
             </div>

             <div style={{background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9', display: 'flex', gap: '12px', marginBottom: '32px'}}>
               <ShieldCheck size={20} color="#10b981" />
               <p style={{margin: 0, fontSize: '14px', color: '#475569'}}>Your booking is secured by MediSync. You can reschedule up to 2 hours before the visit free of charge.</p>
             </div>

             <button onClick={handlePay} style={{width: '100%'}} className="bk-proceed-btn">
               Confirm Booking
             </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Booking;
