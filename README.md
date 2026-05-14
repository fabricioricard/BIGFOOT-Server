# 🌉 BIGchain Bridge API

> API de conversão de tokens BIG (BIGchain) para SPL (Solana) com gestão de saldos, limites e histórico de transações

[![License: Proprietary](https://img.shields.io/badge/license-Proprietary-red)](./LICENSE)
[![Node.js: 18+](https://img.shields.io/badge/node.js-18+-green)](https://nodejs.org)
[![Express.js](https://img.shields.io/badge/express-4.x-black)](https://expressjs.com)
[![Solana](https://img.shields.io/badge/solana-devnet-purple)](https://solana.com)

## 📋 Índice

- [Sobre](#sobre)
- [Funcionalidades](#funcionalidades)
- [Stack Tecnológico](#stack-tecnológico)
- [Instalação](#instalação)
- [Endpoints](#endpoints)
- [Autenticação](#autenticação)
- [Rate Limiting](#rate-limiting)
- [Segurança](#segurança)
- [Configuração](#configuração)
- [Desenvolvimento](#desenvolvimento)
- [Licença](#licença)

---

## Sobre

**BIGchain Bridge API** é uma API especializada em conversão de tokens entre duas blockchains:

- **BIG (BIGchain)** — Tokens minerados pela comunidade BIGFOOT Connect
- **SPL (Solana)** — Tokens equivalentes na blockchain Solana

A API gerencia:
- ✅ Conversão segura de tokens
- ✅ Histórico de transações
- ✅ Limites diários por utilizador
- ✅ Validação de autenticação Firebase
- ✅ Consulta de saldos em tempo real

Construída com **Express.js**, **Firebase** e **Solana Web3.js**.

---

## ✨ Funcionalidades

### 🔄 Conversão de Tokens

- Converte automaticamente BIG Points para tokens SPL na Solana
- Validação de saldos em tempo real
- Limite diário por utilizador configurável
- Apenas 1 conversão por utilizador por mês
- Confirmação em blockchain e assinatura de transação

### 📊 Histórico de Transações

- Registo completo de todas as conversões
- Últimas 50 transações por utilizador
- Informações detalhadas: ID, montante, status, assinatura TX
- Timestamps precisos
- Filtros por utilizador

### 📈 Gestão de Limites

- Limite diário configurável por utilizador
- Visualização de limite disponível
- Contador de utilização diária
- Reset automático à meia-noite UTC
- Avisos de limite próximo

### 🔍 Consulta de Saldos

- Saldo de tokens SPL em carteiras Solana
- Consultas públicas (sem autenticação)
- Verificação em tempo real
- Suporte a múltiplos tokens SPL

### 🛡️ Segurança Multi-Camada

- Validação Firebase ID Token
- Prevenção de conversão cruzada (XSS/CSRF)
- Rate limiting global
- CORS restrito
- Chave privada segura (variáveis de ambiente)

---

## 🧱 Stack Tecnológico

| Componente | Tecnologia |
|-----------|-----------|
| **Runtime** | Node.js 18+ |
| **Framework** | Express.js 4.x |
| **Base de Dados** | Firebase Firestore |
| **Autenticação** | Firebase Admin SDK |
| **Blockchain BIG** | BIGchain RPC |
| **Blockchain SOL** | Solana Web3.js |
| **Tokens SPL** | @solana/spl-token |
| **HTTP Client** | axios / node-fetch |
| **Variáveis Env** | dotenv |

---

## 🚀 Instalação

### Pré-requisitos

- **Node.js** ≥ 18 LTS
- **npm** ≥ 8
- Conta Firebase com Firestore ativado
- Carteira Solana com liquidez (devnet)

### 1. Clone o repositório

```bash
git clone https://github.com/bigfoot-connect/bigchain-bridge-api.git
cd bigchain-bridge-api
```

### 2. Instale dependências

```bash
npm install
```

### 3. Configure variáveis de ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Servidor
PORT=3001
NODE_ENV=production
HOST=0.0.0.0

# Firebase
FIREBASE_PROJECT_ID=seu-projeto-id
FIREBASE_PRIVATE_KEY=sua-chave-privada
FIREBASE_CLIENT_EMAIL=seu-email-firebase

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_POOL_PRIVATE_KEY=sua-chave-privada-base58
SOLANA_POOL_ADDRESS=sua-carteira-pool
SPL_TOKEN_MINT=seu-token-mint

# Limites
MAX_PER_USER_DAILY=1000
MAX_PER_USER_MONTHLY=50000
GLOBAL_RATE_LIMIT=100

# Domínio
ALLOWED_ORIGIN=https://bigfootconnect.tech
```

### 4. Inicie o servidor

```bash
# Desenvolvimento
npm run dev

# Produção
npm start
```

A API estará disponível em `http://localhost:3001`

---

## 📡 Endpoints

### 1. GET `/`

Rota de boas-vindas com informações da API.

**Autenticação:** Nenhuma  
**Rate Limit:** Nenhum

#### Resposta

```json
{
  "name": "BIGchain Bridge API",
  "version": "1.0.0",
  "status": "online",
  "network": "devnet",
  "endpoints": [
    "GET /",
    "GET /health",
    "POST /bridge/convert",
    "GET /bridge/history/:bigAddress",
    "GET /bridge/limits/:bigAddress",
    "GET /balance/solana/:solanaAddress"
  ]
}
```

---

### 2. GET `/health`

Verifica o estado da API e conectividade com a blockchain.

**Autenticação:** Nenhuma  
**Rate Limit:** Nenhum

#### Resposta

```json
{
  "status": "ok",
  "timestamp": 1715459200000,
  "bigchain": "online",
  "network": "devnet"
}
```

| Campo | Descrição |
|-------|-----------|
| `status` | Estado da API (`ok` ou `error`) |
| `timestamp` | Unix timestamp da verificação |
| `bigchain` | Estado da conexão com BIGchain |
| `network` | Rede atual (devnet/mainnet) |

---

### 3. POST `/bridge/convert`

🔐 **Requer Autenticação**

Converte BIG Points para tokens SPL na Solana.

**Autenticação:** Firebase ID Token (header `Authorization: Bearer <token>`)  
**Rate Limit:** 1 conversão por utilizador por mês  
**Limite Diário:** Configurável (padrão: 1000 BIG)

#### Parâmetros

| Campo | Tipo | Obrigatório | Descrição |
|-------|------|:----------:|-----------|
| `bigAddress` | string | ✅ | Endereço BIG do utilizador (`big{UID}`) |
| `solanaAddress` | string | ✅ | Endereço Solana de destino |
| `amount` | number | ✅ | Montante a converter (validado no servidor) |

#### Validações

- ✅ Token Firebase válido e não expirado
- ✅ `bigAddress` coincide com UID do token
- ✅ `amount` ≤ saldo disponível no Firestore
- ✅ `amount` ≤ limite diário restante
- ✅ Não existe conversão anterior no mês atual
- ✅ `solanaAddress` é um endereço Solana válido

#### Resposta (Sucesso)

```json
{
  "success": true,
  "id": "conv_abc123xyz",
  "amount": 10.0,
  "solanaAddress": "6CSsCj5N...",
  "txSignature": "5Xg8J...",
  "explorerUrl": "https://explorer.solana.com/tx/5Xg8J...",
  "createdAt": 1715459200000
}
```

#### Respostas de Erro

| Status | Código | Descrição |
|--------|--------|-----------|
| `400` | `INVALID_TOKEN` | Token Firebase inválido |
| `401` | `UNAUTHORIZED` | Utilizador não autenticado |
| `403` | `ADDRESS_MISMATCH` | bigAddress não coincide com UID |
| `403` | `ALREADY_CONVERTED` | Já existe conversão este mês |
| `422` | `INSUFFICIENT_BALANCE` | Saldo insuficiente |
| `422` | `LIMIT_EXCEEDED` | Limite diário excedido |
| `500` | `BLOCKCHAIN_ERROR` | Erro ao confirmar transação |

#### Exemplo de Requisição

```bash
curl -X POST http://localhost:3001/bridge/convert \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{
    "bigAddress": "big_user123",
    "solanaAddress": "6CSsCj5N4Y7X2L9m5Z8k",
    "amount": 10.0
  }'
```

---

### 4. GET `/bridge/history/:bigAddress`

🔐 **Requer Autenticação**

Retorna as últimas 50 conversões do utilizador.

**Autenticação:** Firebase ID Token  
**Rate Limit:** 30 req/min por utilizador  
**Parâmetros:** `bigAddress` (path parameter)

#### Respostas

```json
{
  "success": true,
  "bigAddress": "big_user123",
  "count": 1,
  "conversions": [
    {
      "id": "conv_abc123",
      "bigAddress": "big_user123",
      "solanaAddress": "6CSsCj5N...",
      "amount": 10.0,
      "status": "completed",
      "txSignature": "5Xg8J...",
      "createdAt": 1715459200000,
      "explorerUrl": "https://explorer.solana.com/tx/5Xg8J..."
    }
  ],
  "total": 1
}
```

| Campo | Descrição |
|-------|-----------|
| `id` | Identificador único da conversão |
| `status` | Estado: `pending`, `completed`, `failed` |
| `txSignature` | Assinatura da transação Solana |
| `createdAt` | Timestamp Unix de criação |

#### Exemplo de Requisição

```bash
curl -X GET http://localhost:3001/bridge/history/big_user123 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

---

### 5. GET `/bridge/limits/:bigAddress`

🔐 **Requer Autenticação**

Mostra o limite diário de conversão e utilização atual.

**Autenticação:** Firebase ID Token  
**Rate Limit:** 60 req/min por utilizador

#### Resposta

```json
{
  "success": true,
  "bigAddress": "big_user123",
  "dailyLimit": 1000,
  "used": 10,
  "remaining": 990,
  "resetAt": "2026-05-14T00:00:00Z",
  "monthlyUsed": 10,
  "monthlyLimit": 50000
}
```

| Campo | Descrição |
|-------|-----------|
| `dailyLimit` | Limite diário em BIG |
| `used` | Montante convertido hoje |
| `remaining` | Disponível para converter hoje |
| `resetAt` | Timestamp do reset (meia-noite UTC) |
| `monthlyUsed` | Montante convertido este mês |
| `monthlyLimit` | Limite mensal em BIG |

#### Exemplo de Requisição

```bash
curl -X GET http://localhost:3001/bridge/limits/big_user123 \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..."
```

---

### 6. GET `/balance/solana/:solanaAddress`

Consulta o saldo de tokens SPL em uma carteira Solana (público).

**Autenticação:** Nenhuma  
**Rate Limit:** 60 req/min por IP

#### Parâmetros

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `solanaAddress` | string (path) | Endereço Solana público |

#### Resposta

```json
{
  "success": true,
  "solanaAddress": "6CSsCj5N4Y7X2L9m5Z8k",
  "balance": 150.5,
  "token": "BIG",
  "decimals": 6
}
```

#### Respostas de Erro

| Status | Descrição |
|--------|-----------|
| `400` | Endereço Solana inválido |
| `404` | Conta não encontrada |
| `500` | Erro ao consultar RPC |

#### Exemplo de Requisição

```bash
curl -X GET http://localhost:3001/balance/solana/6CSsCj5N4Y7X2L9m5Z8k
```

---

## 🔐 Autenticação

### Firebase ID Token

Todos os endpoints com 🔐 requerem autenticação:

**Header:**
```
Authorization: Bearer <firebase-id-token>
```

**Obtendo o token (no frontend):**

```javascript
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

const auth = getAuth();
const { user } = await signInWithEmailAndPassword(auth, email, password);
const idToken = await user.getIdToken();

// Usar no header Authorization
```

### Validações

- ✅ Token é validado com Firebase Admin SDK
- ✅ `bigAddress` é verificado contra o UID do token
- ✅ Previne conversão cruzada (um utilizador não pode converter para outro)
- ✅ Cada operação é registada com o UID autenticado

### Fluxo Seguro

```
Cliente                    BIGchain Bridge API
   |                              |
   |-- Firebase Login ----------->|
   |<-- ID Token ------------------|
   |                              |
   |-- POST /bridge/convert ----->|
   |    + Authorization: Bearer   |
   |                              |
   |    Validar token + UID       |
   |    Verificar saldo Firestore |
   |    Enviar transação Solana   |
   |<-- Resposta com TX -----------|
```

---

## 🚦 Rate Limiting

A API implementa rate limiting multi-camada para proteger contra abuso:

| Endpoint | Limite | Escopo |
|----------|--------|--------|
| `/bridge/convert` | 1/mês | Por utilizador |
| `/bridge/history/:bigAddress` | 30/min | Por utilizador |
| `/bridge/limits/:bigAddress` | 60/min | Por utilizador |
| `/balance/solana/:solanaAddress` | 60/min | Por IP |
| **Global** | 100/min | Por IP |

**Resposta ao exceder limite:**

```json
{
  "success": false,
  "error": "RATE_LIMIT_EXCEEDED",
  "retryAfter": 30
}
```

Headers de resposta:
- `X-RateLimit-Limit`: Limite máximo
- `X-RateLimit-Remaining`: Requisições restantes
- `X-RateLimit-Reset`: Unix timestamp do reset

---

## 🔐 Segurança

### Context de Segurança

✅ **Context Isolation**
- Chave privada da pool de liquidez carregada do `.env`
- Nunca exposta em logs ou respostas
- Usada apenas para assinar transações

✅ **Firebase Admin SDK**
- Validação segura de tokens
- Comunicação autenticada com Firestore
- Revogação de tokens suportada

✅ **CORS Restrito**
- Apenas `https://bigfootconnect.tech` autorizado
- Headers adequados em todas as respostas
- Preflight requests validadas

✅ **Validação de Input**
- Endereços Solana e BIG validados
- Montantes verificados contra saldos reais
- Rate limiting por IP e UID

### Proteção contra Ataques

| Ameaça | Proteção |
|--------|----------|
| **XSS (Cross-Site Scripting)** | CORS restrito, sem HTML rendering |
| **CSRF (Cross-Site Request Forgery)** | Token Firebase obrigatório |
| **Brute Force** | Rate limiting global 100/min |
| **Man-in-the-Middle** | HTTPS obrigatório em produção |
| **Token Hijacking** | Verificação de UID contra token |
| **Double Spending** | Validação de saldo em tempo real |

### Dados Sensíveis

❌ Nunca expostos:
- Chave privada do pool
- Chaves privadas de utilizadores
- Tokens Firebase completos
- Emails em logs

✅ Mascarados em logs:
- Endereços truncados: `6CSsCj...`
- UIDs primeiros 6 caracteres: `usr_12...`
- Montantes não sensíveis

---

## ⚙️ Configuração

### Variáveis de Ambiente

```env
# Servidor
PORT=3001                              # Porta padrão
NODE_ENV=production                    # development/production
HOST=0.0.0.0                          # Host para bind

# Firebase
FIREBASE_PROJECT_ID=meu-projeto        # ID do projeto Firebase
FIREBASE_PRIVATE_KEY=-----BEGIN...     # Chave privada JSON
FIREBASE_CLIENT_EMAIL=...@firebase     # Email de serviço

# Solana
SOLANA_RPC_URL=https://api.devnet...   # RPC endpoint
SOLANA_POOL_PRIVATE_KEY=...            # Chave Base58 (signers)
SOLANA_POOL_ADDRESS=...                # Endereço público da pool
SPL_TOKEN_MINT=...                     # Mint do token BIG SPL

# Limites
MAX_PER_USER_DAILY=1000                # Limite diário por utilizador
MAX_PER_USER_MONTHLY=50000             # Limite mensal por utilizador
GLOBAL_RATE_LIMIT=100                  # Requisições/min global

# CORS
ALLOWED_ORIGIN=https://bigfootconnect.tech
```

---

## 🛠️ Desenvolvimento

### Estrutura de Pastas

```
bigchain-bridge-api/
├── src/
│   ├── main.js              # Entry point
│   ├── server.js            # Configuração Express
│   ├── routes/
│   │   ├── index.js         # GET /
│   │   ├── health.js        # GET /health
│   │   ├── bridge.js        # /bridge/* endpoints
│   │   └── balance.js       # /balance/* endpoints
│   ├── middleware/
│   │   ├── auth.js          # Firebase auth validation
│   │   ├── rateLimit.js     # Rate limiting
│   │   └── errorHandler.js  # Error handling
│   ├── services/
│   │   ├── firebase.js      # Firebase Admin SDK
│   │   ├── solana.js        # Solana Web3.js
│   │   └── bigchain.js      # BIGchain RPC
│   └── utils/
│       ├── validators.js    # Validação de input
│       ├── logger.js        # Logging seguro
│       └── constants.js     # Constantes
├── tests/
│   ├── endpoints.test.js
│   └── auth.test.js
├── .env
├── .env.example
├── package.json
└── README.md
```

### Scripts

```bash
# Desenvolvimento com hot-reload
npm run dev

# Produção
npm start

# Testes
npm test

# Linter
npm run lint

# Format
npm run format
```

### Testes

```bash
# Executar testes
npm test

# Testes com cobertura
npm run test:coverage

# Teste específico
npm test -- --grep "convert"
```

---

## 📜 Licença

**BIGchain Bridge API** é distribuído sob uma **licença proprietária**.

Consulte o arquivo [LICENSE](./LICENSE) para mais informações.

---

<div align="center">

**© 2025 BIGFOOT Connect. Todos os direitos reservados.**

Feito com ❤️ para a comunidade blockchain

</div>