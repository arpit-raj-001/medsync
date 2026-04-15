import React, { useState, useEffect, useRef } from 'react';
import { Send, User, Bot, Loader2, KeyRound, RefreshCw, AlertCircle } from 'lucide-react';
import { continueGroqChat } from '../../lib/groq';
import { generateFinalReport } from '../../lib/gemini';
import './ChatFlow.css';

const ChatInterface = ({ onComplete }) => {
  // Try to load initial messages from localStorage
  const loadInitialMessages = () => {
    try {
      const saved = localStorage.getItem('medisync_chat_messages');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : [{ role: 'ai', text: "Welcome to MediSync please describe your issue :" }];
    } catch (e) {
      console.error("Local storage parse error (messages):", e);
      return [{ role: 'ai', text: "Welcome to MediSync please describe your issue :" }];
    }
  };

  const loadInitialOptions = () => {
    try {
      const saved = localStorage.getItem('medisync_chat_options');
      const parsed = saved ? JSON.parse(saved) : null;
      return Array.isArray(parsed) ? parsed : ["I have a headache", "I have a fever", "I have body pain", "Other"];
    } catch (e) {
      console.error("Local storage parse error (options):", e);
      return ["I have a headache", "I have a fever", "I have body pain", "Other"];
    }
  };

  const [messages, setMessages] = useState(loadInitialMessages());
  const [currentOptions, setCurrentOptions] = useState(loadInitialOptions());
  const [apiMissing, setApiMissing] = useState(false);
  const [input, setInput] = useState('');
  
  // Only type initially if we have no messages
  const [isTyping, setIsTyping] = useState(messages.length === 0);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [apiErrorMsg, setApiErrorMsg] = useState(null);
  
  const endOfMessagesRef = useRef(null);

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem('medisync_chat_messages', JSON.stringify(messages));
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('medisync_chat_options', JSON.stringify(currentOptions));
  }, [currentOptions]);

  // Init chat only if API is missing
  useEffect(() => {
    if (!import.meta.env.VITE_GROQ_API_KEY || !import.meta.env.VITE_GEMINI_API_KEY) {
      setApiMissing(true);
    }
    setIsTyping(false); // Never typing on mount now
  }, []);

  const handleRestart = () => {
    localStorage.removeItem('medisync_chat_messages');
    localStorage.removeItem('medisync_chat_options');
    localStorage.removeItem('medisync_chat_stage');
    localStorage.removeItem('medisync_chat_patient');
    setMessages([{ role: 'ai', text: "Welcome to MediSync please describe your issue :" }]);
    setCurrentOptions(["I have a headache", "I have a fever", "I have body pain", "Other"]);
    setIsTyping(false);
    setGeneratingReport(false);
    setApiErrorMsg(null);
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping, generatingReport, apiErrorMsg]);

  const handleSend = async (text) => {
    if (!text.trim()) return;

    setApiErrorMsg(null);
    const userMsg = { role: 'user', text };
    const newContext = [...messages, userMsg];
    
    setMessages(newContext);
    setInput('');
    setCurrentOptions([]);
    setIsTyping(true);

    try {
      const response = await continueGroqChat(newContext, text); 
      
      const aiMsg = { role: 'ai', text: response.message };
      const updatedContext = [...newContext, aiMsg];
      setMessages(updatedContext);
      
      if (response.isSatisfied) {
         setIsTyping(false);
         setGeneratingReport(true);
         
         try {
           const finalReport = await generateFinalReport(updatedContext);
           setTimeout(() => {
             onComplete(finalReport);
           }, 1000);
         } catch (geminiError) {
           console.error("Gemini Report Gen Error:", geminiError);
           setApiErrorMsg(`Gemini Extraction Failed: ${geminiError.message}`);
           setMessages([...updatedContext, { role: 'ai', text: "I've completed the triage, but encountered an error generating your final report via Gemini." }]);
           setGeneratingReport(false);
         }
      } else {
         setCurrentOptions(response.options || []);
         setIsTyping(false);
      }
    } catch (err) {
      console.error("Chat Error:", err);
      setApiErrorMsg(`Groq Processing Failed: ${err.message}`);
      setMessages([...newContext, { role: 'ai', text: "There was an error communicating with the AI. Please try again." }]);
      setIsTyping(false);
    }
  };

  if (apiMissing) {
    return (
      <div className="error-view">
        <div className="error-icon">
           <KeyRound size={40} />
        </div>
        <h2 style={{margin: '0 0 16px 0', fontSize: '24px', fontWeight: 800}}>API Keys Required</h2>
        <p style={{color: '#64748b'}}>
          The AI Interrogation workflow requires both <strong>Groq</strong> and <strong>Gemini</strong> API Keys. 
        </p>
      </div>
    );
  }

  return (
    <div className="cf-container">
      <div className="chat-window">
        {/* Header */}
        <div className="chat-header" style={{ justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="chat-header-icon">
              <Bot size={24} />
            </div>
            <div>
              <h2>AI Medical Triage</h2>
              <p>Groq Interrogation & Gemini Reporting</p>
            </div>
          </div>
          <button 
            onClick={handleRestart} 
            title="Restart Chat"
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.3)', borderRadius: '8px', padding: '8px', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} /> <span style={{fontSize: '12px', fontWeight: 600}}>Restart</span>
          </button>
        </div>

        {/* Chat Area */}
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className={`chat-row ${msg.role}`}>
              <div className="chat-bubble-wrapper">
                <div className="chat-avatar">
                  {msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}
                </div>
                <div className="chat-bubble">
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="chat-row ai">
               <div className="chat-bubble-wrapper">
                 <div className="chat-avatar">
                    <Bot size={16} />
                 </div>
                 <div className="chat-bubble" style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                   <Loader2 size={16} className="spin" style={{color: '#10b981'}} />
                   <span style={{fontSize: '14px', fontWeight: 600, color: '#94a3b8'}}>Doctor is typing...</span>
                 </div>
               </div>
            </div>
          )}

          {generatingReport && (
            <div className="chat-row ai">
               <div className="chat-bubble-wrapper">
                 <div className="chat-avatar" style={{backgroundColor: '#fef3c7', color: '#d97706', borderColor: '#fde68a'}}>
                    <Loader2 size={16} className="spin" />
                 </div>
                 <div className="chat-bubble" style={{display: 'flex', flexDirection: 'column', gap: '4px', borderColor: '#fde68a'}}>
                   <span style={{fontWeight: 700, color: '#d97706', fontSize: '14px'}}>Triage Complete</span>
                   <span style={{fontSize: '13px', color: '#64748b'}}>Gemini is compiling your final medical report and matching specialists...</span>
                 </div>
               </div>
            </div>
          )}

          {apiErrorMsg && (
            <div className="chat-row ai">
               <div className="chat-bubble-wrapper">
                 <div className="chat-avatar" style={{backgroundColor: '#fef2f2', color: '#ef4444', borderColor: '#fca5a5'}}>
                    <AlertCircle size={16} />
                 </div>
                 <div className="chat-bubble" style={{display: 'flex', flexDirection: 'column', gap: '6px', borderColor: '#fca5a5', backgroundColor: '#fff5f5'}}>
                   <span style={{fontWeight: 700, color: '#ef4444', fontSize: '14px'}}>API Exception Triggered</span>
                   <code style={{fontSize: '12px', color: '#b91c1c', backgroundColor: '#fee2e2', padding: '6px', borderRadius: '4px', wordBreak: 'break-word'}}>{apiErrorMsg}</code>
                   <span style={{fontSize: '12px', color: '#991b1b'}}>Please verify your API keys or quota limits in the `.env` file.</span>
                 </div>
               </div>
            </div>
          )}

          <div ref={endOfMessagesRef} />
        </div>

        {/* Input Area */}
        <div className="chat-input-area">
          {currentOptions.length > 0 && (
            <div className="chat-options">
              {currentOptions.map((opt, i) => (
                <button 
                  key={i}
                  onClick={() => handleSend(opt)}
                  disabled={isTyping || generatingReport}
                  className="chat-chip"
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
          
          <div className="chat-input-group">
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
              placeholder="Type your response to the doctor..."
              disabled={isTyping || generatingReport}
              className="chat-input"
            />
            <button 
              onClick={() => handleSend(input)}
              disabled={!input.trim() || isTyping || generatingReport}
              className="chat-send-btn"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;
