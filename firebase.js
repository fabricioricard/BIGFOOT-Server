const admin = require('firebase-admin');

let db   = null;
let auth = null;

function initFirebase() {
  if (admin.apps.length > 0) {
    db   = admin.firestore();
    auth = admin.auth();
    return db;
  }

  try {
    let serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    // Validação dos campos essenciais
    const requiredFields = ['project_id', 'client_email', 'private_key'];
    for (const field of requiredFields) {
      if (!serviceAccount[field]) {
        throw new Error(`Campo obrigatório ausente no serviceAccount: ${field}`);
      }
    }

    // Correção de quebras de linha na chave privada
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    db   = admin.firestore();
    auth = admin.auth();
    console.log('✅ Firebase conectado');
    return db;
  } catch (err) {
    console.error('❌ Erro ao iniciar Firebase:', err.message);
    throw err;
  }
}

function getDb() {
  if (!db) initFirebase();
  return db;
}

function getAuth() {
  if (!auth) initFirebase();
  return auth;
}

module.exports = { initFirebase, getDb, getAuth };