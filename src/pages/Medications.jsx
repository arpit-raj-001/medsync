import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Pill, Clock, PlusCircle, Trash2, Search, CheckCircle2, AlertCircle, X, Tablets, Calendar, ListTodo, Flame, Loader2, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { extractMedicationsFromTranscript, extractMedicationsWithGroq } from '../lib/gemini';
import './Dashboard.css';

const formatDate = (date) => date.toISOString().split('T')[0];

const Medications = () => {
  const { user: patientData } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('active');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  
  const [newMed, setNewMed] = useState({ 
    name: '', 
    dosage: '', 
    frequency: '1', 
    times: ['09:00'], 
    notes: '' 
  });
  
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dates, setDates] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());

  const [medications, setMedications] = useState([]);
  const [intakeHistory, setIntakeHistory] = useState({}); // { [date]: { [medId]: { [timeIdx]: bool } } }
  const [loading, setLoading] = useState(true);

  // AI Sync States
  const [allReports, setAllReports] = useState([]);
  const [selectedReportId, setSelectedReportId] = useState('');
  const [isAILoading, setIsAILoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [previewReport, setPreviewReport] = useState(null);

  // 1. Fetch Master Medications List
  const fetchMedications = useCallback(async () => {
    if (!patientData?.id) return;
    try {
        const { data, error } = await supabase
            .from('medications')
            .select('*')
            .eq('patient_id', patientData.id);
        
        if (!error) setMedications(data || []);
    } catch (err) {
        console.error("Error fetching medications:", err);
    }
  }, [patientData]);

  // 2. Fetch Intake History for visible dates
  const fetchIntakeHistory = useCallback(async () => {
    if (!patientData?.id) return;
    try {
        const { data, error } = await supabase
            .from('medication_intake')
            .select('*')
            .eq('patient_id', patientData.id);
        
        if (!error) {
            const transformed = {};
            data.forEach(entry => {
                const d = entry.date;
                if (!transformed[d]) transformed[d] = {};
                if (!transformed[d][entry.medication_id]) transformed[d][entry.medication_id] = {};
                transformed[d][entry.medication_id][entry.time_index] = entry.taken;
            });
            setIntakeHistory(transformed);
        }
    } catch (err) {
        console.error("Error fetching intake logs:", err);
    }
  }, [patientData]);

  // 3. Fetch All Reports for Dropdown
  const fetchReports = useCallback(async () => {
    if (!patientData?.id) return;
    try {
        const { data, error } = await supabase
            .from('appointments')
            .select('*, doctors(name)')
            .eq('patient_id', patientData.id)
            .not('generated_report', 'is', null)
            .order('appointment_date', { ascending: false });
        
        if (!error) {
            setAllReports(data || []);
            if (data?.length > 0) {
              setSelectedReportId(data[0].id); // Default to latest
            }
        }
    } catch (err) {
        console.error("Error checking reports:", err);
    }
  }, [patientData]);

  useEffect(() => {
    const init = async () => {
        setLoading(true);
        await Promise.all([fetchMedications(), fetchIntakeHistory(), fetchReports()]);
        setLoading(false);
    };
    init();
  }, [fetchMedications, fetchIntakeHistory, fetchReports]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const days = [];
    for (let i = -3; i <= 3; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      days.push({
        full: formatDate(d),
        day: d.toLocaleDateString('en-US', { weekday: 'short' }),
        date: d.getDate(),
        isToday: i === 0
      });
    }
    setDates(days);
  }, []);

  const handleApplyAIPrescription = async () => {
    const reportToSync = allReports.find(r => r.id === selectedReportId);
    if (!reportToSync) {
        alert("No report found to sync.");
        return;
    }
    setIsAILoading(true);
    try {
      const result = await extractMedicationsWithGroq(reportToSync.generated_report);
      
      if (result?.medications && result.medications.length > 0) {
        const insertData = result.medications.map(m => ({
          patient_id: patientData.id,
          name: m.name,
          dosage: m.dosage,
          frequency: m.frequency,
          times: m.times,
          notes: m.notes || '',
          status: 'active'
        }));

        const { error } = await supabase.from('medications').insert(insertData);
        if (error) throw error;

        await fetchMedications();
        alert(`Successfully synced ${insertData.length} medications from the clinic report.`);
        setShowSyncModal(false);
      } else {
        alert("No medications were detected in this report.");
      }
    } catch (e) {
      console.error("AI Sync Error:", e);
      alert("Failed to extract medications. Ensure the report contains valid medical data.");
    } finally {
      setIsAILoading(false);
    }
  };

  const currentReportPreview = useMemo(() => {
    return allReports.find(r => r.id === selectedReportId);
  }, [allReports, selectedReportId]);

  const handleFrequencyChange = (freq) => {
    const n = parseInt(freq, 10);
    let newTimes = [];
    if (n === 1) newTimes = ["09:00"];
    else if (n === 2) newTimes = ["09:00", "21:00"];
    else if (n === 3) newTimes = ["08:00", "16:00", "00:00"];
    else if (n === 4) newTimes = ["06:00", "12:00", "18:00", "00:00"];
    setNewMed({ ...newMed, frequency: freq, times: newTimes });
  };

  const handleAddMedication = async (e) => {
    e.preventDefault();
    try {
        const { error } = await supabase.from('medications').insert([{
            ...newMed,
            patient_id: patientData.id,
            status: 'active'
        }]);
        if (error) throw error;
        await fetchMedications();
        setShowAddModal(false);
        setNewMed({ name: '', dosage: '', frequency: '1', times: ['09:00'], notes: '' });
    } catch (err) {
        alert("Failed to add medication.");
    }
  };

  const deleteMedication = async (id) => {
    if (window.confirm("Remove this medication?")) {
        await supabase.from('medications').delete().eq('id', id);
        fetchMedications();
    }
  };

  const toggleIntake = async (medId, date, timeIndex) => {
    const isTaken = intakeHistory[date]?.[medId]?.[timeIndex];
    try {
        if (!isTaken) {
            // Log as taken
            await supabase.from('medication_intake').upsert([{
                medication_id: medId,
                patient_id: patientData.id,
                date: date,
                time_index: timeIndex,
                taken: true
            }]);
        } else {
            // Remove log
            await supabase.from('medication_intake')
                .delete()
                .match({ medication_id: medId, date: date, time_index: timeIndex });
        }
        await fetchIntakeHistory();
    } catch (err) {
        console.error("Toggle Error:", err);
    }
  };

  const toggleStatus = async (id, currentStatus) => {
    const next = currentStatus === 'active' ? 'completed' : 'active';
    await supabase.from('medications').update({ status: next }).eq('id', id);
    fetchMedications();
  };

  const getCountdown = (doseMinutes, currentMinutes) => {
    const diff = doseMinutes - currentMinutes;
    if (diff <= 0) return "Due Now";
    const h = Math.floor(diff / 60);
    const m = diff % 60;
    return h > 0 ? `in ${h}h ${m}m` : `in ${m}m`;
  };

  const upcomingDoses = useMemo(() => {
    const isTodaySelected = selectedDate === formatDate(new Date());
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();

    const allDoses = [];
    medications.forEach(med => {
      if (med.status !== 'active') return;
      med.times.forEach((time, index) => {
        const [h, m] = time.split(':').map(Number);
        const doseMinutes = h * 60 + m;
        const isTaken = intakeHistory[selectedDate]?.[med.id]?.[index];

        allDoses.push({
          medId: med.id,
          name: med.name,
          dosage: med.dosage,
          time,
          doseMinutes,
          timeIndex: index,
          isTaken,
          isNext: false,
          remainingText: ''
        });
      });
    });

    allDoses.sort((a, b) => a.doseMinutes - b.doseMinutes);

    if (isTodaySelected) {
      const nextIndex = allDoses.findIndex(d => !d.isTaken && d.doseMinutes > currentMinutes);
      if (nextIndex !== -1) {
        allDoses[nextIndex].isNext = true;
        allDoses[nextIndex].remainingText = getCountdown(allDoses[nextIndex].doseMinutes, currentMinutes);
      }
    }
    return allDoses;
  }, [medications, selectedDate, currentTime, intakeHistory]);

  const filteredMedications = medications.filter(m => 
    m.status === activeTab && 
    (m.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
     m.notes?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-white">
        <Loader2 className="animate-spin text-emerald-600" size={40} />
    </div>
  );

  return (
    <div className="dash-container">
      <header className="dash-header" style={{ position: 'sticky', top: 0, zIndex: 100 }}>
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
        <div className="dash-banner" style={{ background: 'linear-gradient(135deg, #059669 0%, #065f46 100%)', marginBottom: '32px', position: 'relative', overflow: 'hidden' }}>
           <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.1, transform: 'rotate(15deg)' }}>
             <Pill size={200} />
           </div>
           
           <div className="dash-banner-content" style={{ position: 'relative', zIndex: 1 }}>
             <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px' }}>
               <Calendar size={32} />
               {new Date(selectedDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
             </h2>
             <p style={{ fontSize: '16px', opacity: 0.9 }}>Track your prescriptions and stay on top of your recovery.</p>
           </div>
           
           <div style={{ display: 'flex', gap: '12px', marginTop: '20px', overflowX: 'auto', paddingBottom: '12px', position: 'relative', zIndex: 10 }}>
             {dates.map((d) => (
                <button
                  key={d.full}
                  onClick={() => setSelectedDate(d.full)}
                  style={{
                    minWidth: '65px', height: '85px', borderRadius: '18px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    gap: '4px', cursor: 'pointer', border: 'none',
                    transition: 'all 0.3s',
                    backgroundColor: selectedDate === d.full ? 'white' : 'rgba(255,255,255,0.15)',
                    color: selectedDate === d.full ? '#059669' : 'white'
                  }}
                >
                  <span style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', opacity: 0.7 }}>{d.day}</span>
                  <span style={{ fontSize: '20px', fontWeight: 940 }}>{d.date}</span>
                </button>
             ))}
           </div>
        </div>

        {/* REPORT DISCOVERY & AI SYNC */}
        <div className="dash-content" style={{ padding: '32px', marginBottom: '32px', background: 'linear-gradient(to bottom right, #f8fafc, #eff6ff)', border: '2px solid #e2e8f0', borderRadius: '24px' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                 <div style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px' }}>
                    <Sparkles size={22} />
                 </div>
                 <div>
                    <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 900, color: '#0f172a' }}>AI Prescription Discovery</h3>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Automatically extract and schedule medicines from clinical reports.</p>
                 </div>
              </div>
           </div>
           
           {allReports.length === 0 ? (
             <div style={{ padding: '24px', textAlign: 'center', background: 'white', borderRadius: '16px', border: '1px dashed #cbd5e1' }}>
                <p style={{ color: '#64748b', fontSize: '14px', fontStyle: 'italic', margin: 0 }}>No clinical reports available for synchronization.</p>
             </div>
           ) : (
             <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '12px' }}>
                   <div style={{ position: 'relative' }}>
                      <select 
                        value={selectedReportId} 
                        onChange={(e) => setSelectedReportId(e.target.value)}
                        style={{ width: '100%', padding: '16px 20px', borderRadius: '16px', border: '1px solid #e2e8f0', background: 'white', fontWeight: 700, fontSize: '15px', color: '#334155', appearance: 'none', cursor: 'pointer' }}
                      >
                        {allReports.map(r => (
                          <option key={r.id} value={r.id}>
                            {r.generated_report?.clinicalTitle || 'Clinical Session'} ({r.appointment_date})
                          </option>
                        ))}
                      </select>
                      <div style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#94a3b8' }}>
                         ▼
                      </div>
                   </div>
                   <button 
                     onClick={() => {
                        const r = allReports.find(x => x.id === selectedReportId);
                        setPreviewReport(r);
                        setShowSyncModal(true);
                     }}
                     style={{ padding: '0 16px', borderRadius: '16px', background: 'white', border: '1px solid #e2e8f0', color: '#059669', fontWeight: 800, cursor: 'pointer' }}
                     title="View Report Details"
                   >
                     <AlertCircle size={22} />
                   </button>
                   <button 
                     onClick={handleApplyAIPrescription}
                     disabled={isAILoading || !selectedReportId}
                     style={{ 
                       backgroundColor: '#059669', color: 'white', border: 'none', padding: '0 24px', 
                       borderRadius: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px',
                       boxShadow: '0 4px 6px -1px rgba(5, 150, 105, 0.2)'
                     }}
                   >
                     {isAILoading ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                     {isAILoading ? 'Extracting Medications...' : 'Sync Medicines'}
                   </button>
                </div>
             </div>
           )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px', marginBottom: '40px' }}>
           <div className="dash-content" style={{ padding: '28px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ backgroundColor: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px' }}>
                    <ListTodo size={22} />
                  </div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Daily Schedule</h3>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {upcomingDoses.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                    <Tablets size={40} color="#e2e8f0" style={{ marginBottom: '12px' }} />
                    <p style={{ color: '#94a3b8', fontSize: '15px' }}>No active schedule.</p>
                  </div>
                ) : (
                  upcomingDoses.map((dose, idx) => (
                    <div 
                      key={`${dose.medId}-${idx}`} 
                      onClick={() => toggleIntake(dose.medId, selectedDate, dose.timeIndex)}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '16px', padding: '16px', 
                        borderRadius: '16px', cursor: 'pointer', border: '1px solid #f1f5f9',
                        backgroundColor: dose.isNext ? '#f0fdf4' : (dose.isTaken ? '#f8fafc' : 'white'),
                        opacity: dose.isTaken ? 0.7 : 1
                      }}
                    >
                      <div style={{ 
                        width: '28px', height: '28px', borderRadius: '8px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: '2px solid',
                        borderColor: dose.isTaken ? '#10b981' : (dose.isNext ? '#059669' : '#e2e8f0'),
                        backgroundColor: dose.isTaken ? '#10b981' : 'white'
                      }}>
                        {dose.isTaken && <CheckCircle2 size={18} color="white" />}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{dose.name} <span style={{ color: '#64748b', fontSize: '13px' }}>{dose.dosage}</span></div>
                        <div style={{ fontSize: '13px', color: '#94a3b8', fontWeight: 600 }}>{dose.time} {dose.isNext && <span style={{ color: '#ef4444' }}>• NEXT</span>}</div>
                      </div>
                      <button 
                         onClick={(e) => { e.stopPropagation(); deleteMedication(dose.medId); }}
                         style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '8px', cursor: 'pointer', borderRadius: '50%', transition: 'all 0.2s' }}
                         className="hover:bg-red-50 hover:text-red-500"
                         title="Remove Medication"
                      >
                         <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
           </div>

           <div className="dash-content" style={{ padding: '28px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
             <div style={{ position: 'relative', width: '130px', height: '130px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
                <svg width="130" height="130" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="44" fill="none" stroke="#f1f5f9" strokeWidth="10" />
                  <circle 
                    cx="50" cy="50" r="44" fill="none" stroke="#059669" strokeWidth="10" 
                    strokeDasharray={2 * Math.PI * 44}
                    strokeDashoffset={2 * Math.PI * 44 * (1 - (upcomingDoses.filter(d => d.isTaken).length / (upcomingDoses.length || 1)))}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dashoffset 0.8s ease' }}
                  />
                </svg>
                <div style={{ position: 'absolute' }}>
                  <div style={{ fontSize: '30px', fontWeight: 900, color: '#0f172a' }}>
                    {Math.round((upcomingDoses.filter(d => d.isTaken).length / (upcomingDoses.length || 1)) * 100)}%
                  </div>
                </div>
             </div>
             <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>Daily Adherence</h3>
           </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
          <div style={{ display: 'flex', gap: '10px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '14px' }}>
             <button onClick={() => setActiveTab('active')} style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', backgroundColor: activeTab === 'active' ? 'white' : 'transparent', color: activeTab === 'active' ? '#059669' : '#64748b' }}>Current</button>
             <button onClick={() => setActiveTab('completed')} style={{ padding: '8px 20px', borderRadius: '10px', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '14px', backgroundColor: activeTab === 'completed' ? 'white' : 'transparent', color: activeTab === 'completed' ? '#059669' : '#64748b' }}>Archive</button>
          </div>
          <button onClick={() => setShowAddModal(true)} style={{ background: '#059669', color: 'white', border: 'none', padding: '12px 24px', borderRadius: '12px', cursor: 'pointer', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '8px' }}><PlusCircle size={20} /> Add Medication</button>
        </div>

        <div className="dash-content" style={{ padding: '0' }}>
          <div className="dash-tabs" style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', width: '100%' }}>
              <Search size={18} style={{ position: 'absolute', left: '16px', color: '#94a3b8' }} />
              <input type="text" placeholder="Search medications..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ padding: '12px 16px 12px 48px', borderRadius: '14px', border: '1px solid #f1f5f9', backgroundColor: '#f8fafc', width: '100%' }} />
            </div>
          </div>
          <div style={{ padding: '12px' }}>
            {filteredMedications.map(med => (
              <div key={med.id} className="dash-item" style={{ border: '1px solid #f1f5f9', borderRadius: '20px', marginBottom: '12px', padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                     <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '12px' }}><Pill size={24} color="#059669" /></div>
                     <div>
                       <h3 style={{ fontWeight: 800 }}>{med.name}</h3>
                       <p style={{ fontSize: '13px', color: '#64748b' }}>{med.dosage} • {med.frequency}x Daily • {med.times?.join(', ')}</p>
                     </div>
                  </div>
                  <div style={{ display: 'flex', gap: '12px' }}>
                     <button onClick={() => toggleStatus(med.id, med.status)} style={{ background: 'transparent', border: '1px solid #e2e8f0', padding: '8px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}>{med.status === 'active' ? 'Suspend' : 'Resume'}</button>
                     <button onClick={() => deleteMedication(med.id)} style={{ background: '#fff1f1', border: 'none', padding: '10px', borderRadius: '10px', cursor: 'pointer', color: '#ef4444' }}><Trash2 size={18} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '30px', width: '100%', maxWidth: '520px', padding: '40px', position: 'relative' }}>
            <button onClick={() => setShowAddModal(false)} style={{ position: 'absolute', top: '30px', right: '30px', background: '#f8fafc', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
            <h2 style={{ fontSize: '26px', fontWeight: 940, marginBottom: '8px' }}>Add Medication</h2>
            <form onSubmit={handleAddMedication} style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '24px' }}>
              <input required type="text" placeholder="Medication Name" value={newMed.name} onChange={(e) => setNewMed({...newMed, name: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
              <input required type="text" placeholder="Dosage (e.g. 500mg)" value={newMed.dosage} onChange={(e) => setNewMed({...newMed, dosage: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
              <select value={newMed.frequency} onChange={(e) => handleFrequencyChange(e.target.value)} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                <option value="1">1x Daily</option>
                <option value="2">2x Daily</option>
                <option value="3">3x Daily</option>
                <option value="4">4x Daily</option>
              </select>
              <textarea placeholder="Instructions..." value={newMed.notes} onChange={(e) => setNewMed({...newMed, notes: e.target.value})} style={{ width: '100%', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0', minHeight: '80px' }} />
              <button type="submit" style={{ backgroundColor: '#059669', color: 'white', border: 'none', padding: '16px', borderRadius: '14px', fontWeight: 800 }}>Add Prescription</button>
            </form>
          </div>
        </div>
      )}
      {showSyncModal && previewReport && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ backgroundColor: 'white', borderRadius: '30px', width: '100%', maxWidth: '600px', padding: '40px', position: 'relative', border: '1px solid #10b981' }}>
            <button onClick={() => setShowSyncModal(false)} style={{ position: 'absolute', top: '30px', right: '30px', background: '#f8fafc', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '8px', borderRadius: '50%' }}><X size={20} /></button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
               <div style={{ background: '#ecfdf5', color: '#10b981', padding: '8px', borderRadius: '8px' }}><Sparkles size={20} /></div>
               <h2 style={{ fontSize: '24px', fontWeight: 940, color: '#0f172a', margin: 0 }}>Clinical Review</h2>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
               <h4 style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', marginBottom: '12px' }}>{previewReport.generated_report.clinicalTitle}</h4>
               <p style={{ fontSize: '14px', lineHeight: 1.6, color: '#475569', background: '#f8fafc', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                  {previewReport.generated_report.summary}
               </p>
               <div style={{ marginTop: '20px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 800, color: '#059669', textTransform: 'uppercase' }}>Detected Medications</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                     {previewReport.generated_report.prescriptions?.map((p, i) => (
                        <div key={i} style={{ padding: '12px', background: 'white', border: '1px solid #f1f5f9', borderRadius: '12px', display: 'flex', justifyContent: 'space-between' }}>
                           <span style={{ fontWeight: 700 }}>{p.medication}</span>
                           <span style={{ fontSize: '12px', color: '#64748b' }}>{p.dosage}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
            <button 
               onClick={handleApplyAIPrescription}
               disabled={isAILoading}
               style={{ width: '100%', marginTop: '32px', backgroundColor: '#059669', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
            >
               {isAILoading ? <Loader2 className="animate-spin" size={20} /> : <PlusCircle size={20} />}
               {isAILoading ? 'Processing Extraction...' : 'Extract & Add to My List'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Medications;
