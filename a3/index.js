function main() {
	const renderPipeline = new RenderPipeline("webgl");

	renderPipeline.setSphere(1, 100, 100, [1, 0, 0, 1], [1, 1, 0, 1]);
	renderPipeline.viewMatrix.setTranslate(0, 0, -6);

	let theta = 0.1;
	function render() {
		renderPipeline.viewMatrix.rotate(theta, 0, 1, 0);
		renderPipeline.render();
		requestAnimationFrame(render);
	}

	render();
}

window.onload = main;
