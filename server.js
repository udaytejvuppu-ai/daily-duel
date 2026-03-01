const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 3000;
const DB_FILE = path.join(__dirname, 'database.json');

app.use(express.json());
app.use(express.static(__dirname));

// --- Database Helpers ---
function readDB() {
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({}));
        return {};
    }
    try {
        return JSON.parse(fs.readFileSync(DB_FILE));
    } catch (e) {
        return {}; // Return empty if JSON is corrupted
    }
}

function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- API Routes ---
app.get('/api/data', (req, res) => {
    res.json(readDB());
});

app.post('/api/tasks', (req, res) => {
    const { date, task } = req.body;
    let db = readDB();
    if (!db[date]) db[date] = { tasks: [], note: "", important: false };
    db[date].tasks.push(task);
    writeDB(db);
    io.emit('dataUpdated', db);
    res.status(200).send('Task Added');
});

app.put('/api/tasks/:id', (req, res) => {
    const { date } = req.body;
    const taskId = parseInt(req.params.id);
    let db = readDB();
    if (db[date]) {
        db[date].tasks = db[date].tasks.map(t => 
            t.id === taskId ? {...t, completed: !t.completed} : t
        );
        writeDB(db);
        io.emit('dataUpdated', db);
    }
    res.status(200).send('Task Toggled');
});

app.delete('/api/tasks/:id', (req, res) => {
    const { date } = req.body;
    const taskId = parseInt(req.params.id);
    let db = readDB();
    if (db[date]) {
        db[date].tasks = db[date].tasks.filter(t => t.id !== taskId);
        writeDB(db);
        io.emit('dataUpdated', db);
    }
    res.status(200).send('Task Deleted');
});

// --- Route for Important Days ---
app.post('/api/day-important', (req, res) => {
    const { date } = req.body;
    let db = readDB();
    if (!db[date]) db[date] = { tasks: [], note: "", important: false };
    db[date].important = !db[date].important;
    writeDB(db);
    io.emit('dataUpdated', db);
    res.status(200).send('Date Toggled Important');
});

// --- Socket.io ---
io.on('connection', (socket) => {
    console.log('a user connected');
});

server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});