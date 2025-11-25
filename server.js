import express from "express";
import http from "http";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);


app.use(express.static("docs"));


const io = new Server(server, {
  cors: {
    origin: "https://nanjun701.github.io", 
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (roomName) => {
      
      const previousRoomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      
      if (previousRoomSize >= 2) {
          socket.emit('full');
          console.log(`Room ${roomName} is full. User ${socket.id} rejected.`);
          return;
      }
      
      socket.join(roomName);
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size;
      
      console.log(`User ${socket.id} joined room ${roomName}. Current Size: ${roomSize}`);

      if (roomSize === 1) {
          socket.emit('created');
      } else if (roomSize === 2) {
          socket.emit('joined');
          io.to(roomName).emit('ready'); 
      }
  });

  socket.on('signal', (data) => {
      socket.broadcast.to(data.room).emit('signal', data);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
  });
});

// 4. 启动服务器
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});