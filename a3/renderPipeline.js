function radians(degrees) {
	return degrees * Math.PI / 180;
}

class RenderPipeline {
	VSHADER_SOURCE = `
	#define PI radians(180.0)

	attribute vec3 position;

	uniform mat4 Pmatrix;
	uniform mat4 Vmatrix;
	uniform mat4 Mmatrix;

	uniform vec4 uSphereColor;
	uniform vec4 uDotColor;
	uniform vec4 uBacteriaColor;

	attribute float type;
	attribute vec3 color;
	varying vec4 vColor;
	void main() {
		gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);\n
		float pointScaleRate = 1.00;
		mat4 pointScale = mat4(pointScaleRate, 0.0, 0.0, 0.0,   0.0, pointScaleRate, 0.0, 0.0,   0.0, 0.0, pointScaleRate, 0.0,   0.0, 0.0, 0.0, 1.0);
		if (type == 0.0) {
			gl_PointSize = 0.0;
			vColor = uSphereColor;
		} else if (type == 1.0) {
			gl_PointSize = 4.0;
			gl_Position = gl_Position * pointScale;
			vColor = uDotColor;
		} else if (type == 2.0) {
			gl_PointSize = 8.0;
			gl_Position = gl_Position * pointScale;
			vColor = uBacteriaColor;
		}
	}
  `;

	FSHADER_SOURCE = `
	precision mediump float;
	varying vec4 vColor;

	void main() {
	gl_FragColor = vColor;
	}
  `;
	constructor(canvasId, latStep, langStep, sphereCount) {
		this.canvas = document.getElementById(canvasId);
		this.gl = getWebGLContext(this.canvas);
		if (!this.gl) {
			throw new Error("Failed to get the rendering context for WebGL");
		}
		if (!initShaders(this.gl, this.VSHADER_SOURCE, this.FSHADER_SOURCE)) {
			throw new Error("Failed to intialize shaders.");
		}
		this.gl.clearColor(1.0, 1.0, 1.0, 1.0);

		this.projMatrix = new Matrix4();
		this.projMatrix.setPerspective(80, this.canvas.width / this.canvas.height, 1, 100);

		this.moMatrix = new Matrix4();
		this.viewMatrix = new Matrix4();

		this.latStep = latStep;
		this.langStep = langStep;
		this.sphereCount = sphereCount;

		this.vertexSize = 3 + 1;
		this.verticesCount = latStep * langStep;
		this.dataBufferOffset = null;
		this.resizeDataBuffer(sphereCount * this.verticesCount * this.vertexSize);
		this.indices = [];
	}

	resizeDataBuffer(size) {
		this.dataBufferOffset = 0;
		this.dataBuffer = new Float32Array(size);
	}

	setColor(colorMap) {
		if (colorMap?.sphere) this.sphereColor = colorMap.sphere;
		if (colorMap?.dot) this.dotColor = colorMap.dot;
		if (colorMap?.bacteria) this.bacteriaColor = colorMap.bacteria;
	}

	setBacteriaPosition(phi, theta) {
		this.bacteriaPos = { phi, theta };
	}

	setDotPosition(phi, theta) {
		this.dotPos = { phi, theta };
	}

	addSphere(ox, oy, oz, radius, type = "field") {
		const latDegreeStep = 180 / (this.latStep - 1);
		const langDegreeStep = 360 / (this.langStep);

		let bufferOffset = this.dataBufferOffset;
		for (let latNumber = 0; latNumber < this.latStep; latNumber++) {
			const theta = latNumber * latDegreeStep + 0;
			const sinTheta = Math.sin(radians(theta));
			const cosTheta = Math.cos(radians(theta));
			for (let langNumber = 0; langNumber <= this.langStep; langNumber++) {
				const phi = langNumber * langDegreeStep;
				const sinPhi = Math.sin(radians(phi));
				const cosPhi = Math.cos(radians(phi));
				const x = cosPhi * sinTheta;
				const y = sinPhi * sinTheta;
				const z = cosTheta;

				let bIndex = bufferOffset + (latNumber * this.langStep + langNumber) * this.vertexSize;
				this.dataBuffer[bIndex++] = ox + x * radius;
				this.dataBuffer[bIndex++] = oy + y * radius;
				this.dataBuffer[bIndex++] = oz + z * radius;
				if (type === "field") {
					if (latNumber % this.dotPos.phi === 0 && langNumber % this.dotPos.theta === 0) {
						this.dataBuffer[bIndex++] = 1.0;
					} else if (latNumber === this.bacteriaPos.phi && langNumber === this.bacteriaPos.theta) {
						this.dataBuffer[bIndex++] = 2.0;
					} else {
						this.dataBuffer[bIndex++] = 0.0;
					}
				} else if (type === "bact") {
					this.dataBuffer[bIndex++] = 2.0;
				}
			}
		}

		const latRectCount = this.latStep;
		const langRectCount = this.langStep;
		bufferOffset = 1 * this.dataBufferOffset;
		for (let j = 0; j < latRectCount - 0; j++) {
			for (let i = 0; i < langRectCount; i++) {
				const q1 = i + j * langRectCount;
				const q2 = (i + 1) % langRectCount + j * langRectCount;
				const q3 = i + (j + 1) * langRectCount;
				const q4 = (i + 1) % langRectCount + (j + 1) * langRectCount;

				this.indices.push(bufferOffset + q1);
				this.indices.push(bufferOffset + q3);
				this.indices.push(bufferOffset + q4);
				this.indices.push(bufferOffset + q1);
				this.indices.push(bufferOffset + q2);
				this.indices.push(bufferOffset + q4);
			}
		}
		this.dataBufferOffset += this.verticesCount * this.vertexSize;
		this.indexBuffer = new Uint16Array(this.indices);
		if (this.indexBufferCount === undefined) this.indexBufferCount = this.indexBuffer.length;
		console.log(this.dataBuffer.length)
		console.log(this.dataBufferOffset)
		console.log(this.indexBuffer.length)
	}

	render() {
		const array = this.dataBuffer;
		const FSIZE = array.BYTES_PER_ELEMENT;
		const ESIZE = this.vertexSize
		const gl = this.gl;
		const buffer = gl.createBuffer();

		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, array, gl.DYNAMIC_DRAW);

		const aPostion = gl.getAttribLocation(gl.program, "position");
		gl.enableVertexAttribArray(aPostion);
		gl.vertexAttribPointer(
			aPostion,
			3,
			gl.FLOAT,
			false,
			FSIZE * ESIZE,
			FSIZE * 0
		);

		const aType = gl.getAttribLocation(gl.program, "type");
		gl.enableVertexAttribArray(aType);
		gl.vertexAttribPointer(
			aType,
			1,
			gl.FLOAT,
			false,
			FSIZE * ESIZE,
			FSIZE * 3
		);

		gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer, gl.STATIC_DRAW);

		gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "Pmatrix"), false, this.projMatrix.elements);
		gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "Vmatrix"), false, this.viewMatrix.elements);
		gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "Mmatrix"), false, this.moMatrix.elements);

		gl.uniform4fv(gl.getUniformLocation(gl.program, "uSphereColor"), this.sphereColor);
		gl.uniform4fv(gl.getUniformLocation(gl.program, "uDotColor"), this.dotColor);
		gl.uniform4fv(gl.getUniformLocation(gl.program, "uBacteriaColor"), this.bacteriaColor);

		gl.enable(gl.DEPTH_TEST);
		gl.clear(gl.COLOR_BUFFER_BIT);
		for (let i = 0; i < this.sphereCount; i++) {
			gl.drawElements(gl.TRIANGLES, this.indexBufferCount, gl.UNSIGNED_SHORT, this.indexBufferCount);
			// gl.drawArrays(
			// 	gl.POINTS,
			// 	i * this.verticesCount,
			// 	this.verticesCount
			// );
		}
	}
}
