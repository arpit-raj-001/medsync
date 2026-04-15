import React, { useState, useEffect } from 'react';
import { Star, MapPin, Stethoscope, ArrowRight, Activity, Clock, ChevronLeft, X } from 'lucide-react';

const DoctorMatch = ({ specialty, synonyms = [], onBack, onSelect }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState('rating'); // rating, exp, fee, distance
  const [userLoc, setUserLoc] = useState(null);

  // Haversine formula to calculate distance in km
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
    const toRad = (val) => (val * Math.PI) / 180;
    const R = 6371; 
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        position => {
          setUserLoc({ lat: position.coords.latitude, lng: position.coords.longitude });
        },
        err => {
          console.log("Geolocation denied or failed. Defaulting to Jaipur center.", err);
          // Default fallback to Jaipur since user mention Aadya etc.
          setUserLoc({ lat: 26.9124, lng: 75.7873 });
        },
        { timeout: 10000, enableHighAccuracy: true }
      );
    } else {
      // No browser support
      setUserLoc({ lat: 19.0760, lng: 72.8777 });
    }
  }, []);

  const normalize = (str) => String(str || "").toLowerCase().replace(/\s+/g, '');

  useEffect(() => {
    setLoading(true);
    fetch('/doctors.json')
      .then(res => res.json())
      .then(data => {
        let filtered = data.filter(d => {
          const safeSpecialty = normalize(specialty || "General Physician");
          const safeSynonyms = Array.isArray(synonyms) ? synonyms.map(s => normalize(s)) : [];
          const aiKeywords = [safeSpecialty, ...safeSynonyms].filter(k => k.length > 0);
          
          if (d.relevantSpecializations && Array.isArray(d.relevantSpecializations)) {
            const docSpecs = d.relevantSpecializations.map(spec => normalize(spec));
            // Strict exact match for precision as requested
            return docSpecs.some(spec => aiKeywords.includes(spec));
          }
          return aiKeywords.includes(normalize(d.specialty));
        });
        
        // Calculate distances if location available
        if (userLoc) {
          filtered = filtered.map(d => ({
            ...d,
            distanceKm: calculateDistance(userLoc.lat, userLoc.lng, d.location?.lat, d.location?.lng)
          }));
        }

        setDoctors(filtered);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error fetching doctors:", err);
        setLoading(false);
      });
  }, [specialty, synonyms, userLoc]);

  const [currentPage, setCurrentPage] = useState(1);
  const [detailDoc, setDetailDoc] = useState(null);
  const itemsPerPage = 20;

  const sortedDoctors = [...doctors].sort((a, b) => {
    if (sortBy === 'rating') return b.rating - a.rating;
    if (sortBy === 'exp') return b.experience - a.experience;
    if (sortBy === 'fee') return a.consultationFee - b.consultationFee;
    if (sortBy === 'distance' && userLoc) return (a.distanceKm || Infinity) - (b.distanceKm || Infinity);
    return 0;
  });

  const totalPages = Math.ceil(sortedDoctors.length / itemsPerPage);
  const currentDoctors = sortedDoctors.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Reset to page 1 when sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [sortBy]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px', gap: '24px' }}>
        <div style={{ width: '64px', height: '64px', border: '4px solid #10b981', borderTopColor: 'transparent', borderRadius: '50%' }} className="spin"></div>
        <p style={{ color: '#64748b', fontWeight: 600 }}>We are looking for relevant doctors...</p>
      </div>
    );
  }

  // "No relevant doctors found" sorry page
  if (doctors.length === 0) {
    return (
      <div style={{ 
        maxWidth: '600px', 
        padding: '60px 40px', 
        margin: '80px auto', 
        textAlign: 'center', 
        background: 'white', 
        borderRadius: '32px', 
        boxShadow: '0 20px 40px rgba(0,0,0,0.05)',
        border: '1px solid #f1f5f9'
      }}>
        <div style={{ 
          width: '80px', 
          height: '80px', 
          background: '#fef2f2', 
          color: '#ef4444', 
          borderRadius: '50%', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          margin: '0 auto 24px auto' 
        }}>
          <Activity size={40} />
        </div>
        <h2 style={{ fontSize: '28px', color: '#0f172a', marginBottom: '16px' }}>No Specialists Found</h2>
        <p style={{ fontSize: '16px', color: '#64748b', lineHeight: '1.6', marginBottom: '32px' }}>
          We couldn't find a direct match for <strong>{specialty}</strong> in your vicinity. This could be due to specific term normalization or region availability.
        </p>
        <button 
          onClick={onBack}
          className="dm-book-btn" 
          style={{ padding: '16px 32px', display: 'inline-flex', margin: '0 auto' }}
        >
          Adjust Symptoms & Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="dm-wrapper">
      
      <div className="dm-header">
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
             <button 
              onClick={onBack}
              style={{ padding: '8px 12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginRight: '12px' }}
            >
              <ChevronLeft size={16} /> <span style={{fontSize: '13px', fontWeight: 600}}>Back</span>
            </button>
            <span className="dm-title-tag">
              <Activity size={14} /> Recommended Specialty
            </span>
            <span style={{ 
              fontSize: '11px', 
              fontWeight: 800, 
              color: '#059669', 
              background: '#ecfdf5', 
              padding: '4px 10px', 
              borderRadius: '6px', 
              border: '1px solid #a7f3d0'
            }}>
              {doctors.length} MATCHES FOUND
            </span>
          </div>
          <h2 style={{ fontSize: '32px', letterSpacing: '-0.5px' }}>{specialty}s Available</h2>
          <p style={{ fontSize: '16px', color: '#64748b', marginTop: '4px' }}>
            Page {currentPage} of {totalPages} • Showing {currentDoctors.length} of {doctors.length} specialists.
          </p>
        </div>
        
        <div className="dm-filters">
          <button 
            onClick={() => setSortBy('rating')} 
            className={`dm-filter-btn ${sortBy === 'rating' ? 'active' : ''}`}
          >
            Highest Rated
          </button>
          <button 
            onClick={() => setSortBy('exp')} 
            className={`dm-filter-btn ${sortBy === 'exp' ? 'active' : ''}`}
          >
            Most Experience
          </button>
          <button 
            onClick={() => setSortBy('fee')} 
            className={`dm-filter-btn ${sortBy === 'fee' ? 'active' : ''}`}
          >
            Lowest Fee
          </button>
          {userLoc && (
            <button 
              onClick={() => setSortBy('distance')} 
              className={`dm-filter-btn ${sortBy === 'distance' ? 'active' : ''}`}
            >
              Distance (Nearest)
            </button>
          )}
        </div>
      </div>

      <div className="dm-grid">
        {currentDoctors.map((doc) => (
          <div key={doc.id} className="dm-card" onClick={() => setDetailDoc(doc)}>
            
            <div className="dm-card-top">
              <div className="dm-avatar">
                 {doc.image ? <img src={doc.image} alt={doc.name} /> : <Stethoscope size={32} />}
              </div>
              <div className="dm-info">
                <div className="dm-title-row">
                  <h3>{doc.name}</h3>
                  <div className="dm-rating">
                    <Star size={12} fill="currentColor" /> {doc.rating}
                  </div>
                </div>
                <p className="dm-specialty-label">{doc.specialty}</p>
                <p className="dm-edu">{doc.education}</p>
                <p className="dm-exp">{doc.experience} Years Exp. • {doc.successfulOperations}+ Successful</p>
              </div>
            </div>

             <div className="dm-clinic">
               <div className="dm-c-row">
                 <MapPin className="dm-c-icon" size={16} />
                 <div className="dm-c-text">
                   <strong>
                     {doc.clinicName}
                     {doc.distanceKm && <span style={{color: '#64748b', fontWeight: 500, fontSize: '13px', marginLeft: '6px'}}>• {doc.distanceKm.toFixed(1)} km away</span>}
                   </strong>
                   <span>{doc.address}</span>
                 </div>
               </div>
               <div className="dm-c-row">
                 <Clock className="dm-c-icon" size={16} />
                 <div className="dm-c-text">
                   <strong>Next available: <span style={{color: '#059669'}}>Today</span></strong>
                 </div>
               </div>
             </div>

            <div className="dm-action">
              <div className="dm-price">
                <span>Consultation</span>
                <strong>₹{doc.consultationFee}</strong>
              </div>
              <button 
                onClick={(e) => {
                    e.stopPropagation();
                    onSelect(doc);
                }}
                className="dm-book-btn"
              >
                Book Visit <ArrowRight size={16} />
              </button>
            </div>
            
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '16px', marginTop: '60px', padding: '24px', background: 'white', borderRadius: '24px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.05)' }}>
          <button 
            disabled={currentPage === 1}
            onClick={() => {
              setCurrentPage(p => Math.max(1, p - 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ 
              padding: '10px 20px', background: currentPage === 1 ? '#f1f5f9' : 'white', 
              border: '1px solid #e2e8f0', borderRadius: '12px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              fontWeight: 600, color: currentPage === 1 ? '#94a3b8' : '#1e293b', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            <ChevronLeft size={18} /> Previous
          </button>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            {[...Array(Math.min(5, totalPages))].map((_, i) => {
               // Simple sliding window for page numbers
               let pageNum = i + 1;
               if (totalPages > 5 && currentPage > 3) pageNum = currentPage - 3 + i;
               if (pageNum > totalPages) return null;
               
               return (
                <button 
                  key={pageNum}
                  onClick={() => {
                    setCurrentPage(pageNum);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  style={{ 
                    width: '40px', height: '40px', borderRadius: '10px', 
                    border: '1px solid', borderColor: currentPage === pageNum ? '#10b981' : '#e2e8f0',
                    background: currentPage === pageNum ? '#10b981' : 'white',
                    color: currentPage === pageNum ? 'white' : '#475569',
                    fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {pageNum}
                </button>
               );
            })}
          </div>

          <button 
            disabled={currentPage === totalPages}
            onClick={() => {
              setCurrentPage(p => Math.min(totalPages, p + 1));
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            style={{ 
              padding: '10px 20px', background: currentPage === totalPages ? '#f1f5f9' : 'white', 
              border: '1px solid #e2e8f0', borderRadius: '12px', cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              fontWeight: 600, color: currentPage === totalPages ? '#94a3b8' : '#1e293b', display: 'flex', alignItems: 'center', gap: '8px'
            }}
          >
            Next <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Detailed Overview Modal */}
      {detailDoc && (
        <div style={{
          position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 2000, padding: '20px'
        }} onClick={() => setDetailDoc(null)}>
          <div style={{
            backgroundColor: 'white', borderRadius: '32px', maxWidth: '500px', width: '100%',
            padding: '40px', position: 'relative', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
            animation: 'modalSlideUp 0.4s ease'
          }} onClick={e => e.stopPropagation()}>
            <button 
              onClick={() => setDetailDoc(null)}
              style={{ position: 'absolute', top: '24px', right: '24px', background: '#f1f5f9', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}
              className="dm-modal-close"
            >
              <X size={20} />
            </button>
            
            <div style={{ display: 'flex', gap: '24px', marginBottom: '32px' }}>
               <div style={{ width: '100px', height: '100px', borderRadius: '24px', overflow: 'hidden', border: '4px solid #f8fafc' }}>
                  <img src={detailDoc.image} alt={detailDoc.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
               </div>
               <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', background: '#f0fdf4', padding: '4px 10px', borderRadius: '6px' }}>
                    {detailDoc.specialty}
                  </span>
                  <h2 style={{ fontSize: '24px', margin: '8px 0 4px 0' }}>{detailDoc.name}</h2>
                  <p style={{ fontSize: '14px', color: '#64748b', fontWeight: 500 }}>{detailDoc.education}</p>
               </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
               <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Experience</p>
                  <strong style={{ fontSize: '16px' }}>{detailDoc.experience} Years</strong>
               </div>
               <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Operations</p>
                  <strong style={{ fontSize: '16px' }}>{detailDoc.successfulOperations}+ Success</strong>
               </div>
               <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Patient Rating</p>
                  <strong style={{ fontSize: '16px' }}>★ {detailDoc.rating} / 5</strong>
               </div>
               <div style={{ background: '#f8fafc', padding: '16px', borderRadius: '16px' }}>
                  <p style={{ margin: 0, fontSize: '12px', color: '#64748b' }}>Languages</p>
                  <strong style={{ fontSize: '14px' }}>{detailDoc.languages.join(', ')}</strong>
               </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
               <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>About Professional</h4>
               <p style={{ margin: 0, fontSize: '15px', color: '#475569', lineHeight: '1.6' }}>
                  {detailDoc.about}
               </p>
            </div>

            <button 
              onClick={() => {
                  onSelect(detailDoc);
                  setDetailDoc(null);
              }}
              className="dm-book-btn"
              style={{ width: '100%', padding: '18px', borderRadius: '16px', fontSize: '16px' }}
            >
              Book Consultation Now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default DoctorMatch;

