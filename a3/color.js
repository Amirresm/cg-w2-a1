class Color {
  static random() {
    return [Math.random(), Math.random(), Math.random(), 1.0];
  }

  static white() {
    return [1.0, 1.0, 1.0, 1.0];
  }

  static poison() {
    return [0.0, 1.0, 0.5, 1.0];
  }

  static explosion() {
    return [0.9, 0.4, 0.0, 1.0];
  }
}

