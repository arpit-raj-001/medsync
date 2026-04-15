import { ChevronLeft, Download, UserPlus, ShieldCheck } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const PreReport = ({ data, onBack, onProceed }) => {
  const handleDownload = async () => {
    const reportElement = document.getElementById('medical-report-card');
    if (!reportElement) return;

    try {
      // High-precision capture with balanced quality
      const canvas = await html2canvas(reportElement, {
        scale: 1.25, 
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/jpeg', 0.9);
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgProps = pdf.getImageProperties(imgData);
      const imgHeight = (imgProps.height * pageWidth) / imgProps.width;
      
      // Add the image centered with small margins
      pdf.addImage(imgData, 'JPEG', 0, 5, pageWidth, imgHeight);
      
      // Standard jsPDF save which handles all browser-specific cross-origin/blob issues internally
      pdf.save('MediSync_Clinical_Report.pdf');
    } catch (error) {
      console.error('PDF Generation Error:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  return (
    <div className="pr-wrapper">
      <div className="pr-header">
        <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '24px', width: '100%' }}>
             <button 
              onClick={onBack}
              style={{ padding: '8px 12px', background: 'white', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
            >
              <ChevronLeft size={16} /> <span style={{fontSize: '13px', fontWeight: 600}}>Modify Triage</span>
            </button>
        </div>
        <div className="pr-icon-box">
          <ShieldCheck size={32} />
        </div>
        <h1>Pre-Visit Report Generated</h1>
        <p>
          Our AI has summarized your intake. You can download this report for your personal records, and we will automatically forward it to the specialist you select.
        </p>
      </div>

      <div id="medical-report-card" className="pr-card">
        <div className="pr-card-header">
          <div className="pr-brand">
             <div className="pr-brand-logo">
                <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
                  <path d="M16 8v16M8 16h16" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
                </svg>
             </div>
             <div>
               <h3>MediSync</h3>
               <p>Clinical Summary</p>
             </div>
          </div>
          <div className="pr-meta">
             <p>Date: {new Date().toLocaleDateString()}</p>
             <span>ID: MS-{Math.floor(Math.random()*100000)}</span>
          </div>
        </div>

        <div className="pr-grid">
          <div className="pr-block full">
            <h4>Primary Complaint</h4>
            <div className="pr-box">
              {data.primaryComplaint || "N/A"}
            </div>
          </div>
          
          <div className="pr-block">
            <h4>Symptoms</h4>
            <ul style={{margin: 0, paddingLeft: '20px', color: '#1e293b'}}>
              {Array.isArray(data.symptoms) ? data.symptoms.map((s, i) => <li key={i}>{s}</li>) : <li>{data.symptoms || "N/A"}</li>}
            </ul>
          </div>
          
          <div className="pr-block">
            <h4>Clinical Details</h4>
            <ul style={{listStyle: 'none', padding: 0, margin: 0, color: '#1e293b', display: 'flex', flexDirection: 'column', gap: '8px'}}>
              <li><strong>Duration:</strong> {data.duration || "N/A"}</li>
              <li><strong>Severity:</strong> {data.severity || "N/A"}</li>
              <li><strong>Progression:</strong> {data.progression || "N/A"}</li>
            </ul>
          </div>

          <div className="pr-block">
            <h4>Key Observations</h4>
            <p style={{fontSize: '15px'}}>{data.keyObservations || "N/A"}</p>
          </div>

          <div className="pr-block">
            <h4>Urgency Level</h4>
            <span style={{
              display: 'inline-block', padding: '6px 12px', borderRadius: '8px', fontSize: '14px', fontWeight: 700,
              backgroundColor: data.urgencyLevel?.toLowerCase().includes('high') ? '#fee2e2' : data.urgencyLevel?.toLowerCase().includes('medium') ? '#fef3c7' : '#d1fae5',
              color: data.urgencyLevel?.toLowerCase().includes('high') ? '#991b1b' : data.urgencyLevel?.toLowerCase().includes('medium') ? '#92400e' : '#065f46'
            }}>
              {data.urgencyLevel || "Low"} Risk Profile
            </span>
          </div>

          <div className="pr-block full" style={{background: '#f8fafc', padding: '24px', borderRadius: '16px', borderLeft: '4px solid #10b981'}}>
            <h4>Possible Concern</h4>
            <p style={{fontSize: '16px', margin: '0 0 16px 0'}}>{data.possibleConcern || "Wait for specialist evaluation."}</p>
            
            <h4 style={{marginTop: '16px'}}>Suggested Next Steps</h4>
            <ul style={{margin: 0, paddingLeft: '20px', color: '#334155', fontSize: '15px'}}>
              {Array.isArray(data.suggestedNextSteps) ? data.suggestedNextSteps.map((step, i) => <li key={i} style={{marginBottom: '4px'}}>{step}</li>) : <li>Consult a physician.</li>}
            </ul>
          </div>
        </div>

        <div className="pr-recommendation">
          <div>
            <h4>AI Recommendation</h4>
            <p>Based on your clinical intake, we strongly recommend consulting a specialized practitioner.</p>
          </div>
          <div className="pr-specialty-badge">
            {data.recommendedSpecialty || "General Physician"}
          </div>
        </div>
      </div>

      <div className="pr-actions">
        <button onClick={handleDownload} className="pr-btn secondary">
          <Download size={18} /> Download PDF
        </button>
        <button onClick={onProceed} className="pr-btn primary">
          <UserPlus size={18} /> Find {data.recommendedSpecialty}s
        </button>
      </div>
    </div>
  );
};

export default PreReport;
