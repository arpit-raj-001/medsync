import Groq from 'groq-sdk';

const apiKey = import.meta.env.VITE_GROQ_API_KEY || '';

// Initialize with safety - don't crash the whole module if key is missing or SDK fails
let groq = null;
try {
  if (apiKey) {
    groq = new Groq({ 
      apiKey, 
      dangerouslyAllowBrowser: true 
    });
  }
} catch (e) {
  console.error("Critical: Failed to initialize Groq SDK:", e);
}

const SYSTEM_PROMPT = `You are an experienced clinical assistant trained to conduct structured patient intake like a professional doctor.

Your goal is to collect only the necessary medical information through precise, step-by-step questioning and generate a structured pre-consultation report.

CORE BEHAVIOR
- Ask one question at a time
- Be precise, not verbose
- Do not ask unnecessary questions
- Adapt questions based on previous answers
- Stop asking questions when sufficient information is collected

Your tone: Professional, Calm, Direct, Reassuring.

INFORMATION YOU MUST COLLECT for the report:
1. Primary Complaint (Main issue in patient’s own words)
2. Symptoms (Type, Location, Associated symptoms)
3. Duration (When it started, Acute or chronic)
4. Severity (Mild / Moderate / Severe, Impact on daily life)
5. Progression (Improving / Worsening / Constant)
6. Triggers (Food, environment, activity, etc.)
7. Medical History (Existing conditions like diabetes, BP, etc.)
8. Medications (Current medications if relevant)
9. Risk Indicators (Fever, bleeding, sudden onset, etc.)

QUESTIONING STRATEGY
- Start broad → then narrow down
- Prioritize high-value clinical questions
- Skip irrelevant sections when not needed
Examples: IF symptom = skin issue → ask about itching, redness, spread. IF symptom = pain → ask location, intensity, type (sharp/dull). 

STOP CONDITION (VERY IMPORTANT)
You must stop asking questions when:
- You can confidently fill all major report sections
- Further questions will not significantly improve clarity
When satisfied:
→ Do NOT ask more questions
→ Move to report generation by stating "Thank you. I have enough information to prepare your health summary."

VERY IMPORTANT JSON RULES:
Because we are communicating with a strict frontend UI, you MUST format your ONLY output as a strict JSON object:
{
  "message": "The exact question or response you dictate to the patient.",
  "options": ["Provide 4-6 relevant short selectable string options for the user to click", "Option 2", "Option 3"],
  "isSatisfied": true or false (Set to true ONLY when you hit the STOP CONDITION)
}`;

export const continueGroqChat = async (historyArray, latestInput) => {
    if (!groq) throw new Error("Groq SDK is not initialized. Please check your API key.");

    const messages = [{ role: 'system', content: SYSTEM_PROMPT }];
    historyArray.forEach(msg => {
      messages.push({
        role: msg.role === 'ai' ? 'assistant' : 'user',
        content: msg.text
      });
    });
    messages.push({ role: 'user', content: latestInput });

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages,
        model: 'llama-3.1-8b-instant',
        temperature: 0.5,
        response_format: { type: 'json_object' }
      });
      return JSON.parse(chatCompletion.choices[0].message.content);
    } catch (e) {
      console.error("Groq API Error:", e);
      throw e;
    }
};

/**
 * runGroqFallback
 * A generic helper to handle clinical extraction/reporting when Gemini fails.
 */
export const runGroqFallback = async (prompt, schemaDescription = "") => {
    if (!groq) throw new Error("Groq SDK is not available.");

    const systemPrompt = `You are an expert clinical data extractor. Your goal is to generate structured medical reports in JSON format. 
    ${schemaDescription}
    RESPOND ONLY WITH VALID JSON. DO NOT EXPLAIN. DO NOT SIMPLIFY CLINICAL TERMS.`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.2, // Low temperature for extraction accuracy
        response_format: { type: 'json_object' }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      console.error("Groq Fallback Error:", e);
      throw e;
    }
};

/**
    const schemaHint = `Strictly return ONLY JSON: { "medications": [{ "name", "dosage", "frequency", "times", "notes" }] }`;
    return await runGroqFallback(prompt, schemaHint);
};

/**
 * generateSimulatedConsultation
 * Generates a sophisticated, highly-educated to-and-fro conversation
 * between a doctor and patient based on triage pre-report data.
 */
export const generateSimulatedConsultation = async (preReportData) => {
    if (!groq) throw new Error("Groq SDK is not available.");

    const prompt = `
    PATIENT TRIAGE DATA:
    ${JSON.stringify(preReportData, null, 2)}

    TASK: Generate a dynamic, professional medical consultation transcript.
    
    PERSONA - THE DOCTOR:
    - Highly educated, uses sophisticated clinical language (e.g., "symptomatology", "etiological factors", "pharmacological intervention").
    - Professional but thorough.
    - Asks clarifying questions based on the triage data.
    
    CONTENT REQUIREMENTS:
    1. Introduction and confirmation of triage symptoms.
    2. A detailed to-and-fro dialogue (at least 10 exchanges).
    3. A clear clinical assessment/diagnosis.
    4. Explicit prescription of medicines with dosage and timing.
    5. Lifestyle advice and emergency danger signs.
    
    FORMAT:
    Return as a plain text transcript with "Doctor:" and "Patient:" prefixes.
    `.trim();

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: "You are a specialized clinical scriptwriter. Generate a high-fidelity medical consultation transcript. Respond ONLY with the transcript text." },
          { role: 'user', content: prompt }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.8
      });

      return completion.choices[0].message.content;
    } catch (e) {
      console.error("Groq Simulation Error:", e);
      throw e;
    }
};

/**
 * summarizeReportForLayman
 * Translates complex clinical reports into extremely simple, analogy-based terms.
 */
export const summarizeReportForLayman = async (reportData) => {
    if (!groq) throw new Error("Groq SDK is not available.");

    const systemPrompt = `You are a kind, wise village doctor who explains medical things to children or people with no formal education.
    
    TASK: Translate the clinical report into a "Grandma-friendly" sensory guide.
    GUIDELINES:
    - Use ZERO technical terms. Call it "Heavy chest" instead of "Angina", "Fast heart" instead of "Tachycardia".
    - Use sensory descriptions for warnings (e.g., "If your skin feels cold like a wet stone", "If your breath sounds like a whistle").
    - Use analogies for medicines (e.g., "The white round pill is the worker that keeps your blood moving smooth").
    - Explicitly list forbidden things (e.g., "No heavy field work", "No salty pickles").
    
    RESPOND ONLY IN JSON:
    {
      "simpleDiagnosis": "An analogy-based explanation of what is wrong",
      "whatToDoNow": ["3-5 very simple positive actions like drinking warm water or walking slowly"],
      "thingsToAvoid": ["3-5 forbidden things like specific foods, heavy work, or cold water"],
      "medicineSteps": [
        { "medicine": "description of the pill", "job": "simple analogy of what it does in the body" }
      ],
      "dangerSigns": ["3 specific sensory signs to visit a hospital immediately"],
      "reassurance": "A kind, culturally respectful closing message"
    }`;

    try {
      const completion = await groq.chat.completions.create({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Summarize this clinical report simply: ${JSON.stringify(reportData)}` }
        ],
        model: 'llama-3.3-70b-versatile',
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      return JSON.parse(completion.choices[0].message.content);
    } catch (e) {
      console.error("Groq Layman Summary Error:", e);
      throw e;
    }
};
