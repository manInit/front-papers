// import styles
import '@/styles/index.scss'

import { UI } from '@/js/UI'
import { Prediction } from './js/Prediction'
import { socketObject } from './js/Socket'

import camConfig from '@/js/CameraConfig'

const createPlayerCard = (index) => `
<div class="player" id="player-${index}">
<h2 class="player-headline">
  <span class="nick">Соперник</span>
  <span class="score" id="score-${index}">0</span>
</h2>
<div class="robot-container">
  <img id="robot-${index}" class="avatar" src="assets/human.png" alt="">
  <img id="robot-hand-${index}" class="robot-hand" alt="">
</div>
</div>`;

// store a reference to the player video
let playerVideo

// keep track of scores
let playerScore = 0

let isLoaded = false
function removeProloader() {
  const prealoder = document.querySelector('.preloader')
  prealoder.style.opacity = 0
  setTimeout(() => {
    prealoder.remove()
  }, 600)
}
// setup & initialization
// -----------------------------------------------------------------------------
async function onInit() {
  UI.init()
  UI.setStatusMessage('Initializing - Please wait a moment')

  const videoPromise = UI.initPlayerVideo(camConfig)
  const predictPromise = Prediction.init()

  Promise.all([videoPromise, predictPromise]).then((result) => {
    if (!isLoaded) {
      isLoaded = true
      removeProloader()
    }

    // result[0] will contain the initialized video element
    // eslint-disable-next-line prefer-destructuring
    playerVideo = result[0]
    playerVideo.play()

    // game is ready
    // eslint-disable-next-line no-use-before-define
    waitForPlayer()
  })
}
//-----

// game logic
// -----------------------------------------------------------------------------
function waitForPlayer() {
  // show a blinking start message
  if (UI.isMobile()) {
    UI.setStatusMessage('Touch the screen to start')
  } else {
    UI.setStatusMessage('Нажмите любую клавишу чтобы начать')
  }

  UI.startAnimateMessage()

  const startGame = () => {
    UI.stopAnimateMessage()
    socketObject.emitReady()
    
    // eslint-disable-next-line no-use-before-define
    playOneRound()
  }

  // wait for player to press any key
  // then stop blinking and play one round
  if (UI.isMobile()) {
    document.addEventListener('touchstart', startGame, { once: true })
  } else {
    window.addEventListener('keypress', startGame, { once: true })
  }
}

async function playOneRound() {
  const avatars = document.querySelectorAll('.avatar')
  const hands = document.querySelectorAll('.robot-hand')
  avatars.forEach((a, index) => {
    UI.showRobotImage(true, a, hands[index])
  })
  
  // hide the timer circle
  UI.showTimer(false)
  UI.setTimerProgress(0)
  UI.setPlayerHand('')

  // ready - set - show
  // wait for countdown to finish
  await UI.startCountdown()

  // show the timer circle
  UI.showTimer(true)

  // start detecting player gestures
  // required duration 150ms ~ 4-5 camera frames
  // eslint-disable-next-line no-use-before-define
  detectPlayerGesture(150)
}

function createElementFromHTML(htmlString) {
  const div = document.createElement('div');
  div.innerHTML = htmlString.trim();
  return div.firstChild;
}

socketObject.cbOnInit = (idUsers) => {
  let card;
  const messagesContainer = document.querySelector('.messages')
  // eslint-disable-next-line no-restricted-syntax
  for (const id of idUsers) {
    card = createElementFromHTML(createPlayerCard(id))
    messagesContainer.before(card)
  }
}

socketObject.cbOnUserDisconnect = (idUser) => {
  console.log(`#player-${idUser}`)
  document.querySelector(`#player-${idUser}`).remove();
}

socketObject.cbOnUserConnect = (idUser) => {
  const card = createElementFromHTML(createPlayerCard(idUser))
  document.querySelector('.messages').before(card)
}

function detectPlayerGesture(requiredDuration) {
  let lastGesture = ''
  let gestureDuration = 0

  const predictNonblocking = () => {
    setTimeout(() => {
      const predictionStartTS = Date.now()

      // predict gesture (require high confidence)
      Prediction.predictGesture(playerVideo, 9).then((playerGesture) => {
        if (playerGesture !== '') {
          if (playerGesture === lastGesture) {
            // player keeps holding the same gesture
            // -> keep timer running
            const deltaTime = Date.now() - predictionStartTS
            gestureDuration += deltaTime
          } else {
            // detected a different gesture
            // -> reset timer
            UI.setPlayerHand(playerGesture)
            lastGesture = playerGesture
            gestureDuration = 0
          }
        } else {
          UI.setPlayerHand(false)
          lastGesture = ''
          gestureDuration = 0
        }

        if (gestureDuration < requiredDuration) {
          // update timer and repeat
          UI.setTimerProgress(gestureDuration / requiredDuration)
          predictNonblocking()
        } else {
          // player result available
          // -> stop timer and check winner
          UI.setTimerProgress(1)
          UI.animatePlayerHand()
          
          socketObject.send(playerGesture)
          socketObject.cbOnFinish = (gesture) => {
            // eslint-disable-next-line no-use-before-define
            console.log(gesture)
            // eslint-disable-next-line no-use-before-define
            checkResult(gesture)
          }
          
        }
      })
    }, 0)
  }

  predictNonblocking()
}

function checkResult(gesture) {
  let statusText;
  let rockWins = false;
  let papersWins = false;
  let scissorWins = false;
  const users = gesture.map(g => ({
    id: g[0],
    gesture: g[1]
  }));
  const gestures = users.map(u => u.gesture);
  const uniqueGesture = new Set(gestures);

  if (uniqueGesture.size === 3 || uniqueGesture.size === 1) {
    statusText = "Ничья!"
  } else {
    const [playerGesture, computerGesture] = Array.from(uniqueGesture);
   
    if (playerGesture === 'rock') {
      if (computerGesture === 'scissors') {
        rockWins = true
        statusText = 'Камень бьет ножницы'
      } else {
        papersWins = true
        statusText = 'Бумага кроет камень'
      }
    } else if (playerGesture === 'paper') {
      if (computerGesture === 'rock') {
        papersWins = true
        statusText = 'Бумага кроет камень'
      } else {
        scissorWins = true
        statusText = 'Ножницы режут бумагу'
      }
    } else if (playerGesture === 'scissors') {
      if (computerGesture === 'paper') {
        scissorWins = true
        statusText = 'Ножницы режут бумагу'
      } else {
        rockWins = true
        statusText = 'Камень бьет ножницы'
      }
    }

    let playerWins = false;
    if (rockWins) {
      const idsWins = users.filter(user => user.gesture === 'rock').map(user => user.id);
      idsWins.forEach(id => {
        const score = document.querySelector(`#score-${id}`)
        if (!score) {
          playerScore += 1;
          playerWins = true;
          return
        } 
        
        const scoreCount = parseInt(score.innerHTML, 10)
        score.innerHTML = scoreCount + 1
      })
      if (!playerWins) {
        socketObject.emitGameOver();
      }
    }
    if (scissorWins) {
      const idsWins = users.filter(user => user.gesture === 'scissors').map(user => user.id);
      idsWins.forEach(id => {
        const score = document.querySelector(`#score-${id}`)
        if (!score) {
          playerScore += 1;
          playerWins = true;
          return
        }
        const scoreCount = parseInt(score.innerHTML, 10)
        score.innerHTML = scoreCount + 1
      })
      if (!playerWins) {
        socketObject.emitGameOver();
      }
    }
    if (papersWins) {
      const idsWins = users.filter(user => user.gesture === 'paper').map(user => user.id);
      idsWins.forEach(id => {
        const score = document.querySelector(`#score-${id}`)
        if (!score) {
          playerScore += 1;
          playerWins = true;
          return
        }
        const scoreCount = parseInt(score.innerHTML, 10)
        score.innerHTML = scoreCount + 1
      })
      if (!playerWins) {
        socketObject.emitGameOver();
      }
    }
  }

  users.forEach((user) => {
    const userCard = document.querySelector(`#robot-${user.id}`)
    if (!userCard) return;
    const userHand = document.querySelector(`#robot-hand-${user.id}`)
    UI.showRobotHand(true, userCard, userHand)
    UI.setRobotGesture(user.gesture, userHand)
  })
 

  UI.setStatusMessage(statusText)
  UI.setPlayerScore(playerScore)
  // UI.setRobotScore(computerScore)

  // wait for 3 seconds, then start next round
  setTimeout(playOneRound, 3000)
}

onInit()
