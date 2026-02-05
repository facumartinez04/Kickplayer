const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

app.use(cors());

const activeUsers = new Map();

io.on('connection', (socket) => {
    const deviceId = socket.handshake.query.deviceId;
    const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;
    const uniqueId = deviceId || ip;

    if (!activeUsers.has(uniqueId)) {
        activeUsers.set(uniqueId, new Set());
    }
    activeUsers.get(uniqueId).add(socket.id);

    io.emit('online_users', { count: activeUsers.size });

    socket.on('disconnect', () => {
        if (activeUsers.has(uniqueId)) {
            const userSockets = activeUsers.get(uniqueId);
            userSockets.delete(socket.id);

            if (userSockets.size === 0) {
                activeUsers.delete(uniqueId);
            }
        }
        io.emit('online_users', { count: activeUsers.size });
    });
});

app.get('/api/online-count', (req, res) => {
    res.json({ count: activeUsers.size });
});

app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;

    if (!streamUrl) {
        return res.status(400).send('Falta la URL del stream');
    }

    try {
        const response = await axios({
            method: 'get',
            url: streamUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://kick.com/',
                'Origin': 'https://kick.com'
            },
            responseType: 'stream'
        });

        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        response.data.pipe(res);

    } catch (error) {
        if (error.response) {
            res.status(error.response.status).send(error.message);
        } else {
            res.status(500).send(error.message);
        }
    }
});

server.listen(PORT, () => {
    console.log(`Servidor con Socket.io corriendo en http://localhost:${PORT}`);
});