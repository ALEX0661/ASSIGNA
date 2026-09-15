const admin = require('firebase-admin');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf8');
const credString = env.split('FIREBASE_CREDENTIALS_JSON=')[1].trim();
const cred = JSON.parse(credString.slice(1, -1)); // remove outer quotes

admin.initializeApp({
  credential: admin.credential.cert(cred)
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('coordinator_schedules').get();
  snapshot.forEach(doc => {
    const data = doc.data();
    console.log(doc.id, {
      status: data.status,
      unfinalizedNote: data.unfinalizedNote,
      rejectionFeedback: data.rejectionFeedback
    });
  });
}

run().catch(console.error);
