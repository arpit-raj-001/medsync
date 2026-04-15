import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

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

const getModel = () => {
  if (!genAI) return null;
  try {
    return genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: reportSchema,
      },
      systemInstruction: "You are an expert clinical summarizer. You will receive a patient triage transcript. Extract the exact required JSON fields strictly according to the schema. IMPORTANT: For 'recommendedSpecialtySynonyms', provide EXACTLY 3 terms. Remove all spaces from these terms (e.g., use 'SkinDoctor' instead of 'Skin Doctor') so they match our strict database mapping."
    });
  } catch (e) {
    console.error("Failed to get Gemini generative model:", e);
    return null;
  }
};

export const generateFinalReport = async (historyArray) => {
    const model = getModel();
    if (!model) throw new Error("Gemini AI is not initialized. Please check your API key.");

    const transcript = historyArray.map(msg => `${msg.role.toUpperCase()}: ${msg.text}`).join('\n');
    const prompt = `Here is the transcript of a patient intake conversation:\n\n${transcript}\n\nGenerate the final JSON report.`;

    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (e) {
      console.error("Gemini Report Generation Error:", e);
      throw e;
    }
};
