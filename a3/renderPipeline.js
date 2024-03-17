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
			gl_PointSize = 5.0;
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
	constructor(canvasId, latStep, langStep, maxSphereCount) {
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
		this.maxSphereCount = maxSphereCount;
		this.currentSphereCount = 0;

		this.vertexSize = 3 + 1;
		this.verticesCount = latStep * langStep + 2;
		this.indicesCount = (latStep) * langStep * 6 + 2 * langStep * 3;
		this.dataBufferOffset = null;
		this.resizeDataBuffer(maxSphereCount * this.verticesCount * this.vertexSize);
		this.indices = [];
		this.lineIndices = [];
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

	createSphere(ox, oy, oz, radius, latCount, longCount) {
		const latDegreeStep = 180 / (latCount + 1);
		const longDegreeStep = 360 / (longCount);

		const points = [];
		points.push({ x: ox, y: oy + radius, z: oz, lat: 0, long: 0 });
		for (let latIter = 1; latIter < latCount + 1; latIter++) {
			const theta = radians(latIter * latDegreeStep);
			const sinTheta = Math.sin(theta);
			const cosTheta = Math.cos(theta);
			for (let longIter = 0; longIter < longCount; longIter++) {
				const phi = radians(longIter * longDegreeStep);
				const sinPhi = Math.sin(phi);
				const cosPhi = Math.cos(phi);
				const x = ox + radius * cosPhi * sinTheta;
				const y = oy + radius * cosTheta;
				const z = oz + radius * sinPhi * sinTheta;
				points.push({ x, y, z, lat: latIter, long: longIter })
			}
		}
		points.push({ x: ox, y: oy - radius, z: oz, lat: latCount + 1, long: 0 });
		return points;
	}

	addSphere = (ox, oy, oz, radius, type = "field") => {
		let bufferOffset = this.currentSphereCount * this.verticesCount * this.vertexSize;


		const spherePoints = this.createSphere(ox, oy, oz, radius, this.latStep, this.langStep);
		spherePoints.forEach((point, i) => {
			const { lat, long } = point;
			let bIndex = bufferOffset + i * this.vertexSize;
			this.dataBuffer[bIndex++] = point.x;
			this.dataBuffer[bIndex++] = point.y;
			this.dataBuffer[bIndex++] = point.z;

			if (type === "field") {
				if (lat % this.dotPos.phi === 0 && long % this.dotPos.theta === 0) {
					this.dataBuffer[bIndex++] = 1.0;
				} else if (lat === this.bacteriaPos.phi && long === this.bacteriaPos.theta) {
					this.dataBuffer[bIndex++] = 0.0;
				} else {
					this.dataBuffer[bIndex++] = 0.0;
				}
			} else if (type === "bact") {
				this.dataBuffer[bIndex++] = 2.0;
			}
		});

		const bufferVertexOffset = (this.currentSphereCount * this.verticesCount);
		for (let point of spherePoints) {
			const latIndex = point.lat - 1;
			if (point.lat === 0) {
				for (let i = 0; i < this.langStep; i++) {
					const start = 0;
					const p1 = 1 + i;
					const p2 = 1 + ((i + 1) % this.langStep);
					this.indices.push(bufferVertexOffset + start);
					this.indices.push(bufferVertexOffset + p1);
					this.indices.push(bufferVertexOffset + p2);
				}
			} else if (point.lat === this.latStep + 1) {
				for (let i = 0; i < this.langStep; i++) {
					const end = this.latStep * this.langStep + 1;
					const p1 = 1 + ((this.latStep - 1) * this.langStep) + i;
					const p2 = 1 + ((this.latStep - 1) * this.langStep) + ((i + 1) % this.langStep);
					this.indices.push(bufferVertexOffset + end);
					this.indices.push(bufferVertexOffset + p1);
					this.indices.push(bufferVertexOffset + p2);
				}
			} else {
				const row11 = 1 + (latIndex * this.langStep) + point.long;
				const row12 = 1 + (latIndex * this.langStep) + (point.long + 1) % this.langStep;
				const row21 = 1 + ((latIndex + 1) % this.latStep * this.langStep) + point.long;
				const row22 = 1 + ((latIndex + 1) % this.latStep * this.langStep) + (point.long + 1) % this.langStep;

				this.indices.push(bufferVertexOffset + row11);
				this.indices.push(bufferVertexOffset + row12);
				this.indices.push(bufferVertexOffset + row21);

				this.indices.push(bufferVertexOffset + row12);
				this.indices.push(bufferVertexOffset + row22);
				this.indices.push(bufferVertexOffset + row21);
			}
		}

		this.dataBufferOffset += this.verticesCount * this.vertexSize;
		this.indexBuffer = new Uint16Array(this.indices);
		// console.log(this.dataBuffer.length)
		// console.log(this.dataBufferOffset)
		// console.log(bufferVertexOffset)
		// console.log(this.indexBuffer.length)
		// console.log(this.indicesCount)
		// console.log(this.indices.slice((this.currentSphereCount) * this.indicesCount, (this.currentSphereCount + 1) * this.indicesCount))
		this.currentSphereCount += 1;
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
		gl.drawElements(gl.TRIANGLES, this.indicesCount * this.currentSphereCount, gl.UNSIGNED_SHORT, 0);
		for (let i = 0; i < this.currentSphereCount; i++) {
			// gl.drawElements(gl.TRIANGLES, this.indicesCount, gl.UNSIGNED_SHORT, i * this.indicesCount * Uint16Array.BYTES_PER_ELEMENT);
			// gl.drawArrays(
			// 	gl.POINTS,
			// 	i * this.verticesCount,
			// 	this.verticesCount
			// );
		}
	}
}
