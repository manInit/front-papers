// import styles
import '@/styles/index.scss'

import { UI } from '@/js/UI'
import { Prediction } from './js/Prediction'
import { socketObject } from './js/Socket'

import camConfig from '@/js/CameraConfig'

// store a reference to the player video
let playerVideo

// keep track of scores
let playerScore = 0
let computerScore = 0

let isLoaded = false
function removeProloader() {
  const prealoder = document.querySelector('.preloader')
  prealoder.style.opacity = 0
  setTimeout(() => {
    prealoder.remove()
  }, 600)
}
// setyp & initialization
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
  // show robot waiting for player
  UI.showRobotImage(true)

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
            checkResult(playerGesture, gesture)
          }
          
        }
      })
    }, 0)
  }

  predictNonblocking()
}

function checkResult(playerGesture, computerGesture) {
  let statusText
  let playerWins = false
  let computerWins = false

  if (playerGesture === computerGesture) {
    // draw
    statusText = "Ничья!"
  } else {
    // check whinner
    // eslint-disable-next-line no-lonely-if
    if (playerGesture === 'rock') {
      if (computerGesture === 'scissors') {
        playerWins = true
        statusText = 'Камень бьет ножницы'
      } else {
        computerWins = true
        statusText = 'Бумага кроет камень'
      }
    } else if (playerGesture === 'paper') {
      if (computerGesture === 'rock') {
        playerWins = true
        statusText = 'Бумага кроет камень'
      } else {
        computerWins = true
        statusText = 'Ножницы режут бумагу'
      }
    } else if (playerGesture === 'scissors') {
      if (computerGesture === 'paper') {
        playerWins = true
        statusText = 'Ножницы режут бумагу'
      } else {
        computerWins = true
        statusText = 'Камень бьет ножницы'
      }
    }
  }

  if (playerWins) {
    playerScore += 1
    statusText += ' - Ты победил!'
  } else if (computerWins) {
    computerScore += 1
    statusText += ' - Соперник выиграл!'
  }

  UI.showRobotHand(true)
  UI.setRobotGesture(computerGesture)

  UI.setStatusMessage(statusText)

  UI.setPlayerScore(playerScore)
  UI.setRobotScore(computerScore)

  // wait for 3 seconds, then start next round
  setTimeout(playOneRound, 3000)
}

function getRandomGesture() {
  const gestures = ['rock', 'paper', 'scissors']
  const randomNum = Math.floor(Math.random() * gestures.length)
  return gestures[randomNum]
}
//-----

onInit()
