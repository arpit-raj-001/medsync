import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { runGroqFallback } from './groq';

const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';

// Initialize with safety
let genAI = null;
try {
  if (apiKey) {
    genAI = new GoogleGenerativeAI(apiKey);
  }
} catch (e) {
  console.error("Critical: Failed to initialize Gemini SDK:", e);
}

const reportSchema = {
  type: SchemaType.OBJECT,
  description: "A final medical report extracted from a triage conversation.",
  properties: {
    primaryComplaint: { type: SchemaType.STRING, description: "Main issue in patient’s own words." },
    symptoms: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "List of symptoms (type, location, associated symptoms)." },
    duration: { type: SchemaType.STRING, description: "When it started, acute or chronic." },
    severity: { type: SchemaType.STRING, description: "Mild / Moderate / Severe + impact on daily life." },
    progression: { type: SchemaType.STRING, description: "Improving / Worsening / Constant." },
    keyObservations: { type: SchemaType.STRING, description: "Important insights from the triage." },
    possibleConcern: { type: SchemaType.STRING, description: "Non-diagnostic, simple explanation of what it might be." },
    recommendedSpecialty: { 
      type: SchemaType.STRING, 
      description: "Match the symptoms to a specialist. Example: General Physician, Dermatologist, Pediatrician, Gynecologist, Cardiologist, Orthopedist, Dentist, ENT Specialist, Ophthalmologist, Psychiatrist, Endocrinologist, Neurologist, Urologist, Gastroenterologist" 
    },
    recommendedSpecialtySynonyms: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: "Provide exactly 3 alternate terms, synonyms, or sub-specialties. For example: if specialty is 'Dentist', synonyms could be ['ToothDoctor', 'DentalSurgeon', 'OralCare']."
    },
    urgencyLevel: { type: SchemaType.STRING, description: "Low / Medium / High based on risk indicators." },
    suggestedNextSteps: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Clear actionable steps for the patient to take before consultation." }
  },
  required: [
    "primaryComplaint", "symptoms", "duration", "severity", "progression", 
    "keyObservations", "possibleConcern", "recommendedSpecialty", "recommendedSpecialtySynonyms", "urgencyLevel", "suggestedNextSteps"
  ]
};

const consultationReportSchema = {
  type: SchemaType.OBJECT,
  description: "A final clinical report generated from a doctor-patient consultation.",
  properties: {
    clinicalTitle: { type: SchemaType.STRING, description: "A professional concise title for this session (e.g., 'Hypertension Management Revision')." },
    diagnosis: { type: SchemaType.STRING, description: "Professional clinical diagnosis or assessment." },
    summary: { type: SchemaType.STRING, description: "A high-density professional summary of the clinical visit." },
    prescriptions: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          medication: { type: SchemaType.STRING, description: "Drug name" },
          dosage: { type: SchemaType.STRING, description: "Strength/Format" },
          timing: { type: SchemaType.STRING, description: "Frequency/Time" },
          instructions: { type: SchemaType.STRING, description: "Usage notes" }
        },
        required: ["medication", "dosage", "timing"]
      }
    },
    patientAdvice: { type: SchemaType.STRING, description: "Patient-friendly lifestyle/dietary guidance." },
    precautions: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Specific technical contraindications or advice." },
    redFlags: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Emergency indicators for immediate hospital visit." },
    followUp: { type: SchemaType.STRING, description: "Recommended next check-up timeline." }
  },
  required: ["clinicalTitle", "diagnosis", "summary", "prescriptions", "patientAdvice", "precautions", "redFlags"]
};

const medicationExtractionSchema = {
  type: SchemaType.OBJECT,
  description: "Extracted medication details from a medical report or transcript.",
  properties: {
    medications: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING, description: "Generic or brand name of medicine." },
          dosage: { type: SchemaType.STRING, description: "Strength (e.g. 500mg)." },
          frequency: { type: SchemaType.STRING, description: "Number of times daily (1, 2, 3, or 4)." },
          times: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING }, description: "Array of HH:mm strings for taking times." },
          notes: { type: SchemaType.STRING, description: "Special instructions (e.g. before food)." }
        },
        required: ["name", "dosage", "frequency", "times"]
      }
    }
  },
  required: ["medications"]
};

const getModel = (schema) => {
  if (!genAI) return null;
  try {
    return genAI.getGenerativeModel({
      model: "gemini-3.1-flash-lite-preview",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: schema || reportSchema,
      },
      systemInstruction: "You are a specialized clinical data orchestrator. Your task is to extract medical data from consultation transcripts. DO NOT SIMPLIFY. Use professional clinical language, specific medical terminology, and maintain technical precision suitable for expert peer review. Focus on identifying distinct clinical entities for later summarization."
    });
  } catch (e) {
    console.error("Failed to get Gemini generative model:", e);
    return null;
  }
};

export const extractMedicationsFromTranscript = async (text) => {
    const prompt = `
MEDICAL DATA INPUT:
${text}

Task: Extract all pharmacotherapeutic agents and their precise dosing regimens.
Standardize:
- Frequency: "1", "2", "3", or "4" (Daily intake counts).
- Temporal mapping: Format times as HH:mm.
- Ensure 100% extraction accuracy from clinical reports.
    `.trim();

    try {
      const model = getModel(medicationExtractionSchema);
      if (!model) throw new Error("Gemini Unavailable");
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      console.warn("Gemini Failed. Falling back to Groq for Medication Extraction...");
      const schemaHint = `Expected JSON: { "medications": [{ "name", "dosage", "frequency", "times": ["HH:mm"], "notes" }] }`;
      return await runGroqFallback(prompt, schemaHint);
    }
};

/**
 * CRITICAL: Specifically uses Groq (Llama 3.3 70B) for high-accuracy extraction.
 * Re-mapped to match database columns: name, dosage, frequency, times, notes.
 */
export const extractMedicationsWithGroq = async (reportJson) => {
    const prompt = `
CLINICAL REPORT DATA:
${JSON.stringify(reportJson, null, 2)}

TASK: Extract all medicinal prescriptions into a strict JSON inventory.
DATABASE SCHEMA CONSTRAINTS:
- "name": Generic or Brand name (string).
- "dosage": Strength/Volume (e.g., "500mg").
- "frequency": DAILY INTAKE COUNT AS INTEGER (e.g., 2).
- "times": ARRAY of "HH:mm" strings (e.g., ["09:00", "21:00"]). 
  * If freq is 1 -> ["09:00"]
  * If freq is 2 -> ["09:00", "21:00"]
  * If freq is 3 -> ["08:00", "14:00", "20:00"]
- "notes": Instructions (e.g., "After food").

CRITICAL INSTRUCTION: Return ONLY the JSON object. Do not explain. Ensure 100% data fidelity.
    `.trim();

    const schemaHint = `Strictly return ONLY JSON: { "medications": [{ "name", "dosage", "frequency", "times", "notes" }] }`;
    return await runGroqFallback(prompt, schemaHint);
};

export const generateFinalReport = async (historyArray) => {
    const transcript = historyArray.map(msg => `${msg.role.toUpperCase()}: ${msg.text}`).join('\n');
    const prompt = `Here is the transcript of a patient intake conversation:\n\n${transcript}\n\nGenerate the final JSON report.`;

    try {
      const model = getModel();
      if (!model) throw new Error("Gemini Unavailable");
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      console.warn("Gemini Failed. Falling back to Groq for Pre-Consultation Report...");
      const schemaHint = "Output must follow medical intake summary with fields: primaryComplaint, symptoms[], duration, severity, progression, keyObservations, possibleConcern, recommendedSpecialty, recommendedSpecialtySynonyms[], urgencyLevel, suggestedNextSteps[]";
      return await runGroqFallback(prompt, schemaHint);
    }
};

export const generateConsultationReport = async (transcript, preReport) => {
    const prompt = `
PATIENT PRE-REPORT:
${JSON.stringify(preReport, null, 2)}

CONSULTATION TRANSCRIPT:
${transcript}

Task: Generate a HIGH-DENSITY, PROFESSIONAL CLINICAL CONSULTATION REPORT. 
GUIDELINES:
- USE ADVANCED CLINICAL TERMINOLOGY (e.g., "Etiology", "Pathophysiological rationale", "Prognostic indicators"). 
- PROVIDE EXTENSIVE DETAIL: Do not summarize into bullet points if a detailed clinical narrative is possible.
- INCLUDE DIFFERENTIAL DIAGNOSIS: Discuss possible alternative conditions and why they were ruled in/out.
- TREATMENT RATIONALE: Explain the clinical reasoning behind each prescribed pharmacological agent.
- DO NOT SIMPLIFY FOR THE PATIENT: Maintain high-fidelity technical precision for peer-review quality.
- Output must be in JSON format matching the schema.
    `.trim();

    try {
      const model = getModel(consultationReportSchema);
      if (!model) throw new Error("Gemini Unavailable");
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      console.warn("Gemini Failed. Falling back to Groq for Professional Clinical Report...");
      const schemaHint = "Output JSON strictly with fields: diagnosis, summary, prescriptions: [{medication, dosage, timing, instructions}], precautions[], redFlags[], followUp";
      return await runGroqFallback(prompt, schemaHint);
    }
};
