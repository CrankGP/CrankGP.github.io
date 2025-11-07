let denmarkMap;
let totalBirths = 58000;      // yearly births
let birthInterval = 0;
let birthsSoFar = 0;
let lastBirthTime = 0;
let simulationDuration = 10 * 60 * 1000; // 10 minutes

let landPixels = []; // precompute land pixel coordinates

function preload() {
  denmarkMap = loadImage("denmark.png"); // land = black, sea = white
}

function setup() {
  createCanvas(denmarkMap.width, denmarkMap.height);

  background(255);          // make canvas white
  image(denmarkMap, 0, 0); // draw map on top
  noStroke();

  // Precompute all land pixels (black pixels)
  denmarkMap.loadPixels();
  for (let y = 0; y < denmarkMap.height; y++) {
    for (let x = 0; x < denmarkMap.width; x++) {
      let index = (y * denmarkMap.width + x) * 4;
      let r = denmarkMap.pixels[index];
      let g = denmarkMap.pixels[index + 1];
      let b = denmarkMap.pixels[index + 2];
      let brightnessValue = (r + g + b) / 3;
      if (brightnessValue < 50) { // black = land
        landPixels.push({ x, y });
      }
    }
  }
  console.log("Total land pixels:", landPixels.length);

  // Compute interval per birth
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
    // Pick a random land pixel
    let idx = floor(random(landPixels.length));
    let px = landPixels[idx].x;
    let py = landPixels[idx].y;

    // Draw birth dot
    fill(random(100, 255), random(100, 255), random(100, 255), 180);
    ellipse(px, py, 6, 6);

    birthsSoFar++;
    lastBirthTime = millis();
  }
}
