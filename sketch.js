let mapImgColored;   // colored Denmark map
let mapImgMask;      // black land / white sea
let landPixels = [];

let totalBirths = 57079;
let simulationDuration = 15 * 60 * 1000; // 15 minutes
let birthInterval = 0;
let birthsSoFar = 0;
let lastBirthTime = 0;

// RSS variables
let rssTitles = [];
let currentTitleIndex = 0;
let lastTitleChange = 0;
let titleInterval = 5000; // change title every 5 seconds

function preload() {
  mapImgColored = loadImage("denmark_colored.png"); 
  mapImgMask = loadImage("denmark_mask.png");
}

function setup() {
  let canvas = createCanvas(mapImgMask.width, mapImgMask.height);
  canvas.parent('canvas-container');
  noStroke();

  image(mapImgColored, 0, 0);

  // Precompute land pixels
  mapImgMask.loadPixels();
  for (let y = 0; y < mapImgMask.height; y++) {
    for (let x = 0; x < mapImgMask.width; x++) {
      let index = (y * mapImgMask.width + x) * 4;
      let r = mapImgMask.pixels[index];
      let g = mapImgMask.pixels[index + 1];
      let b = mapImgMask.pixels[index + 2];
      let brightnessValue = (r + g + b) / 3;
      if (brightnessValue < 50) {
        landPixels.push({ x, y });
      }
    }
  }
  console.log("Total land pixels:", landPixels.length);

  birthInterval = simulationDuration / totalBirths;
  birthsSoFar = 0;
  lastBirthTime = millis();

  // Load RSS feed
  loadRSS();
}

// ---------------- RSS LOADING -----------------

function loadRSS() {
  let rssURL = "https://verdensbedstenyheder.dk/feed/";
  let apiURL = "https://api.allorigins.win/get?url=" + encodeURIComponent(rssURL);

  fetch(apiURL)
    .then(res => res.json())
    .then(data => {
      let parser = new DOMParser();
      let xml = parser.parseFromString(data.contents, "text/xml");
      let items = xml.getElementsByTagName("item");

      rssTitles = [];

      for (let i = 0; i < items.length; i++) {
        let titleNode = items[i].getElementsByTagName("title")[0];
        if (titleNode) rssTitles.push(titleNode.textContent);
      }

      console.log("Loaded RSS titles:", rssTitles);
    })
    .catch(err => {
      console.error("RSS Load Error:", err);
    });
}

// ---------------- DRAW LOOP -----------------

function draw() {
  // draw new flowers
  if (birthsSoFar < totalBirths) {
    if (millis() - lastBirthTime >= birthInterval) {
      let idx = floor(random(landPixels.length));
      let px = landPixels[idx].x;
      let py = landPixels[idx].y;

      drawFlower(px, py, 8);
      birthsSoFar++;
      lastBirthTime = millis();
    }
  } else {
    fill(0);
    textSize(24);
    textAlign(CENTER, CENTER);
    text("Simulation complete 🌸", width / 2, height / 2);
    noLoop();
  }

  // ---- Draw RSS headline on top ----
  drawRSSHeadline();
}

// Draw scrolling RSS title
function drawRSSHeadline() {
  if (rssTitles.length === 0) return;

  if (millis() - lastTitleChange > titleInterval) {
    currentTitleIndex = (currentTitleIndex + 1) % rssTitles.length;
    lastTitleChange = millis();
  }

  fill(255, 255, 255, 200);
  rect(10, 10, width - 20, 40);

  fill(0);
  textSize(20);
  textAlign(LEFT, CENTER);
  text(rssTitles[currentTitleIndex], 20, 30);
}

// ---------------- FLOWER FUNCTION -----------------

function drawFlower(x, y, size) {
  push();
  translate(x, y);
  let petals = 5;
  let petalLength = size;
  let petalWidth = size / 2;
  let centerColor = color(255, 220, 0);

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
