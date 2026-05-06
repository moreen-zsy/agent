// Minimal stream polyfill for clarinet in browser
export class Stream {
  on() {}
  once() {}
  emit() {}
  write() {}
  end() {}
  pipe() { return this; }
}
export default { Stream };
