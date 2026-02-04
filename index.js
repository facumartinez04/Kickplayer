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
io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado. ID:', socket.id);

    // Obtener el número de clientes conectados
    const count = io.engine.clientsCount;

    // Emitir a TODOS los clientes la nueva cantidad
    io.emit('online_users', { count: count });

    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado. ID:', socket.id);
        const newCount = io.engine.clientsCount; // Socket.io actualiza esto automáticamente tras disconnect
        io.emit('online_users', { count: newCount });
    });
});

// Endpoint opcional para consultar vía HTTP
app.get('/api/online-count', (req, res) => {
    res.json({ count: io.engine.clientsCount });
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
