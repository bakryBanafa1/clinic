const { Server } = require('socket.io');

let io;

function initSocket(server) {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] }
  });

  io.on('connection', (socket) => {
    console.log('🔌 Client connected:', socket.id);

    socket.on('join-queue-display', () => {
      socket.join('queue-display');
    });

    socket.on('join-notifications', (userId) => {
      socket.join(`user-${userId}`);
    });

    socket.on('disconnect', () => {
      console.log('🔌 Client disconnected:', socket.id);
    });
  });

  return io;
}

function getIO() {
  return io;
}

function emitQueueUpdate(data) {
  if (io) io.to('queue-display').emit('queue-update', data);
}

function emitNotification(userId, notification) {
  if (io) io.to(`user-${userId}`).emit('notification', notification);
}

module.exports = { initSocket, getIO, emitQueueUpdate, emitNotification };
