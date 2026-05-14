# 🌉 BIGchain Bridge API

API responsável pela **conversão de tokens BIG (BIGchain) para SPL (Solana)** e pela consulta de saldos e limites.  
É uma aplicação **Express.js** que interage com Firestore (via Firebase Admin) e com a blockchain Solana (via `@solana/web3.js` e `@solana/spl-token`).

---

## 🚀 Endpoints

### `GET /`
Rota de boas‑vindas com informação da rede e lista de endpoints.

**Resposta:**
```json
{
  "name": "BIGchain Bridge API",
  "version": "1.0.0",
  "status": "online",
  "network": "devnet",
  "endpoints": [...]
}

GET /health

Verifica o estado da API e se a rede BIGchain está acessível.

Resposta:
json

{
  "status": "ok",
  "timestamp": 1715459200000,
  "bigchain": "online",
  "network": "devnet"
}

POST /bridge/convert 🔐

Requer autenticação (Firebase ID Token no header Authorization: Bearer <token>).
Converte o saldo mensal de BIG do utilizador para tokens SPL na Solana.

Body:
json

{
  "bigAddress": "big{UID}",
  "solanaAddress": "6CSsCj...",
  "amount": 10.0
}

    O campo amount é validado e limitado pelo servidor (máximo definido em MAX_PER_USER_DAILY e saldo real no Firestore).

Resposta de sucesso:
json

{
  "success": true,
  "id": "conv_abc123",
  "amount": 10,
  "solanaAddress": "6CSsCj...",
  "txSignature": "5Xg...",
  "explorerUrl": "https://explorer.solana.com/tx/5Xg..."
}

GET /bridge/history/:bigAddress 🔐

Requer autenticação.
Retorna as últimas 50 conversões do utilizador.

Resposta:
json

{
  "conversions": [
    {
      "id": "conv_abc123",
      "bigAddress": "big...",
      "amount": 10,
      "status": "completed",
      "txSignature": "5Xg...",
      "createdAt": 1715459200000
    }
  ],
  "total": 1
}

GET /bridge/limits/:bigAddress 🔐

Requer autenticação.
Mostra o limite diário de conversão e o quanto já foi utilizado hoje.

Resposta:
json

{
  "bigAddress": "big...",
  "dailyLimit": 1000,
  "used": 10,
  "remaining": 990,
  "resetAt": "midnight UTC"
}

GET /balance/solana/:solanaAddress

Consulta o saldo de tokens BIG (SPL) de uma carteira Solana.
Não requer autenticação – é uma consulta pública.

Resposta:
json

{
  "solanaAddress": "6CSsCj...",
  "balance": 150.5
}

🔐 Autenticação e Segurança

A rota de conversão usa Firebase ID Token (obtido pelo frontend após login) para identificar o utilizador.

O bigAddress enviado pelo cliente é validado contra o UID do token, impedindo conversões em nome de terceiros.

O saldo mensal disponível é calculado pelo servidor (soma dos documentos em bigpoints_earnings), ignorando qualquer valor enviado no body.

Cada utilizador pode fazer apenas um claim por mês (controlado pela coleção claims no Firestore).

Rate limiting global de 100 req/min por IP para mitigar abusos.

CORS restrito ao domínio https://bigfootconnect.tech.

A chave privada do pool de liquidez Solana nunca é exposta – é carregada de variáveis de ambiente e usada apenas no backend.

A API está configurada para aceitar apenas pedidos do domínio oficial do BIGFOOT Connect (https://bigfootconnect.tech).

📜 Licença

Consulte o repositório principal BIGFOOT-Connect para mais informações.