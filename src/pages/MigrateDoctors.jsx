import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const MigrateDoctors = () => {
    const [status, setStatus] = useState('Idle');
    const [log, setLog] = useState([]);

    const addLog = (msg) => setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);

    const runMigration = async () => {
        try {
            setStatus('Loading JSON...');
            addLog('Fetching /doctors.json...');
            const res = await fetch('/doctors.json');
            const doctors = await res.json();
            addLog(`Found ${doctors.length} doctors.`);

            setStatus('Migrating...');
            for (let i = 0; i < doctors.length; i++) {
                const doc = doctors[i];
                addLog(`Uploading Doc ${i+1}/${doctors.length}: ${doc.name}...`);
                
                const { error } = await supabase
                    .from('doctors')
                    .upsert({
                        id: doc.id,
                        name: doc.name,
                        specialty: doc.specialty,
                        experience: doc.experience,
                        rating: doc.rating,
                        patient_count: doc.patientCount,
                        consultation_fee: doc.consultationFee,
                        education: doc.education,
                        clinic_name: doc.clinicName,
                        address: doc.address,
                        successful_operations: doc.successfulOperations,
                        about: doc.about,
                        languages: doc.languages,
                        slots: doc.slots,
                        location: doc.location,
                        relevant_specializations: doc.relevantSpecializations,
                        gender: doc.gender,
                        image: doc.image
                    });

                if (error) {
                    addLog(`Error uploading ${doc.name}: ${error.message}`);
                }
            }

            setStatus('Completed');
            addLog('Migration finished successfully.');
        } catch (err) {
            setStatus('Failed');
            addLog(`Critical Error: ${err.message}`);
        }
    };

    return (
        <div style={{ padding: '40px', fontFamily: 'sans-serif' }}>
            <h1>Supabase Migration Tool</h1>
            <button 
                onClick={runMigration} 
                disabled={status === 'Migrating'}
                style={{ padding: '12px 24px', fontSize: '16px', cursor: 'pointer', background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px' }}
            >
                {status === 'Migrating' ? 'Migrating...' : 'Start Migration'}
            </button>
            <div style={{ marginTop: '20px', padding: '20px', background: '#f8fafc', borderRadius: '12px', height: '400px', overflowY: 'auto' }}>
                <p>Status: <strong>{status}</strong></p>
                {log.map((line, i) => <div key={i} style={{ fontSize: '13px', marginBottom: '4px' }}>{line}</div>)}
            </div>
        </div>
    );
};

export default MigrateDoctors;
