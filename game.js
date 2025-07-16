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

// --- Map Configurations (MỚI) ---
const MAP_CONFIGS = {
  default: {
    background: ["maps/default/background.png"], // Mảng cho các frame animation
    ground: "maps/default/ground.png",
    toppipe: "maps/default/toppipe.png",
    botpipe: "maps/default/botpipe.png",
    animationSpeed: 0 // Không có animation
  },
  city: {
    background: ["maps/city/background_day.png", "maps/city/background_night.png"], // 2 frame cho animation ngày/đêm
    ground: "maps/city/ground_city.png",
    toppipe: "maps/city/toppipe_city.png",
    botpipe: "maps/city/botpipe_city.png",
    animationSpeed: 100 // Tốc độ chuyển frame (mỗi 100 frame game)
  },
  forest: {
    background: ["maps/forest/background_forest.png"], // Map này không có animation background
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
let selectedMap = "default"; // MẶC ĐỊNH LÀ MAP 'default'
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
const mapOptions = document.querySelectorAll(".map-option"); // MỚI: Elements chọn map

// --- Game State Variables (reset for each new game) ---
let birdY;
let velocity;
let score;
let pipes;
let frameCount;
let gameOverCurrentGame;
let _flapRequested = false;

// --- Dynamic Game Settings (will be updated based on difficulty and actual canvas size) ---
let currentGameSettings = {};
let currentCanvasWidth;
let currentCanvasHeight;

// --- Animation Variables (MỚI) ---
let currentBackgroundFrameIndex = 0;
let backgroundAnimationCounter = 0;


// --- DOM Content Loaded Listener ---
document.addEventListener("DOMContentLoaded", () => {
  skinOptions.forEach(option => {
    option.addEventListener("click", () => {
      skinOptions.forEach(opt => opt.classList.remove("selected"));
      option.classList.add("selected");
      selectedSkin = option.dataset.skin;
      console.log("Selected skin: " + selectedSkin);
    });
  });

  difficultyButtons.forEach(button => {
    button.addEventListener("click", () => {
      difficultyButtons.forEach(btn => btn.classList.remove("selected"));
      button.classList.add("selected");
      selectedDifficulty = button.dataset.difficulty;
      console.log("Selected difficulty: " + selectedDifficulty);
    });
  });

  // MỚI: Event listener cho chọn Map
  mapOptions.forEach(option => {
    option.addEventListener("click", () => {
      mapOptions.forEach(opt => opt.classList.remove("selected"));
      option.classList.add("selected");
      selectedMap = option.dataset.map;
      console.log("Selected map: " + selectedMap);
    });
  });

  startButton.addEventListener("click", () => {
    startMenu.style.display = "none";
    startGame();
  });

  gameCanvas.addEventListener("click", handleGameInput);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      handleGameInput();
    }
  });

  startMenu.style.display = "flex";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "none";

  // Đảm bảo nút được chọn mặc định hiển thị đúng
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
      console.warn(`Failed to load image: ${src}. Using fallback. If a fallback color is not specified, a transparent rectangle will be used.`);
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

  // Lấy kích thước thực tế của canvas từ DOM
  currentCanvasWidth = gameCanvas.clientWidth;
  currentCanvasHeight = gameCanvas.clientHeight;

  // Tính toán tỷ lệ scaling dựa trên kích thước thực tế so với kích thước logic ban đầu
  const scaleX = currentCanvasWidth / GAME_SETTINGS_BASE.CANVAS_WIDTH;
  const scaleY = currentCanvasHeight / GAME_SETTINGS_BASE.CANVAS_HEIGHT;

  // Lấy cấu hình map hiện tại
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

    // MỚI: Thêm thông tin animation speed của map vào settings
    mapAnimationSpeed: currentMapConfig.animationSpeed 
  };

  // Reset game state variables for a new game
  birdY = currentGameSettings.CANVAS_HEIGHT / 2 - currentGameSettings.BIRD_HEIGHT / 2;
  velocity = 0;
  score = 0;
  pipes = [];
  frameCount = 0;
  gameOverCurrentGame = false;
  _flapRequested = false;
  currentBackgroundFrameIndex = 0; // Reset frame animation
  backgroundAnimationCounter = 0; // Reset counter

  // Hide menus and show canvas
  startMenu.style.display = "none";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "block";

  // Stop any previous animation frame
  if (currentAnimationFrame) {
    cancelAnimationFrame(currentAnimationFrame);
  }

  if (!gameRunning) {
      playSound(sounds.start, "start");
  }
  playSound(bgMusic, "background music");

  gameRunning = true;

  // MỚI: Load tất cả các hình ảnh cho map đã chọn
  // Lưu ý: background có thể là một mảng các đường dẫn
  const backgroundPromises = currentMapConfig.background.map(src => loadImage(`assets/${src}`, "lightblue"));

  const assetPromises = [
    loadImage(`assets/birds/${selectedSkin}`, "yellow"), // Đường dẫn chim đã cập nhật
    ...backgroundPromises, // Thêm các Promise tải background
    loadImage(`assets/${currentMapConfig.toppipe}`, "green"),
    loadImage(`assets/${currentMapConfig.botpipe}`, "green"),
    loadImage(`assets/${currentMapConfig.ground}`, "brown")
  ];

  Promise.all(assetPromises)
    .then(images => {
      const birdImg = images[0];
      const backgroundImgs = images.slice(1, 1 + currentMapConfig.background.length); // Lấy các ảnh background
      const toppipeImg = images[1 + currentMapConfig.background.length];
      const botpipeImg = images[2 + currentMapConfig.background.length];
      const baseImg = images[3 + currentMapConfig.background.length];

      // Truyền tất cả các background images vào initGameLoop
      initGameLoop({ birdImg, backgroundImgs, toppipeImg, botpipeImg, baseImg });
    })
    .catch(error => {
      console.error("Error loading game assets:", error);
      alert("Failed to load game assets. Please check the 'assets/' folder and file names.");
      startMenu.style.display = "flex";
      gameCanvas.style.display = "none";
      gameRunning = false;
    });
}

/**
 * Initializes the game state and starts the main game loop.
 */
function initGameLoop(assets) {
  const ctx = gameCanvas.getContext("2d");

  gameCanvas.width = currentGameSettings.CANVAS_WIDTH;
  gameCanvas.height = currentGameSettings.CANVAS_HEIGHT;

  const scoreFontSize = (currentGameSettings.CANVAS_WIDTH / GAME_SETTINGS_BASE.CANVAS_WIDTH) * 25;


  /**
   * Helper function to draw an image or a fallback rectangle.
   */
  function drawImageOrFallback(img, x, y, width, height, fallbackColor = null) {
    if (img && img.naturalWidth > 0) {
      ctx.drawImage(img, x, y, width, height);
    } else {
      ctx.fillStyle = img.fallbackColor || fallbackColor || 'transparent';
      ctx.fillRect(x, y, width, height);
    }
  }

  /**
   * The main game loop.
   */
  function gameLoop() {
    if (gameOverCurrentGame) {
      console.log("Game Over, final score: " + score);
      gameRunning = false;
      finalScoreDisplay.textContent = "Điểm của bạn: " + score;
      gameOverMenu.style.display = "flex";
      return;
    }

    ctx.clearRect(0, 0, currentGameSettings.CANVAS_WIDTH, currentGameSettings.CANVAS_HEIGHT);
    frameCount++;

    // MỚI: Xử lý và vẽ background animation
    if (assets.backgroundImgs.length > 1 && currentGameSettings.mapAnimationSpeed > 0) {
      backgroundAnimationCounter++;
      if (backgroundAnimationCounter >= currentGameSettings.mapAnimationSpeed) {
        currentBackgroundFrameIndex = (currentBackgroundFrameIndex + 1) % assets.backgroundImgs.length;
        backgroundAnimationCounter = 0;
      }
    }
    // Vẽ background hiện tại
    drawImageOrFallback(assets.backgroundImgs[currentBackgroundFrameIndex], 0, 0, currentGameSettings.CANVAS_WIDTH, currentGameSettings.CANVAS_HEIGHT, "lightblue");

    // Spawn new pipes
    if (frameCount % currentGameSettings.PIPE_SPAWN_RATE === 0) {
      const minPipeTopHeight = currentGameSettings.MIN_PIPE_TOP_HEIGHT;
      const maxPipeTopHeight = currentGameSettings.CANVAS_HEIGHT - (assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK) - currentGameSettings.PIPE_GAP - currentGameSettings.MAX_PIPE_TOP_HEIGHT_OFFSET;

      const actualMax = Math.max(minPipeTopHeight, maxPipeTopHeight);
      const pipeTopHeight = Math.random() * (actualMax - minPipeTopHeight) + minPipeTopHeight;

      pipes.push({ x: currentGameSettings.CANVAS_WIDTH, height: pipeTopHeight, scored: false });
    }

    // Update and draw pipes
    pipes = pipes.filter(pipe => pipe.x > -currentGameSettings.PIPE_WIDTH);
    pipes.forEach(pipe => {
      pipe.x -= 2;

      drawImageOrFallback(assets.toppipeImg, pipe.x, pipe.height - assets.toppipeImg.height, currentGameSettings.PIPE_WIDTH, assets.toppipeImg.height, "green");
      drawImageOrFallback(assets.botpipeImg, pipe.x, pipe.height + currentGameSettings.PIPE_GAP, currentGameSettings.PIPE_WIDTH, currentGameSettings.CANVAS_HEIGHT - (pipe.height + currentGameSettings.PIPE_GAP) - (assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK), "green");

      // --- Collision detection with pipes ---
      const birdRight = currentGameSettings.BIRD_START_X + currentGameSettings.BIRD_WIDTH;
      const birdBottom = birdY + currentGameSettings.BIRD_HEIGHT;
      const pipeRight = pipe.x + currentGameSettings.PIPE_WIDTH;

      if (
        birdRight > pipe.x &&
        currentGameSettings.BIRD_START_X < pipeRight &&
        (birdY < pipe.height || birdBottom > pipe.height + currentGameSettings.PIPE_GAP)
      ) {
        gameOverCurrentGame = true;
        playSound(sounds.hit, "hit");
        setTimeout(() => playSound(sounds.die, "die"), 300);
        return;
      }

      // Score logic
      if (!pipe.scored && pipeRight < currentGameSettings.BIRD_START_X) {
        score++;
        playSound(sounds.score, "score");
        pipe.scored = true;
      }
    });

    // Draw base (ground)
    const baseEffectiveHeight = assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK;
    drawImageOrFallback(assets.baseImg, 0, currentGameSettings.CANVAS_HEIGHT - baseEffectiveHeight, currentGameSettings.CANVAS_WIDTH, baseEffectiveHeight, "brown");

    // Update bird's vertical position
    velocity += currentGameSettings.GRAVITY;
    birdY += velocity;

    // Process flap request
    if (_flapRequested) {
      velocity = currentGameSettings.FLAP_STRENGTH;
      _flapRequested = false;
    }

    // Draw bird
    drawImageOrFallback(assets.birdImg, currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT, "yellow");

    // --- Collision with base or top of canvas ---
    if (birdY + currentGameSettings.BIRD_HEIGHT > currentGameSettings.CANVAS_HEIGHT - baseEffectiveHeight || birdY < 0) {
      gameOverCurrentGame = true;
      playSound(sounds.hit, "hit");
      setTimeout(() => playSound(sounds.die, "die"), 300);
      return;
    }

    // Draw score
    ctx.fillStyle = "black";
    ctx.font = `${scoreFontSize}px 'Press Start 2P'`;
    ctx.fillText("SCORE: " + score, currentGameSettings.CANVAS_WIDTH * 0.04, currentGameSettings.CANVAS_HEIGHT * 0.07);

    currentAnimationFrame = requestAnimationFrame(gameLoop);
  }

  gameLoop();
          }
