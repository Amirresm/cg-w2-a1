// HelloPint2.js (c) 2012 matsuda
// Vertex shader program
var VSHADER_SOURCE = `
  #define PI radians(180.0)

  uniform float total_Segments;
  attribute vec4 a_Position;
  attribute float a_Radius;
  attribute float current_Segment;

  void main() {
    float angle = (PI * 2.0 * (current_Segment / total_Segments));
    vec4 pos = vec4(vec2(cos(angle), sin(angle)) * a_Radius, 0.0, 1.0);
    pos = pos + a_Position;

    gl_Position = pos;
    gl_PointSize = 2.0;
  }
  `;

// Fragment shader program
var FSHADER_SOURCE =
  "void main() {\n" + "  gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);\n" + "}\n";

const circles = [
  { x: 0.5, y: 0.0, radius: 0.2 },
  { x: -0.5, y: 0.0, radius: 0.2 },
];

function main() {
  // Retrieve <canvas> element
  var canvas = document.getElementById("webgl");

  // Get the rendering context for WebGL
  var gl = getWebGLContext(canvas);
  if (!gl) {
    console.log("Failed to get the rendering context for WebGL");
    return;
  }

  const totalSegment = 6;
  const totalVertices = totalSegment * circles.length;

  const positionArray = new Float32Array((totalVertices + circles.length) * 2);
  const radiusArray = new Float32Array(totalVertices + circles.length);
  const currentSegmentArray = new Float32Array(totalVertices + circles.length);

  for (let i = 0; i < circles.length; i++) {
    const circle = circles[i];
    const circleIndex = i * (totalSegment + 1);
    positionArray[circleIndex * 2] = circle.x;
    positionArray[circleIndex * 2 + 1] = circle.y;
    radiusArray[circleIndex] = 0;
    currentSegmentArray[circleIndex] = -1;
    for (let j = 1; j < totalSegment + 1 + 1; j++) {
      const index = circleIndex + j;
      positionArray[index * 2] = circle.x;
      positionArray[index * 2 + 1] = circle.y;
      radiusArray[index] = circle.radius;
      currentSegmentArray[index] = j - 1;
    }
  }
  console.log(positionArray, radiusArray, currentSegmentArray);

  // Initialize shaders
  if (!initShaders(gl, VSHADER_SOURCE, FSHADER_SOURCE)) {
    console.log("Failed to intialize shaders.");
    return;
  }

  const a_Position = gl.getAttribLocation(gl.program, "a_Position");
  const positionBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
  setBufferData(gl, positionArray);
  setArrayBufferToGL(gl, a_Position, positionBuffer, 2);

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
  // gl.drawArrays(gl.TRIANGLE_FAN, 0, totalVertices);
  gl.drawArrays(gl.POINTS, 0, totalVertices);
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
