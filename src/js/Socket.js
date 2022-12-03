import { io } from 'socket.io-client';

// const socket = io('ws://localhost:3000', {
//   transports: ["websocket"],
// });

const socket = io();

const socketObject = {
  cbOnFinish: (gesture) => {
    console.log('fhinish mock')
  },
  send(gesture) {
    socket.emit('play', gesture);
  },
  finish(gesture) {
    this.cbOnFinish(gesture)
  }
}

socket.on("finish", (gesture) => {
  socketObject.finish(gesture)
});

export {
  socketObject
}