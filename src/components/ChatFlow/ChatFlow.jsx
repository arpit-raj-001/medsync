import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import PreReport from './PreReport';
import DoctorMatch from './DoctorMatch';
import Booking from './Booking';
import './ChatFlow.css';

const ChatFlow = () => {
  // Load persisted state or default
  const loadInitialStage = () => {
    return localStorage.getItem('medisync_chat_stage') || 'chat';
  };

  const loadInitialPatientData = () => {
    const defaultData = {
      symptoms: [],
      history: '',
      duration: '',
      recommendedSpecialty: '',
      recommendedSpecialtySynonyms: [],
      primaryComplaint: '',
      severity: '',
      progression: '',
      keyObservations: '',
      possibleConcern: '',
      urgencyLevel: 'Low',
      suggestedNextSteps: []
    };

    try {
      const saved = localStorage.getItem('medisync_chat_patient');
      if (!saved) return defaultData;
      
      const parsed = JSON.parse(saved);
      // Ensure we have a valid object and merge defaults for missing fields
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ...defaultData, ...parsed };
      }
      return defaultData;
    } catch (e) {
      console.error("Local storage parse error (patientData):", e);
      return defaultData;
    }
  };

  const [stage, setStage] = useState(loadInitialStage());
  const [patientData, setPatientData] = useState(loadInitialPatientData());
  const [selectedDoctor, setSelectedDoctor] = useState(() => {
    try {
      const saved = localStorage.getItem('medisync_selected_doctor');
      return saved ? JSON.parse(saved) : null;
    } catch (e) {
      return null;
    }
  });

  // Cleanup reschedule state if we are in chat stage
  useEffect(() => {
    if (stage === 'chat') {
       localStorage.removeItem('medisync_selected_doctor');
    }
  }, [stage]);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('medisync_chat_stage', stage);
  }, [stage]);

  useEffect(() => {
    localStorage.setItem('medisync_chat_patient', JSON.stringify(patientData));
  }, [patientData]);

  const handleChatComplete = (data) => {
    setPatientData(data);
    setStage('report');
  };

  const handleFindDoctors = () => {
    setStage('doctors');
  };

  const handleSelectDoctor = (doctor) => {
    setSelectedDoctor(doctor);
    setStage('booking');
  };

  const handleBack = () => {
    if (stage === 'booking') setStage('doctors');
    else if (stage === 'doctors') setStage('report');
    else if (stage === 'report') setStage('chat');
  };

  return (
    <div style={{ backgroundColor: '#f8fafc', minHeight: '100vh', fontFamily: 'inherit', position: 'relative' }}>
      {/* Dynamic Header */}
      <header style={{ backgroundColor: 'white', borderBottom: '1px solid #e2e8f0', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', backgroundColor: '#059669', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
             <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                <path d="M16 8v16M8 16h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
             </svg>
          </div>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', letterSpacing: '-0.025em' }}>
            Medi<span style={{ color: '#059669' }}>Sync</span>
          </span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
           <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#94a3b8', backgroundColor: '#f1f5f9', padding: '6px 12px', borderRadius: '9999px' }}>
             {stage === 'chat' && 'Step 1: Patient Intake'}
             {stage === 'report' && 'Step 2: Medical Summary'}
             {stage === 'doctors' && 'Step 3: Specialist Matching'}
             {stage === 'booking' && 'Step 4: Appointment Setup'}
           </span>
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: '1280px', margin: '0 auto', padding: '16px 32px' }}>
        {stage === 'chat' && <ChatInterface onComplete={handleChatComplete} />}
        {stage === 'report' && <PreReport data={patientData} onBack={handleBack} onProceed={handleFindDoctors} />}
        {stage === 'doctors' && <DoctorMatch specialty={patientData.recommendedSpecialty} synonyms={patientData.recommendedSpecialtySynonyms} onBack={handleBack} onSelect={handleSelectDoctor} />}
        {stage === 'booking' && (
          <Booking 
            doctor={selectedDoctor} 
            onBack={handleBack} 
            isRescheduling={!!localStorage.getItem('medisync_rescheduling_id')}
            reschedulingId={localStorage.getItem('medisync_rescheduling_id')}
          />
        )}
      </main>
    </div>
  );
};

export default ChatFlow;
