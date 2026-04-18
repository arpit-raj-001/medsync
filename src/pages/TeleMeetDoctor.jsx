import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Video, VideoOff, Mic, MicOff, PhoneOff, Clock, User, FileText, Stethoscope, AlertCircle, RotateCcw, Home, Timer, Loader2, Lock, Check, CheckCircle2, Sparkles } from 'lucide-react';
import Groq from 'groq-sdk';
import { supabase } from '../lib/supabase';
import { generateConsultationReport } from '../lib/gemini';
import { generateSimulatedConsultation } from '../lib/groq';
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

  // 1. State & Refs
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
  const [presence, setPresence] = useState({ doctor_ready: false, patient_ready: false });
  const [isDictating, setIsDictating] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [transcriptHistory, setTranscriptHistory] = useState([]);
  const [doctorNotes, setDoctorNotes] = useState('');
  const [showNotepad, setShowNotepad] = useState(false);
  const [notepadContent, setNotepadContent] = useState('');
  const [isSendingReport, setIsSendingReport] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [isGeneratingDemo, setIsGeneratingDemo] = useState(false);
  const [preReportJson, setPreReportJson] = useState(null);
  const [appointmentDbId, setAppointmentDbId] = useState(null);
  const [sendOutcome, setSendOutcome] = useState(null); // null | 'success' | 'error'
  const [sendError, setSendError] = useState(null);
  const [generationError, setGenerationError] = useState(null);
  const [finalReport, setFinalReport] = useState(null);

  const jitsiContainerRef = useRef(null);
  const jitsiApiRef = useRef(null);
  const countdownRef = useRef(null);
  const sessionTimerRef = useRef(null);
  const localVideoRef = useRef(null);
  const recognitionRef = useRef(null);

  const [patientData, setPatientData] = useState({
    name: 'Patient', age: '24', gender: 'Male',
    appointmentTime: '...', symptoms: 'Clinical Session',
    caseId: '...', doctorName: 'Dr. Strange', doctorSpec: 'Medical Specialist',
    doctorExp: '...', doctorRating: '...', doctorImage: null,
  });

  // 2. Helper Functions (Defined before use in Effects)
  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  const startSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) return;
    sessionTimerRef.current = setInterval(() => {
      setSessionTime(prev => prev + 1);
    }, 1000);
  }, []);

  const updateReadyStatus = useCallback(async (status) => {
    if (!roomId) return;
    try {
      await supabase
        .from('appointments')
        .update({ doctor_ready: status })
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

  // AI Scribe: Speech Recognition Logic
  const initSpeechRecognition = useCallback(() => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Speech recognition not supported in this browser.');
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
            const transcriptChunk = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                setTranscriptHistory(prev => [...prev, {
                    text: transcriptChunk,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
                setNotepadContent(prev => prev + (prev ? '\n' : '') + `Doctor: ${transcriptChunk}`);
                setLiveTranscript('');
            } else {
                interim += transcriptChunk;
            }
        }
        setLiveTranscript(interim);
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') setIsDictating(false);
    };

    recognition.onend = () => {
        if (isDictating) recognition.start(); // Auto-restart if still toggled on
    };

    recognitionRef.current = recognition;
  }, [isDictating]);

  const toggleDictation = () => {
    if (!isDictating) {
        if (!recognitionRef.current) initSpeechRecognition();
        recognitionRef.current?.start();
        setIsDictating(true);
        setShowNotepad(true);
        setGenerationError(null);
    } else {
        recognitionRef.current?.stop();
        setIsDictating(false);
        setLiveTranscript('');
    }
  };
  const loadDemoTranscript = async () => {
    if (!preReportJson && !patientData.symptoms) {
        alert("No patient context available to generate demo.");
        return;
    }
    
    setIsGeneratingDemo(true);
    try {
        const demo = await generateSimulatedConsultation(preReportJson || { symptoms: patientData.symptoms });
        setNotepadContent(demo);
    } catch (err) {
        console.error("Demo Generation Error:", err);
        alert("Failed to generate clinical simulation.");
    } finally {
        setIsGeneratingDemo(false);
    }
  };
  const handleGenerateTranscript = async () => {
    // We combine the captured transcript with the doctor's manual observations
    const fullTranscript = transcriptHistory.map(m => `${m.role.toUpperCase()}: ${m.text}`).join('\n');
    const enrichedContext = `
CAPTURED TRANSCRIPT:
${fullTranscript}

DOCTOR'S MANUAL CLINICAL OBSERVATIONS (PRIORITY):
${doctorNotes}
    `.trim();

    if (!enrichedContext && !notepadContent) return;
    setIsGeneratingReport(true);
    setGenerationError(null);
    try {
        // High-Fidelity Fix: Pass the RICH pre-report JSON instead of just the symptoms string
        const report = await generateConsultationReport(enrichedContext || notepadContent, preReportJson || patientData.symptoms); 
        setFinalReport(report);
    } catch (err) {
        console.error("Report Generation Error:", err);
        setGenerationError(err.message || String(err));
    } finally {
        setIsGeneratingReport(false);
    }
  };

  const handleSendReport = async () => {
    if (!finalReport || !appointmentDbId) {
        setSendOutcome('error');
        setSendError("No active appointment record found.");
        return;
    }
    setIsSendingReport(true);
    setSendOutcome(null);
    setSendError(null);
    try {
        const { data, error } = await supabase
            .from('appointments')
            .update({ 
                generated_report: finalReport,
                status: 'completed'
            })
            .eq('id', appointmentDbId)
            .select();
            
        if (error) throw error;
        
        if (data && data.length > 0) {
            setSendOutcome('success');
            // Auto-close modal after success delay
            setTimeout(() => {
                setFinalReport(null);
                setSendOutcome(null);
            }, 2000);
        } else {
            // If ID match fails (RLS), try Case ID match as a fallback
            console.warn("Primary ID match failed, attempting fallback with Case ID:", roomId);
            const { data: fallbackData, error: fallbackError } = await supabase
                .from('appointments')
                .update({ 
                    generated_report: finalReport,
                    status: 'completed'
                })
                .eq('case_id', roomId)
                .select();

            if (fallbackData && fallbackData.length > 0) {
                setSendOutcome('success');
                setTimeout(() => {
                    setFinalReport(null);
                    setSendOutcome(null);
                }, 2000);
            } else {
                throw new Error("Target record synchronization mismatch. Verify RLS permissions.");
            }
        }
    } catch (err) {
        console.error("Critical Send Error:", err);
        setSendOutcome('error');
        setSendError(err.message || "Network synchronization failed.");
    } finally {
        setIsSendingReport(false);
    }
  };

  const cleanupJitsi = useCallback(() => {
    updateReadyStatus(false);
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
    }
    clearInterval(countdownRef.current);
    clearInterval(sessionTimerRef.current);
    stopLocalVideo();
    setIsDictating(false);
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

      // Add strict media permissions to the generated iframe
      const iframe = jitsiContainerRef.current.querySelector('iframe');
      if (iframe) {
        iframe.setAttribute('allow', 'camera; microphone; display-capture; autoplay; clipboard-write; spotlight');
      }
    }
  }, [roomId, patientData.doctorName, cleanupJitsi, startSessionTimer]);

  const fetchAppointmentData = useCallback(async (id) => {
    if (!id) return;
    setIsCheckingId(true);
    setValidationError('');
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors(*)')
        .eq('case_id', id)
        .single();

      if (data && !error) {
        setAppointmentDbId(data.id);
        
        // Strictly use DB data for the profile to prevent name/specialty mismatches
        const dbDoctor = data.doctors || {};
        
        setPatientData({
          name: data.patient_name || 'Patient',
          age: data.patient_age || '24',
          gender: data.patient_gender || 'Male',
          appointmentTime: data.appointment_time,
          symptoms: data.pre_report?.primaryComplaint || 'No symptoms reported',
          caseId: data.case_id,
          doctorName: dbDoctor.name || 'Dr. Strange',
          doctorSpec: dbDoctor.specialty || 'Medical Specialist',
          doctorExp: `${dbDoctor.experience || 0} years`,
          doctorRating: dbDoctor.rating || '4.9',
          doctorImage: dbDoctor.image || null,
        });

        if (data.pre_report) {
          setPreReportJson(data.pre_report);
          setLoadingContext(true);
          const parsed = await parseMedicalContext(data.pre_report);
          if (parsed) setMedicalContext(parsed);
          setLoadingContext(false);
        }
        return true;
      } else {
        setValidationError('Invalid or non-existent Case ID.');
        return false;
      }
    } catch (err) {
      console.error('Fetch error:', err);
      setValidationError('Failed to connect to clinical record.');
      return false;
    } finally {
      setIsCheckingId(false);
    }
  }, []);

  const handleJoin = async () => {
    if (!roomId) return;
    const isValid = await fetchAppointmentData(roomId);
    if (isValid) {
        setValidationError('');
        setPhase('waiting');
        await updateReadyStatus(true);
    }
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
      .channel(`handshake-${roomId}`)
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
                    setPhase('ended');
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

  // Jitsi Initialization Trigger
  useEffect(() => {
    if (phase === 'active' && !jitsiApiRef.current) {
        initJitsi();
    }
  }, [phase, initJitsi]);

  // Initial Data & Room Sync
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

  // 4. Render
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
          <div className="tm-waiting-hero">
            <h2>Clinical Room Initialized</h2>
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
              <div className="tm-video-label">Provider Stream — {patientData.doctorName} (Live)</div>
            </div>
            <div className="tm-video-slot">
              <div className="tm-waiting-placeholder">
                <div className="waiting-icon"><User size={36} color="#3b82f6" /></div>
                <span className="waiting-text">Waiting for Patient to Connect…</span>
                <span className="waiting-sub">{patientData.name} has been notified of your presence.</span>
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

                <div style={{marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(255,255,255,0.1)', width: '100%', display: 'flex', justifyContent: 'center'}}>
                  <button className={`tm-scribe-toggle ${isDictating ? 'active' : ''}`} onClick={toggleDictation}>
                    <div className={isDictating ? 'tm-scribe-pulse' : ''} style={{width: isDictating ? '12px' : '0px', height: '12px'}}></div>
                    <Mic size={18} color={isDictating ? '#10b981' : '#94a3b8'} />
                    <span>{isDictating ? 'AI Scribing' : 'AI Scribe'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* AI NOTEPAD SYSTEM */}
        {showNotepad && (
            <div className={`tm-notepad ${showNotepad ? 'open' : ''}`}>
                <div className="tm-notepad-header">
                    <div className="tm-notepad-title">
                        <FileText size={18} />
                        <span>Clinical Scribe Notepad</span>
                    </div>
                    <button className="tm-notepad-close" onClick={() => setShowNotepad(false)}>
                        <RotateCcw size={16} style={{transform: 'rotate(45deg)'}} />
                    </button>
                </div>
                <div className="tm-notepad-paper">
                    {generationError && (
                        <div className="tm-notif-box warning">
                            <AlertCircle size={14} />
                            <span><strong>Generation Failed:</strong> {generationError}</span>
                            <button onClick={() => setGenerationError(null)}>×</button>
                        </div>
                    )}
                    <textarea 
                        className="tm-notepad-content"
                        value={notepadContent}
                        onChange={(e) => setNotepadContent(e.target.value)}
                        placeholder="Start speaking or type clinical notes here..."
                    />
                    {liveTranscript && (
                        <div className="tm-notepad-interim">
                            <span className="typing-dot"></span>
                            {liveTranscript}
                        </div>
                    )}
                </div>
                <div className="tm-notepad-actions">
                    <button 
                        className="tm-pad-btn demo" 
                        onClick={loadDemoTranscript}
                        disabled={isGeneratingDemo}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isGeneratingDemo ? <Loader2 className="animate-spin" size={14} /> : <Sparkles size={14} />}
                        {isGeneratingDemo ? 'Simulating...' : 'Use AI Demo'}
                    </button>
                    <button 
                        className="tm-pad-btn primary" 
                        onClick={handleGenerateTranscript}
                        disabled={isGeneratingReport || !notepadContent}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                        {isGeneratingReport ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
                        {isGeneratingReport ? 'Synthesizing Report...' : 'Generate Clinical Summary'}
                    </button>
                </div>

                {/* FINAL REPORT MODAL */}
                {finalReport && (
                    <div className="tm-final-report-overlay">
                        <div className="tm-report-result-card">
                            <div className="tm-report-header">
                                <Stethoscope size={24} color="#10b981" />
                                <h3>MediSync AI Clinical Report</h3>
                                <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                                    <button 
                                        className={`tm-report-send-btn ${sendOutcome}`}
                                        onClick={handleSendReport}
                                        disabled={isSendingReport || sendOutcome === 'success'}
                                        style={{
                                            backgroundColor: sendOutcome === 'success' ? '#059669' : (sendOutcome === 'error' ? '#ef4444' : '#10b981'),
                                            borderColor: sendOutcome === 'success' ? '#059669' : (sendOutcome === 'error' ? '#ef4444' : '#10b981'),
                                            transition: 'all 0.3s ease'
                                        }}
                                    >
                                        {isSendingReport ? <Loader2 className="animate-spin" size={14} /> : (sendOutcome === 'success' ? <CheckCircle2 size={14} /> : (sendOutcome === 'error' ? <AlertCircle size={14} /> : <Check size={14} />))}
                                        {isSendingReport ? 'Transmitting...' : (sendOutcome === 'success' ? 'Sent and Saved ✅' : (sendOutcome === 'error' ? 'Retry Send' : 'Send to Patient'))}
                                    </button>
                                    <button className="tm-report-close" onClick={() => { setFinalReport(null); setSendOutcome(null); }}>Discard</button>
                                </div>
                            </div>
                            
                            {sendOutcome === 'error' && (
                                <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '10px', color: '#b91c1c', fontSize: '13px', fontWeight: 600 }}>
                                    <AlertCircle size={16} />
                                    <span>Transmission Error: {sendError}</span>
                                </div>
                            )}

                            <div className="tm-report-body">
                                <div className="tm-report-section">
                                    <label>Diagnosis</label>
                                    <p className="tm-diagnosis-text">{finalReport.diagnosis}</p>
                                </div>
                                <div className="tm-report-section">
                                    <label>Clinical Summary</label>
                                    <p>{finalReport.summary}</p>
                                </div>
                                <div className="tm-report-section">
                                    <label>Prescriptions</label>
                                    <div className="tm-meds-grid">
                                        {finalReport.prescriptions?.map((med, i) => (
                                            <div key={i} className="tm-med-item">
                                                <strong>{med.medication}</strong>
                                                <span>{med.dosage} • {med.timing}</span>
                                                <small>{med.instructions}</small>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="tm-report-section">
                                    <label>Precautions</label>
                                    <ul className="tm-report-list">
                                        {finalReport.precautions?.map((p, i) => <li key={i}>{p}</li>)}
                                    </ul>
                                </div>
                                <div className="tm-report-section red">
                                    <label>Red Flags (Immediate Action Required)</label>
                                    <ul className="tm-report-list">
                                        {finalReport.redFlags?.map((r, i) => <li key={i}>{r}</li>)}
                                    </ul>
                                </div>
                            </div>
                            <div className="tm-report-footer">
                                <AlertCircle size={14} />
                                Auto-saved to patient medical records.
                            </div>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* Dictation Overlay for Waiting Room */}
        {isDictating && liveTranscript && (
            <div className="tm-dictation-overlay" style={{bottom: '40px'}}>
                <div className="tm-dictation-bubble">
                    <div className="tm-scribe-pulse"></div>
                    <div className="tm-live-text">{liveTranscript}</div>
                </div>
            </div>
        )}
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
                    
                    {/* Transcript Section */}
                    <div className="tm-transcript-panel">
                        <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#64748b', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px'}}>
                            <Mic size={14} /> AI Scribe Transcript
                        </label>
                        <div className="tm-transcript-container">
                            {transcriptHistory.length === 0 && !liveTranscript && (
                                <p style={{fontSize: '12px', opacity: 0.5, fontStyle: 'italic', textAlign: 'center', padding: '12px'}}>No conversation captured yet.</p>
                            )}
                            {transcriptHistory.map((entry, idx) => (
                                <div key={idx} className="tm-transcript-entry">
                                    <span className="tm-transcript-timestamp">{entry.timestamp}</span>
                                    {entry.text}
                                </div>
                            ))}
                            {liveTranscript && (
                                <div className="tm-transcript-entry" style={{opacity: 0.7}}>
                                    <span className="tm-transcript-timestamp">Live</span>
                                    {liveTranscript}...
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Manual Notepad Section */}
                    <div className="tm-manual-notes-sect">
                        <label style={{display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: '#059669', fontWeight: 800, textTransform: 'uppercase', marginBottom: '8px', marginTop: '20px'}}>
                            <FileText size={14} /> Doctor's Clinical Notes
                        </label>
                        <textarea 
                            className="tm-manual-textarea"
                            placeholder="Type your clinical observations, physical exam findings, or private notes here..."
                            value={doctorNotes}
                            onChange={(e) => setDoctorNotes(e.target.value)}
                        />
                    </div>

                    <div className="tm-info-sect" style={{marginTop: '24px'}}><label>Problem Summary</label></div>
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

                <div className="tm-sidebar-footer" style={{ padding: '24px', borderTop: '1px solid #f1f5f9', background: 'white' }}>
                    <button 
                        className="tm-generate-btn"
                        disabled={isGeneratingReport}
                        onClick={handleGenerateTranscript}
                        style={{
                            width: '100%',
                            padding: '16px',
                            borderRadius: '14px',
                            border: 'none',
                            background: '#059669',
                            color: 'white',
                            fontWeight: 800,
                            fontSize: '15px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            boxShadow: '0 10px 15px -3px rgba(5, 150, 105, 0.2)'
                        }}
                    >
                        {isGeneratingReport ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                        {isGeneratingReport ? 'Compiling AI Report...' : 'Compile Clinical Report'}
                    </button>
                    {generationError && (
                        <p style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
                            <AlertCircle size={12} /> {generationError}
                        </p>
                    )}
                </div>
            </div>
        </div>
        <div className="tm-call-controls">
          <button className={`tm-scribe-toggle ${isDictating ? 'active' : ''}`} onClick={toggleDictation}>
            <div className={isDictating ? 'tm-scribe-pulse' : ''} style={{width: isDictating ? '12px' : '0px', height: '12px'}}></div>
            <Mic size={18} color={isDictating ? '#10b981' : '#94a3b8'} />
            <span>{isDictating ? 'AI Scribing' : 'AI Scribe'}</span>
          </button>
          <div style={{width: '1px', height: '24px', background: 'rgba(255,255,255,0.1)', margin: '0 12px'}}></div>
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleAudio')}><Mic size={22} /></button>
          <button className="tm-ctrl-btn" onClick={() => jitsiApiRef.current?.executeCommand('toggleVideo')}><Video size={22} /></button>
          <button className="tm-ctrl-btn end-btn" onClick={() => { cleanupJitsi(); setPhase('ended'); }}><PhoneOff size={24} /></button>
        </div>

        {/* Dictation Overlay */}
        {isDictating && liveTranscript && (
            <div className="tm-dictation-overlay">
                <div className="tm-dictation-bubble">
                    <div className="tm-scribe-pulse"></div>
                    <div className="tm-live-text">{liveTranscript}</div>
                </div>
            </div>
        )}

        {/* --- CONNECTION CENTER (Polished HUD) --- */}
        <div className="tm-connection-center">
            <div className="tm-conn-stat">
                <span className="tm-stat-header">Identity</span>
                <span className="tm-stat-body"><User size={14} /> Doctor (Me)</span>
            </div>
            <div className="tm-conn-stat">
                <span className="tm-stat-header">Signal</span>
                <div className="tm-stat-body">
                    <span className={`tm-status-indicator ${presence.doctor_ready ? 'online' : 'offline'}`}></span>
                    {presence.doctor_ready ? 'READY' : 'OFFLINE'}
                </div>
            </div>
            <div className="tm-conn-stat">
                <span className="tm-stat-header">Patient</span>
                <div className="tm-stat-body">
                    <span className={`tm-status-indicator ${presence.patient_ready ? 'online' : 'offline'}`}></span>
                    {presence.patient_ready ? 'CONNECTED' : 'WAITING'}
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

          {validationError && (
            <div className="tm-id-error" style={{ color: '#ef4444', fontSize: '13px', fontWeight: 600, background: '#fef2f2', padding: '10px 16px', borderRadius: '10px', marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} /> {validationError}
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
