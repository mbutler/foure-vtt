import admin from 'firebase-admin'

let app
export function initFirebaseAdmin() {
  if (!app) {
    try {
      app = admin.initializeApp()
      console.log('Firebase Admin initialized')
    } catch (e) {
      if (!/already exists/.test(String(e))) {
        console.warn('Firebase Admin init error:', e)
      }
      app = admin.app()
    }
  }
  return app
}

export async function publishMatchState(matchID, G) {
  initFirebaseAdmin()
  const db = admin.firestore()
  const ref = db.doc(`matches/${matchID}`)
  const payload = { G, updatedAt: admin.firestore.FieldValue.serverTimestamp() }
  await ref.set(payload, { merge: true })
}


