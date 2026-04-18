import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User, Stethoscope, Lock, Loader2, Users, ArrowRight, ShieldCheck } from 'lucide-react';
import './DoctorDashboard.css'; // Reuse clinical styling for consistency

const LoginPage = () => {
    const [roleTab, setRoleTab] = useState('patient'); // 'patient' or 'doctor'
    const [form, setForm] = useState({ id: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    const { login } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        const result = await login(form.id, form.password, roleTab);
        
        if (result.success) {
            navigate(roleTab === 'doctor' ? '/doctor-portal' : '/appointments');
        } else {
            setError(result.error || 'Login failed. Please check your credentials.');
        }
        setLoading(false);
    };

    return (
        <div className="dd-container" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div className="dd-login-card" style={{ maxWidth: '450px', width: '100%', padding: '40px' }}>
                <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                    <div style={{ 
                        background: 'linear-gradient(135deg, #10b981, #059669)', 
                        width: '64px', height: '64px', borderRadius: '16px', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto 16px auto', boxShadow: '0 8px 16px rgba(16, 185, 129, 0.2)'
                    }}>
                        <ShieldCheck size={32} color="white" />
                    </div>
                    <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#0f172a', marginBottom: '8px' }}>MediSync Identity</h1>
                    <p style={{ color: '#64748b', fontSize: '14px' }}>Access your clinical command center</p>
                </div>

                {/* Role Toggle */}
                <div style={{ 
                    display: 'flex', 
                    background: '#f1f5f9', 
                    padding: '4px', 
                    borderRadius: '12px', 
                    marginBottom: '32px' 
                }}>
                    <button 
                        onClick={() => setRoleTab('patient')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                            background: roleTab === 'patient' ? 'white' : 'transparent',
                            color: roleTab === 'patient' ? '#0f172a' : '#64748b',
                            fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            boxShadow: roleTab === 'patient' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        <Users size={18} /> Patient
                    </button>
                    <button 
                        onClick={() => setRoleTab('doctor')}
                        style={{
                            flex: 1, padding: '10px', borderRadius: '8px', border: 'none',
                            background: roleTab === 'doctor' ? 'white' : 'transparent',
                            color: roleTab === 'doctor' ? '#0f172a' : '#64748b',
                            fontWeight: 600, cursor: 'pointer', transition: '0.2s',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                            boxShadow: roleTab === 'doctor' ? '0 2px 4px rgba(0,0,0,0.05)' : 'none'
                        }}
                    >
                        <Stethoscope size={18} /> Provider
                    </button>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>
                            {roleTab === 'doctor' ? 'Provider ID' : 'Patient ID'}
                        </label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input 
                                type="text"
                                placeholder={roleTab === 'doctor' ? 'e.g. dr001' : 'e.g. pat001'}
                                className="dd-login-input"
                                style={{ paddingLeft: '40px' }}
                                value={form.id}
                                onChange={e => setForm({...form, id: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    <div>
                        <label style={{ display: 'block', marginBottom: '8px', fontSize: '12px', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Access Key</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: '#94a3b8' }} />
                            <input 
                                type="password"
                                placeholder="••••••••"
                                className="dd-login-input"
                                style={{ paddingLeft: '40px' }}
                                value={form.password}
                                onChange={e => setForm({...form, password: e.target.value})}
                                required
                            />
                        </div>
                    </div>

                    {error && (
                        <div style={{ background: '#fef2f2', color: '#dc2626', padding: '12px', borderRadius: '8px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <AlertCircle size={16} /> {error}
                        </div>
                    )}

                    <button 
                        type="submit" 
                        className="dd-login-btn"
                        disabled={loading}
                        style={{ height: '48px', fontSize: '16px', marginTop: '12px' }}
                    >
                        {loading ? <Loader2 className="animate-spin" /> : (
                            <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                Sign In to {roleTab === 'doctor' ? 'Clinical Portal' : 'Patient Portal'} <ArrowRight size={18} />
                            </span>
                        )}
                    </button>
                </form>

                <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
                    Secure clinical protocol enforced by MediSync Precision Auth
                </div>
            </div>
        </div>
    );
};

const AlertCircle = ({ size, color }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
  </svg>
);

export default LoginPage;
