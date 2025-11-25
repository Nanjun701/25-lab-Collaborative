import express from "express";
import http from "http";
import { Server } from "socket.io";

// 使用 Render 提供的端口，本地开发时默认为 3000
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// 1. 设置静态文件服务：指向 'docs' 文件夹
app.use(express.static("docs"));

// 2. 配置 Socket.io 服务器
// 启用 CORS 以允许 GitHub Pages (或其他任何域名) 连接
const io = new Server(server, {
  cors: {
    // 临时设置为通配符 * 确保不是 CORS 阻止连接
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// 3. Socket.io 连接逻辑
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  socket.on('join', (roomName) => {
      
      // 在用户加入房间之前，获取房间当前的用户数
      const previousRoomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      
      // WebRTC P2P 通常限制房间最多 2 人
      if (previousRoomSize >= 2) {
          socket.emit('full');
          console.log(`Room ${roomName} is full. User ${socket.id} rejected.`);
          return;
      }
      
      // 用户加入房间
      socket.join(roomName);
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size;
      
      console.log(`User ${socket.id} joined room ${roomName}. Current Size: ${roomSize}`);

      if (roomSize === 1) {
          // 第一个用户加入：发送 'created' 信号
          socket.emit('created');
          
      } else if (roomSize === 2) {
          // 第二个用户加入：发送 'joined' 信号
          socket.emit('joined');
          
          // 向房间内的所有成员（包括刚加入的自己）发送 'ready' 信号，触发 WebRTC 连接
          // 注意：如果使用 socket.broadcast.to(roomName) 会排除发送者
          // 所以这里使用 io.to(roomName) 确保所有人都收到 'ready'
          io.to(roomName).emit('ready'); 
      }
      // 如果房间大于 2，已经在前面被拒绝了
  });

  // 接收 WebRTC 信令
  socket.on('signal', (data) => {
      // 广播给房间内的所有其他用户（排除发送者）
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