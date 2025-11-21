let bgImg;
let mapImgColored;
let mapImgMask;
let landPixels = [];
let waterPixels = [];
let allowedHeadlinePixels = [];

let totalBirths = 57079;
let simulationDuration = 1000 * 60 * 1000;
let birthInterval = 0;
let birthsSoFar = 0;
let lastFlowerTime = 0;

// RSS
let headlines = [];
let shownHeadlines = [];
let headlineInterval = 30 * 1000; // 30 seconds
let lastHeadlineTime = 0;

// Layers
let mapLayer, flowerLayer;

// Scaling
let scaleFactor = 1;

// Circle around map for headline restriction
let circleCenterX, circleCenterY;
let circleRadius;

// Fonts
let fonts = [];

function preload() {
  bgImg = loadImage("background2.jpg");
  mapImgColored = loadImage("denmark_colored2.png");
  mapImgMask = loadImage("denmark_mask2.png");

  // Preload multiple fonts
  fonts.push(loadFont("fonts/Roboto_Condensed-Regular.ttf"));
  fonts.push(loadFont("fonts/arial_narrow_7.ttf"));
  fonts.push(loadFont("fonts/HappyTime.otf"));
  fonts.push(loadFont("fonts/Times New Normal Regular.ttf"));
  fonts.push(loadFont("fonts/NewYork.otf"));
  fonts.push(loadFont("fonts/Sunflower.otf"));
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  noStroke();
  textAlign(LEFT, TOP);
  textSize(16);
  fill(255);

  // Layers
  mapLayer = createGraphics(mapImgColored.width, mapImgColored.height);
  mapLayer.image(mapImgColored, 0, 0);

  flowerLayer = createGraphics(mapImgColored.width, mapImgColored.height);
  flowerLayer.clear();

  // Compute land & water pixels
  mapImgMask.loadPixels();
  for (let y = 0; y < mapImgMask.height; y++) {
    for (let x = 0; x < mapImgMask.width; x++) {
      let idx = (y * mapImgMask.width + x) * 4;
      let r = mapImgMask.pixels[idx];
      let g = mapImgMask.pixels[idx + 1];
      let b = mapImgMask.pixels[idx + 2];
      let brightnessValue = (r + g + b) / 3;
      if (brightnessValue < 50) landPixels.push({ x, y });
      else if (brightnessValue > 200) waterPixels.push({ x, y });
    }
  }

  birthInterval = simulationDuration / totalBirths;
  lastFlowerTime = millis();

  // Compute bounding circle for Denmark
  let minX = mapImgColored.width, maxX = 0;
  let minY = mapImgColored.height, maxY = 0;
  for (let p of landPixels) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  circleCenterX = (minX + maxX) / 2;
  circleCenterY = (minY + maxY) / 2;
  circleRadius = max(maxX - minX, maxY - minY) / 2 * 1.05;

  // Allowed headline pixels = water outside circle
  for (let p of waterPixels) {
    let d = dist(p.x, p.y, circleCenterX, circleCenterY);
    if (d >= circleRadius) allowedHeadlinePixels.push(p);
  }

  // Load RSS
  let rssURL = "https://verdensbedstenyheder.dk/feed/";
  let apiURL = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rssURL);
  loadRSS(apiURL);

  lastHeadlineTime = millis();
  updateScale();
}

function draw() {
  background(0);

  // Background
  image(bgImg, 0, 0, width, height);

  // Draw map & flowers
  push();
  translate((width - mapImgColored.width * scaleFactor) / 2,
            (height - mapImgColored.height * scaleFactor) / 2);
  scale(scaleFactor);

  image(mapLayer, 0, 0);
  image(flowerLayer, 0, 0);

  noFill();
  ellipse(circleCenterX, circleCenterY, circleRadius * 2, circleRadius * 2);

  // Flower spawning
  if (birthsSoFar < totalBirths && millis() - lastFlowerTime >= birthInterval && landPixels.length > 0) {
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x;
    let py = landPixels[idx].y;
    drawFlowerOnLayer(flowerLayer, px, py, 8);
    landPixels.splice(idx, 1);
    birthsSoFar++;
    lastFlowerTime = millis();
  }

  pop();

  // Headline logic
  handleHeadlines();

  // Draw headlines
  drawHeadlines();

  if (birthsSoFar >= totalBirths) {
    fill(0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width / 2, height / 2);
  }
}

//
// HEADLINE LOGIC + WRAPPING + RANDOM FONTS + WINDOW CONSTRAINT
//
function handleHeadlines() {
  let now = millis();

  if (headlines.length > 0 && now - lastHeadlineTime >= headlineInterval) {
    addHeadline(headlines.shift());
    lastHeadlineTime = now;
  }
}

// Add headline with overlap check, wrapping, random font, and inside-window constraint
function addHeadline(text) {
  let attempts = 0;

  while (attempts < 200) {
    let p = random(allowedHeadlinePixels);
    let px = p.x;
    let py = p.y;

    let screenX = px * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2;
    let screenY = py * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2;

    // Distance from circle to limit width
    let dx = screenX - (circleCenterX * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2);
    let dy = screenY - (circleCenterY * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2);
    let distanceToCenter = sqrt(dx*dx + dy*dy);
    let maxWidth = distanceToCenter - circleRadius * scaleFactor - 2;
    maxWidth = max(maxWidth, 50); // minimum width

    // Ensure headline stays inside canvas horizontally
    maxWidth = min(maxWidth, width - screenX - 10);

    // Ensure headline stays inside canvas vertically
    let maxHeight = height - screenY - 10;
    if (maxWidth < 50 || maxHeight < 20) {
      attempts++;
      continue; // try new random position
    }

    let temp = {
      text,
      x: px,
      y: py,
      screenX,
      screenY,
      alpha: 0,
      w: maxWidth,
      h: textAscent() * 1.2,
      font: random(fonts)
    };

    // Check overlap
    let ok = true;
    for (let h of shownHeadlines) {
      h.screenX = h.x * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2;
      h.screenY = h.y * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2;
      if (headlinesOverlap(temp, h)) ok = false;
    }

    if (ok) {
      shownHeadlines.push(temp);
      return;
    }

    attempts++;
  }
}

function headlinesOverlap(h1, h2) {
  let pad = 6;

  let x1 = h1.screenX;
  let y1 = h1.screenY;
  let x2 = x1 + h1.w;
  let y2 = y1 + h1.h;

  let x3 = h2.screenX;
  let y3 = h2.screenY;
  let x4 = x3 + h2.w;
  let y4 = y3 + h2.h;

  return !(x2 + pad < x3 ||
           x1 > x4 + pad ||
           y2 + pad < y3 ||
           y1 > y4 + pad);
}

// Draw headlines with fade-in, left-aligned wrapping, random font
function drawHeadlines() {
  push();
  textSize(18);
  noStroke();

  for (let h of shownHeadlines) {
    h.screenX = h.x * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2;
    h.screenY = h.y * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2;

    h.alpha = min(h.alpha + 2, 255);
    fill(255, h.alpha);

    textFont(h.font);
    textAlign(LEFT, TOP);
    textWrap(WORD);
    text(h.text, h.screenX, h.screenY, h.w);
  }

  pop();
}

//
// FLOWERS
//
function drawFlowerOnLayer(layer, x, y, size) {
  layer.push();
  layer.translate(x, y);
  let petals = 5;
  let petalLength = size;
  let petalWidth = size / 2;
  let centerColor = color(255, 220, 0);
  let petalColor = color(random(50, 255), random(50, 255), random(50, 255), 180);
  for (let i = 0; i < petals; i++) {
    let angle = TWO_PI / petals * i;
    layer.push();
    layer.rotate(angle);
    layer.fill(petalColor);
    layer.ellipse(0, petalLength / 2, petalWidth, petalLength);
    layer.pop();
  }
  layer.fill(centerColor);
  layer.ellipse(0, 0, size / 2, size / 2);
  layer.pop();
}

//
// RSS LOADING (first headline immediately shown)
//
function loadRSS(apiURL) {
  fetch(apiURL)
    .then(res => res.json())
    .then(data => {
      if (data.status === "ok" && data.items) {
        headlines = data.items.map(item => item.title);
        if (headlines.length > 0) addHeadline(headlines.shift());
      }
    })
    .catch(err => console.error("RSS fetch error:", err));
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateScale();
}

function updateScale() {
  scaleFactor = min(windowWidth / mapImgColored.width, windowHeight / mapImgColored.height);
}
