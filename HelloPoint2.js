// HelloPint2.js (c) 2012 matsuda
// Vertex shader program
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

// Fragment shader program
var FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;

  void main() {
    gl_FragColor = v_Color;
  }
  `;

const circles = [
  { x: 0, y: 0.0, radius: 1.5, init: true, center: true },
  { x: -0.5, y: 0.0, radius: 0.0, init: false },
  { x: -0.5, y: 0.0, radius: 0.0, init: false },
  { x: -0.5, y: 0.0, radius: 0.0, init: false },
  { x: -0.5, y: 0.0, radius: 0.0, init: false },
  { x: -0.5, y: 0.0, radius: 0.0, init: false },
];

function setup() {
  // Retrieve <canvas> element
  var canvas = document.getElementById("webgl");

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("Failed to intialize shaders.");
    return;
  }

  function render(
    positionArray,
    colorArray,
    radiusArray,
    currentSegmentArray,
    totalSegment,
    circlesCount
  ) {
    const a_Position = gl.getAttribLocation(gl.program, "a_Position");
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    setBufferData(gl, positionArray);
    setArrayBufferToGL(gl, a_Position, positionBuffer, 2);

    const a_Color = gl.getAttribLocation(gl.program, "a_Color");
    const colorBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, colorBuffer);
    setBufferData(gl, colorArray);
    setArrayBufferToGL(gl, a_Color, colorBuffer, 4);

    const a_Radius = gl.getAttribLocation(gl.program, "a_Radius");
    const radiusBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, radiusBuffer);
    setBufferData(gl, radiusArray);
    setArrayBufferToGL(gl, a_Radius, radiusBuffer);

    const current_Segment = gl.getAttribLocation(gl.program, "current_Segment");
    const currentSegmentBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, currentSegmentBuffer);
    setBufferData(gl, currentSegmentArray);
    setArrayBufferToGL(gl, current_Segment, currentSegmentBuffer);

    const total_Segments = gl.getUniformLocation(gl.program, "total_Segments");
    gl.uniform1f(total_Segments, totalSegment);

    // Specify the color for clearing <canvas>
    gl.clearColor(0.0, 0.0, 0.0, 1.0);

    // Clear <canvas>
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Draw
    for (let i = 0; i < circlesCount; i++) {
      gl.drawArrays(gl.TRIANGLE_FAN, i * totalSegment, totalSegment);
    }
  }
  return render;
}

function updateCircles(
  circles,
  totalSegment,
  positionArray,
  colorArray,
  radiusArray,
  currentSegmentArray
) {
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
    for (let j = 0; j < totalSegment; j++) {
      const index = i * totalSegment + j;
      positionArray[index * 2] = circle.x;
      positionArray[index * 2 + 1] = circle.y;
      const colorIndex = index * 4;
      colorArray[colorIndex] = color[0];
      colorArray[colorIndex + 1] = color[1];
      colorArray[colorIndex + 2] = color[2];
      colorArray[colorIndex + 3] = color[3];
      radiusArray[index] = circle.radius;
      currentSegmentArray[index] = j;
    }
  }
}

function main() {
  const totalSegment = 50;
  const totalVertices = totalSegment * circles.length;

  const positionArray = new Float32Array(totalVertices * 2);
  const colorArray = new Float32Array(totalVertices * 4);
  const radiusArray = new Float32Array(totalVertices);
  const currentSegmentArray = new Float32Array(totalVertices);

  const render = setup();

  updateCircles(
    circles,
    totalSegment,
    positionArray,
    colorArray,
    radiusArray,
    currentSegmentArray
  );
  render(
    positionArray,
    colorArray,
    radiusArray,
    currentSegmentArray,
    totalSegment,
    circles.length
  );
  let startTime = -1;
  let lastTime = 0;
  let lastRenderTime = 0;
  function step(timestamp) {
    const start = performance.now();
    if (startTime < 0 && timestamp > 0) {
      startTime = timestamp;
    }
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;
    deltaTime = deltaTime >= 0 ? deltaTime / 1000 : 0;
    for (let i = 0; i < circles.length; i++) {
      const circle = circles[i];
      if (circle.center) {
      } else {
        if ((timestamp - startTime) / 1000 > i) {
          if (!circle.init) {
            const randAngle = Math.random() * Math.PI * 2;
            const radius = 1.5;
            circle.x = Math.cos(randAngle) * radius;
            circle.y = Math.sin(randAngle) * radius;
            circle.init = true;
          }
          if (circle.radius < 0.2) {
            circle.radius += 0.05 * deltaTime;
          }
        }
      }
    }
    updateCircles(
      circles,
      totalSegment,
      positionArray,
      colorArray,
      radiusArray,
      currentSegmentArray
    );
    render(
      positionArray,
      colorArray,
      radiusArray,
      currentSegmentArray,
      totalSegment,
      circles.length
    );
    const end = performance.now();
    const renderTime = end - start;
    lastRenderTime = renderTime;
    console.log("render time", renderTime, "ms");
    window.requestAnimationFrame(step);
  }
  step();
}

function setArrayBufferToGL(gl, loc, buffer, size = 1, type = gl.FLOAT) {
  gl.enableVertexAttribArray(loc);

  // Bind the position buffer.
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

  // Tell the position attribute how to get data out of positionBuffer (ARRAY_BUFFER)
  var normalize = false; // don't normalize the data
  var stride = 0; // 0 = move forward size * sizeof(type) each iteration to get the next position
  var offset = 0; // start at the beginning of the buffer
  gl.vertexAttribPointer(loc, size, type, normalize, stride, offset);
}

function setBufferData(gl, array) {
  gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);
}

main();
