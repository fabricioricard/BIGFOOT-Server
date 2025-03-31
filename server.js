const express = require('express');
const app = express();

app.use(express.json());

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

// Exporta o app para o Vercel
module.exports = app;
