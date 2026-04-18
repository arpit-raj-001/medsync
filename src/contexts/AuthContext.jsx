import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem('medisync_user');
        return saved ? JSON.parse(saved) : null;
    });
    const [role, setRole] = useState(() => {
        return localStorage.getItem('medisync_role') || null;
    });
    const [loading, setLoading] = useState(true);

    const isDoctor = role === 'doctor';
    const isPatient = role === 'patient';

    const login = async (id, password, type) => {
        try {
            const table = type === 'doctor' ? 'doctors' : 'patients';
            const { data, error } = await supabase
                .from(table)
                .select('*')
                .eq('id', id.trim().toLowerCase())
                .eq('password', password.trim())
                .single();

            if (error || !data) {
                throw new Error('Invalid credentials');
            }

            setUser(data);
            setRole(type);
            localStorage.setItem('medisync_user', JSON.stringify(data));
            localStorage.setItem('medisync_role', type);
            return { success: true, data };
        } catch (err) {
            return { success: false, error: err.message };
        }
    };

    const logout = () => {
        setUser(null);
        setRole(null);
        localStorage.removeItem('medisync_user');
        localStorage.removeItem('medisync_role');
        localStorage.removeItem('medisync_doctor'); // Cleanup legacy keys
    };

    useEffect(() => {
        // Simple delay to prevent flash
        setTimeout(() => setLoading(false), 500);
    }, []);

    return (
        <AuthContext.Provider value={{ user, role, isDoctor, isPatient, loading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
