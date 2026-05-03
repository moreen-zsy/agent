// Browser shim for Node's `stream` module.
// `clarinet` (transitive dep of @ag-ui/a2ui-middleware) calls
// `require('stream').Stream.prototype` at module init; without this shim
// `Stream` resolves to `undefined` and the bundle crashes before mount.
export function Stream() {}
export default { Stream };
