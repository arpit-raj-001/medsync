import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Nuclear Reset: Clear stale medical cache on boot to prevent JSON parsing crashes
if (!localStorage.getItem('medisync_v2_migration')) {
  localStorage.clear();
  localStorage.setItem('medisync_v2_migration', 'true');
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
