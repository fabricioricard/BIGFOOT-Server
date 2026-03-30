const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js')

const {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
} = require('@solana/spl-token')

// ========================
// Conexão com a Solana
// ========================
function getConnection() {
  const network = process.env.SOLANA_NETWORK || 'devnet'
  const endpoint = network === 'mainnet-beta'
    ? 'https://api.mainnet-beta.solana.com'
    : clusterApiUrl('devnet')

  return new Connection(endpoint, 'confirmed')
}

// ========================
// Carrega o keypair da variável de ambiente
// A chave NUNCA fica em arquivo no repositório
// ========================
function getKeypair() {
  const raw = process.env.SOLANA_PRIVATE_KEY
  if (!raw) throw new Error('SOLANA_PRIVATE_KEY não configurada')

  try {
    const bytes = JSON.parse(raw)
    return Keypair.fromSecretKey(Uint8Array.from(bytes))
  } catch {
    throw new Error('SOLANA_PRIVATE_KEY inválida — deve ser um array JSON de bytes')
  }
}

// ========================
// Transfere BIG (SPL) para o endereço do usuário
// Retorna a assinatura da transação
// ========================
async function transferBIGToUser(destinationAddress, amount) {
  const connection = getConnection()
  const payer = getKeypair()
  const mintAddress = new PublicKey(process.env.BIG_TOKEN_MINT)

  // Valida endereço Solana
  let destinationPubkey
  try {
    destinationPubkey = new PublicKey(destinationAddress)
  } catch {
    throw new Error(`Endereço Solana inválido: ${destinationAddress}`)
  }

  // Consulta decimais do token
  const mintInfo = await getMint(connection, mintAddress)
  const decimals = mintInfo.decimals
  const amountInUnits = BigInt(Math.round(amount * Math.pow(10, decimals)))

  // Token account do remetente (payer)
  const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    payer.publicKey
  )

  // Token account do destinatário (cria se não existir)
  const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,           // payer paga a criação se necessário
    mintAddress,
    destinationPubkey
  )

  // Executa a transferência
  const signature = await transfer(
    connection,
    payer,
    sourceTokenAccount.address,
    destinationTokenAccount.address,
    payer.publicKey,
    amountInUnits
  )

  console.log(`✅ Transferência SPL: ${amount} BIG → ${destinationAddress}`)
  console.log(`🔗 Tx: ${signature}`)

  return signature
}

// ========================
// Consulta saldo BIG (SPL) de uma wallet
// ========================
async function getBIGBalance(walletAddress) {
  const connection = getConnection()
  const payer = getKeypair()
  const mintAddress = new PublicKey(process.env.BIG_TOKEN_MINT)

  try {
    const pubkey = new PublicKey(walletAddress)
    const tokenAccount = await getOrCreateAssociatedTokenAccount(
      connection,
      payer,
      mintAddress,
      pubkey
    )
    const mintInfo = await getMint(connection, mintAddress)
    const balance = Number(tokenAccount.amount) / Math.pow(10, mintInfo.decimals)
    return balance
  } catch {
    return 0
  }
}

// ========================
// Valida endereço Solana (Base58, 32-44 chars)
// ========================
function isValidSolanaAddress(address) {
  if (!address || address.length < 32 || address.length > 44) return false
  const BASE58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
  for (const c of address) {
    if (!BASE58.includes(c)) return false
  }
  try {
    new PublicKey(address)
    return true
  } catch {
    return false
  }
}

module.exports = { transferBIGToUser, getBIGBalance, isValidSolanaAddress, getConnection }