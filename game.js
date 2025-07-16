// Game default settings (These are the *logical* dimensions for game calculations)
const GAME_SETTINGS_BASE = {
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 600,
  BIRD_WIDTH: 50,
  BIRD_HEIGHT: 50,
  BIRD_START_X: 100,
  BASE_HEIGHT_FALLBACK: 60
};

// --- Difficulty Modes Configuration ---
const DIFFICULTY_MODES = {
  easy: {
    GRAVITY: 0.5,
    FLAP_STRENGTH: -8,
    PIPE_WIDTH: 65,
    PIPE_GAP: 160,
    PIPE_SPAWN_RATE: 150,
    MIN_PIPE_TOP_HEIGHT: 70,
    MAX_PIPE_TOP_HEIGHT_OFFSET: 70
  },
  normal: {
    GRAVITY: 0.6,
    FLAP_STRENGTH: -9,
    PIPE_WIDTH: 70,
    PIPE_GAP: 140,
    PIPE_SPAWN_RATE: 130,
    MIN_PIPE_TOP_HEIGHT: 60,
    MAX_PIPE_TOP_HEIGHT_OFFSET: 60
  },
  hard: {
    GRAVITY: 0.7,
    FLAP_STRENGTH: -10,
    PIPE_WIDTH: 75,
    PIPE_GAP: 120,
    PIPE_SPAWN_RATE: 110,
    MIN_PIPE_TOP_HEIGHT: 50,
    MAX_PIPE_TOP_HEIGHT_OFFSET: 50
  }
};

// --- Map Configurations ---
const MAP_CONFIGS = {
  default: {
    background: ["maps/default/background.png"], // animation frames
    ground: "maps/default/ground.png",
    toppipe: "maps/default/toppipe.png",
    botpipe: "maps/default/botpipe.png",
    animationSpeed: 0
  },
  city: {
    background: ["maps/city/background_day.png", "maps/city/background_night.png"],
    ground: "maps/city/ground_city.png",
    toppipe: "maps/city/toppipe_city.png",
    botpipe: "maps/city/botpipe_city.png",
    animationSpeed: 100
  },
  forest: {
    background: ["maps/forest/background_forest.png"],
    ground: "maps/forest/ground_forest.png",
    toppipe: "maps/forest/toppipe_forest.png",
    botpipe: "maps/forest/botpipe_forest.png",
    animationSpeed: 0
  }
};

// --- Audio Assets ---
const sounds = {
  flap: new Audio("assets/sounds/flap.wav"),
  hit: new Audio("assets/sounds/hit.wav"),
  die: new Audio("assets/sounds/die.wav"),
  score: new Audio("assets/sounds/score.wav"),
  start: new Audio("assets/sounds/start.wav")
};

const bgMusic = new Audio("assets/sounds/bg.mp3");
bgMusic.loop = true;
bgMusic.volume = 0.4;

let selectedSkin = "bird1.png";
let selectedDifficulty = "normal";
let selectedMap = "default"; // Default map
let gameRunning = false;
let currentAnimationFrame;

// --- DOM Elements ---
const startMenu = document.getElementById("startMenu");
const gameOverMenu = document.getElementById("gameOverMenu");
const gameCanvas = document.getElementById("gameCanvas");
const startButton = document.getElementById("startButton");
const finalScoreDisplay = document.getElementById("finalScore");
const skinOptions = document.querySelectorAll(".skin-option");
const difficultyButtons = document.querySelectorAll(".difficulty-button");
const mapOptions = document.querySelectorAll(".map-option");

// --- Game State Variables ---
let birdY;
let velocity;
let score;
let pipes;
let frameCount;
let gameOverCurrentGame;
let _flapRequested = false;

// --- Dynamic Game Settings ---
let currentGameSettings = {};
let currentCanvasWidth;
let currentCanvasHeight;

// --- Animation Variables ---
let currentBackgroundFrameIndex = 0;
let backgroundAnimationCounter = 0;

document.addEventListener("DOMContentLoaded", () => {
  // Skin selection events
  skinOptions.forEach(option => {
    option.addEventListener("click", () => {
      skinOptions.forEach(opt => opt.classList.remove("selected"));
      option.classList.add("selected");
      selectedSkin = option.dataset.skin;
      console.log("Selected skin: " + selectedSkin);
    });
  });

  // Difficulty selection events
  difficultyButtons.forEach(button => {
    button.addEventListener("click", () => {
      difficultyButtons.forEach(btn => btn.classList.remove("selected"));
      button.classList.add("selected");
      selectedDifficulty = button.dataset.difficulty;
      console.log("Selected difficulty: " + selectedDifficulty);
    });
  });

  // Map selection events
  mapOptions.forEach(option => {
    option.addEventListener("click", () => {
      mapOptions.forEach(opt => opt.classList.remove("selected"));
      option.classList.add("selected");
      selectedMap = option.dataset.map;
      console.log("Selected map: " + selectedMap);
    });
  });

  // Start button
  startButton.addEventListener("click", () => {
    startMenu.style.display = "none";
    startGame();
  });

  // Setup input handlers for flap & restart
  setupInputHandlers();

  startMenu.style.display = "flex";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "none";

  // Ensure default selection UI
  document.querySelector(`.difficulty-button[data-difficulty="${selectedDifficulty}"]`)?.classList.add("selected");
  document.querySelector(`.map-option[data-map="${selectedMap}"]`)?.classList.add("selected");
  document.querySelector(`.skin-option[data-skin="${selectedSkin}"]`)?.classList.add("selected");
});

/**
 * Handles all player input (click or spacebar).
 * Decides whether to flap the bird or restart the game.
 */
function handleGameInput() {
  if (gameOverCurrentGame) {
    startGame();
  } else if (gameRunning) {
    _flapRequested = true;
    playSound(sounds.flap, "flap");
  }
}

function setupInputHandlers() {
  gameCanvas.addEventListener("click", () => {
    handleGameInput();
  });

  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault(); // prevent page scrolling on spacebar
      handleGameInput();
    }
  });

  // Also allow clicking on Game Over menu to restart
  gameOverMenu.addEventListener("click", () => {
    if (gameOverCurrentGame) {
      startGame();
    }
  });
}

/**
 * Loads an image and returns a Promise that resolves with the Image object.
 * Includes fallback logic if image fails to load.
 */
function loadImage(src, fallbackColor = null) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img);
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}. Using fallback.`);
      img.isFallback = true;
      img.fallbackColor = fallbackColor;
      resolve(img);
    };
  });
}

/**
 * Plays a sound, with error logging for potential autoplay issues.
 */
function playSound(sound, soundName) {
  sound.play().catch(error => {
    // Normally this error occurs due to autoplay policy
    console.warn(`Failed to play ${soundName} sound (may be autoplay policy):`, error);
  });
}

/**
 * Starts a new game instance. Hides menus, displays canvas, loads assets, and initializes game logic.
 */
function startGame() {
  if (gameRunning && !gameOverCurrentGame) return;

  // Set fixed canvas size from base settings (no scaling for now)
  gameCanvas.width = GAME_SETTINGS_BASE.CANVAS_WIDTH;
  gameCanvas.height = GAME_SETTINGS_BASE.CANVAS_HEIGHT;

  currentCanvasWidth = gameCanvas.width;
  currentCanvasHeight = gameCanvas.height;

  // Get map config
  const currentMapConfig = MAP_CONFIGS[selectedMap];

  currentGameSettings = {
    ...GAME_SETTINGS_BASE,
    ...DIFFICULTY_MODES[selectedDifficulty],
    CANVAS_WIDTH: currentCanvasWidth,
    CANVAS_HEIGHT: currentCanvasHeight,

    BIRD_WIDTH: GAME_SETTINGS_BASE.BIRD_WIDTH,
    BIRD_HEIGHT: GAME_SETTINGS_BASE.BIRD_HEIGHT,
    BIRD_START_X: GAME_SETTINGS_BASE.BIRD_START_X,

    PIPE_WIDTH: DIFFICULTY_MODES[selectedDifficulty].PIPE_WIDTH,
    PIPE_GAP: DIFFICULTY_MODES[selectedDifficulty].PIPE_GAP,
    BASE_HEIGHT_FALLBACK: GAME_SETTINGS_BASE.BASE_HEIGHT_FALLBACK,
    MIN_PIPE_TOP_HEIGHT: DIFFICULTY_MODES[selectedDifficulty].MIN_PIPE_TOP_HEIGHT,
    MAX_PIPE_TOP_HEIGHT_OFFSET: DIFFICULTY_MODES[selectedDifficulty].MAX_PIPE_TOP_HEIGHT_OFFSET,

    mapAnimationSpeed: currentMapConfig.animationSpeed
  };

  // Reset game state
  birdY = currentGameSettings.CANVAS_HEIGHT / 2 - currentGameSettings.BIRD_HEIGHT / 2;
  velocity = 0;
  score = 0;
  pipes = [];
  frameCount = 0;
  gameOverCurrentGame = false;
  _flapRequested = false;
  currentBackgroundFrameIndex = 0;
  backgroundAnimationCounter = 0;

  // Show/hide menus and canvas
  startMenu.style.display = "none";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "block";

  // Cancel any running animation frame
  if (currentAnimationFrame) {
    cancelAnimationFrame(currentAnimationFrame);
  }

  if (!gameRunning) {
    playSound(sounds.start, "start");
  }
  bgMusic.currentTime = 0; // Reset music to start
  playSound(bgMusic, "background music");

  gameRunning = true;

  // Load all assets
  const backgroundPromises = currentMapConfig.background.map(src => loadImage(`assets/${src}`, "lightblue"));

  const assetPromises = [
    loadImage(`assets/birds/${selectedSkin}`, "yellow"),
    ...backgroundPromises,
    loadImage(`assets/${currentMapConfig.toppipe}`, "green"),
    loadImage(`assets/${currentMapConfig.botpipe}`, "green"),
    loadImage(`assets/${currentMapConfig.ground}`, "brown")
  ];

  Promise.all(assetPromises).then(images => {
    const birdImg = images[0];
    const backgrounds = images.slice(1, 1 + currentMapConfig.background.length);
    const topPipeImg = images[1 + currentMapConfig.background.length];
    const botPipeImg = images[2 + currentMapConfig.background.length];
    const groundImg = images[3 + currentMapConfig.background.length];

    runGameLoop(birdImg, backgrounds, topPipeImg, botPipeImg, groundImg);
  });
}

/**
 * Ends the game: stops music, plays sounds, shows game over menu with final score, hides canvas.
 */
function endGame() {
  gameRunning = false;
  gameOverCurrentGame = true;

  playSound(sounds.hit, "hit");
  playSound(sounds.die, "die");
  bgMusic.pause();

  finalScoreDisplay.textContent = `Điểm của bạn: ${score}`;

  gameOverMenu.style.display = "flex";
  gameCanvas.style.display = "none";
}

/**
 * Runs the main game loop using requestAnimationFrame.
 * Handles game state updates, rendering, pipe spawning, collision detection, scoring, and animation.
 */
function runGameLoop(birdImg, backgrounds, topPipeImg, botPipeImg, groundImg) {
  const ctx = gameCanvas.getContext("2d");

  function drawFallbackRect(color, x, y, w, h) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, h);
  }

  function drawBackground() {
    // Handle background animation cycling
    if (backgrounds.length > 1) {
      backgroundAnimationCounter++;
      if (backgroundAnimationCounter > currentGameSettings.mapAnimationSpeed) {
        currentBackgroundFrameIndex = (currentBackgroundFrameIndex + 1) % backgrounds.length;
        backgroundAnimationCounter = 0;
      }
    } else {
      currentBackgroundFrameIndex = 0;
    }

    const bgImg = backgrounds[currentBackgroundFrameIndex];
    if (bgImg.isFallback) {
      drawFallbackRect(bgImg.fallbackColor, 0, 0, currentCanvasWidth, currentCanvasHeight);
    } else {
      ctx.drawImage(bgImg, 0, 0, currentCanvasWidth, currentCanvasHeight);
    }
  }

  // We use a list of pipe objects { x, topHeight }
  // Pipes move left with speed, new pipes spawn every PIPE_SPAWN_RATE frames

  function spawnPipe() {
    const minHeight = currentGameSettings.MIN_PIPE_TOP_HEIGHT;
    const maxHeight = minHeight + currentGameSettings.MAX_PIPE_TOP_HEIGHT_OFFSET;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight)) + minHeight;

    pipes.push({
      x: currentCanvasWidth,
      topHeight
    });
  }

  function drawPipes() {
    pipes.forEach(pipe => {
      // Draw top pipe
      if (topPipeImg.isFallback) {
        drawFallbackRect(topPipeImg.fallbackColor, pipe.x, 0, currentGameSettings.PIPE_WIDTH, pipe.topHeight);
      } else {
        // Draw top pipe flipped vertically (we flip by drawing from bottom up)
        ctx.save();
        ctx.translate(pipe.x + currentGameSettings.PIPE_WIDTH / 2, pipe.topHeight);
        ctx.scale(1, -1);
        ctx.drawImage(topPipeImg, -currentGameSettings.PIPE_WIDTH / 2, 0, currentGameSettings.PIPE_WIDTH, pipe.topHeight);
        ctx.restore();
      }

      // Draw bottom pipe
      const botY = pipe.topHeight + currentGameSettings.PIPE_GAP;
      const botHeight = currentCanvasHeight - botY - currentGameSettings.BASE_HEIGHT_FALLBACK;
      if (botPipeImg.isFallback) {
        drawFallbackRect(botPipeImg.fallbackColor, pipe.x, botY, currentGameSettings.PIPE_WIDTH, botHeight);
      } else {
        ctx.drawImage(botPipeImg, pipe.x, botY, currentGameSettings.PIPE_WIDTH, botHeight);
      }
    });
  }

  function movePipes() {
    const speed = 2 + (selectedDifficulty === "easy" ? 0 : selectedDifficulty === "normal" ? 1 : 2);
    pipes.forEach(pipe => {
      pipe.x -= speed;
    });

    // Remove off-screen pipes
    pipes = pipes.filter(pipe => pipe.x + currentGameSettings.PIPE_WIDTH > 0);
  }

  function drawGround() {
    if (groundImg.isFallback) {
      drawFallbackRect(groundImg.fallbackColor, 0, currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK, currentCanvasWidth, currentGameSettings.BASE_HEIGHT_FALLBACK);
    } else {
      ctx.drawImage(groundImg, 0, currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK, currentCanvasWidth, currentGameSettings.BASE_HEIGHT_FALLBACK);
    }
  }

  function drawBird() {
    if (birdImg.isFallback) {
      drawFallbackRect(birdImg.fallbackColor, currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT);
    } else {
      ctx.drawImage(birdImg, currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT);
    }
  }

  function checkCollision() {
    // Check collision with ground
    if (birdY + currentGameSettings.BIRD_HEIGHT > currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK) {
      return true;
    }

    // Check collision with pipes
    for (const pipe of pipes) {
      const birdRect = {
        x: currentGameSettings.BIRD_START_X,
        y: birdY,
        width: currentGameSettings.BIRD_WIDTH,
        height: currentGameSettings.BIRD_HEIGHT
      };

      const pipeTopRect = {
        x: pipe.x,
        y: 0,
        width: currentGameSettings.PIPE_WIDTH,
        height: pipe.topHeight
      };

      const pipeBottomRect = {
        x: pipe.x,
        y: pipe.topHeight + currentGameSettings.PIPE_GAP,
        width: currentGameSettings.PIPE_WIDTH,
        height: currentCanvasHeight - (pipe.topHeight + currentGameSettings.PIPE_GAP) - currentGameSettings.BASE_HEIGHT_FALLBACK
      };

      if (rectIntersect(birdRect, pipeTopRect) || rectIntersect(birdRect, pipeBottomRect)) {
        return true;
      }
    }
    return false;
  }

  function rectIntersect(r1, r2) {
    return !(r2.x > r1.x + r1.width ||
      r2.x + r2.width < r1.x ||
      r2.y > r1.y + r1.height ||
      r2.y + r2.height < r1.y);
  }

  function updateScore() {
    // Increase score when bird passes pipes
    pipes.forEach(pipe => {
      if (!pipe.passed && pipe.x + currentGameSettings.PIPE_WIDTH < currentGameSettings.BIRD_START_X) {
        score++;
        pipe.passed = true;
        playSound(sounds.score, "score");
      }
    });
  }

  function updateBird() {
    if (_flapRequested) {
      velocity = currentGameSettings.FLAP_STRENGTH;
      _flapRequested = false;
    }

    velocity += currentGameSettings.GRAVITY;
    birdY += velocity;

    // Prevent bird going above top of canvas
    if (birdY < 0) {
      birdY = 0;
      velocity = 0;
    }
  }

  function drawScore() {
    ctx.font = "bold 30px Arial";
    ctx.fillStyle = "white";
    ctx.shadowColor = "black";
    ctx.shadowBlur = 5;
    ctx.textAlign = "center";
    ctx.fillText(score, currentCanvasWidth / 2, 50);
    ctx.shadowBlur = 0;
  }

  function loop() {
    if (!gameRunning) return; // stop loop if game ended

    frameCount++;

    ctx.clearRect(0, 0, currentCanvasWidth, currentCanvasHeight);

    drawBackground();

    // Spawn pipe every PIPE_SPAWN_RATE frames
    if (frameCount % currentGameSettings.PIPE_SPAWN_RATE === 0) {
      spawnPipe();
    }

    movePipes();
    drawPipes();

    updateBird();
    drawBird();

    drawGround();

    updateScore();
    drawScore();

    if (checkCollision()) {
      endGame();
      return;
    }

    currentAnimationFrame = requestAnimationFrame(loop);
  }

  // Start the loop
  currentAnimationFrame = requestAnimationFrame(loop);
}
