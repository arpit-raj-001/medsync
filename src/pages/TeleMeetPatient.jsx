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

  // 1. State & Refs
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
  const [presence, setPresence] = useState({ doctor_ready: false, patient_ready: false });

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

  // 2. Helper Functions (Defined before use in Effects)
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const updateReadyStatus = useCallback(async (status) => {
    if (!roomId) return;
    try {
      await supabase
        .from('appointments')
        .update({ patient_ready: status })
        .eq('case_id', roomId);
    } catch (err) {
      console.error('Ready update error:', err);
    }
  }, [roomId]);

  const startLocalVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      setLocalStream(stream);
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('Camera access denied:', err);
      return null;
    }
  }, []);

  const stopLocalVideo = useCallback(() => {
    setLocalStream(prev => {
        if (prev) prev.getTracks().forEach(track => track.stop());
        return null;
    });
  }, []);

  const cleanupJitsi = useCallback(() => {
    updateReadyStatus(false);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    clearInterval(countdownRef.current);
    clearInterval(sessionTimerRef.current);
    stopLocalVideo();
  }, [updateReadyStatus, stopLocalVideo]);

  const initJitsi = useCallback(() => {
    if (!jitsiContainerRef.current || jitsiApiRef.current || !roomId) return;

    const options = {
      roomName: `medisync-${roomId}`,
      parentNode: jitsiContainerRef.current,
      width: '100%',
      height: '100%',
      configOverwrite: {
        prejoinPageEnabled: false,
        disablePrejoinPage: true,
        p2p: { enabled: false }, // Critical Fix: Force media through bridge to solve "Camera Blocked"
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        hideConferenceSubject: true,
        hideConferenceTimer: true,
        disableProfile: true,
        toolbarButtons: [
          'microphone', 'camera', 'fullscreen', 'fittowindow',
          'hangup', 'videoquality', 'filmstrip', 'tileview'
        ]
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
        if (!sessionTimerRef.current) {
          sessionTimerRef.current = setInterval(() => setSessionTime(prev => prev + 1), 1000);
        }
      });

      api.addListener('readyToClose', () => {
        cleanupJitsi();
        setPhase('ended');
      });

      jitsiApiRef.current = api;

      // Add strict media permissions to the generated iframe
      const iframe = jitsiContainerRef.current.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('allow', 'camera; microphone; display-capture; autoplay; clipboard-write; spotlight');
      }
    }
  }, [roomId, patientData.name, cleanupJitsi]);

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

  const handleJoin = async () => {
    if (!roomId.trim()) return;
    const matched = await validateMeetId(roomId.trim());
    if (!matched) {
      setValidationError('Invalid Meet ID. Please verify your appointment details.');
      return;
    }
    setValidationError('');
    setPhase('waiting');
    await updateReadyStatus(true);
  };

  // 3. Effects (Using initialized functions)

  // Handshake Subscription
  useEffect(() => {
    if (!roomId) return;

    const getInitialStatus = async () => {
      const { data } = await supabase
        .from('appointments')
        .select('doctor_ready, patient_ready')
        .eq('case_id', roomId)
        .single();
      if (data) setPresence(data);
    };
    getInitialStatus();

    const channel = supabase
      .channel(`handshake-p-${roomId}`)
      .on('postgres_changes', { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'appointments', 
          filter: `case_id=eq.${roomId}` 
      }, (payload) => {
        if (payload.new) {
          setPresence({
            doctor_ready: payload.new.doctor_ready,
            patient_ready: payload.new.patient_ready
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      updateReadyStatus(false);
    };
  }, [roomId, updateReadyStatus]);

  // Global Countdown Logic (Stable)
  useEffect(() => {
    let timerId = null;
    if (phase === 'waiting') {
        timerId = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    setPhase('expired');
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
    }
    return () => {
        if (timerId) clearInterval(timerId);
    };
  }, [phase]);

  // Sync Phase Transition
  useEffect(() => {
    if (presence.doctor_ready && presence.patient_ready && phase === 'waiting') {
        setPhase('active');
        stopLocalVideo();
    }
  }, [presence, phase, stopLocalVideo]);

  // Jitsi Trigger
  useEffect(() => {
    if (phase === 'active' && !jitsiApiRef.current) {
        initJitsi();
    }
  }, [phase, initJitsi]);

  // Media Management (Hardened against jitter)
  useEffect(() => {
    if (phase === 'waiting') {
        const init = async () => {
            await startLocalVideo();
        };
        init();
    }
    return () => stopLocalVideo();
  }, [phase, startLocalVideo, stopLocalVideo]);

  // Ensure camera feed reflects in UI when waiting room mounts
  useEffect(() => {
    if (localStream && localVideoRef.current && phase === 'waiting') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, phase]);

  // Room Sync
  useEffect(() => {
    const room = searchParams.get('room');
    if (room && room !== roomId) {
      setRoomId(room);
    }
  }, [searchParams, roomId]);

  useEffect(() => {
    if (phase === 'pre-join' && roomId) {
      fetchAppointmentData(roomId);
    }
  }, [roomId, phase, fetchAppointmentData]);

  // 4. Render Logic
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

  if (phase === 'active' && roomId) {
    return (
      <div className="tm-active-container">
        <div className="tm-session-timer">{formatTime(sessionTime)}</div>
        <div ref={jitsiContainerRef} style={{ flex: 1, background: '#0f172a' }}></div>
        <div className="tm-call-controls">
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleAudio')}><Mic size={22} /></button>
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleVideo')}><Video size={22} /></button>
          <button className="tm-ctrl-btn end-btn" onClick={() => { cleanupJitsi(); setPhase('ended'); }}><PhoneOff size={24} /></button>
        </div>

        {/* --- CONNECTION CENTER (Polished HUD) --- */}
        <div className="tm-connection-center">
            <div className="tm-conn-stat">
                <span className="tm-stat-header">Identity</span>
                <span className="tm-stat-body"><User size={14} /> Patient (Me)</span>
            </div>
            <div className="tm-conn-stat">
                <span className="tm-stat-header">Signal</span>
                <div className="tm-stat-body">
                    <span className={`tm-status-indicator ${presence.patient_ready ? 'online' : 'offline'}`}></span>
                    {presence.patient_ready ? 'READY' : 'OFFLINE'}
                </div>
            </div>
            <div className="tm-conn-stat">
                <span className="tm-stat-header">Doctor</span>
                <div className="tm-stat-body">
                    <span className={`tm-status-indicator ${presence.doctor_ready ? 'online' : 'offline'}`}></span>
                    {presence.doctor_ready ? 'CONNECTED' : 'WAITING'}
                </div>
            </div>
            <div className="tm-conn-actions">
                <button className="tm-conn-btn" onClick={() => updateReadyStatus(true)}>Ping</button>
                <button className="tm-conn-btn" onClick={() => updateReadyStatus(false)}>Reset</button>
            </div>
            <div className="tm-debug-id">Tunnel: {roomId}</div>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
    return (
      <div className="tm-container">
        <div className="tm-waiting-container">
          <div className="tm-waiting-hero">
            <h2>Initializing Consultation</h2>
            <div className="tm-sync-loader">
                <div className="tm-sync-dot"></div>
                <div className="tm-sync-dot"></div>
                <div className="tm-sync-dot"></div>
            </div>
          </div>
          <div className="tm-waiting-grid">
            <div className="tm-video-slot self-video">
              <video 
                ref={localVideoRef} 
                autoPlay 
                playsInline 
                muted 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
              <div className="tm-video-label">You — {patientData.name} (Live Preview)</div>
            </div>
            <div className="tm-video-slot">
              <div className="tm-waiting-placeholder">
                <div className="waiting-icon"><Stethoscope size={36} color="#0ea5e9" /></div>
                <span className="waiting-text">Waiting for {patientData.doctorName}…</span>
                <span className="waiting-sub">Your provider has been notified. They will join shortly.</span>
                <div className="tm-countdown">
                    <div className="tm-countdown-circle">
                        <svg width="80" height="80">
                            <circle cx="40" cy="40" r="36" className="timer-bg" />
                            <circle cx="40" cy="40" r="36" className="timer-progress" style={{ strokeDashoffset: (226 * (1 - countdown / WAITING_TIMEOUT)), strokeDasharray: 226 }} />
                        </svg>
                        <span className="tm-countdown-time">{formatTime(countdown)}</span>
                    </div>
                    <span style={{fontSize: '11px', opacity: 0.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px'}}>Request Valid For</span>
                </div>
                <button 
                  className="tm-status-btn secondary" 
                  style={{marginTop: '32px', padding: '12px 24px'}}
                  onClick={() => { cleanupJitsi(); setPhase('pre-join'); }}
                >
                  Leave Waiting Room
                </button>
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
