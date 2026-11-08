// The Átrios mark (the two halves of the arch), as SVG path data on a
// 400×400 box: the same drawing as the site's header. The certificate PDF
// draws it with pdfkit's path(), so it stays vector at any size.

/** The box the drawing fills, as the site header crops it. */
export const ATRIOS_MARK_VIEWBOX = {
  x: 30,
  y: 0,
  width: 340,
  height: 400,
} as const;

export const ATRIOS_MARK_PATHS: readonly string[] = [
  "M39.04 128.87c-1.23,77.99 -0.52,163.71 -0.22,240.81 11.39,-3.28 84.14,-35.7 89.52,-40.65l-0.01 -155.23c2.75,-2.73 11.89,-8.51 15.41,-10.74l32.07 -21.05c4.81,-3.37 11.76,-7.08 16.56,-11.1 0.97,-27.3 0.07,-71.63 0.14,-101.19l-153.47 99.15z",
  "M207.59 131.2c4.74,2.03 11.39,7.13 16.07,10.19l48.52 31.16 -0.58 157.71c10.39,3.14 70.09,34.07 89.51,40.04l0.55 -241.76 -76.79 -49.37c-17.31,-11.87 -39.72,-24.95 -57.79,-37.18 -4.81,-3.26 -15.12,-10.65 -19.67,-12.29l0.18 101.5z",
];
