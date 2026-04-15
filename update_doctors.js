import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const doctorPath = path.join(__dirname, 'public', 'doctors.json');
const assetBase = path.join(__dirname, 'public', 'doctorasset');

const maleNames = ["Aarav", "Aaryan", "Aditya", "Advait", "Akash", "Anay", "Arjun", "Arnav", "Ayush", "Daksh", "Dhruv", "Ishaan", "Kabir", "Krishna", "Madhav", "Mohan", "Nikhil", "Parth", "Pranav", "Rohan", "Sahil", "Shaurya", "Tushar", "Varun", "Vihaan", "Vivaan", "Yug"];
// const femaleNames - everything else is female by default in our list

const specialtyData = {
  "General Physician": {
    tags: ["generalphysician", "gp", "primarycare", "fever", "cold", "flu", "cough", "headache", "generalmedicine", "internalmedicine"],
    edu: "MBBS, MD - General Medicine",
    clinicSuffix: "Health Care",
    about: "Specializing in comprehensive adult care and chronic disease management."
  },
  "Dermatologist": {
    tags: ["dermatologist", "skindoctor", "skinspecialist", "rashes", "acne", "hairloss", "nailspecialist", "cosmetologist"],
    edu: "MBBS, MD - Dermatology",
    clinicSuffix: "Skin & Hair Clinic",
    about: "Expert in treating skin, hair, and nail disorders with focus on medical dermatology."
  },
  "Pediatrician": {
    tags: ["pediatrician", "childspecialist", "babydoctor", "childrensdoctor", "infantcare", "kidsdoctor"],
    edu: "MBBS, MD - Pediatrics",
    clinicSuffix: "Children's Clinic",
    about: "Dedicated to the physical, emotional, and behavioral health of children from birth to adolescence."
  },
  "Gynecologist": {
    tags: ["gynecologist", "obgyn", "womensdoctor", "pregnancy", "menstrual", "femalehealth", "obstetrician"],
    edu: "MBBS, MS - Obstetrics & Gynaecology",
    clinicSuffix: "Women's Wellness",
    about: "Specialized care for women's reproductive health, prenatal and postnatal management."
  },
  "Cardiologist": {
    tags: ["cardiologist", "heartdoctor", "chestpain", "heartspecialist", "bloodpressure", "bpspecialist", "cardiovascular"],
    edu: "MBBS, MD, DM - Cardiology",
    clinicSuffix: "Heart Institute",
    about: "Expert in cardiovascular health and advanced heart disease treatments."
  },
  "Orthopedist": {
    tags: ["orthopedist", "orthopedicsurgeon", "bonedoctor", "jointspecialist", "kneepain", "legproblem", "backpain", "spinedoctor", "musclepain", "fracture"],
    edu: "MBBS, MS - Orthopaedics",
    clinicSuffix: "Orthopaedic Center",
    about: "Specialize in musculoskeletal system, including joints, ligaments, and bones."
  },
  "Dentist": {
    tags: ["dentist", "toothdoctor", "dentalsurgeon", "toothache", "gums", "orthodontist", "oralcare"],
    edu: "BDS, MDS - Conservative Dentistry",
    clinicSuffix: "Dental Studio",
    about: "Focus on oral health, advanced cosmetic dentistry, and painless treatments."
  },
  "ENT Specialist": {
    tags: ["ent", "entspecialist", "earnosethroatdoctor", "eardoctor", "hearing", "throatpain", "sinusdoctor", "otolaryngologist"],
    edu: "MBBS, MS - ENT",
    clinicSuffix: "ENT Care",
    about: "Specialized in disorders of the ear, nose, and throat for all ages."
  },
  "Ophthalmologist": {
    tags: ["ophthalmologist", "eyedoctor", "visionspecialist", "optometrist", "eyesurgeon", "cataract"],
    edu: "MBBS, MS - Ophthalmology",
    clinicSuffix: "Eye Care",
    about: "Expert in medical and surgical eye care, including cataract and vision correction."
  },
  "Psychiatrist": {
    tags: ["psychiatrist", "mentalhealth", "therapist", "psychologist", "depression", "anxiety", "braindoctor", "counselor", "stress"],
    edu: "MBBS, MD - Psychiatry",
    clinicSuffix: "Mind Center",
    about: "Compassionate care for mental well-being and psychological disorders."
  },
  "Endocrinologist": {
    tags: ["endocrinologist", "diabetesdoctor", "thyroidspecialist", "hormonedoctor", "sugardoctor"],
    edu: "MBBS, MD, DM - Endocrinology",
    clinicSuffix: "Endocrine Clinic",
    about: "Specializing in hormonal imbalances, diabetes, and thyroid management."
  },
  "Neurologist": {
    tags: ["neurologist", "braindoctor", "nervespecialist", "stroke", "migrainespecialist", "neurospecialist"],
    edu: "MBBS, MD, DM - Neurology",
    clinicSuffix: "Neuro Care",
    about: "Advanced treatment for disorders of the nervous system and brain health."
  },
  "Urologist": {
    tags: ["urologist", "kidneydoctor", "urinaryspecialist", "bladder", "prostatedoctor", "urineproblem"],
    edu: "MBBS, MS, MCh - Urology",
    clinicSuffix: "Urology Specialist",
    about: "Focused on urinary tract and male reproductive system conditions."
  },
  "Gastroenterologist": {
    tags: ["gastroenterologist", "stomachdoctor", "digestionspecialist", "liverdoctor", "gutspecialist", "acidity", "ulcer"],
    edu: "MBBS, MD, DM - Gastroenterology",
    clinicSuffix: "Gut Health Clinic",
    about: "Specialize in disorders of the digestive system and liver health."
  }
};

const cityCoords = {
  "Mumbai": { lat: 19.0760, lng: 72.8777 },
  "Delhi": { lat: 28.6139, lng: 77.2090 },
  "Bengaluru": { lat: 12.9716, lng: 77.5946 },
  "Hyderabad": { lat: 17.3850, lng: 78.4867 },
  "Ahmedabad": { lat: 23.0225, lng: 72.5714 },
  "Chennai": { lat: 13.0827, lng: 80.2707 },
  "Kolkata": { lat: 22.5726, lng: 88.3639 },
  "Pune": { lat: 18.5204, lng: 73.8567 },
  "Jaipur": { lat: 26.9124, lng: 75.7873 },
  "Surat": { lat: 21.1702, lng: 72.8311 }
};

const getRandomOffset = (value) => value + (Math.random() - 0.5) * 0.15;
const normalize = (str) => str.toLowerCase().replace(/\s+/g, '');

try {
  // Read Assets
  const malePhotos = fs.readdirSync(path.join(assetBase, 'malepfp')).filter(f => f.match(/\.(jpg|jpeg|png|webp|svg)$/i));
  const femalePhotos = fs.readdirSync(path.join(assetBase, 'femalepfp')).filter(f => f.match(/\.(jpg|jpeg|png|webp|svg)$/i));
  const aadyaPhotos = fs.readdirSync(path.join(assetBase, 'aadyapfp')).filter(f => f.match(/\.(jpg|jpeg|png|webp|svg)$/i));

  const doctorsJSON = fs.readFileSync(doctorPath, 'utf-8');
  let doctors = JSON.parse(doctorsJSON);

  const specialties = Object.keys(specialtyData);
  const cities = Object.keys(cityCoords);

  let mIdx = 0;
  let fIdx = 0;

  const updatedDoctors = doctors.map((doc, index) => {
    const isAadya = doc.name.includes("Aadya Rastogi");
    let gender = "Female";
    let image = "";
    
    // Choose City for Address Consistency
    const city = isAadya ? "Jaipur" : cities[index % cities.length];
    const coords = cityCoords[city];

    if (isAadya) {
        gender = "Female";
        image = `/doctorasset/aadyapfp/${aadyaPhotos[0]}`; 
        doc.about = "She heals hearts with the way she listens, the way she cares, way she understands, the way she looks, her presence alone is a cure.";
        doc.address = `Jamdoli, Jaipur`;
        doc.location = { 
          lat: getRandomOffset(coords.lat), 
          lng: getRandomOffset(coords.lng) 
        };
    } else {
        const firstName = doc.name.replace("Dr. ", "").split(" ")[0];
        if (maleNames.includes(firstName)) {
            gender = "Male";
            image = `/doctorasset/malepfp/${malePhotos[mIdx % malePhotos.length]}`;
            mIdx++;
        } else {
            gender = "Female";
            image = `/doctorasset/femalepfp/${femalePhotos[fIdx % femalePhotos.length]}`;
            fIdx++;
        }
        
        // Match address city to lat/lng city
        doc.address = `Sector ${10 + (index % 50)}, ${city}`;
        doc.location = { 
          lat: getRandomOffset(coords.lat), 
          lng: getRandomOffset(coords.lng) 
        };
    }

    return {
      ...doc,
      gender,
      image
    };
  });

  fs.writeFileSync(doctorPath, JSON.stringify(updatedDoctors, null, 2));
  console.log(`Updated ${updatedDoctors.length} doctors with gender and optimized profile pictures.`);
} catch(e) {
  console.error("Error formatting doctors database:", e);
}
