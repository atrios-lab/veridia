/**
 * The largest file one sending of the Registro Civil accepts (the upload
 * route, app/api/rcpn/upload): the whole base, packed. Shown on the screen
 * so the office knows it before choosing the file.
 */
export const RCPN_MAX_MB = 500;
export const RCPN_MAX_BYTES = RCPN_MAX_MB * 1024 * 1024;
