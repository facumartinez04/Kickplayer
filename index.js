const express = require('express');
const axios = require('axios');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const SLUGS_FILE = path.join(__dirname, 'slugs.json');


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
app.use(express.json());


const activeUsers = new Map();
let specialSlugs = new Map();

// Cargar slugs guardados
if (fs.existsSync(SLUGS_FILE)) {
    try {
        const data = fs.readFileSync(SLUGS_FILE, 'utf8');
        specialSlugs = new Map(JSON.parse(data));
        console.log('Slugs cargados correctamente');
    } catch (error) {
        console.error('Error al cargar slugs:', error);
    }
}

function saveSlugs() {
    try {
        const data = JSON.stringify(Array.from(specialSlugs.entries()), null, 2);
        fs.writeFileSync(SLUGS_FILE, data);
    } catch (error) {
        console.error('Error al guardar slugs:', error);
    }
}

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

const ADMIN_PASSWORD = 'Facundo060604!';

const authenticateAdmin = (req, res, next) => {
    const { password } = req.query;
    if (password === ADMIN_PASSWORD) {
        next();
    } else {
        res.status(403).json({ error: 'Acceso denegado: Contraseña incorrecta' });
    }
};

app.get('/api/online-count', authenticateAdmin, (req, res) => {
    res.json({ count: activeUsers.size });
});

app.get('/api/admin/data', authenticateAdmin, (req, res) => {
    const usersData = Array.from(activeUsers.entries()).map(([key, value]) => ({
        uniqueId: key,
        sockets: Array.from(value)
    }));

    res.json({
        total: activeUsers.size,
        users: usersData
    });
});

app.post('/api/admin/slug', authenticateAdmin, (req, res) => {
    const { slug, channels } = req.body;

    if (!slug || !channels || !Array.isArray(channels)) {
        return res.status(400).json({ error: 'Formato inválido. Se requiere "slug" y un array de "channels".' });
    }

    specialSlugs.set(slug, channels);
    saveSlugs(); // Guardar cambios en archivo
    res.json({ message: 'Slug guardado exitosamente', slug, channels });
});


app.get('/api/admin/slugs', authenticateAdmin, (req, res) => {
    const slugs = Array.from(specialSlugs.entries()).map(([slug, channels]) => ({
        slug,
        channels
    }));
    res.json({ slugs });
});

app.get('/api/slug/:slug', (req, res) => {

    const { slug } = req.params;
    if (specialSlugs.has(slug)) {
        res.json({ channels: specialSlugs.get(slug) });
    } else {
        res.status(404).json({ error: 'Slug no encontrado' });
    }
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