var VSHADER_SOURCE = `
  #define PI radians(180.0)

  uniform float total_Segments;
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  attribute float a_Radius;
  attribute float current_Segment;

  varying vec4 v_Color;

  void main() {
    v_Color = a_Color;
    if (current_Segment == 0.0) {
      gl_Position = a_Position;
    } else {
      float angle = (PI * 2.0 * ((current_Segment - 1.0) / (total_Segments - 2.0)));
      vec4 pos = vec4(vec2(cos(angle), sin(angle)) * a_Radius, 0.0, 0.0);
      pos = pos + a_Position;
      gl_Position = pos;
    }
    gl_Position += vec4(0.0, 0.0, 0.0, 0.0);
  }
  `;

var FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;

  void main() {
    gl_FragColor = v_Color;
  }
  `;

const OUTLINE_CONSTANT = -5421.0;
const settings = {
  OBJECT_ELEMENT_SIZE: 8,
  RANDOM_OBJECT_COUNT: 5,
  circles: [
    { x: 0, y: 0, radius: 0.8, init: true, center: true, visible: true },
  ],
  segmentPerObject: 50,
  growRate: 0.03,
  maxRadius: 0.1,
  centerRadius: 0.8,
  growthStartDelayMs: 1000,
  arrayBuffer: null,
};

function setup() {
  var canvas = document.getElementById("webgl");
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("Failed to intialize shaders.");
    return;
  }
  gl.clearColor(0.0, 0.0, 0.0, 0.0);

  return function render(array, totalSegment, circlesCount) {
    const FSIZE = array.BYTES_PER_ELEMENT;
    const ESIZE = settings.OBJECT_ELEMENT_SIZE;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.DYNAMIC_DRAW);

    const a_Position = gl.getAttribLocation(gl.program, "a_Position");
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * ESIZE, 0);

    const a_Color = gl.getAttribLocation(gl.program, "a_Color");
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(
      a_Color,
      4,
      gl.FLOAT,
      false,
      FSIZE * ESIZE,
      FSIZE * 2
    );

    const a_Radius = gl.getAttribLocation(gl.program, "a_Radius");
    gl.enableVertexAttribArray(a_Radius);
    gl.vertexAttribPointer(
      a_Radius,
      1,
      gl.FLOAT,
      false,
      FSIZE * ESIZE,
      FSIZE * 6
    );

    const current_Segment = gl.getAttribLocation(gl.program, "current_Segment");
    gl.enableVertexAttribArray(current_Segment);
    gl.vertexAttribPointer(
      current_Segment,
      1,
      gl.FLOAT,
      false,
      FSIZE * ESIZE,
      FSIZE * 7
    );

    const total_Segments = gl.getUniformLocation(gl.program, "total_Segments");
    gl.uniform1f(total_Segments, totalSegment);

    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let i = 0; i < circlesCount; i++) {
      if (array[i * totalSegment * ESIZE] < OUTLINE_CONSTANT) {
        gl.drawArrays(gl.LINE_LOOP, i * totalSegment + 1, totalSegment - 1);
      } else {
        gl.drawArrays(gl.TRIANGLE_FAN, i * totalSegment, totalSegment);
      }
    }
  };
}

function createStepFunction(renderFn, settings) {
  const circles = settings.circles;

  for (let i = 0; i < settings.RANDOM_OBJECT_COUNT; i++) {
    circles.push({ x: 0, y: 0.0, radius: 0.0 });
  }

  const segmentPerObject = settings.segmentPerObject;
  const totalVertices = settings.segmentPerObject * circles.length;
  settings.arrayBuffer = new Float32Array(
    totalVertices * settings.OBJECT_ELEMENT_SIZE * 2
  );
  const array = settings.arrayBuffer;

  function transferDataToBuffer() {
    const ESIZE = settings.OBJECT_ELEMENT_SIZE;
    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i];
      if (!circle.color) {
        if (circle.center) {
          circle.color = [1.0, 1.0, 1.0, 1.0];
        } else if (circle.outline) {
          circle.color = [1.0, 0.0, 0.0, 1.0];
        } else {
          circle.color = [Math.random(), Math.random(), Math.random(), 1.0];
        }
      }
      const color = circle.color;
      for (let j = 0; j < segmentPerObject; j++) {
        let index = (i * segmentPerObject + j) * ESIZE;
        if (j === 0 && circle.outline) {
          array[index++] = OUTLINE_CONSTANT - 1;
        } else {
          array[index++] = circle.x;
        }
        array[index++] = circle.y;
        array[index++] = color[0];
        array[index++] = color[1];
        array[index++] = color[2];
        array[index++] = color[3];
        array[index++] = circle.radius;
        array[index++] = j;
      }
    }
  }

  transferDataToBuffer();
  renderFn(array, segmentPerObject, circles.length);

  const growRate = settings.growRate;
  const maxRadius = settings.maxRadius;
  const centerRadius = settings.centerRadius;
  const growthStartDelayMs = settings.growthStartDelayMs;

  const renderTimeDiv = document.getElementById("render-time");
  const totalTimeDiv = document.getElementById("total-time");
  const deltaTimeDiv = document.getElementById("delta-time");
  const budgetDiv = document.getElementById("budget");
  const elapsedTimeDiv = document.getElementById("elapsed-time");

  let originTime = -1;
  let lastTime = 0;
  let renderTime = 0;
  let currentTime = 0;
  let lastStatsUpdate = 0;
  let totalTime = 0;
  return function step(timestamp) {
    const objectCount = circles.length;
    const start = performance.now();
    if (originTime < 0) {
      originTime = start;
    }
    const deltaS = (start - lastTime) / 1000;
    lastTime = start;
    currentTime = start - originTime;
    let visibleCircleCount = 0;
    let currentBacteriaIndex = 0;
    let toRemove = -1;
    for (let i = 0; i < objectCount; i++) {
      const circle = circles[i];
      if (circle.center) {
      } else if (circle.outline) {
        if (circle.life <= 0 || circle.radius <= 0) {
          toRemove = i;
          continue;
        } else {
          circle.radius += circle.rate * deltaS;
          circle.life -= deltaS;
          // if (circle.color[0] > 0) circle.color[0] -= 0.09;
          // if (circle.color[1] < 1) circle.color[1] += 0.09;
          // if (circle.color[2] < 1) circle.color[2] += 0.09;
          // if (circle.color[3] > 0) circle.color[3] -= 0.09;
        }
      } else {
        if (currentTime / growthStartDelayMs > currentBacteriaIndex) {
          currentBacteriaIndex++;
          if (!circle.init) {
            const randAngle = Math.random() * Math.PI * 2;
            const radius = centerRadius;
            circle.x = Math.cos(randAngle) * radius;
            circle.y = Math.sin(randAngle) * radius;
            circle.init = true;
            circle.visible = true;
          }
          if (circle.radius < maxRadius) {
            circle.radius += growRate * deltaS;
          }
        } else break;
      }
      if (circle.visible) visibleCircleCount++;
      else break;
    }
    if(toRemove >= 0) circles.splice(toRemove, 1);
    renderTime = performance.now();
    transferDataToBuffer();
    renderFn(array, segmentPerObject, visibleCircleCount);
    renderTime = performance.now() - renderTime;
    if (start - lastStatsUpdate > 100) {
      renderTimeDiv.innerText = "Render Time: " + renderTime.toFixed(2) + "ms";
      totalTimeDiv.innerText = "Total Time: " + totalTime.toFixed(2) + "ms";
      deltaTimeDiv.innerText =
        "Delta Time: " + (deltaS * 1000).toFixed(2) + "ms";
      budgetDiv.innerText =
        "Load: " + ((totalTime / (deltaS * 1000)) * 100).toFixed(1) + "%";
      elapsedTimeDiv.innerText =
        "Elapsed Time: " + currentTime.toFixed(2) + "ms";

      lastStatsUpdate = start;
    }
    if (
      true ||
      currentTime <
      objectCount * growthStartDelayMs + (maxRadius / growRate) * 1000
    ) {
      window.requestAnimationFrame(step);
    }
    totalTime = performance.now() - start;
  };
}

function main() {
  const render = setup();
  const circleCountInput = document.getElementById("circle-count");
  const maxRadiusInput = document.getElementById("max-radius");
  const startGrowthDelayInput = document.getElementById("start-growth-delay");
  const growthRateInput = document.getElementById("growth-rate");

  circleCountInput.value = settings.RANDOM_OBJECT_COUNT;
  maxRadiusInput.value = settings.maxRadius;
  startGrowthDelayInput.value = settings.growthStartDelayMs;
  growthRateInput.value = settings.growRate;

  circleCountInput.addEventListener("input", (event) => {
    settings.RANDOM_OBJECT_COUNT = +event.target.value;
  });

  maxRadiusInput.addEventListener("input", (event) => {
    settings.maxRadius = +event.target.value;
  });

  startGrowthDelayInput.addEventListener("input", (event) => {
    settings.growthStartDelayMs = +event.target.value;
  });

  growthRateInput.addEventListener("input", (event) => {
    settings.growRate = +event.target.value;
  });

  document.getElementById("start").addEventListener("click", () => {
    stepFn = createStepFunction(render, settings);
    settings.running = true;
    circleCountInput.disabled = true;
    maxRadiusInput.disabled = true;
    startGrowthDelayInput.disabled = true;
    growthRateInput.disabled = true;
    stepFn();
  });

  document.getElementById("reload").addEventListener("click", () => {
    location.reload();
  });

  document
    .getElementById("webgl")
    .addEventListener("click", function handleCanvasClick(event) {
      const w = event.target.width;
      const h = event.target.height;
      const x = (event.offsetX / (w / 2) - 1) * 1;
      const y = (event.offsetY / (h / 2) - 1) * -1;

      let target = null;
      for (let circle of settings.circles) {
        if (!circle.center) {
          const xD = circle.x - x;
          const yD = circle.y - y;
          if (xD * xD + yD * yD <= circle.radius * circle.radius) {
            target = circle;
          }
        }
      }
      if (target) {
        target.x = -100;
        target.y = -100;
      }
      settings.circles.splice(1, 0, {
        x,
        y,
        radius: 0.01,
        rate: (1.0 - 0.01) / 1.0,
        init: true,
        visible: true,
        outline: true,
        life: 1.0,
        color: [1.0, 0.0, 0.0, 1.0],
      });
   });
}

main();
