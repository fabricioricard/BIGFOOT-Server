const {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
} = require('@solana/web3.js');

const {
  getOrCreateAssociatedTokenAccount,
  transfer,
  getMint,
  getAccount,
} = require('@solana/spl-token');

// ========================
// Conexão com a Solana
// ========================
function getConnection() {
  const network = process.env.SOLANA_NETWORK || 'devnet';
  const endpoint = process.env.SOLANA_RPC_URL || (
    network === 'mainnet-beta'
      ? 'https://api.mainnet-beta.solana.com'
      : clusterApiUrl('devnet')
  );

  return new Connection(endpoint, 'confirmed');
}

// ========================
// Carrega o keypair da variável de ambiente
// A chave NUNCA fica em arquivo no repositório
// ========================
function getKeypair() {
  const raw = process.env.SOLANA_PRIVATE_KEY;
  if (!raw) throw new Error('SOLANA_PRIVATE_KEY não configurada');

  try {
    const bytes = JSON.parse(raw);
    return Keypair.fromSecretKey(Uint8Array.from(bytes));
  } catch {
    throw new Error('SOLANA_PRIVATE_KEY inválida — deve ser um array JSON de bytes');
  }
}

// ========================
// Mascara assinatura para logs
// ========================
function maskSignature(sig) {
  if (!sig || sig.length < 16) return sig;
  return sig.slice(0, 8) + '…' + sig.slice(-8);
}

// ========================
// Transfere BIG (SPL) para o endereço do usuário
// Retorna a assinatura da transação
// ========================
async function transferBIGToUser(destinationAddress, amount) {
  // Validação do valor
  if (typeof amount !== 'number' || amount <= 0 || isNaN(amount)) {
    throw new Error(`Valor inválido: ${amount}`);
  }

  const connection = getConnection();
  const payer = getKeypair();
  const mintAddress = new PublicKey(process.env.BIG_TOKEN_MINT);

  // Valida endereço Solana
  let destinationPubkey;
  try {
    destinationPubkey = new PublicKey(destinationAddress);
  } catch {
    throw new Error(`Endereço Solana inválido: ${destinationAddress}`);
  }

  // Consulta decimais do token
  const mintInfo = await getMint(connection, mintAddress);
  const decimals = mintInfo.decimals;
  const amountInUnits = BigInt(Math.round(amount * Math.pow(10, decimals)));

  // Token account do remetente (payer)
  const sourceTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    payer.publicKey
  );

  // Token account do destinatário (cria se não existir)
  const destinationTokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    destinationPubkey
  );

  // Executa a transferência
  const signature = await transfer(
    connection,
    payer,
    sourceTokenAccount.address,
    destinationTokenAccount.address,
    payer.publicKey,
    amountInUnits
  );

  // Log seguro: valor público, assinatura mascarada
  console.log(`✅ Transferência SPL: ${amount} BIG → ${destinationAddress}`);
  console.log(`🔗 Tx: ${maskSignature(signature)}`);

  return signature;
}

// ========================
// Consulta saldo BIG (SPL) de uma wallet
// Agora sem chave privada — apenas consulta pública
// ========================
async function getBIGBalance(walletAddress) {
  const connection = getConnection();
  const mintAddress = new PublicKey(process.env.BIG_TOKEN_MINT);

  try {
    const pubkey = new PublicKey(walletAddress);

    // Encontrar a token account associada (sem usar chave privada)
    const accounts = await connection.getTokenAccountsByOwner(pubkey, {
      mint: mintAddress,
    });

    if (accounts.value.length === 0) {
      return 0; // Sem token account associada
    }

    // Pega a primeira token account (normalmente só uma por mint)
    const tokenAccountInfo = await getAccount(connection, accounts.value[0].pubkey);
    const mintInfo = await getMint(connection, mintAddress);
    const balance = Number(tokenAccountInfo.amount) / Math.pow(10, mintInfo.decimals);
    return balance;
  } catch (err) {
    console.error(`Erro ao consultar saldo de ${walletAddress}:`, err.message);
    return 0;
  }
}

// ========================
// Valida endereço Solana (Base58, 32-44 chars)
// ========================
function isValidSolanaAddress(address) {
  if (!address || address.length < 32 || address.length > 44) return false;
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

module.exports = { transferBIGToUser, getBIGBalance, isValidSolanaAddress, getConnection };