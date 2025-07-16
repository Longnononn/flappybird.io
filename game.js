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
  document.querySelector(`.difficulty-button[data-difficulty="${selectedDifficulty}"]`).classList.add("selected");
  document.querySelector(`.map-option[data-map="${selectedMap}"]`).classList.add("selected");
});

/**
 * Handles all player input (click or spacebar).
 * Decides whether to flap the bird or restart the game.
 */
function handleGameInput() {
  if (gameOverCurrentGame) {
    console.log("Restarting game...");
    startGame();
  } else if (gameRunning) {
    _flapRequested = true;
    playSound(sounds.flap, "flap");
  }
}

function setupInputHandlers() {
  // Click on canvas to flap or restart
  gameCanvas.addEventListener("click", () => {
    handleGameInput();
  });

  // Click on game over menu to restart
  gameOverMenu.addEventListener("click", () => {
    if (gameOverCurrentGame) {
      startGame();
    }
  });

  // Click anywhere on body to restart if game over
  document.body.addEventListener("click", () => {
    if (gameOverCurrentGame) {
      startGame();
    }
  });

  // Prevent clicks on startMenu from bubbling to body (avoid accidental restart)
  startMenu.addEventListener("click", e => {
    e.stopPropagation();
  });

  // Space key to flap or restart
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      e.preventDefault(); // prevent page scrolling on spacebar
      handleGameInput();
    }
  });
}

/**
 * Loads an image and returns a Promise that resolves with the Image object.
 * Includes fallback logic if image fails to load.
 */
function loadImage(src, fallbackColor = null) {
  return new Promise((resolve, reject) => {
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
    console.warn(`Failed to play ${soundName} sound (may be autoplay policy):`, error);
  });
}

/**
 * Starts a new game instance. Hides menus, displays canvas, loads assets, and initializes game logic.
 */
function startGame() {
  if (gameRunning && !gameOverCurrentGame) return;

  // Get actual canvas size from DOM
  currentCanvasWidth = gameCanvas.clientWidth || GAME_SETTINGS_BASE.CANVAS_WIDTH;
  currentCanvasHeight = gameCanvas.clientHeight || GAME_SETTINGS_BASE.CANVAS_HEIGHT;

  // Set canvas width and height attributes (important for drawing scale)
  gameCanvas.width = currentCanvasWidth;
  gameCanvas.height = currentCanvasHeight;

  // Calculate scaling factors
  const scaleX = currentCanvasWidth / GAME_SETTINGS_BASE.CANVAS_WIDTH;
  const scaleY = currentCanvasHeight / GAME_SETTINGS_BASE.CANVAS_HEIGHT;

  // Get map config
  const currentMapConfig = MAP_CONFIGS[selectedMap];

  currentGameSettings = {
    ...GAME_SETTINGS_BASE,
    ...DIFFICULTY_MODES[selectedDifficulty],
    CANVAS_WIDTH: currentCanvasWidth,
    CANVAS_HEIGHT: currentCanvasHeight,

    BIRD_WIDTH: GAME_SETTINGS_BASE.BIRD_WIDTH * scaleX,
    BIRD_HEIGHT: GAME_SETTINGS_BASE.BIRD_HEIGHT * scaleY,
    BIRD_START_X: GAME_SETTINGS_BASE.BIRD_START_X * scaleX,

    PIPE_WIDTH: DIFFICULTY_MODES[selectedDifficulty].PIPE_WIDTH * scaleX,
    PIPE_GAP: DIFFICULTY_MODES[selectedDifficulty].PIPE_GAP * scaleY,
    BASE_HEIGHT_FALLBACK: GAME_SETTINGS_BASE.BASE_HEIGHT_FALLBACK * scaleY,
    MIN_PIPE_TOP_HEIGHT: DIFFICULTY_MODES[selectedDifficulty].MIN_PIPE_TOP_HEIGHT * scaleY,
    MAX_PIPE_TOP_HEIGHT_OFFSET: DIFFICULTY_MODES[selectedDifficulty].MAX_PIPE_TOP_HEIGHT_OFFSET * scaleY,

    mapConfig: currentMapConfig
  };

  birdY = currentCanvasHeight / 2 - currentGameSettings.BIRD_HEIGHT / 2;
  velocity = 0;
  score = 0;
  pipes = [];
  frameCount = 0;
  gameOverCurrentGame = false;
  _flapRequested = false;

  startMenu.style.display = "none";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "block";

  // Play background music
  bgMusic.currentTime = 0;
  bgMusic.play().catch(() => {});

  // Start game loop
  requestAnimationFrame(gameLoop);
  gameRunning = true;
  currentAnimationFrame = 0;
  backgroundAnimationCounter = 0;
  currentBackgroundFrameIndex = 0;

  console.log("Game started");
}

/**
 * Ends the current game, shows game over menu, stops the game loop.
 */
function endGame() {
  gameRunning = false;
  gameOverCurrentGame = true;

  playSound(sounds.hit, "hit");
  playSound(sounds.die, "die");
  bgMusic.pause();

  finalScoreDisplay.textContent = `Điểm của bạn: ${score}`;

  // Show game over menu
  gameOverMenu.style.display = "flex";
  startMenu.style.display = "none";

  // Keep canvas visible so user can see final frame behind the menu
  gameCanvas.style.display = "block";

  console.log("Game over");
}

/**
 * Draws the current frame of the game on canvas.
 */
async function gameLoop() {
  if (!gameRunning) return;

  const ctx = gameCanvas.getContext("2d");

  // Clear canvas
  ctx.clearRect(0, 0, currentCanvasWidth, currentCanvasHeight);

  // Load background image (animated if multiple frames)
  const bgFrames = currentGameSettings.mapConfig.background;
  backgroundAnimationCounter++;
  if (currentGameSettings.mapConfig.animationSpeed > 0) {
    if (backgroundAnimationCounter >= currentGameSettings.mapConfig.animationSpeed) {
      currentBackgroundFrameIndex = (currentBackgroundFrameIndex + 1) % bgFrames.length;
      backgroundAnimationCounter = 0;
    }
  }
  const bgImage = await loadImage(bgFrames[currentBackgroundFrameIndex]);

  // Draw background
  if (!bgImage.isFallback) {
    ctx.drawImage(bgImage, 0, 0, currentCanvasWidth, currentCanvasHeight);
  } else {
    ctx.fillStyle = "#cceeff";
    ctx.fillRect(0, 0, currentCanvasWidth, currentCanvasHeight);
  }

  // Draw pipes
  for (let pipe of pipes) {
    const topPipeImg = await loadImage(currentGameSettings.mapConfig.toppipe);
    const botPipeImg = await loadImage(currentGameSettings.mapConfig.botpipe);

    // Top pipe
    if (!topPipeImg.isFallback) {
      ctx.drawImage(topPipeImg, pipe.x, 0, currentGameSettings.PIPE_WIDTH, pipe.topHeight);
    } else {
      ctx.fillStyle = "green";
      ctx.fillRect(pipe.x, 0, currentGameSettings.PIPE_WIDTH, pipe.topHeight);
    }

    // Bottom pipe
    if (!botPipeImg.isFallback) {
      ctx.drawImage(botPipeImg, pipe.x, pipe.topHeight + currentGameSettings.PIPE_GAP, currentGameSettings.PIPE_WIDTH, currentCanvasHeight);
    } else {
      ctx.fillStyle = "green";
      ctx.fillRect(pipe.x, pipe.topHeight + currentGameSettings.PIPE_GAP, currentGameSettings.PIPE_WIDTH, currentCanvasHeight);
    }
  }

  // Draw ground
  const groundImg = await loadImage(currentGameSettings.mapConfig.ground);
  if (!groundImg.isFallback) {
    ctx.drawImage(groundImg, 0, currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK, currentCanvasWidth, currentGameSettings.BASE_HEIGHT_FALLBACK);
  } else {
    ctx.fillStyle = "#964B00";
    ctx.fillRect(0, currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK, currentCanvasWidth, currentGameSettings.BASE_HEIGHT_FALLBACK);
  }

  // Load bird image
  const birdImg = await loadImage(`assets/birds/${selectedSkin}`);
  if (!birdImg.isFallback) {
    ctx.drawImage(birdImg, currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT);
  } else {
    ctx.fillStyle = "yellow";
    ctx.fillRect(currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT);
  }

  // Apply gravity and flap velocity
  velocity += currentGameSettings.GRAVITY;
  if (_flapRequested) {
    velocity = currentGameSettings.FLAP_STRENGTH;
    _flapRequested = false;
  }
  birdY += velocity;

  // Prevent bird from going above canvas
  if (birdY < 0) {
    birdY = 0;
    velocity = 0;
  }

  // Check collision with ground
  if (birdY + currentGameSettings.BIRD_HEIGHT >= currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK) {
    birdY = currentCanvasHeight - currentGameSettings.BASE_HEIGHT_FALLBACK - currentGameSettings.BIRD_HEIGHT;
    endGame();
    return;
  }

  // Spawn pipes every PIPE_SPAWN_RATE frames
  if (frameCount % currentGameSettings.PIPE_SPAWN_RATE === 0) {
    const topPipeHeight = currentGameSettings.MIN_PIPE_TOP_HEIGHT + Math.random() * currentGameSettings.MAX_PIPE_TOP_HEIGHT_OFFSET;
    pipes.push({
      x: currentCanvasWidth,
      topHeight: topPipeHeight
    });
  }

  // Move pipes and check collisions
  for (let i = pipes.length - 1; i >= 0; i--) {
    pipes[i].x -= 2; // pipe speed

    // Remove pipes out of screen
    if (pipes[i].x + currentGameSettings.PIPE_WIDTH < 0) {
      pipes.splice(i, 1);
      score++;
      playSound(sounds.score, "score");
    } else {
      // Collision detection with bird
      const pipeX = pipes[i].x;
      const pipeWidth = currentGameSettings.PIPE_WIDTH;

      // Bird rectangle
      const birdRect = {
        x: currentGameSettings.BIRD_START_X,
        y: birdY,
        width: currentGameSettings.BIRD_WIDTH,
        height: currentGameSettings.BIRD_HEIGHT
      };

      // Top pipe rectangle
      const topPipeRect = {
        x: pipeX,
        y: 0,
        width: pipeWidth,
        height: pipes[i].topHeight
      };

      // Bottom pipe rectangle
      const bottomPipeRect = {
        x: pipeX,
        y: pipes[i].topHeight + currentGameSettings.PIPE_GAP,
        width: pipeWidth,
        height: currentCanvasHeight
      };

      if (rectsOverlap(birdRect, topPipeRect) || rectsOverlap(birdRect, bottomPipeRect)) {
        endGame();
        return;
      }
    }
  }

  // Draw score
  ctx.fillStyle = "#fff";
  ctx.font = "30px Arial";
  ctx.fillText(`Điểm: ${score}`, 10, 50);

  frameCount++;
  currentAnimationFrame++;

  requestAnimationFrame(gameLoop);
}

/**
 * Returns true if two rectangles overlap.
 * Rectangles defined by x,y,width,height
 */
function rectsOverlap(r1, r2) {
  return !(
    r1.x > r2.x + r2.width ||
    r1.x + r1.width < r2.x ||
    r1.y > r2.y + r2.height ||
    r1.y + r1.height < r2.y
  );
}
