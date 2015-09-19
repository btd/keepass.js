import uuid from 'uuid';
import { Buffer } from 'buffer';

class UUID {
  constructor() {
    let buffer = new Buffer(16);
    uuid.v4(null, buffer, 0);
    this._value = buffer;
  }

  toXml() {
    return this._value.toString('base64');
  }
}

let zero = new UUID;
zero._value.fill(0);

UUID.ZERO = zero;

UUID.fromXml = function(str) {
  let u = new UUID;
  u._value = new Buffer(str, 'base64');
  return u;
}

export default UUID;
