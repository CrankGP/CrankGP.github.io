let mapImgColored;   // colored Denmark map
let mapImgMask;      // black land / white sea
let backgroundImg;   // background image
let landPixels = [];

let totalBirths = 58000;
let simulationDuration = 10 * 60 * 1000; // 10 minutes
let birthInterval = 0;
let birthsSoFar = 0;
let lastBirthTime = 0;

let scaleFactor = 1; // scaling factor to fit window

function preload() {
  backgroundImg = loadImage("background.jpg");  
  mapImgColored = loadImage("denmark_colored.png"); 
  mapImgMask = loadImage("denmark_mask.png");    
}

function setup() {
  let canvas = createCanvas(windowWidth, windowHeight);
  canvas.parent('canvas-container');
  noStroke();

  // Precompute land pixels
  mapImgMask.loadPixels();
  for (let y = 0; y < mapImgMask.height; y++) {
    for (let x = 0; x < mapImgMask.width; x++) {
      let index = (y * mapImgMask.width + x) * 4;
      let r = mapImgMask.pixels[index];
      let g = mapImgMask.pixels[index + 1];
      let b = mapImgMask.pixels[index + 2];
      let brightnessValue = (r + g + b) / 3;
      if (brightnessValue < 50) { // black = land
        landPixels.push({ x, y });
      }
    }
  }
  console.log("Total land pixels:", landPixels.length);

  birthInterval = simulationDuration / totalBirths;
  birthsSoFar = 0;
  lastBirthTime = millis();
}

function draw() {
  background(255); // optional base

  // Compute scale to fit window while maintaining map aspect ratio
  scaleFactor = min(width / mapImgMask.width, height / mapImgMask.height);

  push();
  scale(scaleFactor);

  // Draw background image scaled to map size
  image(backgroundImg, 0, 0, mapImgMask.width, mapImgMask.height);

  // Draw map on top
  image(mapImgColored, 0, 0);

  // Draw flowers
  if (birthsSoFar < totalBirths && millis() - lastBirthTime >= birthInterval) {
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x;
    let py = landPixels[idx].y;

    drawFlower(px, py, 8);

    birthsSoFar++;
    lastBirthTime = millis();
  }

  pop();

  // Simulation complete message
  if (birthsSoFar >= totalBirths) {
    fill(0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width / 2, height / 2);
    noLoop();
  }
}

function drawFlower(x, y, size) {
  push();
  translate(x, y);
  let petals = 5;
  let petalLength = size;
  let petalWidth = size / 2;
  let centerColor = color(255, 220, 0); // yellow center

  let petalColor = color(random(50, 255), random(50, 255), random(50, 255), 180);

  for (let i = 0; i < petals; i++) {
    let angle = TWO_PI / petals * i;
    push();
    rotate(angle);
    fill(petalColor);
    ellipse(0, petalLength / 2, petalWidth, petalLength);
    pop();
  }

  fill(centerColor);
  ellipse(0, 0, size / 2, size / 2);
  pop();
}

// Handle window resizing
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
