const https = require('https');
const http = require('http');

const PEERS_API = 'https://api.bigfootconnect.tech/api/peers/list';

// ========================
// VALIDAÇÕES DE SEGURANÇA
// ========================

// Verifica se é um IP público válido (não privado, não loopback)
const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/;
const ipv6Regex = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

function isValidPublicIP(address) {
  if (!ipv4Regex.test(address) && !ipv6Regex.test(address)) return false;

  if (ipv4Regex.test(address)) {
    const parts = address.split('.').map(Number);
    // Bloquear loopback, APIPA, privado e multicast
    if (parts[0] === 127) return false;                 // 127.x.x.x
    if (parts[0] === 10) return false;                  // 10.x.x.x
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false; // 172.16-31.x.x
    if (parts[0] === 192 && parts[1] === 168) return false; // 192.168.x.x
    if (parts[0] === 0) return false;                   // 0.x.x.x
    if (parts[0] >= 224) return false;                  // Multicast/reservado
    return true;
  }

  // IPv6 básico
  const normalized = address.toLowerCase();
  if (normalized === '::1') return false;               // loopback
  if (normalized.startsWith('fe80:')) return false;     // link-local
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return false; // ULA (privado)
  return true;
}

// Sanitiza a lista de peers vinda da API
function SanitizePeersList(peers) {
  return peers
    .map(p => p.address)
    .filter(addr => {
      // Deve conter "host:port"
      const lastColon = addr.lastIndexOf(':');
      if (lastColon === -1) return false;
      const host = addr.substring(0, lastColon).replace(/^\[/, '').replace(/\]$/, '');
      const port = parseInt(addr.substring(lastColon + 1));
      return isValidPublicIP(host) && !isNaN(port) && port > 0 && port <= 65535;
    });
}

// ========================
// Busca lista de nodes ativos na API pública
// ========================
async function getActivePeers() {
  return new Promise((resolve, reject) => {
    https.get(PEERS_API, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const rawPeers = json.peers || [];
          const validPeers = SanitizePeersList(rawPeers);
          console.log(`[BIGCHAIN] ${validPeers.length} peers válidos (de ${rawPeers.length} recebidos)`);
          resolve(validPeers.map(p => p.address));
        } catch {
          reject(new Error('Failed to parse peers list'));
        }
      });
    }).on('error', reject)
      .on('timeout', () => reject(new Error('Peers API timeout')));
  });
}

// ========================
// Tenta chamar um endpoint em um node específico
// Retorna o resultado ou lança erro
// ========================
async function fetchFromNode(nodeAddress, path) {
  let baseUrl;
  if (nodeAddress.startsWith('http')) {
    baseUrl = nodeAddress;
  } else {
    const p2pPortMatch = nodeAddress.match(/:(\d+)$/);
    if (p2pPortMatch) {
      const p2pPort = parseInt(p2pPortMatch[1]);
      const apiPort = p2pPort + 1000;
      const host = nodeAddress.slice(0, nodeAddress.lastIndexOf(':'));
      const cleanHost = host.replace(/^\[/, '').replace(/\]$/, '');
      const urlHost = cleanHost.includes(':') ? `[${cleanHost}]` : cleanHost;
      baseUrl = `http://${urlHost}:${apiPort}`;
    } else {
      baseUrl = `http://${nodeAddress}:4000`;
    }
  }

  const url = `${baseUrl}${path}`;
  const client = url.startsWith('https') ? https : http;

  return new Promise((resolve, reject) => {
    const req = client.get(url, { timeout: 5000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error(`Invalid JSON from ${url}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout: ${url}`));
    });
  });
}

// ========================
// Consulta o saldo de um endereço BIGchain
// Tenta múltiplos nodes até encontrar um que responda
// ========================
async function getBigchainBalance(address) {
  const peers = await getActivePeers();
  if (peers.length === 0) throw new Error('No active BIGchain nodes found');

  const shuffled = peers.sort(() => Math.random() - 0.5);
  const errors = [];
  for (const peer of shuffled) {
    try {
      const result = await fetchFromNode(peer, `/balance?address=${address}`);
      if (typeof result.balance === 'number') {
        console.log(`✅ Balance from node ${peer}: ${result.balance} BIG`);
        return result.balance;
      }
    } catch (err) {
      errors.push(`${peer}: ${err.message}`);
    }
  }
  throw new Error(`All nodes failed:\n${errors.join('\n')}`);
}

// ========================
// Consulta o status de um node (verifica se está online)
// ========================
async function getBigchainStatus() {
  const peers = await getActivePeers();
  if (peers.length === 0) return { online: false, peers: 0, message: 'No nodes found' };

  for (const peer of peers) {
    try {
      const status = await fetchFromNode(peer, '/status');
      return {
        online:  true,
        node:    peer,
        blocks:  status.blocks,
        peers:   status.peers,
        supply:  status.supply,
      };
    } catch {
      continue;
    }
  }
  return { online: false, peers: peers.length, message: 'All nodes unreachable' };
}

module.exports = { getBigchainBalance, getBigchainStatus, getActivePeers };