const https = require('https')
const http = require('http')

const PEERS_API = 'https://api.bigfootconnect.tech/api/peers/list'

// ========================
// Busca lista de nodes ativos na API pública
// ========================
async function getActivePeers() {
  return new Promise((resolve, reject) => {
    https.get(PEERS_API, { timeout: 8000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          const peers = (json.peers || []).map(p => p.address)
          resolve(peers)
        } catch {
          reject(new Error('Failed to parse peers list'))
        }
      })
    }).on('error', reject)
      .on('timeout', () => reject(new Error('Peers API timeout')))
  })
}

// ========================
// Tenta chamar um endpoint em um node específico
// Retorna o resultado ou lança erro
// ========================
async function fetchFromNode(nodeAddress, path) {
  // Normaliza o endereço — pode vir como "[ipv6]:port" ou "ip:port"
  let baseUrl
  if (nodeAddress.startsWith('http')) {
    baseUrl = nodeAddress
  } else {
    // Converte endereço P2P (porta 3000) para API HTTP (porta 4000)
    const p2pPortMatch = nodeAddress.match(/:(\d+)$/)
    if (p2pPortMatch) {
      const p2pPort = parseInt(p2pPortMatch[1])
      const apiPort = p2pPort + 1000 // 3000 → 4000, 3001 → 4001
      const host = nodeAddress.slice(0, nodeAddress.lastIndexOf(':'))
      // Remove brackets do IPv6 se necessário
      const cleanHost = host.replace(/^\[/, '').replace(/\]$/, '')
      // IPv6 precisa de brackets na URL
      const urlHost = cleanHost.includes(':') ? `[${cleanHost}]` : cleanHost
      baseUrl = `http://${urlHost}:${apiPort}`
    } else {
      baseUrl = `http://${nodeAddress}:4000`
    }
  }

  const url = `${baseUrl}${path}`
  const client = url.startsWith('https') ? https : http

  return new Promise((resolve, reject) => {
    const req = client.get(url, { timeout: 5000 }, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch {
          reject(new Error(`Invalid JSON from ${url}`))
        }
      })
    })
    req.on('error', reject)
    req.on('timeout', () => {
      req.destroy()
      reject(new Error(`Timeout: ${url}`))
    })
  })
}

// ========================
// Consulta o saldo de um endereço BIGchain
// Tenta múltiplos nodes até encontrar um que responda
// ========================
async function getBigchainBalance(address) {
  const peers = await getActivePeers()

  if (peers.length === 0) {
    throw new Error('No active BIGchain nodes found')
  }

  // Embaralha para distribuir a carga entre os nodes
  const shuffled = peers.sort(() => Math.random() - 0.5)

  const errors = []
  for (const peer of shuffled) {
    try {
      const result = await fetchFromNode(peer, `/balance?address=${address}`)
      if (typeof result.balance === 'number') {
        console.log(`✅ Balance from node ${peer}: ${result.balance} BIG`)
        return result.balance
      }
    } catch (err) {
      errors.push(`${peer}: ${err.message}`)
    }
  }

  throw new Error(`All nodes failed:\n${errors.join('\n')}`)
}

// ========================
// Consulta o status de um node (verifica se está online)
// ========================
async function getBigchainStatus() {
  const peers = await getActivePeers()

  if (peers.length === 0) {
    return { online: false, peers: 0, message: 'No nodes found' }
  }

  for (const peer of peers) {
    try {
      const status = await fetchFromNode(peer, '/status')
      return {
        online:  true,
        node:    peer,
        blocks:  status.blocks,
        peers:   status.peers,
        supply:  status.supply,
      }
    } catch {
      continue
    }
  }

  return { online: false, peers: peers.length, message: 'All nodes unreachable' }
}

module.exports = { getBigchainBalance, getBigchainStatus, getActivePeers }