let bgImg;
let mapImgColored;
let mapImgMask;
let landPixels = [];
let waterPixels = [];
let allowedHeadlinePixels = [];

let totalBirths = 57079;
let simulationDuration = 120 * 60 * 1000;
let birthInterval = 0;
let birthsSoFar = 0;
let lastFlowerTime = 0;

// RSS / feeds
let feedURLs = [
  "https://verdensbedstenyheder.dk/emner/kloden/feed/",
  "https://verdensbedstenyheder.dk/emner/teknologi/feed/",
  "https://verdensbedstenyheder.dk/emner/mennesker/feed/"
];
let headlines = [];
let headlineInterval = 5 * 1000; // 30 seconds
let lastHeadlineTime = 0;
let shownHeadlines = [];

// Layers
let mapLayer, flowerLayer, staticFlowersLayer;

// Scaling
let scaleFactor = 1;
let zoomFactor = 1.6; // zoom map & flowers

// Map rectangle for headline constraint
let mapRect;

// Fonts
let fonts = [];
let counterFont;

// Headline wiggle
let wiggleAmplitude = 5;
let wiggleSpeed = 0.001; // slower wiggle

// Border margin for headlines
let borderMargin = 20;

// Max number of animated flowers
let maxActiveFlowers = 100;

function preload() {
  bgImg = loadImage("background2.jpg");
  mapImgColored = loadImage("denmark_colored2.png");
  mapImgMask = loadImage("denmark_mask2.png");

  fonts.push(loadFont("fonts/Roboto_Condensed-Regular.ttf"));
  fonts.push(loadFont("fonts/arial_narrow_7.ttf"));
  fonts.push(loadFont("fonts/HappyTime.otf"));
  fonts.push(loadFont("fonts/Times New Normal Regular.ttf"));
  fonts.push(loadFont("fonts/NewYork.otf"));
  fonts.push(loadFont("fonts/Sunflower.otf"));

  counterFont = loadFont("fonts/Sunflower.otf");
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  noStroke();
  textAlign(LEFT, TOP);
  textSize(16);
  fill(255);

  mapLayer = createGraphics(mapImgColored.width, mapImgColored.height);
  mapLayer.image(mapImgColored, 0, 0);

  flowerLayer = createGraphics(mapImgColored.width, mapImgColored.height);
  flowerLayer.flowers = [];
  flowerLayer.clear();

  staticFlowersLayer = createGraphics(mapImgColored.width, mapImgColored.height);
  staticFlowersLayer.clear();

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

  // Map rectangle
  let minX = mapImgColored.width, maxX = 0;
  let minY = mapImgColored.height, maxY = 0;
  for (let p of landPixels) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  mapRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  // Allowed headline pixels = water pixels outside rectangle
  for (let p of waterPixels) {
    if (p.x < mapRect.x || p.x > mapRect.x + mapRect.w ||
        p.y < mapRect.y || p.y > mapRect.y + mapRect.h) {
      allowedHeadlinePixels.push(p);
    }
  }

  updateScale();
  loadFeeds();
}

async function loadFeeds() {
  let all = [];
  for (let url of feedURLs) {
    let apiURL = "https://api.rss2json.com/v1/api.json?rss_url=" + encodeURIComponent(url);
    try {
      let res = await fetch(apiURL);
      let data = await res.json();
      if (data && data.items) {
        data.items.forEach(item => {
          if (item.title) all.push(item.title);
        });
      }
    } catch (e) {
      console.log("Failed feed:", url, e);
    }
  }
  if (all.length > 1) shuffle(all, true);
  headlines = all;

  if (headlines.length > 0) {
    addHeadline(headlines.shift());
    lastHeadlineTime = millis();
  }
}

function draw() {
  background(0);
  image(bgImg, 0, 0, width, height);

  push();
  translate((width - mapImgColored.width * scaleFactor * zoomFactor) / 2,
            (height - mapImgColored.height * scaleFactor * zoomFactor) / 2);
  scale(scaleFactor * zoomFactor);

  image(mapLayer, 0, 0);
  image(staticFlowersLayer, 0, 0); // draw frozen flowers

  // Animate active flowers
  flowerLayer.clear();
  for (let f of flowerLayer.flowers) {
    flowerLayer.push();
    flowerLayer.translate(f.x, f.y);
    let angleOffset = f.active ? sin(millis() * f.swaySpeed + f.phase) * PI / 4 : 0;
    flowerLayer.rotate(f.baseAngle + angleOffset);

    for (let i = 0; i < f.petals; i++) {
      let angle = TWO_PI / f.petals * i;
      flowerLayer.push();
      flowerLayer.rotate(angle);
      flowerLayer.fill(f.color);
      flowerLayer.ellipse(0, f.petalLength / 2, f.petalWidth, f.petalLength);
      flowerLayer.pop();
    }

    flowerLayer.fill(f.centerColor);
    flowerLayer.ellipse(0, 0, f.size / 2, f.size / 2);
    flowerLayer.pop();
  }
  image(flowerLayer, 0, 0);
  pop();

  // Spawn flowers
  if (birthsSoFar < totalBirths && millis() - lastFlowerTime >= birthInterval && landPixels.length > 0) {
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x;
    let py = landPixels[idx].y;
    drawFlowerOnLayer(flowerLayer, px, py, 8);
    landPixels.splice(idx, 1);
    birthsSoFar++;
    lastFlowerTime = millis();
  }

  // Headlines
  handleHeadlines();
  drawHeadlines();

  if (birthsSoFar >= totalBirths) {
    push();
    fill(255);
    textSize(28);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width / 2, height / 2);
    pop();
  }
}

function drawFlowerOnLayer(layer, x, y, baseSize) {
  let petals = floor(random(5, 10));
  let size = baseSize * random(0.8, 1.5);
  let petalLength = size * random(0.8, 1.2);
  let petalWidth = size * random(0.4, 0.8);
  let centerColor = color(255, 220, 0);
  let petalColor = color(random(100, 255), random(100, 255), random(100, 255), 180);
  let swaySpeed = random(0.0005, 0.002);
  let baseAngle = random(TWO_PI);

  // Deactivate flowers under the new flower
  for (let f of layer.flowers) {
    let d = dist(x, y, f.x, f.y);
    if (d < (size + f.size) / 2) f.active = false;
  }

  let newFlower = {
    x, y, size, petals, petalLength, petalWidth, centerColor, color: petalColor,
    baseAngle, swaySpeed, phase: random(TWO_PI), active: true
  };

  layer.flowers.push(newFlower);

  // Limit active flowers
  while (layer.flowers.length > maxActiveFlowers) {
    let oldFlower = layer.flowers.shift(); // remove oldest
    drawFlowerToStaticLayer(staticFlowersLayer, oldFlower);
  }
}

function drawFlowerToStaticLayer(layer, f) {
  layer.push();
  layer.translate(f.x, f.y);
  layer.rotate(f.baseAngle); // static, no sway

  for (let i = 0; i < f.petals; i++) {
    let angle = TWO_PI / f.petals * i;
    layer.push();
    layer.rotate(angle);
    layer.fill(f.color);
    layer.ellipse(0, f.petalLength / 2, f.petalWidth, f.petalLength);
    layer.pop();
  }

  layer.fill(f.centerColor);
  layer.ellipse(0, 0, f.size / 2, f.size / 2);
  layer.pop();
}

function handleHeadlines() {
  let now = millis();
  if (headlines.length > 0 && now - lastHeadlineTime >= headlineInterval) {
    addHeadline(headlines.shift());
    lastHeadlineTime = now;
  }
}

function addHeadline(text) {
  if (!text) return;
  let attempts = 0;
  while (attempts < 200) {
    let p = random(allowedHeadlinePixels);
    let px = p.x;
    let py = p.y;

    let screenX = px * scaleFactor * zoomFactor + (width - mapImgColored.width * scaleFactor * zoomFactor) / 2;
    let screenY = py * scaleFactor * zoomFactor + (height - mapImgColored.height * scaleFactor * zoomFactor) / 2;

    if (screenY < 50 + borderMargin || 
        screenX < borderMargin || 
        screenX > width - borderMargin || 
        screenY > height - borderMargin) {
      attempts++;
      continue;
    }

    let chosenFont = random(fonts);
    textFont(chosenFont);
    textSize(16);

    // compute max width based on window border
    let maxWidth = width - borderMargin*2 - (screenX - borderMargin);

    let maxLines = 3;
    let words = text.split(/\s+/);
    let lines = [];
    let line = "";

    for (let i = 0; i < words.length; i++) {
      let testLine = line ? line + " " + words[i] : words[i];
      if (textWidth(testLine) <= maxWidth) {
        line = testLine;
      } else {
        lines.push(line);
        line = words[i];
        if (lines.length >= maxLines) {
          line += "…";
          break;
        }
      }
    }
    if (lines.length < maxLines && line) lines.push(line);

    let fadeDuration = 10000; // 10 sec fade
    let visibleDuration = 30000; // 30 sec fully visible

    let temp = { 
      text, lines, x: px, y: py, screenX, screenY, 
      alpha: 0, font: chosenFont, phase: random(TWO_PI),
      createdAt: millis(),
      visibleDuration: visibleDuration,
      fadeDuration: fadeDuration
    };

    let ok = true;
    for (let h of shownHeadlines) {
      if (headlinesOverlap(temp, h)) { ok = false; break; }
    }

    if (ok) { shownHeadlines.push(temp); return; }
    attempts++;
  }
}

function headlinesOverlap(h1, h2) {
  let pad = 6;
  let x1 = h1.screenX, y1 = h1.screenY;
  let x2 = x1 + width/2, y2 = y1 + textAscent()*1.2*h1.lines.length;
  let x3 = h2.screenX, y3 = h2.screenY;
  let x4 = x3 + width/2, y4 = y3 + textAscent()*1.2*h2.lines.length;
  return !(x2 + pad < x3 || x1 > x4 + pad || y2 + pad < y3 || y1 > y4 + pad);
}

function drawHeadlines() {
  push();
  textSize(16);
  noStroke();
  let now = millis();

  for (let i = shownHeadlines.length - 1; i >= 0; i--) {
    let h = shownHeadlines[i];
    h.screenX = constrain(h.x * scaleFactor * zoomFactor + (width - mapImgColored.width * scaleFactor * zoomFactor) / 2, borderMargin, width - borderMargin);
    h.screenY = constrain(h.y * scaleFactor * zoomFactor + (height - mapImgColored.height * scaleFactor * zoomFactor) / 2, borderMargin, height - borderMargin);

    // Fade-in
    if (h.alpha < 255 && now - h.createdAt < h.visibleDuration) {
      h.alpha = min(h.alpha + 2, 255);
    }

    // Fade-out only if 5 or more headlines exist
    if (shownHeadlines.length >= 10) {
      let timeSinceVisibleEnd = now - h.createdAt - h.visibleDuration;
      if (timeSinceVisibleEnd > 0) {
        let fadeProgress = constrain(timeSinceVisibleEnd / h.fadeDuration, 0, 1);
        h.alpha = 255 * (1 - fadeProgress);
      }
    }

    // Remove headline if fully faded
    if (h.alpha <= 0) {
      shownHeadlines.splice(i, 1);
      continue;
    }

    textFont(h.font);
    textAlign(LEFT, TOP);
    let xOffset = sin(now * wiggleSpeed + h.phase) * wiggleAmplitude;

    for (let j = 0; j < h.lines.length; j++) {
      fill(255, h.alpha);
      // constrain each line within window
      let lineX = constrain(h.screenX + xOffset, borderMargin, width - borderMargin - textWidth(h.lines[j]));
      let lineY = constrain(h.screenY + j * textAscent() * 1.2, borderMargin, height - borderMargin - textAscent());
      text(h.lines[j], lineX, lineY, width - borderMargin*2);
    }
  }
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateScale();
}

function updateScale() {
  scaleFactor = min(windowWidth / mapImgColored.width, windowHeight / mapImgColored.height);
}
