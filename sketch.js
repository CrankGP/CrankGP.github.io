let mapImgColored;
let mapImgMask;
let landPixels = [];

let totalBirths = 58000;
let simulationDuration = 10 * 60 * 1000; // 10 minutes
let birthInterval = 0;
let birthsSoFar = 0;
let lastBirthTime = 0;

let scaleX, scaleY; // scaling factors for responsive canvas

function preload() {
  mapImgColored = loadImage("denmark_colored.png"); // real colored map
  mapImgMask = loadImage("denmark_mask.png");       // black land / white sea
}

function setup() {
  createCanvas(windowWidth, windowHeight); // responsive canvas

  // Compute scale to fit window while maintaining aspect ratio
  scaleX = width / mapImgMask.width;
  scaleY = height / mapImgMask.height;

  // Draw scaled map
  background(255);
  image(mapImgColored, 0, 0, mapImgMask.width * scaleX, mapImgMask.height * scaleY);
  noStroke();

  // Precompute land pixels at original image coordinates
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
  if (birthsSoFar >= totalBirths) {
    fill(0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width / 2, height / 2);
    noLoop();
    return;
  }

  if (millis() - lastBirthTime >= birthInterval) {
    // Pick a random land pixel (original coordinates)
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x * scaleX;
    let py = landPixels[idx].y * scaleY;

    drawFlower(px, py, 8 * ((scaleX + scaleY) / 2)); // scale flower size

    birthsSoFar++;
    lastBirthTime = millis();
  }
}

// Draw a top-view flower at (x, y)
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

// Resize canvas when window changes
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  scaleX = width / mapImgMask.width;
  scaleY = height / mapImgMask.height;
  background(255);
  image(mapImgColored, 0, 0, mapImgMask.width * scaleX, mapImgMask.height * scaleY);
}
