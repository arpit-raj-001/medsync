import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import TeleMeetDoctor from './TeleMeetDoctor';
import TeleMeetPatient from './TeleMeetPatient';

/**
 * TeleMeet Dispatcher
 * Routes to either TeleMeetDoctor or TeleMeetPatient based on the authenticated role.
 * Fallback to URL param for external guest access if needed.
 */
const TeleMeet = () => {
    const { isDoctor } = useAuth();

    if (isDoctor) {
        return <TeleMeetDoctor />;
    }

    return <TeleMeetPatient />;
};

export default TeleMeet;
