function main() {
	const renderPipeline = new RenderPipeline("webgl");

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
	window.onmousemove = function(ev) {
		if (dragging) {
			let x = ev.clientX;
			let y = ev.clientY;
			let factor = 100 / canvas.height;
			let dx = factor * (x - dragStartX);
			let dy = factor * (y - dragStartY);
			console.log(dx, dy);
			renderPipeline.viewMatrix.rotate(dy, 1, 0, 0);
			renderPipeline.viewMatrix.rotate(dx, 0, 1, 0);
			dragStartX = x;
			dragStartY = y;
		}
	}

	renderPipeline.setSphere(2, 6, 6, [0.3, 0.3, 0.3, 1], [1, 1, 0, 1]);
	renderPipeline.viewMatrix.setTranslate(0, 0, -6);

	let theta = 0.0;
	function render() {
		renderPipeline.viewMatrix.rotate(theta, 1, 0, 0);
		renderPipeline.render();
		requestAnimationFrame(render);
	}

	render();
}

window.onload = main;
