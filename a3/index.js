function randomPointOnSphere(ox, oy, oz, radius) {
	const randomLat = Math.floor(Math.random() * 180);
	const randomLong = Math.floor(Math.random() * 360);

	const theta = radians(randomLat);
	const sinTheta = Math.sin(theta);
	const cosTheta = Math.cos(theta);
	const phi = radians(randomLong);
	const sinPhi = Math.sin(phi);
	const cosPhi = Math.cos(phi);
	const x = ox + radius * cosPhi * sinTheta;
	const y = oy + radius * cosTheta;
	const z = oz + radius * sinPhi * sinTheta;
	return { x, y, z, lat: randomLat, long: randomLong }
}

function pointOnSphere(ox, oy, oz, radius, latNumber, longNumber) {
	const randomLat = 90 + latNumber * 180;
	const randomLong = 270 + longNumber * 360;

	const theta = radians(randomLat);
	const sinTheta = Math.sin(theta);
	const cosTheta = Math.cos(theta);
	const phi = radians(randomLong);
	const sinPhi = Math.sin(phi);
	const cosPhi = Math.cos(phi);
	const x = ox + radius * cosPhi * sinTheta;
	const y = oy + radius * cosTheta;
	const z = oz + radius * sinPhi * sinTheta;
	return { x, y, z, lat: randomLat, long: randomLong }
}

function main() {
	const resolution = 20;
	const renderPipeline = new RenderPipeline("webgl", resolution, resolution * 2, 10);

	const canvas = document.getElementById("webgl");


	let dragging = false;
	let dragStartX;
	let dragStartY;
	window.onmousedown = function(ev) {
		dragging = true;
		dragStartX = ev.clientX;
		dragStartY = ev.clientY;
	}

	window.onmouseup = function() {
		dragging = false;
	}
	let dx = 0;
	let dy = 0;
	let zoom = 6
	window.onmousemove = function(ev) {
		if (dragging) {
			let x = ev.clientX;
			let y = ev.clientY;
			let factor = 0.5 / canvas.height;
			dx += factor * (x - dragStartX);
			dy += factor * (y - dragStartY);
			if (dy > 0.495) dy = 0.495;
			if (dy < -0.495) dy = -0.495;
			const { x: ex, y: ey, z: ez } = pointOnSphere(0, 0, 0, zoom, -dy, dx);
			renderPipeline.viewMatrix.setLookAt(ex, ey, ez, 0, 0, 0, 0, 1, 0)
			dragStartX = x;
			dragStartY = y;
		}
	}
	window.addEventListener("wheel", event => {
		const delta = Math.sign(event.deltaY);
		zoom += delta * 0.5;
		const { x: ex, y: ey, z: ez } = pointOnSphere(0, 0, 0, zoom, -dy, dx);
		renderPipeline.viewMatrix.setLookAt(ex, ey, ez, 0, 0, 0, 0, 1, 0)
	});


	renderPipeline.setColor({
		sphere: [0.3, 0.3, 0.3, 1.0],
		dot: [0.7, 0.7, 0.7, 1.0],
		bacteria: [0.0, 1.0, 0.0, 1.0],
	})

	renderPipeline.setDotPosition(4, 4);
	renderPipeline.setBacteriaPosition(2, 100);

	renderPipeline.addSphere(0, 0, 0, 3.0);
	renderPipeline.addSphere(0, 0, 0, 3.01, "grid");


	const bacteriaPos = randomPointOnSphere(0, 0, 0, 2.95);
	renderPipeline.addSphere(bacteriaPos.x, bacteriaPos.y, bacteriaPos.z, 0.1, "bact");
	// renderPipeline.viewMatrix.setTranslate(0, 0, -6);
	const { x: ex, y: ey, z: ez } = pointOnSphere(0, 0, 0, 6, 0, 0);
	renderPipeline.viewMatrix.setLookAt(ex, ey, ez, 0, 0, 0, 0, 1, 0);

	let theta = 0.0;
	function render() {
		renderPipeline.viewMatrix.rotate(theta, 1, 0, 0);
		renderPipeline.render();
		requestAnimationFrame(render);
	}

	render();
}

window.onload = main;
