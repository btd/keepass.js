import errors from './errors';

class BufferReader {
  constructor(buffer) {
    errors.buffer(buffer, 'buffer');

    this._index = 0;
    this._buffer = buffer;
  }

  hasNext() {
    return this._index < this._buffer.length;
  }

  nextBuffer(length) {
    if(typeof length === 'undefined') length = this._buffer.length;
    let res = this._buffer.slice(this._index, this._index + length);
    this._index += length;
    return res;
  }

  _nextRead(method, length) {
    let res = this._buffer[method](this._index);
    this._index += length;
    return res;
  }

  nextUInt8() {
    return this._nextRead('readUInt8', 1);
  }

  nextUInt16LE() {
    return this._nextRead('readUInt16LE', 2);
  }

  nextUInt32LE() {
    return this._nextRead('readUInt32LE', 4);
  }
}

export default BufferReader;
