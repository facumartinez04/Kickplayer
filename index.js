const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app); // Crear servidor HTTP
// Configurar Socket.io con CORS para permitir conexiones desde cualquier origen (ajustar en producción)
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = 3000;

// Habilitar CORS para todas las solicitudes Express
app.use(cors());

// Lógica de Socket.io para contar usuarios
const activeUsers = new Map(); // Mapa para rastrear usuarios únicos: { "IP_o_DeviceID": Set(socketIds) }

io.on('connection', (socket) => {
    // Intentar obtener un ID único:
    // 1. Busca 'deviceId' en los query params (lo ideal, enviado desde el front)
    // 2. Si no, usa la IP del cliente (fallback)
    const deviceId = socket.handshake.query.deviceId;
    const ip = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address;

    // El identificador único será el deviceId (si existe) o la IP
    const uniqueId = deviceId || ip;

    console.log(`Usuario conectado. Socket ID: ${socket.id}, Unique ID: ${uniqueId}`);

    // Agregamos al usuario al registro
    if (!activeUsers.has(uniqueId)) {
        activeUsers.set(uniqueId, new Set());
    }
    activeUsers.get(uniqueId).add(socket.id);

    // Obtener el número de usuarios ÚNICOS
    const uniqueCount = activeUsers.size;

    // Emitir a TODOS los clientes la nueva cantidad de usuarios únicos
    io.emit('online_users', { count: uniqueCount });

    socket.on('disconnect', () => {
        console.log(`Usuario desconectado. Socket ID: ${socket.id}, Unique ID: ${uniqueId}`);

        if (activeUsers.has(uniqueId)) {
            const userSockets = activeUsers.get(uniqueId);
            userSockets.delete(socket.id);

            // Si el usuario ya no tiene sockets abiertos (cerró todas las pestañas), lo removemos
            if (userSockets.size === 0) {
                activeUsers.delete(uniqueId);
            }
        }

        const newUniqueCount = activeUsers.size;
        io.emit('online_users', { count: newUniqueCount });
    });
});

// Endpoint opcional para consultar vía HTTP
app.get('/api/online-count', (req, res) => {
    res.json({ count: activeUsers.size });
});

// Endpoint del Proxy
app.get('/proxy', async (req, res) => {
    const streamUrl = req.query.url;

    if (!streamUrl) {
        return res.status(400).send('Falta la URL del stream');
    }

    try {
        // Configuramos las cabeceras para simular una petición válida desde Kick.com
        const response = await axios({
            method: 'get',
            url: streamUrl,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://kick.com/',
                'Origin': 'https://kick.com'
            },
            responseType: 'stream' // Importante para streaming de video
        });

        // Reenviar el tipo de contenido original (video/mp4, application/x-mpegURL, etc.)
        if (response.headers['content-type']) {
            res.setHeader('Content-Type', response.headers['content-type']);
        }

        // Canalizar el stream de datos hacia la respuesta
        response.data.pipe(res);

    } catch (error) {
        console.error('Error en el proxy:', error.message);
        if (error.response) {
            res.status(error.response.status).send(error.message);
        } else {
            res.status(500).send(error.message);
        }
    }
});

// IMPORTANTE: Usar server.listen en lugar de app.listen para que funcione Socket.io
server.listen(PORT, () => {
    console.log(`Servidor con Socket.io corriendo en http://localhost:${PORT}`);
});
