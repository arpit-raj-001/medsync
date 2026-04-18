import React from 'react';
import { 
  X, 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  AlertCircle, 
  Stethoscope, 
  History,
  Tag as TagIcon,
  Loader2,
  Activity,
  ShieldCheck
} from 'lucide-react';
import './PatientDetailModal.css';

const PatientDetailModal = ({ isOpen, onClose, appointment }) => {
  if (!isOpen || !appointment) return null;

  const pr = appointment.pre_report || {};
  const clinicalInfo = appointment.medical_context || {};

  return (
    <div className="pdm-backdrop" onClick={onClose}>
      <div className="pdm-window" onClick={e => e.stopPropagation()}>
        <div className="pdm-header">
          <div className="pdm-title-row">
             <div className="pdm-avatar">
                <User size={24} />
             </div>
             <div>
                <h2>{appointment.patient_name || 'Patient Overview'}</h2>
                <p>Case ID: <strong>{appointment.case_id}</strong></p>
             </div>
          </div>
          <button className="pdm-close" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="pdm-content">
          {/* Metadata Row */}
          <div className="pdm-meta-grid">
             <div className="pdm-meta-item">
                <Calendar size={16} />
                <span>{appointment.appointment_date}</span>
             </div>
             <div className="pdm-meta-item">
                <Clock size={16} />
                <span>{appointment.appointment_time}</span>
             </div>
             <div className="pdm-meta-item">
                <Stethoscope size={16} />
                <span>{appointment.mode || 'Video Consult'}</span>
             </div>
          </div>

          <div className="pdm-grid">
             {/* Left Column: Triage Details */}
             <div className="pdm-left">
                <section className="pdm-section">
                   <h3><AlertCircle size={18} /> Patient Intake Summary</h3>
                   <div className="pdm-report-card">
                      <div className="pdm-field">
                         <label>Primary Complaint</label>
                         <p>{pr.primaryComplaint || 'Not specified'}</p>
                      </div>
                      <div className="pdm-field">
                         <label>Duration & Severity</label>
                         <p>{pr.duration} • <strong>{pr.severity}</strong></p>
                      </div>
                      <div className="pdm-field">
                         <label>Symptoms Reported</label>
                         <div className="pdm-tags">
                            {Array.isArray(pr.symptoms) ? pr.symptoms.map(s => <span key={s} className="pdm-tag">{s}</span>) : <span>{pr.symptoms || 'None'}</span>}
                         </div>
                      </div>
                      <div className="pdm-field">
                         <label>Patient Context</label>
                         <p style={{fontSize: '13px', opacity: 0.8}}>{pr.possibleConcern || 'No specific concerns flagged.'}</p>
                      </div>
                   </div>
                </section>
             </div>

             {/* Right Column: AI Clinical Analysis */}
             <div className="pdm-right">
                <section className="pdm-section">
                   <h3><Activity size={18} /> AI Clinical Analysis</h3>
                   <div className="pdm-analysis-box">
                      {appointment.pre_report ? (
                        <>
                           <div className="pdm-analysis-note">
                              <label>Clinical Summary</label>
                              <p>{appointment.pre_report.possibleConcern || "Summary generated from triage data."}</p>
                           </div>
                           <div className="pdm-analysis-item">
                              <label><History size={14} style={{marginRight: '4px'}}/> Recommended Specialty</label>
                              <p>{appointment.pre_report.recommendedSpecialty}</p>
                           </div>
                           <div className="pdm-analysis-item">
                              <label><ShieldCheck size={14} style={{marginRight: '4px'}}/> Urgency Assessment</label>
                              <div className={`pdm-urgency-badge ${appointment.pre_report.urgencyLevel?.toLowerCase()}`}>
                                 {appointment.pre_report.urgencyLevel} Priority
                              </div>
                           </div>
                        </>
                      ) : (
                        <div className="pdm-empty-state">
                           <Loader2 className="animate-spin" size={24} />
                           <p>AI is analyzing clinical indicators...</p>
                        </div>
                      )}
                   </div>
                </section>
             </div>
          </div>
        </div>

        <div className="pdm-footer">
           <button className="pdm-done-btn" onClick={onClose}>Mark Review Complete</button>
        </div>
      </div>
    </div>
  );
};

export default PatientDetailModal;
