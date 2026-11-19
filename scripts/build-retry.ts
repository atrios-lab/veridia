// When `next build` may be tried again (decision of 19/11/2026).
//
// The serif faces come from Google Fonts at build time (src/lib/fonts.ts).
// When that download fails on the build machine, Turbopack stops with
// "next/font/google queries have exactly one entry" for every face, and the
// whole deploy fails although nothing in the code is wrong: the same commit
// builds on the next try. That failure, and only that one, is worth trying
// again; any other error stops the deploy at once.

/** How many times the build is tried in all, the first one included. */
export const MAX_BUILD_ATTEMPTS = 3;

/** Seconds to wait before trying again, so a slow font server can recover. */
export const RETRY_DELAY_SECONDS = 10;

const FONT_DOWNLOAD_FAILURE = [
  /next\/font\/google queries have exactly one entry/,
  /Failed to fetch `[^`]+` from Google Fonts/i,
  /Failed to fetch font `[^`]+`/i,
];

/** Whether a failed build's output says the fonts could not be downloaded. */
export function isFontDownloadFailure(output: string): boolean {
  return FONT_DOWNLOAD_FAILURE.some((pattern) => pattern.test(output));
}

/** Whether to try again after a failed attempt (1-based) with this output. */
export function shouldRetryBuild(attempt: number, output: string): boolean {
  return attempt < MAX_BUILD_ATTEMPTS && isFontDownloadFailure(output);
}
