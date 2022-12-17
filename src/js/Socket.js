import { io } from 'socket.io-client';

// const socket = io('ws://localhost:3000', {
//   transports: ["websocket"],
// });

const socket = io();

const socketObject = {
  cbOnFinish: (gesture) => {
    console.log('fhinish mock')
  },
  cbOnUserConnect: () => {
    console.log('fhinish mock')
  },
  cbOnInit: (idUsers) => {
    console.log('dfdf')
  },
  cbOnUserDisconnect: (idUser) => {
    console.log('dfdf')
  },
  send(gesture) {
    socket.emit('play', gesture);
  },
  finish(gesture) {
    this.cbOnFinish(gesture)
  },
  userConnect(idUser) {
    this.cbOnUserConnect(idUser);
  },
  init(idUsers) {
    this.cbOnInit(idUsers);
  },
  userDisconnect(idUser) {
    this.cbOnUserDisconnect(idUser)
  },
  emitGameOver() {
    socket.emit('gameOver');
    setTimeout(() => {
      document.body.innerHTML = 'GAME OVER'
    }, 100)
  },
  emitReady() {
    socket.emit('ready')
  }
}

socket.on("finish", (gesture) => {
  socketObject.finish(gesture)
});

socket.on("user-connect", (idUser) => {
  socketObject.userConnect(idUser)
})

socket.on("init", (idUsers) => {
  socketObject.init(idUsers);
});

socket.on("user-disconnect", (idUser) => {
  socketObject.userDisconnect(idUser)
})

socket.on('disconnect', () => {
  document.body.innerHTML = 'Игра уже идет'
})

export {
  socketObject
}