// Expose the native DOMException provided by Node.js, deprecating the external polyfill
module.exports = globalThis.DOMException;
