require('dotenv').config()

const express = require('express')
const cors = require('cors')
const rateLimit = require('express-rate-limit')
const { initFirebase, getDb, getAuth } = require('./firebase')
const { getBigchainBalance, getBigchainStatus } = require('./bigchain')
const { transferBIGToUser, getBIGBalance, isValidSolanaAddress } = require('./solana')

const app = express()
const PORT = process.env.PORT || 3001

const MAX_PER_USER_DAILY = Number(process.env.MAX_PER_USER_DAILY) || 1000
const MIN_CONVERSION     = Number(process.env.MIN_CONVERSION) || 1

// ========================
// MIDDLEWARES
// ========================

app.use(cors())
app.use(express.json())

// Rate limit global: 30 requests por IP por minuto
app.use(rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many requests. Try again in 1 minute.' }
}))

// ========================
// INIT
// ========================

initFirebase()

// ========================
// AUTH MIDDLEWARE
// Verifica o Firebase ID Token enviado pelo frontend no header Authorization.
// Bloqueia qualquer requisição sem token válido.
// ========================

async function verifyFirebaseToken(req, res, next) {
  const authHeader = req.headers['authorization'] || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' })
  }

  try {
    const decoded = await getAuth().verifyIdToken(token)
    req.firebaseUser = decoded  // uid, email disponíveis nas rotas
    next()
  } catch (err) {
    console.error('❌ Invalid Firebase token:', err.message)
    return res.status(401).json({ error: 'Invalid or expired authorization token' })
  }
}

// ========================
// GET /
// ========================
app.get('/', (req, res) => {
  res.json({
    name:    'BIGchain Bridge API',
    version: '1.0.0',
    status:  'online',
    network: process.env.SOLANA_NETWORK || 'devnet',
    endpoints: [
      'GET  /health',
      'POST /bridge/convert',
      'GET  /bridge/history/:bigAddress',
      'GET  /bridge/limits/:bigAddress',
      'GET  /balance/solana/:solanaAddress',
    ]
  })
})

// ========================
// GET /health
// ========================
app.get('/health', async (req, res) => {
  try {
    const bigchain = await getBigchainStatus().catch(() => null)
    res.json({
      status: 'ok',
      timestamp: Date.now(),
      bigchain: bigchain ? 'online' : 'offline',
      network: process.env.SOLANA_NETWORK || 'devnet',
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// ========================
// POST /bridge/convert
// Protegido por verifyFirebaseToken — exige Bearer token válido no header.
//
// Body: {
//   bigAddress: "big{userId}",     // endereço sintético — validado contra o UID do token
//   solanaAddress: "6CSsCj...",    // endereço da Phantom do usuário
//   amount: 10.0                   // ignorado — servidor calcula o saldo real
// }
// ========================
app.post('/bridge/convert', verifyFirebaseToken, async (req, res) => {
  const { bigAddress, solanaAddress, amount } = req.body

  // --- Validações de entrada ---
  if (!bigAddress || !solanaAddress || !amount) {
    return res.status(400).json({ error: 'bigAddress, solanaAddress and amount are required' })
  }

  if (!bigAddress.startsWith('big') || bigAddress.length < 10) {
    return res.status(400).json({ error: 'Invalid BIGchain address' })
  }

  if (!isValidSolanaAddress(solanaAddress)) {
    return res.status(400).json({ error: 'Invalid Solana address' })
  }

  const parsedAmount = parseFloat(amount)
  if (isNaN(parsedAmount) || parsedAmount < MIN_CONVERSION) {
    return res.status(400).json({ error: `Minimum conversion is ${MIN_CONVERSION} BIG` })
  }

  try {
    const db = getDb()

    // ── PROTEÇÃO: usar o UID do token verificado, nunca confiar no body ──
    // O frontend envia bigAddress = "big{uid}" mas o servidor usa o UID
    // do token JWT verificado — assim ninguém pode forjar o userId.
    const userId = req.firebaseUser.uid

    // Garante que o bigAddress do body corresponde ao usuário autenticado
    const expectedBigAddress = `big${userId}`
    if (bigAddress !== expectedBigAddress) {
      console.warn(`⚠️  bigAddress mismatch: got ${bigAddress}, expected ${expectedBigAddress}`)
      return res.status(403).json({ error: 'bigAddress does not match authenticated user' })
    }

    const currentMonth = new Date().toISOString().slice(0, 7) // "2025-06"

    // ── PROTEÇÃO: verificar se este usuário já fez claim este mês ──
    const claimRef = db.collection('users').doc(userId).collection('claims').doc(currentMonth)
    const claimSnap = await claimRef.get()

    if (claimSnap.exists) {
      return res.status(429).json({
        error: 'Monthly claim already used. Next claim available on the 1st of next month.',
        nextClaimMonth: (() => {
          const d = new Date()
          d.setMonth(d.getMonth() + 1, 1)
          return d.toISOString().slice(0, 7)
        })(),
      })
    }

    // ── PROTEÇÃO: calcular saldo real no Firestore, ignorar o amount do frontend ──
    const earningsSnap = await db
      .collection('users')
      .doc(userId)
      .collection('bigpoints_earnings')
      .get()

    let realMonthlyBalance = 0
    earningsSnap.forEach(doc => {
      if (doc.id.startsWith(currentMonth)) {
        realMonthlyBalance += doc.data().bigpoints || 0
      }
    })

    const safeAmount = Math.min(Math.floor(realMonthlyBalance), MAX_PER_USER_DAILY)

    if (safeAmount < MIN_CONVERSION) {
      return res.status(400).json({
        error: `Insufficient monthly balance. Available: ${realMonthlyBalance.toFixed(2)} BIG`,
        available: realMonthlyBalance,
      })
    }

    console.log(`📋 Claim: ${safeAmount} BIG | user: ${userId} (${req.firebaseUser.email}) → ${solanaAddress}`)

    // --- Verifica se não há conversão pendente para este usuário ---
    const pendingSnap = await db.collection('conversions')
      .where('bigAddress', '==', bigAddress)
      .where('status', '==', 'pending')
      .limit(1)
      .get()

    if (!pendingSnap.empty) {
      return res.status(409).json({ error: 'You already have a pending conversion. Wait for it to complete.' })
    }

    // --- Cria registro da conversão ---
    const convRef = db.collection('conversions').doc()
    await convRef.set({
      id:            convRef.id,
      bigAddress,
      solanaAddress,
      amount:        safeAmount,
      status:        'pending',
      userId,
      month:         currentMonth,
      createdAt:     Date.now(),
      completedAt:   null,
      txSignature:   null,
      error:         null,
    })

    // --- Executa a transferência na Solana ---
    let txSignature
    try {
      txSignature = await transferBIGToUser(solanaAddress, safeAmount)
    } catch (solanaErr) {
      await convRef.update({ status: 'failed', error: solanaErr.message })
      console.error('❌ Solana transfer failed:', solanaErr.message)
      return res.status(502).json({ error: `Solana transfer failed: ${solanaErr.message}` })
    }

    // --- Atualiza conversão como concluída ---
    await convRef.update({
      status:      'completed',
      txSignature,
      completedAt: Date.now(),
    })

    // --- Registra o claim mensal (fonte de verdade no servidor) ---
    await claimRef.set({
      amount:        safeAmount,
      solanaAddress,
      txSignature,
      conversionId:  convRef.id,
      claimedAt:     Date.now(),
    })

    // --- Atualiza limite diário ---
    const today = new Date().toISOString().split('T')[0]
    const dailyRef = db.collection('daily_conversions').doc(`${bigAddress}_${today}`)
    const dailyDoc = await dailyRef.get()
    const dailyTotal = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0
    await dailyRef.set(
      { total: dailyTotal + safeAmount, updatedAt: Date.now() },
      { merge: true }
    )

    console.log(`✅ Claim completed: ${safeAmount} BIG → ${solanaAddress} | tx: ${txSignature}`)

    return res.json({
      success:      true,
      id:           convRef.id,
      amount:       safeAmount,
      solanaAddress,
      txSignature,
      explorerUrl:  `https://explorer.solana.com/tx/${txSignature}`,
    })

  } catch (err) {
    console.error('❌ Unexpected error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
})

// ========================
// GET /bridge/history/:bigAddress
// ========================
app.get('/bridge/history/:bigAddress', async (req, res) => {
  const { bigAddress } = req.params

  if (!bigAddress.startsWith('big')) {
    return res.status(400).json({ error: 'Invalid BIGchain address' })
  }

  try {
    const db = getDb()
    const snap = await db.collection('conversions')
      .where('bigAddress', '==', bigAddress)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const conversions = snap.docs.map(doc => doc.data())
    return res.json({ conversions, total: conversions.length })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ========================
// GET /bridge/limits/:bigAddress
// ========================
app.get('/bridge/limits/:bigAddress', async (req, res) => {
  const { bigAddress } = req.params

  try {
    const db = getDb()
    const today = new Date().toISOString().split('T')[0]
    const dailyDoc = await db.collection('daily_conversions')
      .doc(`${bigAddress}_${today}`)
      .get()

    const used = dailyDoc.exists ? (dailyDoc.data().total || 0) : 0
    const remaining = Math.max(0, MAX_PER_USER_DAILY - used)

    return res.json({
      bigAddress,
      dailyLimit:  MAX_PER_USER_DAILY,
      used,
      remaining,
      resetAt:     'midnight UTC',
    })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ========================
// GET /balance/solana/:solanaAddress
// ========================
app.get('/balance/solana/:solanaAddress', async (req, res) => {
  const { solanaAddress } = req.params

  if (!isValidSolanaAddress(solanaAddress)) {
    return res.status(400).json({ error: 'Invalid Solana address' })
  }

  try {
    const balance = await getBIGBalance(solanaAddress)
    return res.json({ solanaAddress, balance })
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
})

// ========================
// START
// ========================
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log(`🚀 BIGchain Bridge running on port ${PORT}`)
    console.log(`🌐 Network: ${process.env.SOLANA_NETWORK || 'devnet'}`)
    console.log(`📊 Daily limit: ${MAX_PER_USER_DAILY} BIG/user`)
  })
}

module.exports = app
