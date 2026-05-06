// Minimal util polyfill for browser
export function debuglog() { return function() {}; }
export function inspect() { return ''; }
export function format() { return ''; }
export default { debuglog, inspect, format };
