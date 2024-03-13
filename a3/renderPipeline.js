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
	attribute vec3 color;
	varying vec3 vColor;
	void main() {
		gl_Position = Pmatrix * Vmatrix * Mmatrix * vec4(position, 1.0);\n
		vColor = color;
	}
  `;

	FSHADER_SOURCE = `
	precision mediump float;
	varying vec3 vColor;

	void main() {
	gl_FragColor = vec4(vColor, 1);
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
		this.gl.clearColor(1.0, 1.0, 1.0, 1.0);

		this.projMatrix = new Matrix4();
		this.projMatrix.setPerspective(80, this.canvas.width / this.canvas.height, 1, 100);

		this.moMatrix = new Matrix4();
		this.viewMatrix = new Matrix4();
	}

	resizeDataBuffer(size) {
		this.dataBuffer = new Float32Array(size);
	}

	setSphere(radius, latCount, langCount, color, dotColor) {
		const verticesCount = latCount * langCount;
		const vertexSize = 3 + 3;
		this.vertexSize = vertexSize;
		this.verticesCount = verticesCount;

		this.resizeDataBuffer(verticesCount * vertexSize);

		const latDegreeStep = 180 / latCount;
		const langDegreeStep = 360 / langCount;

		for (let latNumber = 0; latNumber <= latCount; latNumber++) {
			const theta = latNumber * latDegreeStep;
			const sinTheta = Math.sin(radians(theta));
			const cosTheta = Math.cos(radians(theta));
			for (let langNumber = 0; langNumber <= langCount; langNumber++) {
				const phi = langNumber * langDegreeStep;
				const sinPhi = Math.sin(radians(phi));
				const cosPhi = Math.cos(radians(phi));
				const x = cosPhi * sinTheta;
				const y = sinPhi * sinTheta;
				const z = cosTheta;

				let bIndex = (latNumber * langCount + langNumber) * vertexSize;
				this.dataBuffer[bIndex++] = x * radius;
				this.dataBuffer[bIndex++] = y * radius;
				this.dataBuffer[bIndex++] = z * radius;
				if (latNumber % 5 === 0 && langNumber % 5 === 0) {
					this.dataBuffer[bIndex++] = dotColor[0];
					this.dataBuffer[bIndex++] = dotColor[1];
					this.dataBuffer[bIndex++] = dotColor[2];
				} else {
					this.dataBuffer[bIndex++] = color[0];
					this.dataBuffer[bIndex++] = color[1];
					this.dataBuffer[bIndex++] = color[2];

				}
			}
		}
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

		const aColor = gl.getAttribLocation(gl.program, "color");
		gl.enableVertexAttribArray(aColor);
		gl.vertexAttribPointer(
			aColor,
			3,
			gl.FLOAT,
			false,
			FSIZE * ESIZE,
			FSIZE * 3
		);

		// const total_Segments = gl.getUniformLocation(gl.program, "total_Segments");
		// gl.uniform1f(total_Segments, this.shapeFragmentCount);

		gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "Pmatrix"), false, this.projMatrix.elements);
		gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "Vmatrix"), false, this.viewMatrix.elements);
		gl.uniformMatrix4fv(gl.getUniformLocation(gl.program, "Mmatrix"), false, this.moMatrix.elements);

		gl.enable(gl.DEPTH_TEST);
		gl.clear(gl.COLOR_BUFFER_BIT);

		gl.drawArrays(
			gl.TRIANGLE_FAN,
			0,
			this.verticesCount
		);
	}
}
