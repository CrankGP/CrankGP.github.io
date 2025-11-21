let bgImg;
let mapImgColored;
let mapImgMask;
let landPixels = [];
let waterPixels = [];
let allowedHeadlinePixels = [];
let flowers = [];

let totalBirths = 57079;
let simulationDuration = 1000 * 60 * 1000;
let birthInterval = 0;
let birthsSoFar = 0;
let lastFlowerTime = 0;

// RSS
let headlines = [];
let shownHeadlines = [];
let headlineInterval = 2 * 60 * 1000;
let lastHeadlineTime = 0;

// Layers
let mapLayer, flowerLayer;

// Scaling
let scaleFactor = 1;

// Circle around map for headline constraint
let circleCenterX, circleCenterY;
let circleRadius;

function preload() {
  bgImg = loadImage("background2.jpg");
  mapImgColored = loadImage("denmark_colored2.png");
  mapImgMask = loadImage("denmark_mask2.png");
}

function setup() {
  createCanvas(windowWidth, windowHeight);

  noStroke();
  textAlign(CENTER, CENTER);
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

  // Compute circle around Denmark land (hugging black pixels)
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
  circleRadius = max(maxX - minX, maxY - minY) / 2 * 1.05; // 5% padding

  // Precompute allowed headline positions outside the circle
  for (let p of waterPixels) {
    let d = dist(p.x, p.y, circleCenterX, circleCenterY);
    if (d >= circleRadius) allowedHeadlinePixels.push(p);
  }

  // Load RSS and show first headline immediately
  let rssURL = "https://verdensbedstenyheder.dk/feed/";
  let apiURL = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(rssURL);
  loadRSS(apiURL);

  lastHeadlineTime = millis();

  updateScale();
}

function draw() {
  background(0);

  // Draw scaled background
  image(bgImg, 0, 0, width, height);

  push();
  translate((width - mapImgColored.width * scaleFactor) / 2, 
            (height - mapImgColored.height * scaleFactor) / 2);
  scale(scaleFactor);

  // Draw map and flowers
  image(mapLayer, 0, 0);
  image(flowerLayer, 0, 0);

  // Draw faint circle to show blocked area for headlines
  noFill();
  strokeWeight(2 / scaleFactor);
  ellipse(circleCenterX, circleCenterY, circleRadius * 2, circleRadius * 2);

  // Add new flower
  if (birthsSoFar < totalBirths && millis() - lastFlowerTime >= birthInterval && landPixels.length > 0) {
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x;
    let py = landPixels[idx].y;
    drawFlowerOnLayer(flowerLayer, px, py, 8);
    landPixels.splice(idx, 1);
    birthsSoFar++;
    lastFlowerTime = millis();
  }

  // Add headline every 2 minutes
  let now = millis();
  if (headlines.length > 0 && now - lastHeadlineTime >= headlineInterval) {
    let headlineText = headlines.shift();

    if (allowedHeadlinePixels.length > 0) {
      let px, py;
      let attempts = 0;

      do {
        let idx = floor(random(allowedHeadlinePixels.length));
        px = allowedHeadlinePixels[idx].x;
        py = allowedHeadlinePixels[idx].y;

        // Convert to canvas coordinates for checking
        let canvasX = px * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2;
        let canvasY = py * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2;

        let cX = circleCenterX * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2;
        let cY = circleCenterY * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2;

        if (dist(canvasX, canvasY, cX, cY) >= circleRadius * scaleFactor) break;
        attempts++;
      } while (attempts < 100);

      if (attempts < 100) {
        shownHeadlines.push({ text: headlineText, x: px, y: py });
      }
    }

    lastHeadlineTime = now;
  }

  // Draw headlines scaled with map
  for (let h of shownHeadlines) {
    push();
    translate((width - mapImgColored.width * scaleFactor) / 2,
              (height - mapImgColored.height * scaleFactor) / 2);
    scale(scaleFactor);
    fill(255);
    noStroke();
    textSize(16 / scaleFactor);
    text(h.text, h.x, h.y);
    pop();
  }

  pop();

  // Completion message
  if (birthsSoFar >= totalBirths) {
    fill(0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width / 2, height / 2);
  }
}

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

function loadRSS(apiURL) {
  fetch(apiURL)
    .then(res => res.json())
    .then(data => {
      if (data.status === "ok" && data.items) {
        headlines = data.items.map(item => item.title);

        // Show first headline immediately
        if (headlines.length > 0 && allowedHeadlinePixels.length > 0) {
          let idx = floor(random(allowedHeadlinePixels.length));
          let px = allowedHeadlinePixels[idx].x;
          let py = allowedHeadlinePixels[idx].y;

          let firstHeadline = headlines.shift();

          // Convert map coords to canvas
          let canvasX = px * scaleFactor + (width - mapImgColored.width * scaleFactor) / 2;
          let canvasY = py * scaleFactor + (height - mapImgColored.height * scaleFactor) / 2;

          let textW = textWidth(firstHeadline);
          let textH = textAscent();
          canvasX = constrain(canvasX, textW / 2, width - textW / 2);
          canvasY = constrain(canvasY, textH / 2, height - textH / 2);

          px = (canvasX - (width - mapImgColored.width * scaleFactor) / 2) / scaleFactor;
          py = (canvasY - (height - mapImgColored.height * scaleFactor) / 2) / scaleFactor;

          shownHeadlines.push({ text: firstHeadline, x: px, y: py });
        }
      } else console.error("RSS2JSON returned error:", data);
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
