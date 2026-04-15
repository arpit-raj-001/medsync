import fs from 'fs';
import path from 'path';

// Arrays for combinatorial generation of Indian Doctor profiles
const firstNames = [
  'Aarav', 'Vihaan', 'Vivaan', 'Ananya', 'Diya', 'Advik', 'Kavya', 'Aryan', 'Ishaan', 'Shaurya',
  'Meera', 'Rohan', 'Dhruv', 'Riya', 'Aisha', 'Siddharth', 'Aditi', 'Pranav', 'Kriti', 'Arjun',
  'Neha', 'Rahul', 'Sneha', 'Vikram', 'Pooja', 'Karan', 'Priya', 'Amit', 'Anjali', 'Deepak',
  'Ramesh', 'Suresh', 'Geeta', 'Seema', 'Rajesh', 'Sanjay', 'Sunita', 'Anita', 'Vinay', 'Ashok',
  'Vivek', 'Nikhil', 'Gaurav', 'Manish', 'Tarun', 'Ankit', 'Sachin', 'Saurabh', 'Rohit', 'Nitin'
];

const lastNames = [
  'Sharma', 'Verma', 'Gupta', 'Malhotra', 'Bhatia', 'Kaur', 'Singh', 'Reddy', 'Patel', 'Desai',
  'Mehta', 'Joshi', 'Kapoor', 'Chopra', 'Iyer', 'Menon', 'Nair', 'Pillai', 'Rao', 'Das',
  'Banerjee', 'Bose', 'Chatterjee', 'Sengupta', 'Mishra', 'Tiwari', 'Pandey', 'Shukla', 'Yadav',
  'Jain', 'Agarwal', 'Garg', 'Chauhan', 'Thakur', 'Ahuja', 'Chawla', 'Sethi', 'Bansal', 'Mittal'
];

// Weighted specialties — more common issues have more weight
const specialties = [
  { name: 'General Physician', weight: 15 },
  { name: 'Dermatologist', weight: 12 },
  { name: 'Pediatrician', weight: 10 },
  { name: 'Gynecologist', weight: 10 },
  { name: 'Cardiologist', weight: 8 },
  { name: 'Orthopedist', weight: 8 },
  { name: 'Dentist', weight: 8 },
  { name: 'ENT Specialist', weight: 6 },
  { name: 'Ophthalmologist', weight: 6 },
  { name: 'Psychiatrist', weight: 5 },
  { name: 'Endocrinologist', weight: 4 },
  { name: 'Neurologist', weight: 4 },
  { name: 'Urologist', weight: 2 },
  { name: 'Gastroenterologist', weight: 2 }
];

const cities = [
  'Mumbai, Maharashtra', 'Delhi, NCR', 'Bengaluru, Karnataka', 'Hyderabad, Telangana',
  'Chennai, Tamil Nadu', 'Kolkata, West Bengal', 'Pune, Maharashtra', 'Ahmedabad, Gujarat',
  'Jaipur, Rajasthan', 'Chandigarh, Punjab', 'Lucknow, Uttar Pradesh', 'Kochi, Kerala'
];

// Clinic name components
const clinicPrefix = ['Apex', 'MediCare', 'City', 'Lifeline', 'Prime', 'Care', 'Wellness', 'Aarogya', 'Cure', 'Healing', 'Divine'];
const clinicSuffix = ['Clinic', 'Hospital', 'Healthcare', 'Medical Center', 'Polyclinic'];

// Education bases
const mbbsBase = 'MBBS';
const msmdOptions = ['MD - General Medicine', 'MD - Dermatology', 'MS - Orthopaedics', 'MS - ENT', 'MD - Pediatrics', 'MS - Obstetrics & Gynaecology', 'DNB - Cardiology', 'MDS', 'MS - General Surgery', 'MD - Psychiatry', 'DM - Neurology'];

// Utility: get random element
const randElem = (arr) => arr[Math.floor(Math.random() * arr.length)];
// Utility: get random number in range
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
// Utility: randomly weighted specialty
const getWeightedSpecialty = () => {
  const totalWeight = specialties.reduce((acc, curr) => acc + curr.weight, 0);
  let r = Math.random() * totalWeight;
  for (let s of specialties) {
    if (r < s.weight) return s.name;
    r -= s.weight;
  }
  return specialties[0].name;
};

// Generate Time Slots for a day (mocking available/unavailable)
const generateTimeSlots = () => {
  const slots = [];
  const times = [
    '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
    '12:00 PM', '12:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM',
    '04:00 PM', '04:30 PM', '05:00 PM', '05:30 PM'
  ];
  
  times.forEach(time => {
    // 70% chance a slot is available
    slots.push({
      time: time,
      isAvailable: Math.random() > 0.3
    });
  });
  return slots;
};

const generateDoctors = (count = 5000) => {
  const doctors = [];
  for (let i = 1; i <= count; i++) {
    const specialty = getWeightedSpecialty();
    const city = randElem(cities);
    const exp = randInt(3, 40);
    const rating = (Math.random() * (5 - 3.5) + 3.5).toFixed(1);
    
    // Fees increase with experience and specific specialties
    let baseFee = 500;
    if (exp > 15) baseFee += 300;
    if (exp > 25) baseFee += 400;
    if (['Cardiologist', 'Neurologist', 'Endocrinologist'].includes(specialty)) baseFee += 500;
    const finalFee = Math.floor(baseFee / 100) * 100 + randElem([0, 50]); // like 500, 850, 1200

    const doc = {
      id: `doc_${i}`,
      name: `Dr. ${randElem(firstNames)} ${randElem(lastNames)}`,
      specialty: specialty,
      experience: exp,
      rating: parseFloat(rating),
      patientCount: randInt(exp * 50, exp * 400),
      consultationFee: finalFee,
      education: `${mbbsBase}, ${randElem(msmdOptions)}`,
      clinicName: `${randElem(clinicPrefix)} ${randElem(clinicSuffix)}`,
      address: `${randElem(['Sector ' + randInt(1, 50), 'Phase ' + randInt(1, 5), 'Road No. ' + randInt(1, 15)])}, ${city}`,
      successfulOperations: randInt(exp * 10, exp * 80),
      about: `Highly experienced ${specialty} with ${exp} years of clinical expertise. Committed to providing compassionate and comprehensive patient care.`,
      languages: ['English', 'Hindi', randElem(['Marathi', 'Tamil', 'Telugu', 'Bengali', 'Gujarati', 'Punjabi'])],
      slots: generateTimeSlots(),
      // Mock coordinates slightly randomized around India for map demo purpose
      location: {
        lat: 20.5937 + (Math.random() * 10 - 5), // Roughly India bounds
        lng: 78.9629 + (Math.random() * 10 - 5)
      }
    };
    doctors.push(doc);
  }
  return doctors;
};

console.log('Generating 5000 Indian doctors...');
const db = generateDoctors(5000);

// We save to the public directory so Vite can serve it statically for fast frontend fetching
const outputPath = path.join(process.cwd(), 'public', 'doctors.json');
fs.writeFileSync(outputPath, JSON.stringify(db, null, 2));

console.log(`Successfully generated 5000 doctors at ${outputPath}`);
