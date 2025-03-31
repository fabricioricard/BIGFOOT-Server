const express = require('express');
const app = express();
const PORT = 3000; // Ou outra porta

app.use(express.json());

// Banco de dados simulado (substitua por um banco real, como SQLite ou MongoDB)
const usersData = [];

app.post('/api', (req, res) => {
    const { walletAddress, totalSharedGB, timestamp } = req.body;
    console.log("Dados recebidos:", { walletAddress, totalSharedGB, timestamp });

    // Armazena os dados
    const userIndex = usersData.findIndex(user => user.walletAddress === walletAddress);
    if (userIndex >= 0) {
        usersData[userIndex].totalSharedGB += totalSharedGB; // Acumula GB
    } else {
        usersData.push({ walletAddress, totalSharedGB, lastUpdated: timestamp });
    }

    res.status(200).json({ success: true });
});

// Endpoint para você visualizar os dados (opcional)
app.get('/api/users', (req, res) => {
    res.json(usersData);
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});