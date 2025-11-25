import express from "express";
import http from "http";
import { Server } from "socket.io";

// 使用 Render 提供的端口，本地开发时默认为 3000
const PORT = process.env.PORT || 3000;

const app = express();
const server = http.createServer(app);

// 1. 设置静态文件服务：指向 'docs' 文件夹，这是 GitHub Pages 识别的文件夹
app.use(express.static("docs"));

// 2. 配置 Socket.io 服务器
// 启用 CORS 以允许 GitHub Pages (或其他任何域名) 连接
const io = new Server(server, {
  cors: {
    // ⚠️ 部署到 GH Pages 后，您需要将 origin 替换为您实际的 GH Pages 域名
    // 格式：https://<YOUR_GITHUB_USERNAME>.github.io
    // 测试阶段可以先用 "*"
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// 3. Socket.io 连接逻辑 (此处应添加您的 Room 逻辑)
io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  // ⚠️ 教授的教程示例使用了 "draw"，您应该根据 Holiday Room 项目的协作逻辑来编写这里的代码
  // 比如，接收加入房间的信号：
  socket.on('join', (roomName) => {
      socket.join(roomName);
      const roomSize = io.sockets.adapter.rooms.get(roomName)?.size || 0;
      
      if (roomSize === 1) {
          socket.emit('created');
      } else if (roomSize > 1) {
          socket.emit('joined');
      } else {
          socket.emit('full');
      }
      socket.broadcast.to(roomName).emit('ready');
  });

  // 接收 WebRTC 信令
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