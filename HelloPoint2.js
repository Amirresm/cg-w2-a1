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
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  function render(array, totalSegment, circlesCount) {
    const FSIZE = array.BYTES_PER_ELEMENT;
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, array, gl.STATIC_DRAW);

    const a_Position = gl.getAttribLocation(gl.program, "a_Position");
    gl.enableVertexAttribArray(a_Position);
    gl.vertexAttribPointer(a_Position, 2, gl.FLOAT, false, FSIZE * 8, 0);

    const a_Color = gl.getAttribLocation(gl.program, "a_Color");
    gl.enableVertexAttribArray(a_Color);
    gl.vertexAttribPointer(a_Color, 4, gl.FLOAT, false, FSIZE * 8, FSIZE * 2);

    const a_Radius = gl.getAttribLocation(gl.program, "a_Radius");
    gl.enableVertexAttribArray(a_Radius);
    gl.vertexAttribPointer(a_Radius, 1, gl.FLOAT, false, FSIZE * 8, FSIZE * 6);

    const current_Segment = gl.getAttribLocation(gl.program, "current_Segment");
    gl.enableVertexAttribArray(current_Segment);
    gl.vertexAttribPointer(
      current_Segment,
      1,
      gl.FLOAT,
      false,
      FSIZE * 8,
      FSIZE * 7
    );

    const total_Segments = gl.getUniformLocation(gl.program, "total_Segments");
    gl.uniform1f(total_Segments, totalSegment);

    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let i = 0; i < circlesCount; i++) {
      gl.drawArrays(gl.TRIANGLE_FAN, i * totalSegment, totalSegment);
    }
  }
  return render;
}

function updateCircles(circles, totalSegment, array) {
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
      let index = (i * totalSegment + j) * 8;
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

function main() {
  const totalSegment = 50;
  const totalVertices = totalSegment * circles.length;

  const array = new Float32Array(totalVertices * 8);

  const render = setup();

  updateCircles(circles, totalSegment, array);
  render(array, totalSegment, circles.length);
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
    updateCircles(circles, totalSegment, array);
    render(array, totalSegment, circles.length);
    const end = performance.now();
    const renderTime = end - start;
    lastRenderTime = renderTime;
    console.log("render time", renderTime, "ms");
    window.requestAnimationFrame(step);
  }
  step();
}

main();
