let bgImg;
let mapImgColored;
let mapImgMask;
let landPixels = [];
let waterPixels = [];
let allowedHeadlinePixels = [];

let totalBirths = 57079;
let simulationDuration = 500 * 60 * 1000;
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
let headlineInterval = 15 * 1000;
let lastHeadlineTime = 0;
let shownHeadlines = [];

// Layers
let mapLayer, flowerLayer, staticFlowersLayer;

// Scaling
let scaleFactor = 1;
let zoomFactor = 2.0;

// Map rectangle for headline constraint
let mapRect;

// Fonts
let fonts = [];
let counterFont;

// Headline wiggle
let wiggleAmplitude = 5;
let wiggleSpeed = 0.002;

// Border margin
let borderMargin = 20;

// Max animated flowers
let maxActiveFlowers = 200;

// Fade timings
const DEFAULT_VISIBLE_DURATION = 30000;
const DEFAULT_FADE_DURATION = 20000;

function preload() {
  bgImg = loadImage("background2.jpg");
  mapImgColored = loadImage("denmark_colored2.png");
  mapImgMask = loadImage("denmark_mask2.png");

  fonts.push(loadFont("fonts/HappyTime.otf"));
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

  // mask → land/water
  mapImgMask.loadPixels();
  for (let y = 0; y < mapImgMask.height; y++) {
    for (let x = 0; x < mapImgMask.width; x++) {
      let idx = (y * mapImgMask.width + x) * 4;
      let v = (mapImgMask.pixels[idx] + mapImgMask.pixels[idx+1] + mapImgMask.pixels[idx+2]) / 3;

      if (v < 50) landPixels.push({ x, y });
      else if (v > 200) waterPixels.push({ x, y });
    }
  }

  birthInterval = simulationDuration / totalBirths;
  lastFlowerTime = millis();

  // Map bounding rectangle
  let minX = mapImgColored.width, maxX = 0;
  let minY = mapImgColored.height, maxY = 0;
  for (let p of landPixels) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  mapRect = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };

  // Allowed headline positions: water outside land box
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
    addHeadline(headlines[0]);    // show first immediately
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
  image(staticFlowersLayer, 0, 0);

  flowerLayer.clear();

  for (let f of flowerLayer.flowers) {
    flowerLayer.push();
    flowerLayer.translate(f.x, f.y);

    let offset = f.active ? sin(millis()*f.swaySpeed + f.phase) * PI/4 : 0;
    flowerLayer.rotate(f.baseAngle + offset);

    for (let i = 0; i < f.petals; i++) {
      flowerLayer.push();
      flowerLayer.rotate(TWO_PI/f.petals * i);
      flowerLayer.fill(f.color);
      flowerLayer.ellipse(0, f.petalLength/2, f.petalWidth, f.petalLength);
      flowerLayer.pop();
    }

    flowerLayer.fill(f.centerColor);
    flowerLayer.ellipse(0, 0, f.size/2, f.size/2);
    flowerLayer.pop();
  }

  image(flowerLayer, 0, 0);
  pop();

  // flower spawning
  if (birthsSoFar < totalBirths && millis() - lastFlowerTime >= birthInterval && landPixels.length > 0) {
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x;
    let py = landPixels[idx].y;

    drawFlowerOnLayer(flowerLayer, px, py, 8);
    landPixels.splice(idx, 1);
    birthsSoFar++;
    lastFlowerTime = millis();
  }

  // headline timing
  handleHeadlines();
  drawHeadlines();

  if (birthsSoFar >= totalBirths) {
    push();
    fill(255);
    textSize(28);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width/2, height/2);
    pop();
  }
}

function drawFlowerOnLayer(layer, x, y, baseSize) {
  let petals = floor(random(5,10));
  let size = baseSize * random(0.8, 1.5);
  let petalLength = size * random(0.8,1.2);
  let petalWidth = size * random(0.4,0.8);
  let centerColor = color(255,220,0);
  let petalColor = color(random(100,255), random(100,255), random(100,255), 180);
  let swaySpeed = random(0.0005, 0.002);
  let baseAngle = random(TWO_PI);

  // stop sway for flowers under this one
  for (let f of layer.flowers) {
    if (dist(x,y,f.x,f.y) < (size + f.size)/2) {
      f.active = false;
    }
  }

  layer.flowers.push({
    x, y, size,
    petals,
    petalLength,
    petalWidth,
    centerColor,
    color: petalColor,
    baseAngle,
    swaySpeed,
    phase: random(TWO_PI),
    active: true
  });

  // limit
  while (layer.flowers.length > maxActiveFlowers) {
    drawFlowerToStaticLayer(staticFlowersLayer, layer.flowers.shift());
  }
}

function drawFlowerToStaticLayer(layer, f) {
  layer.push();
  layer.translate(f.x, f.y);
  layer.rotate(f.baseAngle);

  for (let i=0; i < f.petals; i++) {
    layer.push();
    layer.rotate(TWO_PI/f.petals * i);
    layer.fill(f.color);
    layer.ellipse(0, f.petalLength/2, f.petalWidth, f.petalLength);
    layer.pop();
  }

  layer.fill(f.centerColor);
  layer.ellipse(0, 0, f.size/2, f.size/2);
  layer.pop();
}

// ------------------------------------------------------------------
// ★ LOOPING HEADLINES IMPLEMENTATION
// ------------------------------------------------------------------
function handleHeadlines() {
  let now = millis();

  // auto-fade handled in drawHeadlines()

  // time for next headline?
  if (now - lastHeadlineTime >= headlineInterval) {

    if (headlines.length === 0) return;

    // ★ instead of shift() (removes forever),
    // we rotate the array to loop.
    let text = headlines.shift();   // remove first
    headlines.push(text);           // ★ put back at end → LOOP

    addHeadline(text);

    lastHeadlineTime = now;
  }
}

// ------------------------------------------------------------------

function addHeadline(text) {
  if (!text) return;

  let attempts = 0;

  while (attempts < 200) {
    let p = random(allowedHeadlinePixels);
    let screenX = p.x * scaleFactor * zoomFactor
        + (width - mapImgColored.width * scaleFactor * zoomFactor) / 2;
    let screenY = p.y * scaleFactor * zoomFactor
        + (height - mapImgColored.height * scaleFactor * zoomFactor) / 2;

    if (screenY < 50 + borderMargin ||
        screenX < borderMargin ||
        screenX > width-borderMargin ||
        screenY > height-borderMargin) {
      attempts++;
      continue;
    }

    let chosenFont = random(fonts);

    textFont(chosenFont);
    textSize(50);

    let maxWidth = max(80, width - borderMargin*2 - (screenX - borderMargin));

    let words = text.split(/\s+/);
    let lines = [];
    let line = "";

    for (let w of words) {
      let test = line ? line+" "+w : w;

      if (textWidth(test) <= maxWidth) {
        line = test;
      } else {
        lines.push(line);
        line = w;
      }
      if (lines.length >= 20) break;
    }
    if (lines.length < 3 && line) lines.push(line);

    shownHeadlines = [];     // only one headline at once
    shownHeadlines.push({
      text,
      lines,
      x:p.x, y:p.y,
      screenX, screenY,
      alpha: 0,
      font: chosenFont,
      phase: random(TWO_PI),
      createdAt: millis(),
      visibleDuration: DEFAULT_VISIBLE_DURATION,
      fadeDuration: DEFAULT_FADE_DURATION
    });
    return;
  }
}

function drawHeadlines() {
  push();
  textSize(50);
  noStroke();

  let now = millis();

  for (let i = shownHeadlines.length-1; i >= 0; i--) {
    let h = shownHeadlines[i];

    h.screenX = constrain(
      h.x * scaleFactor * zoomFactor + (width - mapImgColored.width * scaleFactor * zoomFactor) / 2,
      borderMargin,
      width - borderMargin
    );
    h.screenY = constrain(
      h.y * scaleFactor * zoomFactor + (height - mapImgColored.height * scaleFactor * zoomFactor) / 2,
      borderMargin,
      height - borderMargin
    );

    if (now - h.createdAt < h.visibleDuration) {
      h.alpha = min(h.alpha + 4, 255);
    }

    let timeSinceVisibleEnd = now - h.createdAt - h.visibleDuration;
    if (timeSinceVisibleEnd > 0) {
      let fadeProgress = constrain(timeSinceVisibleEnd / h.fadeDuration, 0, 1);
      h.alpha = 255 * (1 - fadeProgress);
    }

    if (h.alpha <= 0) {
      shownHeadlines.splice(i, 1);
      continue;
    }

    textFont(h.font);

    let xOffset = sin(now * wiggleSpeed + h.phase) * wiggleAmplitude;

    for (let j=0; j<h.lines.length; j++) {
      fill(255, h.alpha);

      let rawX = h.screenX + xOffset;
      let safeX = constrain(rawX, borderMargin, width - borderMargin - textWidth(h.lines[j]));
      let safeY = constrain(h.screenY + j * textAscent() * 1.2,
                            borderMargin,
                            height - borderMargin - textAscent());

      text(h.lines[j], safeX, safeY);
    }
  }
  pop();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  updateScale();
}

function updateScale() {
  scaleFactor = min(windowWidth/mapImgColored.width,
                    windowHeight/mapImgColored.height);
}
