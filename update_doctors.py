import json
import os

filepath = 'c:/Users/Shrish/Desktop/vibecode/medisync/public/doctors.json'

with open(filepath, 'r', encoding='utf-8') as f:
    data = json.load(f)

for doc in data:
    # Add password
    doc['password'] = 'gamma1202'
    
    # Rename Aadya to Stephen Strange
    if 'Aadya Rastogi' in doc['name']:
        doc['name'] = 'Dr. Stephen Strange'
        if doc['id'] == 'aadya_generalphysician':
            doc['id'] = 'dr001'
        else:
            doc['id'] = doc['id'] + '_strange'

with open(filepath, 'w', encoding='utf-8') as f:
    json.dump(data, f, indent=2)

print("Updated doctors.json successfully.")
