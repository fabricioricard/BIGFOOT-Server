// server.js - API local para integração com PacketCrypt
const express = require('express');
const cors = require('cors');
const { spawn, exec } = require('child_process');
const path = require('path');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors({
    origin: ['chrome-extension://*', 'moz-extension://*', 'http://localhost:*'],
    credentials: true
}));
app.use(express.json());

// Estado global do minerador
let miningProcess = null;
let miningStats = {
    isRunning: false,
    hashrate: 0,
    shares: 0,
    pool: null,
    wallet: null,
    startTime: null
};

// Configurações (ajuste conforme sua instalação)
const PACKETCRYPT_PATH = './packetcrypt'; // ou caminho para o binário
const DEFAULT_POOL = 'http://pool.pkt.world';

// Endpoints da API

// Status do minerador
app.get('/api/status', (req, res) => {
    res.json({
        success: true,
        data: miningStats
    });
});

// Iniciar mineração
app.post('/api/start', (req, res) => {
    const { wallet, pool = DEFAULT_POOL, threads = 1 } = req.body;
    
    if (!wallet) {
        return res.status(400).json({
            success: false,
            error: 'Wallet address é obrigatório'
        });
    }
    
    if (miningProcess) {
        return res.status(400).json({
            success: false,
            error: 'Mineração já está rodando'
        });
    }
    
    try {
        // Comando para iniciar o PacketCrypt
        // Ajuste conforme sua versão/configuração
        const args = [
            'ann',
            '-p', pool,
            '-P', wallet,
            '--threads', threads.toString()
        ];
        
        miningProcess = spawn(PACKETCRYPT_PATH, args);
        
        miningStats = {
            isRunning: true,
            hashrate: 0,
            shares: 0,
            pool: pool,
            wallet: wallet,
            startTime: new Date().toISOString()
        };
        
        // Capturar output do processo
        miningProcess.stdout.on('data', (data) => {
            const output = data.toString();
            console.log('PacketCrypt output:', output);
            
            // Parse do output para extrair estatísticas
            parseOutput(output);
        });
        
        miningProcess.stderr.on('data', (data) => {
            console.error('PacketCrypt error:', data.toString());
        });
        
        miningProcess.on('close', (code) => {
            console.log(`PacketCrypt process exited with code ${code}`);
            miningProcess = null;
            miningStats.isRunning = false;
        });
        
        res.json({
            success: true,
            message: 'Mineração iniciada',
            data: miningStats
        });
        
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// Parar mineração
app.post('/api/stop', (req, res) => {
    if (!miningProcess) {
        return res.status(400).json({
            success: false,
            error: 'Mineração não está rodando'
        });
    }
    
    miningProcess.kill('SIGTERM');
    miningProcess = null;
    miningStats.isRunning = false;
    
    res.json({
        success: true,
        message: 'Mineração parada'
    });
});

// Configurar pool
app.post('/api/config/pool', (req, res) => {
    const { pool } = req.body;
    
    if (miningStats.isRunning) {
        return res.status(400).json({
            success: false,
            error: 'Pare a mineração antes de alterar configurações'
        });
    }
    
    // Validar URL do pool
    try {
        new URL(pool);
        res.json({
            success: true,
            message: 'Pool configurado',
            pool: pool
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            error: 'URL do pool inválida'
        });
    }
});

// Obter informações do sistema
app.get('/api/system', (req, res) => {
    const os = require('os');
    
    res.json({
        success: true,
        data: {
            platform: os.platform(),
            cpus: os.cpus().length,
            memory: Math.round(os.totalmem() / 1024 / 1024 / 1024) + ' GB',
            uptime: os.uptime()
        }
    });
});

// Verificar se PacketCrypt está disponível
app.get('/api/check', (req, res) => {
    exec(`${PACKETCRYPT_PATH} --version`, (error, stdout, stderr) => {
        if (error) {
            res.status(500).json({
                success: false,
                error: 'PacketCrypt não encontrado',
                details: error.message
            });
        } else {
            res.json({
                success: true,
                version: stdout.trim()
            });
        }
    });
});

// Função para parsear output do PacketCrypt
function parseOutput(output) {
    // Exemplo de parsing - ajuste conforme o formato real do seu PacketCrypt
    
    // Procurar por hashrate
    const hashrateMatch = output.match(/(\d+\.?\d*)\s*(kH\/s|MH\/s|H\/s)/i);
    if (hashrateMatch) {
        let hashrate = parseFloat(hashrateMatch[1]);
        const unit = hashrateMatch[2].toLowerCase();
        
        if (unit.includes('k')) hashrate *= 1000;
        else if (unit.includes('m')) hashrate *= 1000000;
        
        miningStats.hashrate = hashrate;
    }
    
    // Procurar por shares aceitos
    const shareMatch = output.match(/accepted.*share/i);
    if (shareMatch) {
        miningStats.shares++;
    }
    
    // Procurar por erros de conexão
    const errorMatch = output.match(/error|failed|connection/i);
    if (errorMatch) {
        console.warn('Possível problema detectado:', output);
    }
}

// WebSocket para updates em tempo real (opcional)
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Cliente conectado via WebSocket');
    
    // Enviar status inicial
    socket.emit('status', miningStats);
    
    socket.on('disconnect', () => {
        console.log('Cliente desconectado');
    });
});

// Enviar updates periódicos via WebSocket
setInterval(() => {
    if (io.engine.clientsCount > 0) {
        io.emit('status', miningStats);
    }
}, 2000);

server.listen(PORT, 'localhost', () => {
    console.log(`PacketCrypt API rodando em http://localhost:${PORT}`);
    console.log('Endpoints disponíveis:');
    console.log('  GET  /api/status - Status da mineração');
    console.log('  POST /api/start - Iniciar mineração');
    console.log('  POST /api/stop - Parar mineração');
    console.log('  GET  /api/system - Info do sistema');
    console.log('  GET  /api/check - Verificar PacketCrypt');
});

// Limpeza ao sair
process.on('SIGINT', () => {
    if (miningProcess) {
        console.log('\nParando mineração...');
        miningProcess.kill('SIGTERM');
    }
    process.exit(0);
});
