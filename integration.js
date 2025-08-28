class PacketCryptIntegration {
    constructor() {
        this.apiUrl = 'http://localhost:3001';
        this.socket = null;
        this.isConnected = false;
        this.miningStats = {
            isRunning: false,
            hashrate: 0,
            shares: 0,
            wallet: null,
            pool: null,
            startTime: null
        };
        this.settings = {
            wallet: '',
            pool: 'http://pool.pkt.world',
            threads: 1,
            enabled: false
        };
    }

    // Inicializar integração
    async initialize() {
        await this.loadSettings();
        await this.connectToAPI();
        this.setupWebSocket();
    }

    // Carregar configurações salvas
    async loadSettings() {
        try {
            const result = await chrome.storage.local.get(['packetcrypt']);
            if (result.packetcrypt) {
                this.settings = { ...this.settings, ...result.packetcrypt };
            }
        } catch (error) {
            console.error('Erro ao carregar configurações PacketCrypt:', error);
        }
    }

    // Salvar configurações
    async saveSettings() {
        try {
            await chrome.storage.local.set({ packetcrypt: this.settings });
        } catch (error) {
            console.error('Erro ao salvar configurações PacketCrypt:', error);
        }
    }

    // Conectar com a API local
    async connectToAPI() {
        try {
            const response = await fetch(`${this.apiUrl}/api/check`);
            const data = await response.json();
            
            if (data.success) {
                this.isConnected = true;
                console.log('PacketCrypt API conectada:', data.version);
                return true;
            }
        } catch (error) {
            console.log('PacketCrypt API não disponível:', error.message);
            this.isConnected = false;
        }
        return false;
    }

    // Configurar WebSocket para updates em tempo real
    setupWebSocket() {
        if (!this.isConnected) return;

        try {
            this.socket = io(this.apiUrl);
            
            this.socket.on('connect', () => {
                console.log('WebSocket PacketCrypt conectado');
            });
            
            this.socket.on('status', (status) => {
                this.miningStats = status;
                this.updateBigfootStats();
            });
            
            this.socket.on('disconnect', () => {
                console.log('WebSocket PacketCrypt desconectado');
            });
            
        } catch (error) {
            console.error('Erro ao conectar WebSocket:', error);
        }
    }

    // Fazer requisições para a API
    async request(endpoint, options = {}) {
        if (!this.isConnected) {
            throw new Error('API PacketCrypt não conectada');
        }

        const url = `${this.apiUrl}${endpoint}`;
        const config = {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            ...options
        };

        const response = await fetch(url, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Erro na requisição');
        }
        
        return data;
    }

    // Iniciar mineração
    async startMining() {
        if (!this.settings.wallet) {
            throw new Error('Configure um endereço de wallet PKT primeiro');
        }

        const result = await this.request('/api/start', {
            method: 'POST',
            body: JSON.stringify({
                wallet: this.settings.wallet,
                pool: this.settings.pool,
                threads: this.settings.threads
            })
        });

        return result;
    }

    // Parar mineração
    async stopMining() {
        return await this.request('/api/stop', {
            method: 'POST'
        });
    }

    // Obter status da mineração
    async getStatus() {
        const result = await this.request('/api/status');
        this.miningStats = result.data;
        return result;
    }

    // Atualizar estatísticas do BIGFOOT Connect
    updateBigfootStats() {
        // Integrar estatísticas do PacketCrypt com as do BIGFOOT
        const packetcryptData = {
            packetcrypt_hashrate: this.miningStats.hashrate,
            packetcrypt_shares: this.miningStats.shares,
            packetcrypt_status: this.miningStats.isRunning ? 'mining' : 'stopped',
            packetcrypt_wallet: this.miningStats.wallet,
            packetcrypt_uptime: this.calculateUptime()
        };

        // Enviar para o background script do BIGFOOT
        chrome.runtime.sendMessage({
            action: 'updateStats',
            data: packetcryptData
        });
    }

    // Calcular tempo de mineração
    calculateUptime() {
        if (!this.miningStats.startTime) return 0;
        
        const start = new Date(this.miningStats.startTime);
        const now = new Date();
        return Math.floor((now - start) / 1000); // segundos
    }

    // Formatar hashrate
    formatHashrate(hashrate) {
        if (hashrate >= 1000000) {
            return `${(hashrate / 1000000).toFixed(2)} MH/s`;
        } else if (hashrate >= 1000) {
            return `${(hashrate / 1000).toFixed(2)} kH/s`;
        } else {
            return `${hashrate.toFixed(2)} H/s`;
        }
    }

    // Formatar tempo
    formatUptime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        
        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }

    // Verificar se está minerando
    isMining() {
        return this.miningStats.isRunning;
    }

    // Obter estatísticas para UI
    getUIStats() {
        return {
            connected: this.isConnected,
            mining: this.miningStats.isRunning,
            hashrate: this.formatHashrate(this.miningStats.hashrate),
            shares: this.miningStats.shares,
            uptime: this.formatUptime(this.calculateUptime()),
            wallet: this.miningStats.wallet,
            pool: this.miningStats.pool
        };
    }

    // Desconectar
    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
        }
        this.isConnected = false;
    }
}

// Instância global para usar na extensão
window.packetcryptIntegration = new PacketCryptIntegration();
