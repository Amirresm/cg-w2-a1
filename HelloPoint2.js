var VSHADER_SOURCE = `
  #define PI radians(180.0)

  uniform float total_Segments;
  attribute vec4 a_Position;
  attribute vec4 a_Color;
  attribute float a_Radius;
  attribute float current_Segment;

  varying vec4 v_Color;

  void main() {
    float angle = (PI * 2.0 * (current_Segment / total_Segments));
    vec4 pos = vec4(vec2(cos(angle), sin(angle)) * a_Radius, 0.0, 1.0);
    pos = pos + a_Position;

    gl_Position = pos;
    gl_PointSize = 2.0;
    v_Color = a_Color;
  }
  `;

var FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;

  void main() {
    gl_FragColor = v_Color;
  }
  `;

const settings = {
  OBJECT_ELEMENT_SIZE: 8,
  RANDOM_OBJECT_COUNT: 30,
  circles: [{ x: 0, y: 0, radius: 1.5, init: true, center: true }],
  segmentPerObject: 50,
  growRate: 0.05,
  maxRadius: 0.2,
  centerRadius: 1.5,
  growthStartDelayMs: 100,
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
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  return function render(array, totalSegment, circlesCount) {
    const FSIZE = array.BYTES_PER_ELEMENT;
    const ESIZE = settings.OBJECT_ELEMENT_SIZE;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);

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
      gl.drawArrays(gl.TRIANGLE_FAN, i * totalSegment, totalSegment);
    }
  };
}

function createStepFunction(renderFn, settings) {
  const circles = settings.circles;

  for (let i = 0; i < settings.RANDOM_OBJECT_COUNT; i++) {
    circles.push({ x: 0, y: 0.0, radius: 0.0, init: false });
  }

  const objectCount = circles.length;
  const segmentPerObject = settings.segmentPerObject;
  const totalVertices = settings.segmentPerObject * circles.length;
  settings.arrayBuffer = new Float32Array(
    totalVertices * settings.OBJECT_ELEMENT_SIZE
  );
  const array = settings.arrayBuffer;

  function transferDataToBuffer() {
    const ESIZE = settings.OBJECT_ELEMENT_SIZE;
    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i];
      if (!circle.color) {
        if (circle.center) {
          circle.color = [1.0, 1.0, 1.0, 1.0];
        } else {
          circle.color = [Math.random(), Math.random(), Math.random(), 1.0];
        }
      }
      const color = circle.color;
      for (let j = 0; j < segmentPerObject; j++) {
        let index = (i * segmentPerObject + j) * ESIZE;
        array[index++] = circle.x;
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
  renderFn(array, segmentPerObject, objectCount);

  const growRate = settings.growRate;
  const maxRadius = settings.maxRadius;
  const centerRadius = settings.centerRadius;
  const growthStartDelayMs = settings.growthStartDelayMs;

  const renderTimeDiv = document.getElementById("render-time");
  const deltaTimeDiv = document.getElementById("delta-time");
  const budgetDiv = document.getElementById("budget");
  const totalTimeDiv = document.getElementById("total-time");

  let startTime = -1;
  let lastTime = 0;
  let lastRenderTime = 0;
  let currentTime = 0;
  return function step(timestamp) {
    const start = performance.now();
    if (startTime < 0 && timestamp > 0) {
      startTime = timestamp;
    }
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    deltaTime = deltaTime >= 0 ? deltaTime : 0;
    const deltaS = deltaTime / 1000;
    currentTime = timestamp - startTime;
    for (let i = 0; i < objectCount; i++) {
      const circle = circles[i];
      if (circle.center) {
      } else {
        if ((currentTime) / growthStartDelayMs > i) {
          if (!circle.init) {
            const randAngle = Math.random() * Math.PI * 2;
            const radius = centerRadius;
            circle.x = Math.cos(randAngle) * radius;
            circle.y = Math.sin(randAngle) * radius;
            circle.init = true;
          }
          if (circle.radius < maxRadius) {
            circle.radius += growRate * deltaS;
          }
        }
      }
    }
    transferDataToBuffer();
    renderFn(array, segmentPerObject, objectCount);
    const renderTime = performance.now() - start;
    lastRenderTime = renderTime;
    if (currentTime % 100 < 50) {
      renderTimeDiv.innerText = "Render Time: " + renderTime.toFixed(2) + "ms";
      deltaTimeDiv.innerText = "Delta Time: " + deltaTime.toFixed(2) + "ms";
      budgetDiv.innerText = "Load: " + (renderTime / deltaTime * 100).toFixed(1) + "%";
      totalTimeDiv.innerText =
        "Total Time: " + (currentTime).toFixed(2) + "ms";
    }
    if (
      true ||
      !timestamp ||
      currentTime <
      objectCount * growthStartDelayMs + (maxRadius / growRate) * 1000
    ) {
      window.requestAnimationFrame(step);
    }
  };
}

function main() {
  const render = setup();
  const step = createStepFunction(render, settings);

  step();
}

function handleCanvasClick(event) {
  const w = event.target.width;
  const h = event.target.height;
  const x = (event.offsetX / (w / 2) - 1) * 2;
  const y = (event.offsetY / (h / 2) - 1) * -2;

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
}

document.getElementById("webgl").addEventListener("click", handleCanvasClick)

main();
