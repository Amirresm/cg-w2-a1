function main() {
	const renderPipeline = new RenderPipeline("webgl");

	renderPipeline.setSphere(2, 100, 100, [1, 0, 0, 1], [1, 1, 0, 1]);

	let theta = 0;
	function render() {
		theta += 0.1;
		renderPipeline.moMatrix.setRotate(theta, 0, 1, 0);
		renderPipeline.render();
		requestAnimationFrame(render);
	}

	render();
}

window.onload = main;
