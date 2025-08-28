client.js - Cliente para integração com a API local

class PacketCryptClient {
    constructor() {
        this.baseUrl = 'http://localhost:3001';
        this.socket = null;
        this.callbacks = {
            onStatusUpdate: null,
            onError: null,
            onConnect: null,
            onDisconnect: null
        };
    }

    // Conectar WebSocket para updates em tempo real
    connect() {
        if (this.socket && this.socket.connected) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                // Para extensões, você pode precisar usar socket.io CDN
                this.socket = io(this.baseUrl);
                
                this.socket.on('connect', () => {
                    console.log('Conectado ao PacketCrypt API');
                    if (this.callbacks.onConnect) this.callbacks.onConnect();
                    resolve();
                });
                
                this.socket.on('disconnect', () => {
                    console.log('Desconectado do PacketCrypt API');
                    if (this.callbacks.onDisconnect) this.callbacks.onDisconnect();
                });
                
                this.socket.on('status', (status) => {
                    if (this.callbacks.onStatusUpdate) {
                        this.callbacks.onStatusUpdate(status);
                    }
                });
                
                this.socket.on('error', (error) => {
                    console.error('Socket error:', error);
                    if (this.callbacks.onError) this.callbacks.onError(error);
                });
                
                // Timeout para conexão
                setTimeout(() => {
                    if (!this.socket.connected) {
                        reject(new Error('Timeout na conexão'));
                    }
                }, 5000);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    // Fazer requisições HTTP para a API
    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || 'Erro na requisição');
            }
            
            return data;
        } catch (error) {
            console.error('Request error:', error);
            throw error;
        }
    }

    // Verificar status da mineração
    async getStatus() {
        return await this.request('/api/status');
    }

    // Iniciar mineração
    async startMining(wallet, pool = null, threads = 1) {
        const body = { wallet, threads };
        if (pool) body.pool = pool;
        
        return await this.request('/api/start', {
            method: 'POST',
            body: JSON.stringify(body)
        });
    }

    // Parar mineração
    async stopMining() {
        return await this.request('/api/stop', {
            method: 'POST'
        });
    }

    // Configurar pool
    async setPool(pool) {
        return await this.request('/api/config/pool', {
            method: 'POST',
            body: JSON.stringify({ pool })
        });
    }

    // Obter informações do sistema
    async getSystemInfo() {
        return await this.request('/api/system');
    }

    // Verificar se PacketCrypt está disponível
    async checkPacketCrypt() {
        return await this.request('/api/check');
    }

    // Registrar callbacks
    onStatusUpdate(callback) {
        this.callbacks.onStatusUpdate = callback;
    }

    onError(callback) {
        this.callbacks.onError = callback;
    }

    onConnect(callback) {
        this.callbacks.onConnect = callback;
    }

    onDisconnect(callback) {
        this.callbacks.onDisconnect = callback;
    }

    // Desconectar
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
    }
}

// Exemplo de uso na extensão
class MiningExtension {
    constructor() {
        this.client = new PacketCryptClient();
        this.isConnected = false;
        this.currentStatus = null;
        
        this.setupEventListeners();
        this.loadSettings();
    }

    async init() {
        try {
            await this.client.connect();
            this.isConnected = true;
            this.updateUI();
            
            // Verificar se PacketCrypt está disponível
            const check = await this.client.checkPacketCrypt();
            console.log('PacketCrypt check:', check);
            
        } catch (error) {
            console.error('Falha ao conectar:', error);
            this.showError('Não foi possível conectar com o PacketCrypt. Certifique-se que o servidor local está rodando.');
        }
    }

    setupEventListeners() {
        this.client.onStatusUpdate((status) => {
            this.currentStatus = status;
            this.updateUI();
        });

        this.client.onError((error) => {
            this.showError(`Erro: ${error.message}`);
        });

        this.client.onConnect(() => {
            this.isConnected = true;
            this.updateUI();
        });

        this.client.onDisconnect(() => {
            this.isConnected = false;
            this.updateUI();
        });
    }

    // Carregar configurações salvas
    loadSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.get(['wallet', 'pool', 'threads'], (result) => {
                this.settings = {
                    wallet: result.wallet || '',
                    pool: result.pool || 'http://pool.pkt.world',
                    threads: result.threads || 1
                };
                this.updateSettingsUI();
            });
        }
    }

    // Salvar configurações
    saveSettings() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.local.set(this.settings);
        }
    }

    // Iniciar mineração
    async startMining() {
        if (!this.settings.wallet) {
            this.showError('Configure seu endereço de wallet primeiro');
            return;
        }

        try {
            const result = await this.client.startMining(
                this.settings.wallet,
                this.settings.pool,
                this.settings.threads
            );
            
            console.log('Mineração iniciada:', result);
            this.updateUI();
            
        } catch (error) {
            this.showError(`Erro ao iniciar mineração: ${error.message}`);
        }
    }

    // Parar mineração
    async stopMining() {
        try {
            const result = await this.client.stopMining();
            console.log('Mineração parada:', result);
            this.updateUI();
        } catch (error) {
            this.showError(`Erro ao parar mineração: ${error.message}`);
        }
    }

    // Atualizar interface
    updateUI() {
        const statusElement = document.getElementById('mining-status');
        const hashrateElement = document.getElementById('hashrate');
        const sharesElement = document.getElementById('shares');
        const startButton = document.getElementById('start-btn');
        const stopButton = document.getElementById('stop-btn');
        const connectionStatus = document.getElementById('connection-status');

        if (connectionStatus) {
            connectionStatus.textContent = this.isConnected ? 'Conectado' : 'Desconectado';
            connectionStatus.className = this.isConnected ? 'connected' : 'disconnected';
        }

        if (this.currentStatus) {
            if (statusElement) {
                statusElement.textContent = this.currentStatus.isRunning ? 'Minerando' : 'Parado';
            }
            
            if (hashrateElement) {
                const hashrate = this.formatHashrate(this.currentStatus.hashrate);
                hashrateElement.textContent = hashrate;
            }
            
            if (sharesElement) {
                sharesElement.textContent = this.currentStatus.shares.toString();
            }
        }

        if (startButton && stopButton) {
            const isRunning = this.currentStatus?.isRunning || false;
            startButton.disabled = !this.isConnected || isRunning;
            stopButton.disabled = !this.isConnected || !isRunning;
        }
    }

    updateSettingsUI() {
        const walletInput = document.getElementById('wallet-input');
        const poolInput = document.getElementById('pool-input');
        const threadsInput = document.getElementById('threads-input');

        if (walletInput) walletInput.value = this.settings.wallet;
        if (poolInput) poolInput.value = this.settings.pool;
        if (threadsInput) threadsInput.value = this.settings.threads;
    }

    formatHashrate(hashrate) {
        if (hashrate >= 1000000) {
            return `${(hashrate / 1000000).toFixed(2)} MH/s`;
        } else if (hashrate >= 1000) {
            return `${(hashrate / 1000).toFixed(2)} kH/s`;
        } else {
            return `${hashrate.toFixed(2)} H/s`;
        }
    }

    showError(message) {
        const errorElement = document.getElementById('error-message');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
            
            // Auto-hide após 5 segundos
            setTimeout(() => {
                errorElement.style.display = 'none';
            }, 5000);
        } else {
            console.error(message);
            alert(message); // Fallback
        }
    }
}

// Inicializar quando a extensão carregar
let miningExtension;

document.addEventListener('DOMContentLoaded', () => {
    miningExtension = new MiningExtension();
    miningExtension.init();
    
    // Event listeners para botões
    const startBtn = document.getElementById('start-btn');
    const stopBtn = document.getElementById('stop-btn');
    
    if (startBtn) {
        startBtn.addEventListener('click', () => {
            miningExtension.startMining();
        });
    }
    
    if (stopBtn) {
        stopBtn.addEventListener('click', () => {
            miningExtension.stopMining();
        });
    }
    
    // Event listeners para configurações
    const walletInput = document.getElementById('wallet-input');
    const poolInput = document.getElementById('pool-input');
    const threadsInput = document.getElementById('threads-input');
    
    [walletInput, poolInput, threadsInput].forEach(input => {
        if (input) {
            input.addEventListener('change', () => {
                miningExtension.settings = {
                    wallet: walletInput?.value || '',
                    pool: poolInput?.value || '',
                    threads: parseInt(threadsInput?.value) || 1
                };
                miningExtension.saveSettings();
            });
        }
    });
});

// Limpeza ao fechar extensão
window.addEventListener('beforeunload', () => {
    if (miningExtension) {
        miningExtension.client.disconnect();
    }
});
