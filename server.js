// server.js
import express from 'express';
import http from 'http';
import { Server } from 'socket.io';

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public')); // 托管网页文件

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('join', (roomName) => {
        const room = io.sockets.adapter.rooms.get(roomName);
        const numClients = room ? room.size : 0;

        if (numClients === 0) {
            socket.join(roomName);
            socket.emit('created', roomName);
        } else if (numClients === 1) {
            socket.join(roomName);
            socket.emit('joined', roomName);
            io.to(roomName).emit('ready', roomName);
        } else {
            socket.emit('full', roomName);
        }
    });

    socket.on('signal', (data) => {
        socket.broadcast.to(data.room).emit('signal', data);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});