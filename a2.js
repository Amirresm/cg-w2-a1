const OUTLINE_CONSTANT = -5421.0;

class CircleShape {
  static ELEMENT_SIZE = 8; // x, y, r, color[4], vertexIndex
  static checkCollision(shape1, shape2) {
    const dX = shape1.x - shape2.x;
    const dY = shape1.y - shape2.y;
    const sumR = shape1.radius + shape2.radius;
    return sumR * sumR >= dX * dX + dY * dY;
  }

  constructor(x, y, radius, color, visible, type = "fill") {
    this.x = x;
    this.y = y;
    this.radius = radius;
    this.color = color;
    this.visible = visible;
    this.type = type;
  }
}

class ObjectMeta {
  constructor(shape) {
    this.shape = shape;
    this.active = true;
  }

  remove() {
    this.shape.visible = false;
    this.active = false;
  }
}

class GrowableObject extends ObjectMeta {
  constructor(shape, maxRadius, growthRate) {
    super(shape);
    this.maxRadius = maxRadius;
    this.growthRate = growthRate;
  }

  grow(deltaS) {
    if (this.shape.radius < this.maxRadius) {
      this.shape.radius += this.growthRate * deltaS;
    } else {
      this.shape.radius = this.maxRadius;
    }
  }
}

class ShrinkableObject extends ObjectMeta {
  constructor(shape, shrinkRate) {
    super(shape);
    this.shrinkRate = shrinkRate;
  }

  shrink(deltaS) {
    if (this.shape.radius > 0) {
      this.shape.radius -= this.shrinkRate * deltaS;
    } else {
      this.shape.radius = 0;
    }
  }
}

class Color {
  static random() {
    return [Math.random(), Math.random(), Math.random(), 1.0];
  }

  static white() {
    return [1.0, 1.0, 1.0, 1.0];
  }
}

class WorldContext {
  constructor() {
    this.scene = [];
    this.bacteria = [];
    this.poisons = [];

    this.settings = {
      RANDOM_OBJECT_COUNT: 5,
      growRate: 0.03,
      maxRadius: 0.1,
      centerRadius: 0.8,
      growthStartDelayMs: 1000,
    };
  }

  setup() {
    this.scene.push(
      new ObjectMeta(new CircleShape(0, 0, 0.8, Color.white(), true))
    );
    for (let i = 0; i < this.settings.RANDOM_OBJECT_COUNT; i++) {
      const randAngle = Math.random() * Math.PI * 2;
      const centerRadius = this.settings.centerRadius;
      const x = Math.cos(randAngle) * centerRadius;
      const y = Math.sin(randAngle) * centerRadius;
      const bacterium = new GrowableObject(
        new CircleShape(x, y, 0.0, Color.random(), false),
        this.settings.maxRadius,
        this.settings.growRate
      );
      this.bacteria.push(bacterium);
    }
  }

  update(deltaS, gameElapsedTime) {
    for (let i = 0; i < this.bacteria.length; i++) {
      const bacterium = this.bacteria[i];
      if (!bacterium.active) continue;
      if (gameElapsedTime > this.settings.growthStartDelayMs * i) {
        if (!bacterium.shape.visible) {
          bacterium.shape.visible = true;
        }
        bacterium.grow(deltaS);
      }
    }
    let poisonIndexToRemove = -1;
    for (let i = 0; i < this.poisons.length; i++) {
      const poison = this.poisons[i];
      if (poison.shape.radius >= poison.maxRadius) {
        // poison.shape.visible = false;
        poisonIndexToRemove = i;
        continue;
      } else {
        poison.grow(deltaS);
        // if (poison.color[0] > 0) poison.color[0] -= 0.01;
        // if (poison.color[1] < 1) poison.color[1] += 0.01;
        // if (poison.color[2] < 1) poison.color[2] += 0.01;
        // if (poison.shape.color[3] > 0) poison.shape.color[3] -= 0.01;
        for (let j = 0; j < this.bacteria.length; j++) {
          if (
            CircleShape.checkCollision(poison.shape, this.bacteria[j].shape)
          ) {
            this.bacteria[j].remove();
          }
        }
      }
    }
    if (poisonIndexToRemove >= 0) this.poisons.splice(poisonIndexToRemove, 1);
  }

  addPoison(x, y, maxRadius = 0.3, lifeTime = 0.7) {
    this.poisons.push(
      new GrowableObject(
        new CircleShape(x, y, 0.01, [1.0, 0.0, 0.0, 1.0], true, "outline"),
        maxRadius,
        (maxRadius - 0.01) / lifeTime
      )
    );
  }
}

class RenderPipeline {
  VSHADER_SOURCE = `
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

  FSHADER_SOURCE = `
  precision mediump float;
  varying vec4 v_Color;

  void main() {
    gl_FragColor = v_Color;
  }
  `;
  constructor(canvasId, dataBufferSize, shapeFragmentCount, shapeElementSize) {
    this.canvas = document.getElementById(canvasId);
    this.gl = getWebGLContext(this.canvas);
    if (!this.gl) {
      throw new Error("Failed to get the rendering context for WebGL");
    }
    if (!initShaders(this.gl, this.VSHADER_SOURCE, this.FSHADER_SOURCE)) {
      throw new Error("Failed to intialize shaders.");
    }
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);

    this.dataBuffer = new Float32Array(dataBufferSize);
    this.shapeFragmentCount = shapeFragmentCount;
    this.shapeElementSize = shapeElementSize;
    this.currentShapeCountInBuffer = 0;
  }

  reshapeDataBuffer(maxShapeCount) {
    this.dataBuffer = new Float32Array(
      maxShapeCount * this.shapeElementSize * this.shapeFragmentCount
    );
  }

  transferShapesToBuffer(shapes) {
    const ESIZE = this.shapeElementSize;
    const array = this.dataBuffer;

    const objectOffset = this.currentShapeCountInBuffer;

    let visibleShapeCount = 0;
    let bufferIndex = 0;
    for (let i = 0; i < shapes.length; i++) {
      const shape = shapes[i];
      if (shape.visible) {
        for (let j = 0; j < this.shapeFragmentCount; j++) {
          let index =
            ((bufferIndex + objectOffset) * this.shapeFragmentCount + j) *
            ESIZE;
          if (j === 0 && shape.type === "outline") {
            array[index++] = OUTLINE_CONSTANT - 1;
          } else {
            array[index++] = shape.x;
          }
          array[index++] = shape.y;
          array[index++] = shape.color[0];
          array[index++] = shape.color[1];
          array[index++] = shape.color[2];
          array[index++] = shape.color[3];
          array[index++] = shape.radius;
          array[index++] = j;
        }
        visibleShapeCount++;
        bufferIndex++;
      }
    }
    this.currentShapeCountInBuffer += visibleShapeCount;
  }

  render() {
    const array = this.dataBuffer;
    const FSIZE = array.BYTES_PER_ELEMENT;
    const ESIZE = this.shapeElementSize;
    const gl = this.gl;
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
    gl.uniform1f(total_Segments, this.shapeFragmentCount);

    gl.clear(gl.COLOR_BUFFER_BIT);

    for (let i = 0; i < this.currentShapeCountInBuffer; i++) {
      if (array[i * this.shapeFragmentCount * ESIZE] < OUTLINE_CONSTANT) {
        gl.drawArrays(
          gl.LINE_LOOP,
          i * this.shapeFragmentCount + 1,
          this.shapeFragmentCount - 1
        );
      } else {
        gl.drawArrays(
          gl.TRIANGLE_FAN,
          i * this.shapeFragmentCount,
          this.shapeFragmentCount
        );
      }
    }
    this.currentShapeCountInBuffer = 0;
  }

  runShapePipeline(arrayOfShapes) {
    arrayOfShapes.forEach(this.transferShapesToBuffer.bind(this));
    this.render();
  }
}

class GameMainLoop {
  constructor(worldContext, renderPipeline, technicalStats) {
    this.lastTimestamp = null;
    this.running = false;
    this.gameElapsedTime = 0;

    this.worldContext = worldContext;
    this.renderPipeline = renderPipeline;
    this.technicalStats = technicalStats;

    this.technicalStats.addBacteriaDivElements(this.worldContext.bacteria);
  }

  start() {
    this.running = true;
    this.lastTimestamp = null;
    this.loop(performance.now());
  }

  stop() {
    this.running = false;
  }

  loop(timestamp) {
    let totalUpdateTime = performance.now();
    if (!this.lastTimestamp) {
      this.lastTimestamp = timestamp;
    }

    let deltaMS = timestamp - this.lastTimestamp;
    if (deltaMS > 100) {
      console.log("DeltaMS too large, clamping to 100");
      deltaMS = 100;
    }
    this.gameElapsedTime += deltaMS;
    this.lastTimestamp = timestamp;

    this.worldContext.update(deltaMS / 1000.0, this.gameElapsedTime);

    let renderTimeMS = performance.now();
    this.renderPipeline.runShapePipeline([
      this.worldContext.scene.map((m) => m.shape),
      this.worldContext.bacteria.map((m) => m.shape),
      this.worldContext.poisons.map((m) => m.shape),
    ]);
    renderTimeMS = performance.now() - renderTimeMS;
    totalUpdateTime = performance.now() - totalUpdateTime;

    if (this.gameElapsedTime % 100 < 16) {
      this.technicalStats.updateBacteriaDivElements(this.worldContext.bacteria);
      this.technicalStats.updateStats(
        this.worldContext.bacteria,
        renderTimeMS,
        deltaMS / 1000.0,
        totalUpdateTime,
        this.gameElapsedTime
      );
    }
    if (this.running) requestAnimationFrame(this.loop.bind(this));
  }
}

class TechnicalStats {
  constructor() {
    this.renderTimeDiv = document.getElementById("render-time");
    this.totalTimeDiv = document.getElementById("total-time");
    this.deltaTimeDiv = document.getElementById("delta-time");
    this.budgetDiv = document.getElementById("budget");
    this.elapsedTimeDiv = document.getElementById("elapsed-time");
    this.bacteriaListTitleDiv = document.getElementById("bacteria-list-title");
    this.bacteriaListDiv = document.getElementById("bacteria-list");
  }

  addBacteriaDivElements(bacteria) {
    while (this.bacteriaListDiv.firstChild) {
      this.bacteriaListDiv.removeChild(this.bacteriaListDiv.firstChild);
    }
    for (let i = 0; i < bacteria.length; i++) {
      const bacterium = bacteria[i];
      const bacteriaDiv = document.createElement("div");
      bacteriaDiv.id = `bacteria-${i}`;
      bacteriaDiv.className = "bacteria";
      bacteriaDiv.style.width = `0px`;
      bacteriaDiv.style.height = `24px`;
      bacteriaDiv.style.backgroundColor = `rgba(${Math.floor(
        bacterium.shape.color[0] * 255
      )}, ${Math.floor(bacterium.shape.color[1] * 255)}, ${Math.floor(
        bacterium.shape.color[2] * 255
      )}, ${bacterium.shape.color[3]})`;
      bacteriaDiv.style.border = "2px solid transparent";
      bacteriaDiv.innerText = `B ${i} (Inactive)`;
      this.bacteriaListDiv.appendChild(bacteriaDiv);
    }
  }

  updateBacteriaDivElements(bacteria) {
    for (let i = 0; i < bacteria.length; i++) {
      const bacterium = bacteria[i];
      const bacteriaDiv = document.getElementById(`bacteria-${i}`);
      if (!bacterium.active) {
        bacteriaDiv.style.width = `100px`;
        bacteriaDiv.style.backgroundColor = "rgba(0, 0, 0, 1)";
        bacteriaDiv.style.color = "rgba(255, 255, 255, 1)";
        bacteriaDiv.style.border = "2px solid transparent";
        bacteriaDiv.innerText = `B ${i} (Dead)`;
      } else {
        bacteriaDiv.innerText = `B ${i} (${(
          (bacterium.shape.radius / bacterium.maxRadius) *
          100
        ).toFixed(2)}%)`;
        bacteriaDiv.style.width = `${(
          (bacterium.shape.radius / bacterium.maxRadius) *
          100
        ).toFixed(0)}px`;
        if (bacterium.shape.radius === bacterium.maxRadius) {
          bacteriaDiv.style.border = "2px solid red";
        }
      }
    }
  }

  updateStats(bacteria, renderTime, deltaS, totalUpdateTime, elapsedTime) {
    this.renderTimeDiv.innerText =
      "Render Time: " + renderTime.toFixed(2) + "ms";
    this.totalTimeDiv.innerText =
      "Total Time: " + totalUpdateTime.toFixed(2) + "ms";
    this.deltaTimeDiv.innerText =
      "Delta Time: " + (deltaS * 1000).toFixed(2) + "ms";
    this.budgetDiv.innerText =
      "Load: " + ((totalUpdateTime / (deltaS * 1000)) * 100).toFixed(1) + "%";
    this.elapsedTimeDiv.innerText =
      "Elapsed Time: " + elapsedTime.toFixed(2) + "ms";

    const activeBacteriaCount = bacteria.filter((b) => b.shape.visible).length;
    this.bacteriaListTitleDiv.innerText = `Active Bacteria: ${activeBacteriaCount.toFixed(
      0
    )}`;
  }
}

class GameStateController {
  constructor(worldContext, gameMainLoop) {
    this.circleCountInput = document.getElementById("circle-count");
    this.maxRadiusInput = document.getElementById("max-radius");
    this.startGrowthDelayInput = document.getElementById("start-growth-delay");
    this.growthRateInput = document.getElementById("growth-rate");

    this.circleCountInput.value = worldContext.settings.RANDOM_OBJECT_COUNT;
    this.maxRadiusInput.value = worldContext.settings.maxRadius;
    this.startGrowthDelayInput.value = worldContext.settings.growthStartDelayMs;
    this.growthRateInput.value = worldContext.settings.growRate;

    this.worldContext = worldContext;
    this.gameMainLoop = gameMainLoop;

    this.bindInputs();
    this.bindActions();
    this.bindCanvasClick();
  }

  setup() {
    this.worldContext.setup();
    this.gameMainLoop.renderPipeline.reshapeDataBuffer(
      this.worldContext.bacteria.length * 2
    );
    this.gameMainLoop.technicalStats.addBacteriaDivElements(
      this.worldContext.bacteria
    );
  }

  bindInputs() {
    this.circleCountInput.addEventListener("input", (event) => {
      this.worldContext.settings.RANDOM_OBJECT_COUNT = +event.target.value;
    });

    this.maxRadiusInput.addEventListener("input", (event) => {
      this.worldContext.settings.maxRadius = +event.target.value;
    });

    this.startGrowthDelayInput.addEventListener("input", (event) => {
      this.worldContext.settings.growthStartDelayMs = +event.target.value;
    });

    this.growthRateInput.addEventListener("input", (event) => {
      this.worldContext.settings.growRate = +event.target.value;
    });
  }

  disableInputs() {
    this.circleCountInput.disabled = true;
    this.maxRadiusInput.disabled = true;
    this.startGrowthDelayInput.disabled = true;
    this.growthRateInput.disabled = true;
  }

  enableInputs() {
    this.circleCountInput.disabled = false;
    this.maxRadiusInput.disabled = false;
    this.startGrowthDelayInput.disabled = false;
    this.growthRateInput.disabled = false;
  }

  bindActions() {
    document.getElementById("start").addEventListener("click", () => {
      this.disableInputs();
      document.getElementById("start").disabled = true;
      this.setup();
      this.gameMainLoop.start();
    });

    document.getElementById("pause").addEventListener("click", () => {
      if (this.gameMainLoop.running) {
        this.enableInputs();
        document.getElementById("pause").value = "Resume";
        this.gameMainLoop.stop();
      } else {
        this.disableInputs();
        document.getElementById("pause").value = "Pause";
        this.gameMainLoop.start();
      }
    });

    document.getElementById("reload").addEventListener("click", () => {
      location.reload();
    });
  }

  bindCanvasClick() {
    document.getElementById("webgl").addEventListener(
      "click",
      function handleCanvasClick(event) {
        const w = event.target.width;
        const h = event.target.height;
        const x = (event.offsetX / (w / 2) - 1) * 1;
        const y = (event.offsetY / (h / 2) - 1) * -1;
        // let target = null;
        // for (let bacteria of this.worldContext.bacteria) {
        //   if (
        //     CircleShape.checkCollision(bacteria.shape, {
        //       x: x,
        //       y: y,
        //       radius: 0.01,
        //     })
        //   ) {
        //     target = bacteria;
        //   }
        // }
        // if (target) {
        //   target.remove();
        // }
        this.worldContext.addPoison(x, y);
      }.bind(this)
    );
  }
}

const world = new WorldContext();
const renderPipeline = new RenderPipeline("webgl", 99999, 50, 8);
const technicalStats = new TechnicalStats();
const gameMainLoop = new GameMainLoop(world, renderPipeline, technicalStats);
const gameStateController = new GameStateController(world, gameMainLoop);
