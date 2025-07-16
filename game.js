// --- GAME SETTINGS ---
const GAME_SETTINGS_BASE = { CANVAS_WIDTH: 400, CANVAS_HEIGHT: 600, BIRD_WIDTH: 50, BIRD_HEIGHT: 50, BIRD_START_X: 100, BASE_HEIGHT_FALLBACK: 60 };
const DIFFICULTY_MODES = {
  easy: { GRAVITY:0.5, FLAP_STRENGTH:-8, PIPE_WIDTH:65, PIPE_GAP:160, PIPE_SPAWN_RATE:150, MIN_PIPE_TOP_HEIGHT:70, MAX_PIPE_TOP_HEIGHT_OFFSET:70 },
  normal: { GRAVITY:0.6, FLAP_STRENGTH:-9, PIPE_WIDTH:70, PIPE_GAP:140, PIPE_SPAWN_RATE:130, MIN_PIPE_TOP_HEIGHT:60, MAX_PIPE_TOP_HEIGHT_OFFSET:60 },
  hard: { GRAVITY:0.7, FLAP_STRENGTH:-10, PIPE_WIDTH:75, PIPE_GAP:120, PIPE_SPAWN_RATE:110, MIN_PIPE_TOP_HEIGHT:50, MAX_PIPE_TOP_HEIGHT_OFFSET:50 }
};
const MAP_CONFIGS = {
  default: { background:["maps/default/background.png"], ground:"maps/default/ground.png", toppipe:"maps/default/toppipe.png", botpipe:"maps/default/botpipe.png", animationSpeed:0 },
  city:    { background:["maps/city/background_day.png","maps/city/background_night.png"], ground:"maps/city/ground_city.png", toppipe:"maps/city/toppipe_city.png", botpipe:"maps/city/botpipe_city.png", animationSpeed:100 },
  forest:  { background:["maps/forest/background_forest.png"], ground:"maps/forest/ground_forest.png", toppipe:"maps/forest/toppipe_forest.png", botpipe:"maps/forest/botpipe_forest.png", animationSpeed:0 }
};
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

// --- STATE VARIABLES ---
let selectedSkin="bird1.png", selectedDifficulty="normal", selectedMap="default";
let gameRunning=false, gameOverCurrentGame=false, _flapRequested=false;
let currentGameSettings={}, currentCanvasWidth, currentCanvasHeight;
let birdY, velocity, score, pipes, frameCount;
let currentBackgroundFrameIndex=0, backgroundAnimationCounter=0;
let currentAnimationFrame;

// --- DOM REFERENCES ---
const startMenu = document.getElementById("startMenu");
const gameOverMenu = document.getElementById("gameOverMenu");
const gameCanvas = document.getElementById("gameCanvas");
const startButton = document.getElementById("startButton");
const finalScoreDisplay = document.getElementById("finalScore");
const restartButton = document.getElementById("restartButton");
const skinOptions = document.querySelectorAll(".skin-option");
const difficultyButtons = document.querySelectorAll(".difficulty-button");
const mapOptions = document.querySelectorAll(".map-option");

document.addEventListener("DOMContentLoaded", () => {
  // Skin selection
  skinOptions.forEach(opt => opt.addEventListener("click", () => {
    skinOptions.forEach(o=>o.classList.remove("selected"));
    opt.classList.add("selected");
    selectedSkin = opt.dataset.skin;
  }));

  // Difficulty selection
  difficultyButtons.forEach(btn => btn.addEventListener("click", () => {
    difficultyButtons.forEach(b=>b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedDifficulty = btn.dataset.difficulty;
  }));

  // Map selection
  mapOptions.forEach(opt => opt.addEventListener("click", () => {
    mapOptions.forEach(o=>o.classList.remove("selected"));
    opt.classList.add("selected");
    selectedMap = opt.dataset.map;
  }));

  // Start button
  startButton.addEventListener("click", () => {
    startMenu.style.display = "none";
    startGame();
  });

  // Game canvas flap or restart
  gameCanvas.addEventListener("click", handleGameInput);

  // Game Over menu restart
  gameOverMenu.addEventListener("click", () => {
    if (gameOverCurrentGame) startGame();
  });

  // “Chơi lại” button
  restartButton.addEventListener("click", () => {
    if (gameOverCurrentGame) startGame();
  });

  // Space bar support
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") handleGameInput();
  });

  // Initial UI setup
  startMenu.style.display = "flex";
  gameOverMenu.style.display = "none";
  gameCanvas.style.display = "none";
  document.querySelector(`.difficulty-button[data-difficulty="${selectedDifficulty}"]`).classList.add("selected");
  document.querySelector(`.map-option[data-map="${selectedMap}"]`).classList.add("selected");
});

// Flap / restart logic
function handleGameInput() {
  if (gameOverCurrentGame) {
    if (gameOverMenu.style.display === "flex") startGame();
  } else if (gameRunning) {
    _flapRequested = true;
    playSound(sounds.flap,"flap");
  }
}

// Load image helper
function loadImage(src, fallbackColor = null) {
  return new Promise((res) => {
    const img = new Image();
    img.src = src;
    img.onload = () => res(img);
    img.onerror = () => { console.warn(`Image failed: ${src}`); img.isFallback = true; img.fallbackColor = fallbackColor; res(img); };
  });
}

// Play sound helper
function playSound(sound, name) {
  sound.play().catch(e=>console.warn(`Sound ${name} failed`, e));
}

function startGame() {
  if (gameRunning && !gameOverCurrentGame) return;

  currentCanvasWidth = gameCanvas.clientWidth;
  currentCanvasHeight = gameCanvas.clientHeight;

  const scaleX = currentCanvasWidth/GAME_SETTINGS_BASE.CANVAS_WIDTH;
  const scaleY = currentCanvasHeight/GAME_SETTINGS_BASE.CANVAS_HEIGHT;

  const mapCfg = MAP_CONFIGS[selectedMap];

  currentGameSettings = {
    ...GAME_SETTINGS_BASE,
    ...DIFFICULTY_MODES[selectedDifficulty],
    CANVAS_WIDTH:currentCanvasWidth,
    CANVAS_HEIGHT:currentCanvasHeight,
    BIRD_WIDTH:GAME_SETTINGS_BASE.BIRD_WIDTH*scaleX,
    BIRD_HEIGHT:GAME_SETTINGS_BASE.BIRD_HEIGHT*scaleY,
    BIRD_START_X:GAME_SETTINGS_BASE.BIRD_START_X*scaleX,
    PIPE_WIDTH:DIFFICULTY_MODES[selectedDifficulty].PIPE_WIDTH*scaleX,
    PIPE_GAP:DIFFICULTY_MODES[selectedDifficulty].PIPE_GAP*scaleY,
    BASE_HEIGHT_FALLBACK:GAME_SETTINGS_BASE.BASE_HEIGHT_FALLBACK*scaleY,
    MIN_PIPE_TOP_HEIGHT:DIFFICULTY_MODES[selectedDifficulty].MIN_PIPE_TOP_HEIGHT*scaleY,
    MAX_PIPE_TOP_HEIGHT_OFFSET:DIFFICULTY_MODES[selectedDifficulty].MAX_PIPE_TOP_HEIGHT_OFFSET*scaleY,
    mapAnimationSpeed:mapCfg.animationSpeed
  };

  // Reset state
  birdY = currentGameSettings.CANVAS_HEIGHT/2 - currentGameSettings.BIRD_HEIGHT/2;
  velocity = 0; score = 0; pipes = []; frameCount = 0;
  gameOverCurrentGame = false; _flapRequested = false;
  currentBackgroundFrameIndex = 0; backgroundAnimationCounter = 0;

  startMenu.style.display="none";
  gameOverMenu.style.display="none";
  gameCanvas.style.display="block";

  if (currentAnimationFrame) cancelAnimationFrame(currentAnimationFrame);

  playSound(sounds.start,"start");
  playSound(bgMusic,"bgMusic");

  const bgPromises = mapCfg.background.map(src => loadImage(`assets/${src}`, "lightblue"));
  const assetPromises = [ loadImage(`assets/birds/${selectedSkin}`, "yellow"), ...bgPromises,
    loadImage(`assets/${mapCfg.toppipe}`, "green"),
    loadImage(`assets/${mapCfg.botpipe}`, "green"),
    loadImage(`assets/${mapCfg.ground}`, "brown") ];

  Promise.all(assetPromises).then(images => {
    const birdImg = images[0];
    const backgroundImgs = images.slice(1,1+mapCfg.background.length);
    const toppipeImg = images[1+backgroundImgs.length];
    const botpipeImg = images[2+backgroundImgs.length];
    const baseImg = images[3+backgroundImgs.length];
    initGameLoop({birdImg,backgroundImgs,toppipeImg,botpipeImg,baseImg});
  }).catch(e=>{
    console.error("Assets load failed",e);
    alert("Không thể tải tài nguyên game.");
    startMenu.style.display="flex";
    gameCanvas.style.display="none";
    gameRunning=false;
  });
}

function initGameLoop(assets) {
  const ctx = gameCanvas.getContext("2d");
  gameCanvas.width = currentGameSettings.CANVAS_WIDTH;
  gameCanvas.height = currentGameSettings.CANVAS_HEIGHT;
  const scoreFontSize = currentGameSettings.CANVAS_WIDTH/GAME_SETTINGS_BASE.CANVAS_WIDTH*25;

  const drawImageOrFallback = (img,x,y,w,h,fallbackColor)=>{
    if (img.naturalWidth>0) ctx.drawImage(img,x,y,w,h);
    else { ctx.fillStyle = img.fallbackColor||fallbackColor||'transparent'; ctx.fillRect(x,y,w,h); }
  };

  function gameLoop() {
    if (gameOverCurrentGame) {
      gameRunning=false;
      finalScoreDisplay.textContent="Điểm của bạn: "+score;
      gameOverMenu.style.display="flex";
      return;
    }
    frameCount++;
    ctx.clearRect(0,0,currentGameSettings.CANVAS_WIDTH,currentGameSettings.CANVAS_HEIGHT);

    // Animated background
    if (assets.backgroundImgs.length>1 && currentGameSettings.mapAnimationSpeed>0) {
      backgroundAnimationCounter++;
      if (backgroundAnimationCounter>=currentGameSettings.mapAnimationSpeed) {
        currentBackgroundFrameIndex=(currentBackgroundFrameIndex+1)%assets.backgroundImgs.length;
        backgroundAnimationCounter=0;
      }
    }
    drawImageOrFallback(assets.backgroundImgs[currentBackgroundFrameIndex],0,0,currentGameSettings.CANVAS_WIDTH,currentGameSettings.CANVAS_HEIGHT,"lightblue");

    // Spawn pipes
    if (frameCount % currentGameSettings.PIPE_SPAWN_RATE === 0) {
      const minTop = currentGameSettings.MIN_PIPE_TOP_HEIGHT;
      const maxTop = currentGameSettings.CANVAS_HEIGHT - (assets.baseImg.height||currentGameSettings.BASE_HEIGHT_FALLBACK) - currentGameSettings.PIPE_GAP - currentGameSettings.MAX_PIPE_TOP_HEIGHT_OFFSET;
      const h = Math.random()*(Math.max(minTop,maxTop)-minTop)+minTop;
      pipes.push({ x: currentGameSettings.CANVAS_WIDTH, height: h, scored: false });
    }

    // Pipe updates
    pipes = pipes.filter(pipe => pipe.x > -currentGameSettings.PIPE_WIDTH);
    pipes.forEach(pipe => {
      pipe.x -= 2;
      drawImageOrFallback(assets.toppipeImg, pipe.x, pipe.height - assets.toppipeImg.height, currentGameSettings.PIPE_WIDTH, assets.toppipeImg.height, "green");
      drawImageOrFallback(assets.botpipeImg, pipe.x, pipe.height + currentGameSettings.PIPE_GAP, currentGameSettings.PIPE_WIDTH, currentGameSettings.CANVAS_HEIGHT - (pipe.height+currentGameSettings.PIPE_GAP)-(assets.baseImg.height||currentGameSettings.BASE_HEIGHT_FALLBACK), "green");

      // Collision
      const br = currentGameSettings.BIRD_START_X + currentGameSettings.BIRD_WIDTH;
      const bb = birdY + currentGameSettings.BIRD_HEIGHT;
      const pr = pipe.x + currentGameSettings.PIPE_WIDTH;
      if (br > pipe.x && currentGameSettings.BIRD_START_X < pr && (birdY < pipe.height || bb > pipe.height+currentGameSettings.PIPE_GAP)) {
        gameOverCurrentGame=true;
        playSound(sounds.hit,"hit");
        setTimeout(()=>playSound(sounds.die,"die"),300);
        return;
      }

      // Score
      if (!pipe.scored && pr < currentGameSettings.BIRD_START_X) {
        score++;
        playSound(sounds.score,"score");
        pipe.scored = true;
      }
    });

    // Base
    const baseH = assets.baseImg.height || currentGameSettings.BASE_HEIGHT_FALLBACK;
    drawImageOrFallback(assets.baseImg,0,currentGameSettings.CANVAS_HEIGHT-baseH,currentGameSettings.CANVAS_WIDTH,baseH,"brown");

    // Bird physics
    velocity += currentGameSettings.GRAVITY;
    birdY += velocity;
    if (_flapRequested) { velocity = currentGameSettings.FLAP_STRENGTH; _flapRequested = false; }

    // Draw bird
    drawImageOrFallback(assets.birdImg, currentGameSettings.BIRD_START_X, birdY, currentGameSettings.BIRD_WIDTH, currentGameSettings.BIRD_HEIGHT, "yellow");

    // Collision with floor or ceiling
    if (birdY + currentGameSettings.BIRD_HEIGHT > currentGameSettings.CANVAS_HEIGHT - baseH || birdY < 0) {
      gameOverCurrentGame = true;
      playSound(sounds.hit,"hit");
      setTimeout(()=>playSound(sounds.die,"die"),300);
      return;
    }

    // Draw score
    ctx.fillStyle = "black";
    ctx.font = `${scoreFontSize}px 'Press Start 2P'`;
    ctx.fillText("SCORE: "+score, currentGameSettings.CANVAS_WIDTH*0.04, currentGameSettings.CANVAS_HEIGHT*0.07);

    currentAnimationFrame = requestAnimationFrame(gameLoop);
  }

  gameLoop();
}
