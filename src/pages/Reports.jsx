import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Calendar, Clock, ChevronRight, Stethoscope, Search, Sparkles, Filter, Loader2, Download, X, Info, Tablets, AlertCircle, CheckCircle2, ListTodo } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { summarizeReportForLayman } from '../lib/groq';
import './Dashboard.css';

const Reports = () => {
  const { user: patientData } = useAuth();
  const navigate = useNavigate();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReport, setSelectedReport] = useState(null);
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [laymanSummary, setLaymanSummary] = useState(null);
  const [showLaymanModal, setShowLaymanModal] = useState(false);

  const fetchReports = useCallback(async () => {
    if (!patientData?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('appointments')
        .select('*, doctors(name, specialty)')
        .eq('patient_id', patientData.id)
        .not('generated_report', 'is', null)
        .order('appointment_date', { ascending: false });
      
      if (!error) setReports(data || []);
    } catch (err) {
        console.error("Error fetching reports:", err);
    } finally {
        setLoading(false);
    }
  }, [patientData]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleGenerateLaymanSummary = async () => {
    if (!selectedReport) return;
    setIsSummarizing(true);
    try {
      const summary = await summarizeReportForLayman(selectedReport.generated_report);
      setLaymanSummary(summary);
      setShowLaymanModal(true);
    } catch (err) {
      console.error("Summarization Error:", err);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setIsSummarizing(false);
    }
  };

  const filteredReports = reports.filter(r => 
    r.doctors?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.generated_report?.diagnosis?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="animate-spin text-emerald-600" size={40} />
    </div>
  );

  return (
    <div className="dash-container">
      <header className="dash-header">
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
        <div className="dash-banner" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)', marginBottom: '32px' }}>
          <div className="dash-banner-content">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px' }}>
              <FileText size={32} color="#10b981" />
              Clinical Reports Vault
            </h2>
            <p style={{ opacity: 0.8 }}>Access all your professional clinical documentation and AI-generated insights.</p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: selectedReport ? '1fr 1fr' : '1fr', gap: '32px', transition: 'all 0.3s ease' }}>
          {/* Reports List */}
          <div className="dash-content" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid #f1f5f9', display: 'flex', gap: '16px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search size={18} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                <input 
                  type="text" 
                  placeholder="Search by diagnosis or doctor..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{ width: '100%', padding: '12px 16px 12px 48px', borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}
                />
              </div>
              <button style={{ padding: '12px', borderRadius: '12px', background: 'white', border: '1px solid #e2e8f0', color: '#64748b' }}><Filter size={18} /></button>
            </div>

            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {filteredReports.length === 0 ? (
                <div style={{ padding: '60px', textAlign: 'center', color: '#94a3b8' }}>
                  <FileText size={48} style={{ margin: '0 auto 16px', opacity: 0.2 }} />
                  <p>No clinical reports found.</p>
                </div>
              ) : (
                filteredReports.map(report => (
                  <div 
                    key={report.id} 
                    onClick={() => setSelectedReport(report)}
                    style={{ 
                      padding: '24px', 
                      borderBottom: '1px solid #f1f5f9', 
                      cursor: 'pointer', 
                      transition: 'all 0.2s',
                      backgroundColor: selectedReport?.id === report.id ? '#f0fdf4' : 'transparent',
                      borderLeft: selectedReport?.id === report.id ? '4px solid #10b981' : '4px solid transparent'
                    }}
                    className="report-item-hover"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                          <Stethoscope size={24} />
                        </div>
                        <div>
                          <h4 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 800 }}>{report.generated_report?.diagnosis || 'Clinical Consultation'}</h4>
                          <p style={{ margin: 0, fontSize: '13px', color: '#64748b', fontWeight: 600 }}>Dr. {report.doctors?.name} • {report.doctors?.specialty}</p>
                          <div style={{ display: 'flex', gap: '12px', marginTop: '8px', fontSize: '12px', color: '#94a3b8' }}>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Calendar size={12} /> {report.appointment_date}</span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Clock size={12} /> {report.appointment_time}</span>
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ color: '#059669', background: '#ecfdf5', padding: '6px', borderRadius: '8px' }} title="Clinical Info">
                           <Info size={16} />
                        </div>
                        <ChevronRight size={18} color="#cbd5e1" />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Report Detail View */}
          {selectedReport && (
            <div className="dash-content animate-in slide-in-from-right-4 duration-300" style={{ padding: '32px', border: '1px solid #10b981' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: '#ecfdf5', color: '#10b981', padding: '8px', borderRadius: '8px' }}><Sparkles size={18} /></div>
                    <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 940 }}>Clinical Assessment</h3>
                 </div>
                 <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="dash-action-btn-outline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Download size={16} /> PDF</button>
                    <button onClick={() => setSelectedReport(null)} style={{ padding: '8px', borderRadius: '50%', background: '#f1f5f9', border: 'none', cursor: 'pointer' }}><X size={16} /></button>
                 </div>
              </div>

              <div style={{ background: '#f8fafc', padding: '24px', borderRadius: '16px', marginBottom: '24px', border: '1px solid #e2e8f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                     <h4 style={{ margin: 0, fontSize: '14px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Summarization</h4>
                  </div>
                 <p style={{ margin: 0, fontSize: '14px', color: '#475569', fontStyle: 'italic' }}>
                    Click below to generate a patient-friendly summary of this complex clinical report.
                 </p>
                 <button 
                    onClick={handleGenerateLaymanSummary}
                    disabled={isSummarizing}
                    style={{ marginTop: '16px', width: '100%', background: isSummarizing ? '#94a3b8' : '#10b981', color: 'white', border: 'none', padding: '16px', borderRadius: '16px', fontWeight: 900, cursor: isSummarizing ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', boxShadow: '0 4px 6px -1px rgba(16, 185, 129, 0.2)' }}
                 >
                    {isSummarizing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />}
                    {isSummarizing ? 'Translating to Simple Language...' : 'Explain in Simple Words (AI)'}
                 </button>
              </div>

              <div className="report-detail-scroller" style={{ maxHeight: 'calc(100vh - 400px)', overflowY: 'auto', paddingRight: '12px' }}>
                  <div style={{ marginBottom: '32px' }}>
                     <h1 style={{ fontSize: '24px', fontWeight: 940, color: '#0f172a', marginBottom: '8px', lineHeight: 1.2 }}>{selectedReport.generated_report?.clinicalTitle || selectedReport.generated_report?.diagnosis}</h1>
                     <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontSize: '11px', fontWeight: 800, background: '#f1f5f9', color: '#64748b', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase' }}>Clinical Document</span>
                        <span style={{ fontSize: '11px', fontWeight: 800, background: '#ecfdf5', color: '#059669', padding: '4px 10px', borderRadius: '6px', textTransform: 'uppercase' }}>Verified</span>
                     </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                    <div style={{ padding: '24px', background: 'white', borderRadius: '20px', border: '1px solid #f1f5f9', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '12px' }}>
                           <Stethoscope size={14} /> Clinical Diagnosis
                        </label>
                        <p style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>{selectedReport.generated_report?.diagnosis}</p>
                    </div>

                    <div style={{ padding: '24px', background: '#f8fafc', borderRadius: '20px', border: '1px solid #e2e8f0' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '12px' }}>
                           <FileText size={14} /> Technical Summary
                        </label>
                        <p style={{ fontSize: '15px', lineHeight: 1.7, color: '#334155', margin: 0 }}>{selectedReport.generated_report?.summary}</p>
                    </div>

                    {selectedReport.generated_report?.prescriptions && (
                        <div style={{ padding: '24px', background: 'white', borderRadius: '24px', border: '1px solid #10b981', boxShadow: '0 10px 15px -3px rgba(16, 185, 129, 0.1)' }}>
                           <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '16px' }}>
                              <Tablets size={16} /> Prescribed Medication Plan
                           </label>
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                              {selectedReport.generated_report.prescriptions.map((p, i) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px', background: '#f0fdf4', borderRadius: '18px', border: '1px solid #dcfce7' }}>
                                       <div>
                                          <div style={{ fontWeight: 900, fontSize: '16px', color: '#064e3b' }}>{p.medication}</div>
                                          <div style={{ fontSize: '13px', color: '#065f46', marginTop: '4px', opacity: 0.8 }}>{p.dosage} — {p.timing}</div>
                                          {p.instructions && <div style={{ fontSize: '11px', color: '#065f46', marginTop: '4px', fontStyle: 'italic' }}>{p.instructions}</div>}
                                       </div>
                                       <div style={{ padding: '8px', background: 'white', borderRadius: '12px', color: '#059669' }}><CheckCircle2 size={18} /></div>
                                    </div>
                              ))}
                           </div>
                        </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ padding: '24px', background: '#f0fdf4', borderRadius: '20px', border: '1px solid #dcfce7' }}>
                           <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginBottom: '12px' }}>
                              <Sparkles size={14} /> Lifestyle Guidance
                           </label>
                           <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#166534', margin: 0 }}>{selectedReport.generated_report?.patientAdvice}</p>
                        </div>
                        <div style={{ padding: '24px', background: '#fef2f2', borderRadius: '20px', border: '1px solid #fecdd3' }}>
                           <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', marginBottom: '12px' }}>
                              <AlertCircle size={14} /> Emergency Indicators
                           </label>
                           <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                              {selectedReport.generated_report?.redFlags?.map((flag, i) => (
                                    <span key={i} style={{ fontSize: '11px', fontWeight: 700, color: '#991b1b', background: 'white', padding: '4px 10px', borderRadius: '6px', border: '1px solid #fecdd3' }}>{flag}</span>
                              ))}
                           </div>
                        </div>
                    </div>

                    <div style={{ padding: '20px', borderTop: '2px dashed #e2e8f0', display: 'flex', justifyContent: 'center' }}>
                       <div style={{ textAlign: 'center' }}>
                          <label style={{ fontSize: '11px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase' }}>Recommended Follow-up</label>
                          <p style={{ marginTop: '4px', fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>{selectedReport.generated_report?.followUp || 'As needed'}</p>
                       </div>
                    </div>
                  </div>
               </div>
            </div>
          )}
        </div>
      </main>
      {/* LAYMAN SUMMARY MODAL */}
      {showLaymanModal && laymanSummary && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(12px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div className="animate-in zoom-in-95 duration-300" style={{ backgroundColor: 'white', borderRadius: '32px', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '2px solid #10b981' }}>
            
            {/* Header */}
            <div style={{ padding: '32px', background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)', color: 'white', position: 'relative' }}>
               <button onClick={() => setShowLaymanModal(false)} style={{ position: 'absolute', top: '24px', right: '24px', background: 'rgba(255,255,255,0.2)', border: 'none', cursor: 'pointer', color: 'white', padding: '10px', borderRadius: '50%', display: 'flex' }}><X size={20} /></button>
               <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'white', color: '#10b981', padding: '12px', borderRadius: '16px' }}><Sparkles size={28} /></div>
                  <div>
                    <h2 style={{ fontSize: '28px', fontWeight: 940, margin: 0 }}>Simple Health Guide</h2>
                    <p style={{ margin: 0, opacity: 0.9, fontWeight: 600 }}>Easy-to-understand summary of your visit.</p>
                  </div>
               </div>
            </div>

            {/* Content Scroller */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
               
               {/* Simple Diagnosis */}
               <section>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 800, color: '#059669', textTransform: 'uppercase', marginBottom: '16px' }}>
                     <Stethoscope size={18} /> What is happening?
                  </label>
                  <p style={{ fontSize: '22px', fontWeight: 800, color: '#0f172a', lineHeight: 1.4, margin: 0 }}>
                     {laymanSummary.simpleDiagnosis}
                  </p>
               </section>


               {/* Good Things to Do */}
               <section style={{ padding: '24px', background: '#f0fdf4', borderRadius: '24px', border: '1px solid #dcfce7' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 800, color: '#16a34a', textTransform: 'uppercase', marginBottom: '16px' }}>
                     <Sparkles size={18} /> Good things to do
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     {laymanSummary.whatToDoNow?.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                           <div style={{ width: '24px', height: '24px', background: '#16a34a', color: 'white', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '12px', fontWeight: 800 }}>{i+1}</div>
                           <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#166534' }}>{item}</p>
                        </div>
                     ))}
                  </div>
               </section>

               {/* Things to Avoid */}
               <section style={{ padding: '24px', background: '#fffbeb', borderRadius: '24px', border: '1px solid #fde68a' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase', marginBottom: '16px' }}>
                     <AlertCircle size={18} /> ⛔ Things to avoid
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     {laymanSummary.thingsToAvoid?.map((item, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                           <div style={{ color: '#dc2626' }}><X size={16} /></div>
                           <p style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#92400e' }}>{item}</p>
                        </div>
                     ))}
                  </div>
               </section>

               {/* Medicine Helpers */}
               <section style={{ padding: '24px', background: '#f8fafc', borderRadius: '24px', border: '1px solid #e2e8f0' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', marginBottom: '16px' }}>
                     <Tablets size={18} /> Your Medicine Helpers
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                     {laymanSummary.medicineSteps?.map((step, i) => (
                        <div key={i} style={{ display: 'flex', gap: '16px', alignItems: 'center', background: 'white', padding: '16px', borderRadius: '16px', border: '1px solid #f1f5f9' }}>
                           <div style={{ background: '#ecfdf5', color: '#059669', padding: '10px', borderRadius: '12px' }}><Tablets size={20} /></div>
                           <div>
                              <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#0f172a' }}>{step.medicine}</p>
                              <p style={{ margin: 0, fontSize: '14px', color: '#64748b', fontWeight: 600 }}>{step.job}</p>
                           </div>
                        </div>
                     ))}
                  </div>
               </section>
               <section style={{ padding: '24px', background: '#fef2f2', borderRadius: '24px', border: '1px solid #fecdd3' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', fontWeight: 800, color: '#dc2626', textTransform: 'uppercase', marginBottom: '16px' }}>
                     <AlertCircle size={18} /> Go to hospital if you see:
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                     {laymanSummary.dangerSigns?.map((sign, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'center', background: 'white', padding: '12px 16px', borderRadius: '16px', border: '1px solid #fecdd3' }}>
                           <div style={{ color: '#dc2626' }}><Info size={18} /></div>
                           <p style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#991b1b' }}>{sign}</p>
                        </div>
                     ))}
                  </div>
               </section>

               {/* Reassurance */}
               <div style={{ textAlign: 'center', padding: '20px', borderTop: '2px dashed #e2e8f0', marginTop: '12px' }}>
                  <p style={{ fontSize: '18px', fontWeight: 800, color: '#059669', margin: 0, fontStyle: 'italic' }}>
                     "{laymanSummary.reassurance}"
                  </p>
               </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '24px 40px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
               <button 
                  onClick={() => setShowLaymanModal(false)}
                  style={{ background: '#0f172a', color: 'white', border: 'none', padding: '16px 48px', borderRadius: '16px', fontSize: '16px', fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
               >
                  <X size={18} /> Understood & Close
               </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
