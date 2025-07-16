// Game default settings (These are the *logical* dimensions for game calculations)
const GAME_SETTINGS_BASE = {
  CANVAS_WIDTH: 400,
  CANVAS_HEIGHT: 600,
  BIRD_WIDTH: 50,
  BIRD_HEIGHT: 50,
  BIRD_START_X: 100,
  BASE_HEIGHT_FALLBACK: 60 // Fallback height for the ground if image fails to load
};

// --- Difficulty Modes Configuration ---
const DIFFICULTY_MODES = {
  easy: {
    GRAVITY: 0.5,
    FLAP_STRENGTH: -8,
    PIPE_WIDTH: 65,
    PIPE_GAP: 160,
    PIPE_SPAWN_RATE: 150, // How often pipes appear (frames)
    MIN_PIPE_TOP_HEIGHT: 70,
    MAX_PIPE_TOP_HEIGHT_OFFSET: 70 // Offset from bottom to ensure pipe doesn't go too low
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
    background: ["maps/default/background.png"], // Array for animation frames (single frame here)
    ground: "maps/default/ground.png",
    toppipe: "maps/default/toppipe.png",
    botpipe: "maps/default/botpipe.png",
    animationSpeed: 0 // No animation for this map
  },
  city: {
    background: ["maps/city/background_day.png", "maps/city/background_night.png"], // 2 frames for day/night animation
    ground: "maps/city/ground_city.png",
    toppipe: "maps/city/toppipe_city.png",
    botpipe: "maps/city/botpipe_city.png",
    animationSpeed: 100 // Frame transition speed (every 100 game frames)
  },
  forest: {
    background: ["maps/forest/background_forest.png"], // This map has no background animation
    ground: "maps/forest/ground_forest.png",
    toppipe: "maps/forest/toppipe_forest.png",
    botpipe: "maps/forest/botpipe_forest.png",
    animationSpeed: 0
  }
};

// --- Audio Assets ---
// Using new Audio() for sound effects
const sounds = {
  flap: new Audio("assets/sounds/flap.wav"),
  hit: new Audio("assets/sounds/hit.wav"),
  die: new Audio("assets/sounds/die.wav"),
  score: new Audio("assets/sounds/score.wav"),
  start: new Audio("assets/sounds/start.wav")
};

// Background music setup
const bgMusic = new Audio("assets/sounds/bg.mp3");
bgMusic.loop = true; // Loop the background music
bgMusic.volume = 0.4; // Set volume

// --- Game Selection Variables ---
let selectedSkin = "bird1.png"; // Default bird skin
let selectedDifficulty = "normal"; // Default difficulty
let selectedMap = "default"; // Default map
let gameRunning = false; // Flag to indicate if the game loop is active
let currentAnimationFrame; // Stores the requestAnimationFrame ID

// --- DOM Elements ---
// Get references to HTML elements by their IDs
const startMenu = document.getElementById("startMenu");
const gameOverMenu = document.getElementById("gameOverMenu");
const gameCanvas = document.getElementById("gameCanvas");
const startButton = document.getElementById("startButton");
const finalScoreDisplay = document.getElementById("finalScore");
const skinOptions = document.querySelectorAll(".skin-option"); // All bird skin options
const difficultyButtons = document.querySelectorAll(".difficulty-button"); // All difficulty buttons
const mapOptions = document.querySelectorAll(".map-option"); // All map options

// --- Game State Variables (reset for each new game) ---
let birdY; // Bird's vertical position
let velocity; // Bird's vertical velocity
let score; // Player's score
let pipes; // Array to store active pipes
let frameCount; // Counter for game frames (used for pipe spawning)
let gameOverCurrentGame; // Flag for current game's over state
let _flapRequested = false; // Flag to indicate if a flap was requested by user input

// --- Dynamic Game Settings (will be updated based on difficulty and actual canvas size) ---
let currentGameSettings = {}; // Holds the combined and scaled game settings
let currentCanvasWidth; // Actual width of the canvas in pixels
let currentCanvasHeight; // Actual height of the canvas in pixels

// --- Animation Variables (MỚI) ---
let currentBackgroundFrameIndex = 0; // Current frame index for animated backgrounds
let backgroundAnimationCounter = 0; // Counter to control background animation speed


// --- DOM Content Loaded Listener ---
// This ensures the script runs after the entire HTML document is loaded
document.addEventListener("DOMContentLoaded", () => {
  // Event listeners for bird skin selection
  skinOptions.forEach(option => {
    option.addEventListener("click", () => {
      skinOptions.forEach(opt => opt.classList.remove("selected")); // Remove 'selected' from all
      option.classList.add("selected"); // Add 'selected' to clicked option
      selectedSkin = option.dataset.skin; // Update selected skin based on data-skin attribute
      console.log("Selected skin: " + selectedSkin);
    });
  });

  // Event listeners for difficulty selection
  difficultyButtons.forEach(button => {
    button.addEventListener("click", () => {
      difficultyButtons.forEach(btn => btn.classList.remove("selected")); // Remove 'selected' from all
      button.classList.add("selected"); // Add 'selected' to clicked button
      selectedDifficulty = button.dataset.difficulty; // Update selected difficulty
      console.log("Selected difficulty: " + selectedDifficulty);
    });
  });

  // MỚI: Event listener for map selection
  mapOptions.forEach(option => {
    option.addEventListener("click", () => {
      mapOptions.forEach(opt => opt.classList.remove("selected")); // Remove 'selected' from all
      option.classList.add("selected"); // Add 'selected' to clicked option
      selectedMap = option.dataset.map; // Update selected map
      console.log("Selected map: " + selectedMap);
    });
  });

  // Event listener for the "Start" button
  startButton.addEventListener("click", () => {
    startMenu.style.display = "none"; // Hide the start menu
    startGame(); // Begin the game
  });

  // Event listener for game input (click on canvas or spacebar)
  // This handles flapping the bird when the game is running
  gameCanvas.addEventListener("click", handleGameInput);
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      handleGameInput();
    }
  });

  // FIX FOR ANDROID RESTART ISSUE:
  // Add a click listener directly to the game over menu.
  // When the game is over, this overlay covers the canvas,
  // so clicking anywhere on it will trigger a restart.
  gameOverMenu.addEventListener("click", () => {
    if (gameOverCurrentGame) { // Only restart if the game is actually over
      console.log("Restarting game from game over menu click...");
      startGame(); // Call startGame to reset and begin a new game
    }
  });

  // Set initial display states for menus and canvas
  startMenu.style.display = "flex";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "none";

  // Ensure default selected buttons/options are visually marked
  document.querySelector(`.difficulty-button[data-difficulty="${selectedDifficulty}"]`).classList.add("selected");
  document.querySelector(`.map-option[data-map="${selectedMap}"]`).classList.add("selected");
});

/**
 * Handles all player input (click or spacebar).
 * This function is primarily for flapping the bird during active gameplay.
 * Restarting after game over is handled by the gameOverMenu's dedicated listener.
 */
function handleGameInput() {
  // Only process flap if the game is running and not in a game over state
  if (gameRunning && !gameOverCurrentGame) {
    _flapRequested = true; // Set flag to process flap in the next game loop iteration
    playSound(sounds.flap, "flap"); // Play flap sound
  }
}

/**
 * Loads an image and returns a Promise that resolves with the Image object.
 * Includes fallback logic if image fails to load, using a colored rectangle.
 * IMPORTANT: If you see a blue screen, it's likely an image failed to load.
 * Check your browser's console (F12 -> Console tab) for "Failed to load image" errors
 * and verify your 'assets/' folder structure and file names.
 */
function loadImage(src, fallbackColor = null) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = src;
    img.onload = () => resolve(img); // Resolve with the image on successful load
    img.onerror = () => {
      console.warn(`Failed to load image: ${src}. Using fallback. If a fallback color is not specified, a transparent rectangle will be used.`);
      // Attach fallback properties to the image object
      img.isFallback = true;
      img.fallbackColor = fallbackColor;
      resolve(img); // Still resolve, but with an image that has fallback properties
    };
  });
}

/**
 * Plays a sound, with error logging for potential autoplay issues.
 */
function playSound(sound, soundName) {
  sound.play().catch(error => {
    console.warn(`Failed to play ${soundName} sound (may be autoplay policy restrictions):`, error);
  });
}

/**
 * Starts a new game instance.
 * Hides menus, displays canvas, loads assets, and initializes game logic.
 */
function startGame() {
  // Prevent starting a new game if one is already running and not in game over state
  if (gameRunning && !gameOverCurrentGame) return;

  // Get actual canvas dimensions from DOM to ensure responsiveness
  currentCanvasWidth = gameCanvas.clientWidth;
  currentCanvasHeight = gameCanvas.clientHeight;

  // Calculate scaling factors based on actual vs. base logical dimensions
  const scaleX = currentCanvasWidth / GAME_SETTINGS_BASE.CANVAS_WIDTH;
  const scaleY = currentCanvasHeight / GAME_SETTINGS_BASE.CANVAS_HEIGHT;

  // Get current map configuration based on user selection
  const currentMapConfig = MAP_CONFIGS[selectedMap];

  // Dynamically set game settings based on selected difficulty and canvas size
  currentGameSettings = {
    ...GAME_SETTINGS_BASE, // Base logical settings
    ...DIFFICULTY_MODES[selectedDifficulty], // Difficulty-specific overrides
    CANVAS_WIDTH: currentCanvasWidth, // Use actual canvas width
    CANVAS_HEIGHT: currentCanvasHeight, // Use actual canvas height
    
    // Scale bird and pipe dimensions based on canvas scaling
    BIRD_WIDTH: GAME_SETTINGS_BASE.BIRD_WIDTH * scaleX,
    BIRD_HEIGHT: GAME_SETTINGS_BASE.BIRD_HEIGHT * scaleY,
    BIRD_START_X: GAME_SETTINGS_BASE.BIRD_START_X * scaleX,
    
    PIPE_WIDTH: DIFFICULTY_MODES[selectedDifficulty].PIPE_WIDTH * scaleX,
    PIPE_GAP: DIFFICULTY_MODES[selectedDifficulty].PIPE_GAP * scaleY,
    BASE_HEIGHT_FALLBACK: GAME_SETTINGS_BASE.BASE_HEIGHT_FALLBACK * scaleY,
    MIN_PIPE_TOP_HEIGHT: DIFFICULTY_MODES[selectedDifficulty].MIN_PIPE_TOP_HEIGHT * scaleY,
    MAX_PIPE_TOP_HEIGHT_OFFSET: DIFFICULTY_MODES[selectedDifficulty].MAX_PIPE_TOP_HEIGHT_OFFSET * scaleY,

    // Add map animation speed to current settings
    mapAnimationSpeed: currentMapConfig.animationSpeed 
  };

  // Reset all game state variables for a fresh game
  birdY = currentGameSettings.CANVAS_HEIGHT / 2 - currentGameSettings.BIRD_HEIGHT / 2; // Bird starts in middle
  velocity = 0; // Initial vertical velocity
  score = 0; // Reset score
  pipes = []; // Clear all pipes
  frameCount = 0; // Reset frame counter
  gameOverCurrentGame = false; // Game is not over
  _flapRequested = false; // No flap requested yet
  currentBackgroundFrameIndex = 0; // Reset background animation frame
  backgroundAnimationCounter = 0; // Reset background animation counter

  // Hide menus and show the game canvas
  startMenu.style.display = "none";
  gameOverMenu.style.display = "none"; // Ensure game over menu is hidden
  gameCanvas.style.display = "block";

  // Cancel any previously running animation frame to prevent multiple loops
  if (currentAnimationFrame) {
    cancelAnimationFrame(currentAnimationFrame);
  }

  // Play start sound only if the game was not running before (first start, not restart)
  if (!gameRunning) {
      playSound(sounds.start, "start");
  }
  playSound(bgMusic, "background music"); // Play background music

  gameRunning = true; // Set gameRunning to true to indicate game is active

  // Load all necessary game assets (bird, background(s), pipes, ground)
  // Background can be an array of image paths for animation
  const backgroundPromises = currentMapConfig.background.map(src => loadImage(`assets/${src}`, "lightblue"));

  const assetPromises = [
    loadImage(`assets/birds/${selectedSkin}`, "yellow"), // Bird image
    ...backgroundPromises, // All background images
    loadImage(`assets/${currentMapConfig.toppipe}`, "green"), // Top pipe image
    loadImage(`assets/${currentMapConfig.botpipe}`, "green"), // Bottom pipe image
    loadImage(`assets/${currentMapConfig.ground}`, "brown") // Ground image
  ];

  // Wait for all assets to load before starting the game loop
  Promise.all(assetPromises)
    .then(images => {
      // Destructure loaded images from the array
      const birdImg = images[0];
      const backgroundImgs = images.slice(1, 1 + currentMapConfig.background.length);
      const toppipeImg = images[1 + currentMapConfig.background.length];
      const botpipeImg = images[2 + currentMapConfig.background.length];
      const baseImg = images[3 + currentMapConfig.background.length];

      // Initialize and start the main game loop with loaded assets
      initGameLoop({ birdImg, backgroundImgs, toppipeImg, botpipeImg, baseImg });
    })
    .catch(error => {
      console.error("Error loading game assets:", error);
      // Display a user-friendly message if assets fail to load
      alert("Failed to load game assets. Please check the 'assets/' folder and file names. See console (F12) for details.");
      // Return to start menu if assets fail
      startMenu.style.display = "flex";
      gameCanvas.style.display = "none";
      gameRunning = false;
    });
}

/**
 * Initializes the game context and starts the main game loop.
 * @param {Object} assets - Object containing all loaded Image objects.
 */
function initGameLoop(assets) {
  const ctx = gameCanvas.getContext("2d"); // Get 2D rendering context

  // Set canvas dimensions to match the actual client dimensions
  gameCanvas.width = currentGameSettings.CANVAS_WIDTH;
  gameCanvas.height = currentGameSettings.CANVAS_HEIGHT;

  // Calculate font size for score based on canvas width
  const scoreFontSize = (currentGameSettings.CANVAS_WIDTH / GAME_SETTINGS_BASE.CANVAS_WIDTH) * 25;


  /**
   * Helper function to draw an image or a fallback colored rectangle if image fails to load.
   * @param {Image} img - The image object to draw.
   * @param {number} x - X coordinate.
   * @param {number} y - Y coordinate.
   * @param {number} width - Width to draw.
   * @param {number} height - Height to draw.
   * @param {string} fallbackColor - Color to use if image fails (e.g., "red", "blue").
   */
  function drawImageOrFallback(img, x, y, width, height, fallbackColor = null) {
    if (img && img.naturalWidth > 0) { // Check if image is loaded and has dimensions
      ctx.drawImage(img, x, y, width, height);
    } else {
      ctx.fillStyle = img.fallbackColor || fallbackColor || 'transparent'; // Use fallback color or transparent
      ctx.fillRect(x, y, width, height); // Draw a rectangle as fallback
    }
  }

  /**
   * The main game loop function.
   * This function is called repeatedly using requestAnimationFrame.
   */
  function gameLoop() {
    // If game is over, stop the loop, update score display, and show game over menu
    if (gameOverCurrentGame) {
      console.log("Game Over, final score: " + score);
      gameRunning = false; // Set gameRunning to false
      finalScoreDisplay.textContent = "Điểm của bạn: " + score; // Update final score
      gameOverMenu.style.display = "flex"; // Show game over menu
      return; // Stop the animation loop
    }

    ctx.clearRect(0, 0, currentGameSettings.CANVAS_WIDTH, currentGameSettings.CANVAS_HEIGHT); // Clear canvas
    frameCount++; // Increment frame counter

    // MỚI: Handle and draw background animation if multiple frames and animation speed is set
    if (assets.backgroundImgs.length > 1 && currentGameSettings.mapAnimationSpeed > 0) {
      backgroundAnimationCounter++;
      if (backgroundAnimationCounter >= currentGameSettings.mapAnimationSpeed) {
        currentBackgroundFrameIndex = (currentBackgroundFrameIndex + 1) % assets.backgroundImgs.length;
        backgroundAnimationCounter = 0;
      }
    }
    // Draw the current background frame
    drawImageOrFallback(assets.backgroundImgs[currentBackgroundFrameIndex], 0, 0, currentGameSettings.CANVAS_WIDTH, currentGameSettings.CANVAS_HEIGHT, "lightblue");

    // Spawn new pipes at a defined rate
    if (frameCount % currentGameSettings.PIPE_SPAWN_RATE === 0) {
      const minPipeTopHeight = currentGameSettings.MIN_PIPE_TOP_HEIGHT;
      // Calculate max height for the top pipe, considering ground height and pipe gap
      const maxPipeTopHeight = currentGameSettings.CANVAS_HEIGHT - (assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK) - currentGameSettings.PIPE_GAP - currentGameSettings.MAX_PIPE_TOP_HEIGHT_OFFSET;

      const actualMax = Math.max(minPipeTopHeight, maxPipeTopHeight); // Ensure max is not less than min
      const pipeTopHeight = Math.random() * (actualMax - minPipeTopHeight) + minPipeTopHeight; // Random top pipe height

      pipes.push({ x: currentGameSettings.CANVAS_WIDTH, height: pipeTopHeight, scored: false }); // Add new pipe
    }

    // Update and draw pipes
    // Filter out pipes that have moved off-screen to the left
    pipes = pipes.filter(pipe => pipe.x > -currentGameSettings.PIPE_WIDTH);
    pipes.forEach(pipe => {
      pipe.x -= 2; // Move pipe to the left (speed)

      // Draw top pipe (inverted)
      drawImageOrFallback(assets.toppipeImg, pipe.x, pipe.height - assets.toppipeImg.height, currentGameSettings.PIPE_WIDTH, assets.toppipeImg.height, "green");
      // Draw bottom pipe
      drawImageOrFallback(assets.botpipeImg, pipe.x, pipe.height + currentGameSettings.PIPE_GAP, currentGameSettings.PIPE_WIDTH, currentGameSettings.CANVAS_HEIGHT - (pipe.height + currentGameSettings.PIPE_GAP) - (assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK), "green");

      // --- Collision detection with pipes ---
      const birdRight = currentGameSettings.BIRD_START_X + currentGameSettings.BIRD_WIDTH;
      const birdBottom = birdY + currentGameSettings.BIRD_HEIGHT;
      const pipeRight = pipe.x + currentGameSettings.PIPE_WIDTH;

      // Check for horizontal overlap AND vertical overlap with either top or bottom pipe
      if (
        birdRight > pipe.x && // Bird's right edge is past pipe's left edge
        currentGameSettings.BIRD_START_X < pipeRight && // Bird's left edge is before pipe's right edge
        (birdY < pipe.height || birdBottom > pipe.height + currentGameSettings.PIPE_GAP) // Bird is too high OR too low
      ) {
        gameOverCurrentGame = true; // Set game over flag
        playSound(sounds.hit, "hit"); // Play hit sound
        setTimeout(() => playSound(sounds.die, "die"), 300); // Play die sound after a short delay
        return; // Exit gameLoop early on collision to prevent further updates
      }

      // Score logic: Increment score if bird has passed the pipe and hasn't been scored yet
      if (!pipe.scored && pipeRight < currentGameSettings.BIRD_START_X) {
        score++;
        playSound(sounds.score, "score"); // Play score sound
        pipe.scored = true; // Mark pipe as scored
      }
    });

    // Draw base (ground)
    const baseEffectiveHeight = assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK;
    drawImageOrFallback(assets.baseImg, 0, currentGameSettings.CANVAS_HEIGHT - baseEffectiveHeight, currentGameSettings.CANVAS_WIDTH, baseEffectiveHeight, "brown");

    // Update bird's vertical position based on velocity and gravity
    velocity += currentGameSettings.GRAVITY; // Apply gravity
    birdY += velocity; // Update position

    // Process flap request: If flap was requested, apply flap strength to velocity
    if (_flapRequested) {
      velocity = currentGameSettings.FLAP_STRENGTH;
      _flapRequested = false; // Reset flap request
    }

    // Draw bird at its current position
    drawImageOrFallback(assets.birdImg, currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT, "yellow");

    // --- Collision with base (ground) or top of canvas ---
    if (birdY + currentGameSettings.BIRD_HEIGHT > currentGameSettings.CANVAS_HEIGHT - baseEffectiveHeight || birdY < 0) {
      gameOverCurrentGame = true; // Set game over flag
      playSound(sounds.hit, "hit"); // Play hit sound
      setTimeout(() => playSound(sounds.die, "die"), 300); // Play die sound after a short delay
      return; // Exit gameLoop early on collision
    }

    // Draw score on the canvas
    ctx.fillStyle = "black";
    ctx.font = `${scoreFontSize}px 'Press Start 2P'`; // Set font style
    ctx.fillText("SCORE: " + score, currentGameSettings.CANVAS_WIDTH * 0.04, currentGameSettings.CANVAS_HEIGHT * 0.07);

    // Request the next animation frame to continue the loop
    currentAnimationFrame = requestAnimationFrame(gameLoop);
  }

  // Start the game loop
  gameLoop();
}

