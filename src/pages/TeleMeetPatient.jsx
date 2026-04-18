import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Clock, User, FileText, Stethoscope, AlertCircle, RotateCcw, Home, Timer, Loader2, Lock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import './TeleMeet.css';

// ====== Constants ======
const WAITING_TIMEOUT = 300; // 5 minutes in seconds
const JITSI_DOMAIN = 'meet.jit.si';

// ====== Helper: Validate Meet ID against Supabase ======
const validateMeetId = async (meetId) => {
  try {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, doctors(*)')
      .eq('case_id', meetId)
      .in('status', ['pending', 'accepted'])
      .single();
    
    if (error || !data) return null;
    return data;
  } catch {
    return null;
  }
};

// ====== Component ======
const TeleMeetPatient = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [phase, setPhase] = useState('pre-join');
  const [roomId, setRoomId] = useState(searchParams.get('room') || '');
  const [countdown, setCountdown] = useState(WAITING_TIMEOUT);
  const [sessionTime, setSessionTime] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [validationError, setValidationError] = useState('');
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isDoctor] = useState(false);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const countdownRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const localVideoRef = useRef(null);

  const [patientData, setPatientData] = useState({
    name: 'Patient', age: '24', gender: 'Male',
    appointmentTime: '...', symptoms: 'General Consultation',
    caseId: '...', doctorName: 'Doctor', doctorSpec: 'Physician',
    doctorExp: '...', doctorRating: '...', doctorImage: null,
  });

  // ====== Sync Room ID from URL and Auto-Fetch if present ======
  useEffect(() => {
    const room = searchParams.get('room');
    if (room && room !== roomId) {
      setRoomId(room);
    }
  }, [searchParams, roomId]);

  // ====== Load Data from Supabase ======
  const fetchAppointmentData = useCallback(async (id) => {
    if (!id) return;
    setIsCheckingId(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors(*)')
        .eq('case_id', id)
        .single();

      if (data && !error) {
        setPatientData({
          name: data.patient_name || 'Patient',
          age: '24', gender: 'Male',
          appointmentTime: data.appointment_time,
          symptoms: data.pre_report?.primaryComplaint || 'General Consultation',
          caseId: data.case_id,
          doctorName: data.doctors?.name || 'Dr. Sarah Mitchell',
          doctorSpec: data.doctors?.specialty || 'General Physician',
          doctorExp: `${data.doctors?.experience || 10} years`,
          doctorRating: data.doctors?.rating || '4.8',
          doctorImage: data.doctors?.image || null,
        });
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsCheckingId(false);
    }
  }, []);

  useEffect(() => {
    if (phase === 'pre-join' && roomId) {
      fetchAppointmentData(roomId);
    }
  }, [roomId, phase, fetchAppointmentData]);

  const [doctorPresent, setDoctorPresent] = useState(false);
  const presenceIntervalRef = useRef(null);

  // ====== Presence Management ======
  const updateJoinStatus = async (status) => {
    if (!roomId) return;
    try {
      await supabase
        .from('appointments')
        .update({ patient_joined: status })
        .eq('case_id', roomId);
    } catch (err) {
      console.error('Presence update error:', err);
    }
  };

  const startPresencePolling = useCallback(() => {
    if (presenceIntervalRef.current) return;
    presenceIntervalRef.current = setInterval(async () => {
      if (!roomId) return;
      const { data, error } = await supabase
        .from('appointments')
        .select('doctor_joined')
        .eq('case_id', roomId)
        .single();
      
      if (data && data.doctor_joined) {
        setDoctorPresent(true);
        clearInterval(presenceIntervalRef.current);
      }
    }, 4000);
  }, [roomId]);

  useEffect(() => {
    return () => {
      if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
      updateJoinStatus(false);
    };
  }, [roomId]);

  // ====== Self Video Preview ======
  const startLocalVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.warn('Camera access denied:', err);
    }
  }, []);

  const stopLocalVideo = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
  }, [localStream]);

  // ====== Jitsi Integration ======
  const initJitsi = useCallback(() => {
    if (!jitsiContainerRef.current || jitsiApiRef.current) return;

    const options = {
      roomName: `medisync-${roomId}`,
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: '100%',
      configOverwrite: {
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        hideConferenceSubject: true,
        hideConferenceTimer: true,
        disableProfile: true,
        toolbarButtons: [],
      },
      interfaceConfigOverwrite: {
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        DEFAULT_BACKGROUND: '#0f172a',
      },
      userInfo: {
        displayName: patientData.name,
        email: 'patient@medisync.health'
      }
    };

    if (window.JitsiMeetExternalAPI) {
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);

      api.addListener('participantJoined', () => {
        setPhase('active');
        sessionTimerRef.current = setInterval(() => setSessionTime(prev => prev + 1), 1000);
      });

      api.addListener('readyToClose', () => {
        cleanupJitsi();
        setPhase('ended');
      });

      jitsiApiRef.current = api;
    }
  }, [roomId, patientData.name]);

  const cleanupJitsi = useCallback(() => {
    updateJoinStatus(false);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    clearInterval(countdownRef.current);
    clearInterval(sessionTimerRef.current);
    if (presenceIntervalRef.current) clearInterval(presenceIntervalRef.current);
    stopLocalVideo();
  }, [stopLocalVideo, roomId]);

  const handleJoin = async () => {
    if (!roomId.trim()) return;
    const matched = await validateMeetId(roomId.trim());
    if (!matched) {
      setValidationError('Invalid Meet ID. Please verify your appointment details.');
      return;
    }
    setValidationError('');
    setPhase('waiting');
    await updateJoinStatus(true);
    startPresencePolling();
  };

  useEffect(() => {
    if (doctorPresent && phase === 'waiting') {
      stopLocalVideo();
      setPhase('active');
      initJitsi();
    }
  }, [doctorPresent, phase, initJitsi, stopLocalVideo]);

  // ====== Effects ======
  useEffect(() => {
    if (phase === 'pre-join') startLocalVideo();
    return () => stopLocalVideo();
  }, [phase, startLocalVideo, stopLocalVideo]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ---------- RENDER ----------
  if (phase === 'expired') {
    return (
      <div className="tm-container">
        <div className="tm-status-screen">
          <div className="tm-status-card">
            <div className="tm-status-icon expired"><AlertCircle size={40} /></div>
            <h2>Session Expired</h2>
            <p>The doctor did not join. Please reschedule through your dashboard.</p>
            <div className="tm-status-actions">
              <button className="tm-status-btn primary" onClick={() => navigate('/appointments')}>Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'ended') {
    return (
      <div className="tm-container">
        <div className="tm-status-screen">
          <div className="tm-status-card">
            <div className="tm-status-icon ended"><Video size={40} /></div>
            <h2>Session Concluded</h2>
            <p>Your consultation with <strong>{patientData.doctorName}</strong> has ended.</p>
            <button className="tm-status-btn primary" onClick={() => navigate('/')}>Return Home</button>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div className="tm-active-container">
        <div className="tm-session-timer">{formatTime(sessionTime)}</div>
        <div ref={jitsiContainerRef} style={{ flex: 1, background: '#0f172a' }}></div>
        <div className="tm-call-controls">
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleAudio')}><Mic size={22} /></button>
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleVideo')}><Video size={22} /></button>
          <button className="tm-ctrl-btn end-btn" onClick={() => { cleanupJitsi(); setPhase('ended'); }}><PhoneOff size={24} /></button>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    const circum = 2 * Math.PI * 35;
    const progress = ((WAITING_TIMEOUT - countdown) / WAITING_TIMEOUT) * circum;
    return (
      <div className="tm-container">
        <div className="tm-waiting-container">
          <div className="tm-waiting-grid">
            <div className="tm-video-slot self-video">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="tm-video-label">You — {patientData.name}</div>
            </div>
            <div className="tm-video-slot">
              <div className="tm-waiting-placeholder">
                <div className="waiting-icon"><Stethoscope size={36} color="#0ea5e9" /></div>
                <span className="waiting-text">Waiting for Doctor…</span>
                <span className="waiting-sub">{patientData.doctorName}</span>
                <div className="tm-countdown">
                    <Loader2 className="animate-spin" size={32} color="#0ea5e9" />
                    <span className="tm-countdown-time" style={{position: 'relative', top: '20px'}}>Syncing...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="tm-container">
      <div className="tm-patient-bar">
        <div className="tm-patient-card">
          <h3><span className="tm-dot"></span> Patient Information</h3>
          <div className="tm-patient-grid">
            <div className="tm-patient-field"><span className="tm-field-label">Name</span><span className="tm-field-value">{patientData.name}</span></div>
            <div className="tm-patient-field"><span className="tm-field-label">Case ID</span><span className="tm-field-value">{patientData.caseId}</span></div>
          </div>
        </div>
      </div>

      <div className="tm-prejoin">
        <div className="tm-panel">
          <div className="tm-panel-title"><Stethoscope size={16} /> Doctor Profile</div>
          <div className="tm-doc-avatar">{patientData.doctorImage ? <img src={patientData.doctorImage} alt="" /> : <User size={36} />}</div>
          <div className="tm-doc-name">{patientData.doctorName}</div>
          <div className="tm-doc-spec">{patientData.doctorSpec}</div>
          <div className="tm-doc-status"><span className="status-dot"></span> Available Now</div>
        </div>

        <div className="tm-panel main tm-center-panel">
          <div className="tm-meet-icon"><Video size={36} color="white" /></div>
          <div className="tm-meet-title">Join TeleMeet</div>
          <div className="tm-meet-subtitle">Enter your room to meet with your healthcare provider.</div>
          {!roomId && (
             <div className="tm-meet-input-group">
                <input type="text" className="tm-meet-input" placeholder="Enter Meet ID" value={roomId} onChange={(e) => setRoomId(e.target.value.toUpperCase())} />
             </div>
          )}
          {roomId && <div className="tm-id-badge-centered"><Video size={16} /> Room: {roomId}</div>}
          <button className="tm-join-btn" onClick={handleJoin}>Join Consultation</button>
          {validationError && <div className="tm-error-note" style={{marginTop: '12px'}}><Lock size={14} /> {validationError}</div>}
        </div>

        <div className="tm-panel">
          <div className="tm-panel-title"><FileText size={16} /> Medical Context</div>
          <p>Clinical data is available once the provider initiates the session.</p>
        </div>
      </div>
    </div>
  );
};

export default TeleMeetPatient;
