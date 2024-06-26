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
			gl_PointSize = 3.0;
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
		this.dataBufferOffset = null;
		this.resizeDataBuffer(maxSphereCount * this.verticesCount * this.vertexSize);
		this.indices = [];
		this.indicesCount = latStep * langStep * 6 + 2 * langStep * 3;
		this.lineIndices = [];
		this.lineIndicesCount = latStep * langStep * 2;
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


	static pointOnSphere(ox, oy, oz, radius, latDeg, longDeg) {
		latDeg = latDeg + 0;
		longDeg = longDeg + 0;

		const theta = radians(latDeg);
		const sinTheta = Math.sin(theta);
		const cosTheta = Math.cos(theta);
		const phi = radians(longDeg)
		const sinPhi = Math.sin(phi);
		const cosPhi = Math.cos(phi);
		const x = ox + radius * cosPhi * sinTheta;
		const y = oy + radius * cosTheta;
		const z = oz + radius * sinPhi * sinTheta;
		console.log({ x, y, z });
		// return { x, y, z };
		return RenderPipeline.rotatePoint(x, y, z, 90, 1, 0, 0);
	}

	static rotatePoint(x, y, z, deg, ax, ay, az) {
		const mat4 = new Matrix4();
		// mat4.setIdentity();
		mat4.elements = new Float32Array([ 1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1 ]);
		console.log(mat4.elements)

		mat4.rotate(deg, ax, ay, az);
		console.log(mat4.elements)

		return {
			x: mat4.elements[12],
			y: mat4.elements[13],
			z: mat4.elements[14],
		}
	}

	createBactSphere(ox, oy, oz, radius, width, latCount, longCount) {
		const latDegreeStep = 180 / (latCount + 1);
		const longDegreeStep = 360 / (longCount);

		const points = [];

		const startPoint = RenderPipeline.pointOnSphere(ox, oy, oz, radius, 0, 0);
		points.push({ x: startPoint.x, y: startPoint.y, z: startPoint.z, lat: 0, long: 0 });

		for (let latIter = 1; latIter < latCount + 1; latIter++) {
			for (let longIter = 0; longIter < longCount; longIter++) {
				const latDegree = latIter * latDegreeStep;
				const longDegree = longIter * longDegreeStep;
				const middlePoint = RenderPipeline.pointOnSphere(ox, oy, oz, radius, latDegree, longDegree);
				// console.log(middlePoint);
				points.push({ x: middlePoint.x, y: middlePoint.y, z: middlePoint.z, lat: latIter, long: longIter })
			}
		}
		const endPoint = RenderPipeline.pointOnSphere(ox, oy, oz, radius, (latCount + 1) * latDegreeStep, 0);
		points.push({ x: endPoint.x, y: endPoint.y, z: endPoint.z, lat: latCount + 1, long: 0 });
		console.log(points.length)
		return points;
	}

	addSphere = (ox, oy, oz, radius, type = "field") => {
		let bufferOffset = this.currentSphereCount * this.verticesCount * this.vertexSize;


		const spherePoints = type === "exp"
			? this.createBactSphere(ox, oy, oz, radius, 10, this.latStep, this.langStep)
			: this.createSphere(ox, oy, oz, radius, this.latStep, this.langStep);
		spherePoints.forEach((point, i) => {
			let bIndex = bufferOffset + i * this.vertexSize;
			this.dataBuffer[bIndex++] = point.x;
			this.dataBuffer[bIndex++] = point.y;
			this.dataBuffer[bIndex++] = point.z;

			if (type === "field") {
				this.dataBuffer[bIndex++] = 0.0;
			} else if (type === "bact") {
				this.dataBuffer[bIndex++] = 2.0;
			} else if (type === "grid" || type === "exp") {
				this.dataBuffer[bIndex++] = 1.0;
			}

		});

		const bufferVertexOffset = (this.currentSphereCount * this.verticesCount);
		if (type === "grid" || type === "exp") {
			for (let point of spherePoints) {
				const latIndex = point.lat - 1;
				if (point.lat !== 0 && point.lat !== this.latStep + 1) {
					const p1 = 1 + (latIndex * this.langStep) + point.long;
					const p2 = 1 + (latIndex * this.langStep) + (point.long + 1) % this.langStep;
					this.lineIndices.push(bufferVertexOffset + p1);
					this.lineIndices.push(bufferVertexOffset + p2);
				}
				if (point.lat === 0) {
					for (let i = 0; i < this.langStep; i++) {
						const p1 = 0;
						const p2 = 1 + i;
						this.lineIndices.push(bufferVertexOffset + p1);
						this.lineIndices.push(bufferVertexOffset + p2);
					}
				} else if (point.lat === this.latStep + 1) {
					for (let i = 0; i < this.langStep; i++) {
						const p1 = this.latStep * this.langStep + 1;
						const p2 = 1 + ((this.latStep - 1) * this.langStep) + i;
						this.lineIndices.push(bufferVertexOffset + p1);
						this.lineIndices.push(bufferVertexOffset + p2);
					}
				} else if (point.lat < this.latStep) {
					const p1 = 1 + (latIndex * this.langStep) + point.long;
					const p2 = 1 + ((latIndex + 1) % this.latStep * this.langStep) + point.long;
					this.lineIndices.push(bufferVertexOffset + p1);
					this.lineIndices.push(bufferVertexOffset + p2);
				}
			}
		} else {
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
		}

		this.dataBufferOffset += this.verticesCount * this.vertexSize;
		this.indexBuffer = new Uint16Array(this.indices);
		this.lineIndexBuffer = new Uint16Array(this.lineIndices);
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
		gl.drawElements(gl.TRIANGLES, this.indexBuffer.length, gl.UNSIGNED_SHORT, 0);

		// gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.lineIndexBuffer, gl.STATIC_DRAW);
		gl.drawElements(gl.LINES, this.lineIndexBuffer.length, gl.UNSIGNED_SHORT, 0);
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
