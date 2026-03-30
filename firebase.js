const admin = require('firebase-admin')

let db = null

function initFirebase() {
  if (admin.apps.length > 0) {
    db = admin.firestore()
    return db
  }

  try {
    // No Vercel: FIREBASE_SERVICE_ACCOUNT é a string JSON do serviceAccountKey
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    })

    db = admin.firestore()
    console.log('✅ Firebase conectado')
    return db
  } catch (err) {
    console.error('❌ Erro ao iniciar Firebase:', err.message)
    throw err
  }
}

function getDb() {
  if (!db) initFirebase()
  return db
}

module.exports = { initFirebase, getDb }