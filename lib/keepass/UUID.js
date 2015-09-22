import uuid from 'uuid';
import { Buffer } from 'buffer';

class UUID {
  constructor(value) {
    if(!value) {
      let buffer = new Buffer(16);
      uuid.v4(null, buffer, 0);
      value = buffer.toString('base64');
    }
    this._value = value;
  }

  get value() {
    return this._value;
  }

  toXml() {
    return this._value;
  }
}

let buffer = new Buffer(16);
buffer.fill(0);

UUID.ZERO = new UUID(buffer.toString('base64'));

UUID.fromXml = function(str) {
  return new UUID(str);
}

export default UUID;
