import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Clock, User, FileText, Stethoscope, AlertCircle, RotateCcw, Home, Timer, Loader2, Lock } from 'lucide-react';
import Groq from 'groq-sdk';
import { supabase } from '../lib/supabase';
import './TeleMeet.css';

// ====== Constants ======
const WAITING_TIMEOUT = 300; // 5 minutes in seconds
const JITSI_DOMAIN = 'meet.jit.si';

let groq = null;
try {
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;
  if (apiKey) {
    groq = new Groq({ apiKey, dangerouslyAllowBrowser: true });
  }
} catch (e) {
  console.warn('Groq init failed for TeleMeet:', e);
}

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

// ====== Helper: Parse pre-report via Groq ======
const parseMedicalContext = async (preReportData) => {
  if (!groq || !preReportData || !preReportData.primaryComplaint) return null;

  try {
    const reportText = `
Primary Complaint: ${preReportData.primaryComplaint || 'N/A'}
Symptoms: ${Array.isArray(preReportData.symptoms) ? preReportData.symptoms.join(', ') : preReportData.symptoms || 'N/A'}
Duration: ${preReportData.duration || 'N/A'}
Severity: ${preReportData.severity || 'N/A'}
Progression: ${preReportData.progression || 'N/A'}
Urgency Level: ${preReportData.urgencyLevel || 'N/A'}
Possible Concern: ${preReportData.possibleConcern || 'N/A'}
Recommended Specialty: ${preReportData.recommendedSpecialty || 'N/A'}
    `.trim();

    const response = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `You are a medical data parser. Extact JSON with: "medicalNotes", "symptoms" (list), "medicalHistory", "tags" (list).`
        },
        { role: 'user', content: reportText }
      ],
      temperature: 0.1,
      max_tokens: 400
    });

    const text = response.choices[0]?.message?.content?.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : null;
  } catch (err) {
    console.error('Groq parsing error:', err);
    return null;
  }
};

// ====== Component ======
const TeleMeet = () => {
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
  const [medicalContext, setMedicalContext] = useState(null);
  const [loadingContext, setLoadingContext] = useState(false);
  const [isCheckingId, setIsCheckingId] = useState(false);
  const [isDoctor, setIsDoctor] = useState(searchParams.get('role') === 'doctor');

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const countdownRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const localVideoRef = useRef(null);

  const [patientData, setPatientData] = useState({
    name: 'Arpit Raj', age: '24', gender: 'Male',
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
  }, [searchParams]);

  // ====== Load Data from Supabase ======
  const fetchAppointmentData = async (id) => {
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
          name: data.patient_name || 'Arpit Raj',
          age: '24', // Default for demo
          gender: 'Male', // Default for demo
          appointmentTime: data.appointment_time,
          symptoms: data.pre_report?.primaryComplaint || 'General Consultation',
          caseId: data.case_id,
          doctorName: data.doctors?.name || 'Dr. Sarah Mitchell',
          doctorSpec: data.doctors?.specialty || 'General Physician',
          doctorExp: `${data.doctors?.experience || 10} years`,
          doctorRating: data.doctors?.rating || '4.8',
          doctorImage: data.doctors?.image || null,
        });

        if (data.pre_report) {
          setLoadingContext(true);
          const parsed = await parseMedicalContext(data.pre_report);
          if (parsed) setMedicalContext(parsed);
          setLoadingContext(false);
        }
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setIsCheckingId(false);
    }
  };

  useEffect(() => {
    if (phase === 'pre-join' && roomId) {
      fetchAppointmentData(roomId);
    }
  }, [roomId, phase]);

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
        startWithAudioMuted: false,
        startWithVideoMuted: false,
        disableModeratorIndicator: true,
        enableEmailInStats: false,
        prejoinPageEnabled: false,
        disableDeepLinking: true,
        disableInviteFunctions: true,
        hideConferenceSubject: true,
        hideConferenceTimer: true,
        disableProfile: true,
        toolbarButtons: [],
        notifications: [],
        disableThirdPartyRequests: true,
        enableClosePage: false,
        disableRemoteMute: true,
        remoteVideoMenu: { disableKick: true, disableGrantModerator: true },
        disableLocalVideoFlip: false,
        constraints: {
          video: { height: { ideal: 720 }, width: { ideal: 1280 } }
        }
      },
      interfaceConfigOverwrite: {
        DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
        SHOW_JITSI_WATERMARK: false,
        SHOW_WATERMARK_FOR_GUESTS: false,
        SHOW_BRAND_WATERMARK: false,
        SHOW_CHROME_EXTENSION_BANNER: false,
        TOOLBAR_BUTTONS: [],
        MOBILE_APP_PROMO: false,
        HIDE_INVITE_MORE_HEADER: true,
        DISABLE_PRESENCE_STATUS: true,
        FILM_STRIP_MAX_HEIGHT: 0,
        TILE_VIEW_MAX_COLUMNS: 2,
        DEFAULT_BACKGROUND: '#0f172a',
        DISABLE_VIDEO_BACKGROUND: true,
        filmStripOnly: false,
        VERTICAL_FILMSTRIP: false,
        VIDEO_LAYOUT_FIT: 'both'
      },
      userInfo: {
        displayName: patientData.name,
        email: 'patient@medisync.health'
      }
    };

    // Load JitsiMeetExternalAPI from CDN
    if (window.JitsiMeetExternalAPI) {
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);

      api.addListener('participantJoined', () => {
        clearInterval(countdownRef.current);
        setPhase('active');
        startSessionTimer();
      });

      api.addListener('participantLeft', () => {
        if (!isDoctor) {
           cleanupJitsi();
           setPhase('ended');
        }
      });

      api.addListener('readyToClose', () => {
        cleanupJitsi();
        setPhase('ended');
      });

      jitsiApiRef.current = api;
    }
  }, [roomId, patientData.name]);

  const cleanupJitsi = useCallback(() => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    clearInterval(countdownRef.current);
    clearInterval(sessionTimerRef.current);
  }, []);

  // ====== Session Timer ======
  const startSessionTimer = () => {
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ====== Join Meeting (with validation) ======
  const handleJoin = () => {
    if (!roomId.trim()) return;

    // Validate meet ID against stored appointments
    const matchedAppointment = validateMeetId(roomId.trim());
    if (!matchedAppointment) {
      setValidationError('Invalid Meet ID. Please enter a valid Meet ID from your appointment confirmation email.');
      return;
    }

    // Update patient data with matched appointment info
    setPatientData(prev => ({
      ...prev,
      doctorName: matchedAppointment.doctorName || prev.doctorName,
      doctorSpec: matchedAppointment.specialty || prev.doctorSpec,
      caseId: matchedAppointment.id || prev.caseId,
      appointmentTime: matchedAppointment.time || prev.appointmentTime
    }));

    setValidationError('');
    stopLocalVideo();
    setPhase('waiting');
    setCountdown(WAITING_TIMEOUT);
  };

  // ====== Countdown Effect ======
  useEffect(() => {
    if (phase !== 'waiting') return;

    const script = document.createElement('script');
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => {
      initJitsi();
    };
    document.head.appendChild(script);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          cleanupJitsi();
          setPhase('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(countdownRef.current);
      if (document.head.contains(script)) {
        document.head.removeChild(script);
      }
    };
  }, [phase, initJitsi, cleanupJitsi]);

  // ====== Self Video on Pre-Join ======
  useEffect(() => {
    if (phase === 'pre-join') {
      startLocalVideo();
    }
    return () => {
      if (phase !== 'pre-join') stopLocalVideo();
    };
  }, [phase]);

  // ====== Cleanup on unmount ======
  useEffect(() => {
    return () => {
      cleanupJitsi();
      stopLocalVideo();
    };
  }, []);

  // ====== Mute / Video Controls ======
  const toggleMute = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleAudio');
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleVideo');
      setIsVideoOff(!isVideoOff);
    }
  };

  const endCall = () => {
    cleanupJitsi();
    setPhase('ended');
  };

  // ====== Countdown Ring Progress ======
  const circumference = 2 * Math.PI * 35;
  const countdownProgress = ((WAITING_TIMEOUT - countdown) / WAITING_TIMEOUT) * circumference;

  // ====== RENDER ======

  // ---------- Expired State ----------
  if (phase === 'expired') {
    return (
      <div className="tm-container">
        <div className="tm-status-screen">
          <div className="tm-status-card">
            <div className="tm-status-icon expired">
              <AlertCircle size={40} />
            </div>
            <h2>Session Expired</h2>
            <p>The doctor did not join within the 5-minute waiting period. This can happen due to scheduling conflicts or network issues.</p>
            <div className="tm-status-actions">
              <button className="tm-status-btn primary" onClick={() => { setPhase('pre-join'); setCountdown(WAITING_TIMEOUT); startLocalVideo(); }}>
                <RotateCcw size={16} /> Try Again
              </button>
              <button className="tm-status-btn secondary" onClick={() => navigate('/appointments')}>
                <Home size={16} /> Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Ended State ----------
  if (phase === 'ended') {
    return (
      <div className="tm-container">
        <div className="tm-status-screen">
          <div className="tm-status-card">
            <div className="tm-status-icon ended">
              <Video size={40} />
            </div>
            <h2>Consultation Ended</h2>
            <p>Your video consultation with <strong>{patientData.doctorName}</strong> has concluded. Duration: <strong>{formatTime(sessionTime)}</strong></p>
            <div className="tm-status-actions">
              <button className="tm-status-btn primary" onClick={() => navigate('/appointments')}>
                View Appointments
              </button>
              <button className="tm-status-btn secondary" onClick={() => navigate('/')}>
                Return Home
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Active Session ----------
  if (phase === 'active') {
    return (
      <div className="tm-active-container">
        <div className="tm-session-timer">
          <span className="rec-dot"></span>
          {formatTime(sessionTime)}
        </div>
        
        <div style={{ display: 'flex', flex: 1, width: '100%', overflow: 'hidden' }}>
            <div ref={jitsiContainerRef} style={{ flex: 1, background: '#0f172a' }}></div>
            
            {isDoctor && (
                <div className="tm-doctor-sidebar">
                    <div className="tm-sidebar-header">
                        <FileText size={18} />
                        <h3>Clinical Context</h3>
                    </div>
                    <div className="tm-sidebar-scroll">
                        <div className="tm-info-sect">
                            <label>Patient</label>
                            <strong>{patientData.name} ({patientData.age} yr)</strong>
                        </div>
                        {medicalContext ? (
                            <>
                                <div className="tm-info-sect">
                                    <label>AI Summary</label>
                                    <p>{medicalContext.medicalNotes}</p>
                                </div>
                                <div className="tm-info-sect">
                                    <label>Clinical History</label>
                                    <p>{medicalContext.medicalHistory}</p>
                                </div>
                                <div className="tm-info-sect">
                                    <label>Detected Symptoms</label>
                                    <div className="tm-tags-row">
                                        {medicalContext.symptoms?.map(s => <span key={s}>#{s}</span>)}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div style={{padding: '20px', textAlign: 'center', opacity: 0.5}}>
                                <Loader2 className="animate-spin" style={{margin: '0 auto 10px'}} />
                                <p style={{fontSize: '11px'}}>Gathering clinical data...</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>

        <div className="tm-call-controls">
          <button className={`tm-ctrl-btn mute-btn ${isMuted ? 'active' : ''}`} onClick={toggleMute} title={isMuted ? 'Unmute' : 'Mute'}>
            {isMuted ? <MicOff size={22} /> : <Mic size={22} />}
          </button>
          <button className={`tm-ctrl-btn mute-btn ${isVideoOff ? 'active' : ''}`} onClick={toggleVideo} title={isVideoOff ? 'Turn on camera' : 'Turn off camera'}>
            {isVideoOff ? <VideoOff size={22} /> : <Video size={22} />}
          </button>
          <button className="tm-ctrl-btn end-btn" onClick={endCall} title="End Call">
            <PhoneOff size={24} />
          </button>
        </div>
      </div>
    );
  }

  // ---------- Waiting State (FIXED: Full-height Jitsi + no overlap) ----------
  if (phase === 'waiting') {
    return (
      <div className="tm-container">
        <div className="tm-waiting-container">
          <div className="tm-patient-bar" style={{ marginBottom: '20px' }}>
            <div className="tm-patient-card" style={{ background: 'linear-gradient(135deg, #0369a1, #0284c7)', border: 'none', color: 'white' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Video size={20} color="white" />
                  <span style={{ fontWeight: 800, fontSize: '14px' }}>Live Session — Room: {roomId}</span>
                </div>
                <span style={{ fontSize: '13px', opacity: 0.8 }}>Connecting to {patientData.doctorName}...</span>
              </div>
            </div>
          </div>

          <div className="tm-waiting-grid">
            {/* Patient Side — Full Jitsi Embed (fills entire left slot) */}
            <div className="tm-video-slot self-video" style={{ position: 'relative' }}>
              <div
                ref={jitsiContainerRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  width: '100%',
                  height: '100%',
                  overflow: 'hidden'
                }}
              ></div>
              <div className="tm-video-label">You — {patientData.name}</div>
            </div>

            {/* Doctor Side — Waiting */}
            <div className="tm-video-slot">
              <div className="tm-waiting-placeholder">
                <div className="waiting-icon">
                  <Stethoscope size={36} color="#0ea5e9" />
                </div>
                <span className="waiting-text">Waiting for Doctor…</span>
                <span className="waiting-sub">{patientData.doctorName} • {patientData.doctorSpec}</span>

                {/* Countdown Timer */}
                <div className="tm-countdown">
                  <div className="tm-countdown-circle">
                    <svg width="80" height="80" viewBox="0 0 80 80">
                      <circle className="timer-bg" cx="40" cy="40" r="35" />
                      <circle
                        className="timer-progress"
                        cx="40" cy="40" r="35"
                        strokeDasharray={circumference}
                        strokeDashoffset={circumference - countdownProgress}
                      />
                    </svg>
                    <span className="tm-countdown-time">{formatTime(countdown)}</span>
                  </div>
                  <span className="tm-countdown-label">Time remaining</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Pre-Join Screen ----------
  return (
    <div className="tm-container">
      {/* Top Patient Bar */}
      <div className="tm-patient-bar">
        <div className="tm-patient-card">
          <h3><span className="tm-dot"></span> Patient Information</h3>
          <div className="tm-patient-grid">
            <div className="tm-patient-field">
              <span className="tm-field-label">Name</span>
              <span className="tm-field-value">{patientData.name}</span>
            </div>
            <div className="tm-patient-field">
              <span className="tm-field-label">Age</span>
              <span className="tm-field-value">{patientData.age}</span>
            </div>
            <div className="tm-patient-field">
              <span className="tm-field-label">Gender</span>
              <span className="tm-field-value">{patientData.gender}</span>
            </div>
            <div className="tm-patient-field">
              <span className="tm-field-label">Appointment</span>
              <span className="tm-field-value">{patientData.appointmentTime}</span>
            </div>
            <div className="tm-patient-field">
              <span className="tm-field-label">Symptoms</span>
              <span className="tm-field-value">{patientData.symptoms}</span>
            </div>
            <div className="tm-patient-field">
              <span className="tm-field-label">Case ID</span>
              <span className="tm-field-value">{patientData.caseId}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3-Column Layout */}
      <div className="tm-prejoin">

        {/* Left Panel — Doctor Info */}
        <div className="tm-panel">
          <div className="tm-panel-title">
            <Stethoscope size={16} /> Doctor Profile
          </div>
          <div className="tm-doc-avatar">
            {patientData.doctorImage ? (
              <img src={patientData.doctorImage} alt={patientData.doctorName} />
            ) : (
              <User size={36} color="#64748b" />
            )}
          </div>
          <div className="tm-doc-name">{patientData.doctorName}</div>
          <div className="tm-doc-spec">{patientData.doctorSpec}</div>
          <div className="tm-doc-stats">
            <div className="tm-doc-stat">
              <span className="stat-label">Experience</span>
              <span className="stat-value">{patientData.doctorExp}</span>
            </div>
            <div className="tm-doc-stat">
              <span className="stat-label">Rating</span>
              <span className="stat-value">⭐ {patientData.doctorRating}</span>
            </div>
            <div className="tm-doc-stat">
              <span className="stat-label">Consultation</span>
              <span className="stat-value">Telehealth</span>
            </div>
          </div>
          <div className="tm-doc-status">
            <span className="status-dot"></span>
            <span>Available Now</span>
          </div>
        </div>

        {/* Center Panel — Join CTA */}
        <div className="tm-panel main tm-center-panel">
          <div className="tm-meet-icon">
            <Video size={36} color="white" />
          </div>
          <div className="tm-meet-title">{isDoctor ? 'Start Practise Session' : 'Join TeleMeet'}</div>
          <div className="tm-meet-subtitle">
            {isDoctor 
              ? 'Initialize your secure provider room. Patients will be able to join once you enter.'
              : 'Enter your unique Meet ID received via email to join your scheduled consultation.'}
          </div>

          {!isDoctor && !roomId && (
            <div className="tm-meet-input-group">
              <input
                type="text"
                className="tm-meet-input"
                placeholder="Enter Meet ID (e.g., MS-A1B2C3)"
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value.toUpperCase()); setValidationError(''); }}
              />
            </div>
          )}

          {(isDoctor || roomId) && (
            <div className="tm-id-badge-centered">
               <Video size={16} /> Room: {roomId}
            </div>
          )}

          <button 
            className="tm-join-btn" 
            disabled={isCheckingId || (!isDoctor && !roomId)}
            onClick={() => {
              stopLocalVideo();
              if (isDoctor) {
                 setPhase('active');
                 initJitsi();
              } else {
                 setPhase('waiting');
                 initJitsi();
                 startCountdown();
              }
            }}
          >
            {isCheckingId ? <Loader2 className="animate-spin" /> : (isDoctor ? 'Start Session' : 'Join Consultation')}
          </button>

          {validationError && (
            <div className="tm-error-note" style={{marginTop: '12px'}}>
              <Lock size={14} /> {validationError}
            </div>
          )}

          <div style={{ marginTop: '24px', opacity: 0.6, fontSize: '11px', fontWeight: 600 }}>
             Secured by MediSync Precision Auth
          </div>
        </div>

        {/* Right Panel — Groq-Parsed Medical Context */}
        <div className="tm-panel">
          <div className="tm-panel-title">
            <FileText size={16} /> Medical Context
          </div>

          {loadingContext ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '40px 0', color: '#64748b' }}>
              <Loader2 size={24} className="tm-spin" />
              <span style={{ fontSize: '13px', fontWeight: 600 }}>Parsing clinical data...</span>
            </div>
          ) : medicalContext ? (
            <>
              <div className="tm-report-section">
                <div className="tm-report-label">Medical Notes</div>
                <div className="tm-report-content">{medicalContext.medicalNotes}</div>
              </div>
              <div className="tm-report-section">
                <div className="tm-report-label">Symptoms</div>
                <div className="tm-report-content">
                  {medicalContext.symptoms && medicalContext.symptoms.length > 0
                    ? medicalContext.symptoms.map((s, i) => (
                        <span key={i} className="tm-report-tag" style={{ background: '#fef3c7', color: '#92400e', marginBottom: '4px' }}>{s}</span>
                      ))
                    : 'No symptoms reported'
                  }
                </div>
              </div>
              <div className="tm-report-section">
                <div className="tm-report-label">Medical History</div>
                <div className="tm-report-content">{medicalContext.medicalHistory}</div>
              </div>
              <div className="tm-report-section">
                <div className="tm-report-label">Tags</div>
                <div>
                  {medicalContext.tags && medicalContext.tags.map((tag, i) => (
                    <span key={i} className="tm-report-tag">{tag}</span>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="tm-report-section">
                <div className="tm-report-label">Medical Notes</div>
                <div className="tm-report-content">No prior clinical data available. Complete AI Triage first to populate medical context.</div>
              </div>
              <div className="tm-report-section">
                <div className="tm-report-label">Tags</div>
                <div>
                  <span className="tm-report-tag">Telehealth</span>
                  <span className="tm-report-tag">New Patient</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeleMeet;
