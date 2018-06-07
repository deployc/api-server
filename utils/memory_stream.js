const { Readable, Duplex } = require('stream');

class MemoryReadableStream extends Readable {
    constructor(options) {
        super(options);
        this._data = '';
    }

    _read(size) {
        this.push(this._data);
        this._data = '';
    }
}

class PrefixedStream extends Duplex {
    constructor(prefix, options) {
        super(options);
        this.queue = [];
        this.prefix = prefix;
    }

    _read(size) {
        while (this.queue.length > 0) {
            this.push(this.prefix);
            this.push(this.queue.shift());
        }
    }

    _write(chunk, enc, cb) {
        this.queue.push(Buffer.isBuffer(chunk) ? chunk : new Buffer(chunk, enc));
        cb();
    }
}

module.exports = { MemoryReadableStream, PrefixedStream };
