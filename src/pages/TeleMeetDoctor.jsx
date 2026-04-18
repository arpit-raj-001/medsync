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
const TeleMeetDoctor = () => {
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
  const [isDoctor] = useState(true);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const countdownRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const localVideoRef = useRef(null);

  const [patientData, setPatientData] = useState({
    name: 'Patient', age: '24', gender: 'Male',
    appointmentTime: '...', symptoms: 'Clinical Session',
    caseId: '...', doctorName: 'Dr. Strange', doctorSpec: 'Medical Specialist',
    doctorExp: '...', doctorRating: '...', doctorImage: null,
  });

  // Load from localStorage Redundancy
  useEffect(() => {
    const savedDoc = localStorage.getItem('medisync_doctor');
    if (savedDoc) {
        const doc = JSON.parse(savedDoc);
        setPatientData(prev => ({
            ...prev,
            doctorName: doc.name || prev.doctorName,
            doctorSpec: doc.specialty || prev.doctorSpec,
            doctorExp: `${doc.experience || 0} years`,
            doctorRating: doc.rating || '4.9',
            doctorImage: doc.image || prev.doctorImage
        }));
    }
  }, []);

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
          age: '24', // Default for demo
          gender: 'Male', // Default for demo
          appointmentTime: data.appointment_time,
          symptoms: data.pre_report?.primaryComplaint || 'Clinical Session',
          caseId: data.case_id,
          doctorName: data.doctors?.name || 'Dr. Strange',
          doctorSpec: data.doctors?.specialty || 'Medical Specialist',
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
  }, []);

  useEffect(() => {
    if (phase === 'pre-join' && roomId) {
      fetchAppointmentData(roomId);
    }
  }, [roomId, phase, fetchAppointmentData]);

  const [bothJoined, setBothJoined] = useState(false);
  const presenceIntervalRef = useRef(null);

  // ====== Presence Management ======
  const updateJoinStatus = async (status) => {
    if (!roomId) return;
    try {
      await supabase
        .from('appointments')
        .update({ doctor_joined: status })
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
        .select('patient_joined')
        .eq('case_id', roomId)
        .single();
      
      if (data && data.patient_joined) {
        setBothJoined(true);
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
        displayName: patientData.doctorName,
        email: 'doctor@medisync.health'
      }
    };

    if (window.JitsiMeetExternalAPI) {
      const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, options);

      api.addListener('participantJoined', () => {
        setPhase('active');
        startSessionTimer();
      });

      api.addListener('readyToClose', () => {
        cleanupJitsi();
        setPhase('ended');
      });

      jitsiApiRef.current = api;
    }
  }, [roomId, patientData.doctorName]);

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

  const startSessionTimer = () => {
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
  };

  const handleJoin = async () => {
    setValidationError('');
    setPhase('waiting');
    await updateJoinStatus(true);
    startPresencePolling();
  };

  useEffect(() => {
    if (bothJoined && phase === 'waiting') {
      stopLocalVideo();
      setPhase('active');
      initJitsi();
    }
  }, [bothJoined, phase, initJitsi, stopLocalVideo]);

  // ---------- RENDER ----------
  if (phase === 'ended') {
    return (
      <div className="tm-container">
        <div className="tm-status-screen">
          <div className="tm-status-card">
            <div className="tm-status-icon ended"><Video size={40} /></div>
            <h2>Consultation Concluded</h2>
            <p>Your session has ended. Duration: <strong>{formatTime(sessionTime)}</strong></p>
            <div className="tm-status-actions">
              <button className="tm-status-btn primary" onClick={() => navigate('/doctor-portal?view=bookings')}>Return to Dashboard</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'waiting') {
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
              <div className="tm-video-label">Your Stream — {patientData.doctorName}</div>
            </div>
            <div className="tm-video-slot">
              <div className="tm-waiting-placeholder">
                <div className="waiting-icon"><User size={36} color="#3b82f6" /></div>
                <span className="waiting-text">Waiting for Patient…</span>
                <span className="waiting-sub">{patientData.name} will join shortly</span>
                <div className="tm-countdown">
                    <Loader2 className="animate-spin" size={32} color="#3b82f6" />
                    <span className="tm-countdown-time" style={{position: 'relative', top: '20px'}}>Syncing...</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'active') {
    return (
      <div className="tm-active-container">
        <div className="tm-session-timer"><span className="rec-dot"></span>{formatTime(sessionTime)}</div>
        <div style={{ display: 'flex', flex: 1, width: '100%', overflow: 'hidden' }}>
            <div ref={jitsiContainerRef} style={{ flex: 1, background: '#0f172a' }}></div>
            <div className="tm-doctor-sidebar">
                <div className="tm-sidebar-header"><FileText size={18} /><h3>Clinical Context</h3></div>
                <div className="tm-sidebar-scroll">
                    <div className="tm-info-sect"><label>Patient</label><strong>{patientData.name} ({patientData.age} yr)</strong></div>
                    {medicalContext ? (
                        <>
                            <div className="tm-info-sect"><label>AI Summary</label><p>{medicalContext.medicalNotes}</p></div>
                            <div className="tm-info-sect"><label>History</label><p>{medicalContext.medicalHistory}</p></div>
                            <div className="tm-info-sect"><label>Detect Tags</label><div className="tm-tags-row">{medicalContext.symptoms?.map(s => <span key={s}>#{s}</span>)}</div></div>
                        </>
                    ) : (
                        <div style={{padding: '20px', textAlign: 'center', opacity: 0.5}}><Loader2 className="animate-spin" /><p>Gathering clinical data...</p></div>
                    )}
                </div>
            </div>
        </div>
        <div className="tm-call-controls">
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleAudio')}><Mic size={22} /></button>
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleVideo')}><Video size={22} /></button>
          <button className="tm-ctrl-btn end-btn" onClick={() => { cleanupJitsi(); setPhase('ended'); }}><PhoneOff size={24} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="tm-container">
      <div className="tm-patient-bar">
        <div className="tm-patient-card">
          <h3><span className="tm-dot"></span> Clinical Session: {roomId}</h3>
          <div className="tm-patient-grid">
            <div className="tm-patient-field"><span className="tm-field-label">Patient</span><span className="tm-field-value">{patientData.name}</span></div>
            <div className="tm-patient-field"><span className="tm-field-label">Scheduled</span><span className="tm-field-value">{patientData.appointmentTime}</span></div>
            <div className="tm-patient-field"><span className="tm-field-label">Case ID</span><span className="tm-field-value">{patientData.caseId}</span></div>
          </div>
        </div>
      </div>

      <div className="tm-prejoin">
        <div className="tm-panel">
          <div className="tm-panel-title"><Stethoscope size={16} /> Provider Profile</div>
          <div className="tm-doc-avatar">{patientData.doctorImage ? <img src={patientData.doctorImage} alt="" /> : <User size={36} />}</div>
          <div className="tm-doc-name">{patientData.doctorName}</div>
          <div className="tm-doc-spec">{patientData.doctorSpec}</div>
          <div className="tm-doc-status"><span className="status-dot"></span> Available Now</div>
        </div>

        <div className="tm-panel main tm-center-panel">
          <div className="tm-meet-icon"><Video size={36} color="white" /></div>
          <div className="tm-meet-title">Start Practice Session</div>
          <div className="tm-meet-subtitle">Initialize your secure clinical room. Once you enter, patients can join for the consultation.</div>

          {!roomId && (
            <div className="tm-meet-input-group">
              <input
                type="text"
                className="tm-meet-input"
                placeholder="Enter Case ID (e.g. APT-09381)"
                value={roomId}
                onChange={(e) => { setRoomId(e.target.value.toUpperCase()); setValidationError(''); }}
              />
            </div>
          )}

          {roomId && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center', width: '100%' }}>
              <div className="tm-id-badge-centered">
                 <Video size={16} /> Room: {roomId}
              </div>
              {!searchParams.get('room') && (
                <button 
                  onClick={() => setRoomId('')}
                  style={{ background: 'transparent', border: 'none', color: '#10b981', fontSize: '12px', fontWeight: 600, cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Change Room
                </button>
              )}
            </div>
          )}

          <button 
            className="tm-join-btn" 
            disabled={isCheckingId || (!roomId)}
            onClick={handleJoin}
          >
            {isCheckingId ? <Loader2 className="animate-spin" /> : 'Start Session'}
          </button>
        </div>

        <div className="tm-panel">
          <div className="tm-panel-title"><FileText size={16} /> Patient Report</div>
          <div className="tm-report-section"><div className="tm-report-label">Reason for Visit</div><div className="tm-report-content">{patientData.symptoms}</div></div>
          {medicalContext && (
            <div className="tm-report-section"><div className="tm-report-label">AI Summary</div><div className="tm-report-content">{medicalContext.medicalNotes}</div></div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeleMeetDoctor;
