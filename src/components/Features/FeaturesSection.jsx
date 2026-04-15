import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './FeaturesSection.css';

const avatarColors = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

const featureReviews = {
  ai_assistant: [
    { name: 'Sarah M.', text: '"The AI symptom checker is incredibly accurate. It saved me a trip to the ER!"', rating: 5 },
    { name: 'John D.', text: '"Felt like chatting with a real nurse. Extremely comforting and fast."', rating: 5 },
    { name: 'Emily R.', text: '"Helped me figure out which specialist I needed immediately."', rating: 4 },
    { name: 'Michael T.', text: '"The summary it generated for my doctor made my actual visit so efficient."', rating: 5 },
    { name: 'Aisha K.', text: '"Very intuitive layout, and the AI understands plain language perfectly."', rating: 5 },
  ],
  vosk: [
    { name: 'Dr. Smith', text: '"The voice-to-text saves me hours of paperwork every single day."', rating: 5 },
    { name: 'Dr. Patel', text: '"It perfectly captures medical terminology during my consultations."', rating: 5 },
    { name: 'James L.', text: '"I love getting a detailed report of what my doctor said right after the call."', rating: 4 },
    { name: 'Dr. Ramirez', text: '"A complete game changer for telemedicine."', rating: 5 },
    { name: 'Linda B.', text: '"The transcripts are spotless. Helps me remember my care plan easily."', rating: 5 },
  ],
  summarizer: [
    { name: 'David W.', text: '"Finally! I can actually understand what my blood test results mean."', rating: 5 },
    { name: 'Sophia G.', text: '"It translated a 10-page clinical report into a 1-page summary I could read to my mom."', rating: 5 },
    { name: 'Marcus J.', text: '"No more frantically Googling medical jargon. This does it beautifully."', rating: 5 },
    { name: 'Elena C.', text: '"Super helpful. The AI pinpoints exactly what I need to worry about."', rating: 4 },
    { name: 'Tom H.', text: '"Takes the anxiety out of reading lab results."', rating: 5 },
  ],
  booking: [
    { name: 'Rachel P.', text: '"Booked a specialist in 3 clicks. The AI matched me perfectly."', rating: 5 },
    { name: 'Carlos E.', text: '"Rescheduling was so easy, no phone calls needed!"', rating: 5 },
    { name: 'Anna S.', text: '"I love how it suggests doctors based on my exact symptoms and location."', rating: 4 },
    { name: 'Will K.', text: '"The interface is incredibly modern and fast."', rating: 5 },
    { name: 'Jenna F.', text: '"Never had booking a doctor feel so seamless."', rating: 5 },
  ],
  medicine: [
    { name: 'Robert C.', text: '"The reminders are a lifesaver for my daily medication routine."', rating: 5 },
    { name: 'Priya N.', text: '"It even compared prices for my prescription! Saved me $40 this month."', rating: 5 },
    { name: 'Lisa M.', text: '"I love how it automatically updates my medicine list after a doctor visit."', rating: 5 },
    { name: 'Kevin B.', text: '"No more forgetting pills. The alerts are perfectly timed."', rating: 4 },
    { name: 'Hannah O.', text: '"The built-in buying links make ordering refills effortless."', rating: 5 },
  ]
};

const ReviewSlider = ({ reviews }) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % reviews.length);
    }, 3000); // Reduced delay as requested
    return () => clearInterval(timer);
  }, [reviews.length]);

  const handleNext = () => {
    setCurrentIndex((prev) => (prev + 1) % reviews.length);
  };
  const handlePrev = () => {
    setCurrentIndex((prev) => (prev - 1 + reviews.length) % reviews.length);
  };

  const review = reviews[currentIndex];

  // Randomize color based on index to keep it consistent per review
  const bgColor = avatarColors[currentIndex % avatarColors.length];
  const initial = review.name.charAt(0);

  return (
    <div className="reviews-wrapper">
      <div className="review-slide anim-fade-in" key={currentIndex}>
        <div className="review-header">
          <div className="user-avatar" style={{ backgroundColor: bgColor }}>
            {initial}
          </div>
          <div className="user-info">
            <span className="user-name">{review.name}</span>
            <div className="star-rating">
              {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
            </div>
          </div>
        </div>
        <p className="review-text">{review.text}</p>
      </div>
      <div className="review-controls">
        {reviews.map((_, i) => (
          <button 
            key={i} 
            className={`review-dot ${i === currentIndex ? 'active' : ''}`}
            onClick={() => setCurrentIndex(i)}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
        <button className="review-arrow next-arrow" onClick={handleNext} aria-label="Next review">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
};

const FeatureRow = ({ title, highlight, details, videoSrc, isReversed, reviews, isColor2, hasNextRow, navPath }) => {
  const ref = useRef(null);
  const navigate = useNavigate();
  const bgClass = isColor2 ? "feature-color-2" : "feature-color-1";

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <div className={`feature-row ${bgClass}`} ref={ref}>
      <div className={`feature-content-wrapper ${isReversed ? 'reversed' : ''}`}>
        <div className="feature-content">
          <h2 className="feature-title">
            {title} <span className="title-gradient">{highlight}</span>
          </h2>
          <div className="feature-description">
            {details}
          </div>
          <button 
            className="btn btn-primary btn-try-now" 
            onClick={() => {
              if (navPath === '/chat') {
                localStorage.removeItem('medisync_chat_messages');
                localStorage.removeItem('medisync_chat_options');
                localStorage.removeItem('medisync_chat_stage');
                localStorage.removeItem('medisync_chat_patient');
              }
              if (navPath) navigate(navPath);
            }}
          >
            Try Now
          </button>
          <ReviewSlider reviews={reviews} />
        </div>
        <div className="feature-visual">
          <video 
            autoPlay 
            loop 
            muted 
            playsInline 
            className="feature-video"
            src={videoSrc}
          />
        </div>
      </div>
      {hasNextRow && <CurveBottom isReversed={isReversed} />}
    </div>
  );
};

const CurveBottom = ({ isReversed }) => (
  <div className="feature-curve" style={{ transform: isReversed ? 'scaleX(-1)' : 'none' }}>
    <svg viewBox="0 0 1440 120" preserveAspectRatio="none" fill="currentColor">
      <path d="M0,0 L1440,0 L1440,20 C960,140 480,20 0,100 Z" />
    </svg>
  </div>
);

const FeaturesSection = () => {
  return (
    <section className="features-section" id="features">
      <div className="features-header-wrapper">
        <div className="features-header anim-up">
          <h1 className="features-main-title">
            Powerful AI <span className="title-gradient">Features</span>
          </h1>
          <p className="features-subtitle">Everything you need to modernize your healthcare experience in one platform.</p>
        </div>
        <CurveBottom isReversed={false} />
      </div>

      <div className="features-container">
        
        <FeatureRow 
          title="🤖 AI Health"
          highlight="Assistant"
          videoSrc="/features/AI_healthcare_assistant_feauture_1.mp4"
          reviews={featureReviews.ai_assistant}
          isColor2={false}
          isReversed={false}
          hasNextRow={true}
          navPath="/chat"
          details={
            <>
              <p>An intelligent chatbot designed to guide users, understand symptoms, and suggest actionable next steps like appointment booking and doctor selection.</p>
              <strong>It efficiently collects:</strong>
              <ul>
                <li>Current Symptoms</li>
                <li>Medical History</li>
                <li>Duration of illness</li>
              </ul>
              <p><em>Why it matters:</em> Generates a concise summary for the doctor before the visit, making your platform feel smart and highly accessible.</p>
            </>
          }
        />

        <FeatureRow 
          title="🎤 Voice-Based"
          highlight="Consultation (VOSK)"
          videoSrc="/features/voice_based_consultation_feauture_2.mp4"
          reviews={featureReviews.vosk}
          isColor2={true}
          isReversed={true}
          hasNextRow={true}
          details={
            <>
              <p>Experience seamless telemedicine with live, real-time transcription powered by VOSK. The system instantly converts doctor-patient conversations into structured clinical text.</p>
              <p>Automatically generates a detailed report based on what the doctor diagnosed during the meeting.</p>
              <p><em>Why it matters:</em> Acts as your platform&apos;s Unique Selling Proposition (USP). It saves immense time and effort for doctors, proving highly impressive in practical demos.</p>
            </>
          }
        />

        <FeatureRow 
          title="📄 AI Report"
          highlight="Summarizer"
          videoSrc="/features/AI_report_summarizer_feauture_3.mp4"
          reviews={featureReviews.summarizer}
          isColor2={false}
          isReversed={false}
          hasNextRow={true}
          details={
            <>
              <p>Medical reports are notoriously hard to read. Our AI Report Summarizer automatically converts dense, complex medical reports into simple, actionable summaries.</p>
              <p>Makes lab results and clinical findings easy for everyday patients to understand without needing a medical degree.</p>
              <p><em>Why it matters:</em> Solves the real-world problem of medical jargon anxiety, ensuring patients actually understand their health data.</p>
            </>
          }
        />

        <FeatureRow 
          title="📅 Smart Appointment"
          highlight="Booking"
          videoSrc="/features/Healthcare_booking_system_feauture_4.mp4"
          reviews={featureReviews.booking}
          isColor2={true}
          isReversed={true}
          hasNextRow={true}
          details={
            <>
              <p>A comprehensive scheduling engine allowing patients to book, reschedule, or cancel appointments effortlessly.</p>
              <p>Integrated with AI to proactively suggest the best doctors available based on your symptoms, urgency, and past history.</p>
              <p><em>Why it matters:</em> The cornerstone functionality of any modern healthcare app, simplified for a frictionless user experience.</p>
            </>
          }
        />

        <FeatureRow 
          title="💊 Medicine &"
          highlight="Reminder System"
          videoSrc="/features/Smart_medicine_system_feauture_5.mp4"
          reviews={featureReviews.medicine}
          isColor2={false}
          isReversed={false}
          hasNextRow={false}
          details={
            <>
              <p>A smart pillbox in your pocket. Track active prescriptions and receive timely reminders so you never miss a dose.</p>
              <p>Automatically suggests medicines based on uploaded reports, provides direct buying links, and compares prices across different pharmacy platforms.</p>
              <p><em>Why it matters:</em> Drastically improves patient adherence and combines practical, financial, and health utility in one feature.</p>
            </>
          }
        />

      </div>
    </section>
  );
};

export default FeaturesSection;
