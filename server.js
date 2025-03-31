const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Banco de dados simulado
const usersData = [];

app.get('/', (req, res) => {
    res.send("Bem-vindo ao Bigfoot Server! Use /api para enviar dados.");
});

app.post('/api', (req, res) => {
    const { walletAddress, totalSharedGB, timestamp } = req.body;
    console.log("Dados recebidos:", { walletAddress, totalSharedGB, timestamp });

    const userIndex = usersData.findIndex(user => user.walletAddress === walletAddress);
    if (userIndex >= 0) {
        usersData[userIndex].totalSharedGB += totalSharedGB;
    } else {
        usersData.push({ walletAddress, totalSharedGB, lastUpdated: timestamp });
    }

    res.status(200).json({ success: true });
});

app.get('/api/users', (req, res) => {
    res.json(usersData);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
