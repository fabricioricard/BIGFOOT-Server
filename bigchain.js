const https = require('https')
const http = require('http')

const BIGCHAIN_API_URL = process.env.BIGCHAIN_API_URL || 'http://localhost:4000'

// ========================
// Consulta o saldo de um endereço na BIGchain
// ========================
async function getBigchainBalance(address) {
  return new Promise((resolve, reject) => {
    const url = `${BIGCHAIN_API_URL}/balance?address=${address}`
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout: 8000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          // API retorna: { address: "big...", balance: 20.0 }
          resolve(json.balance ?? 0)
        } catch {
          reject(new Error('Invalid response from BIGchain API'))
        }
      })
    })

    req.on('error', (err) => reject(new Error(`BIGchain API unreachable: ${err.message}`)))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('BIGchain API timeout'))
    })
  })
}

// ========================
// Consulta o status da chain (para validar que o node está online)
// ========================
async function getBigchainStatus() {
  return new Promise((resolve, reject) => {
    const url = `${BIGCHAIN_API_URL}/status`
    const client = url.startsWith('https') ? https : http

    const req = client.get(url, { timeout: 8000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error('Invalid status response'))
        }
      })
    })

    req.on('error', (err) => reject(new Error(`BIGchain unreachable: ${err.message}`)))
    req.on('timeout', () => {
      req.destroy()
      reject(new Error('BIGchain timeout'))
    })
  })
}

module.exports = { getBigchainBalance, getBigchainStatus }