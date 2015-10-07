import Salsa20 from './Salsa20';
import {Buffer} from 'buffer';
import crypto from 'crypto';

let ID = 1;
let key = crypto.randomBytes(32);

export default class ProtectedBuffer {
  constructor(buf) {
    this._iv = new Buffer(8);
    this._iv.fill(0);
    this._iv.writeUInt32LE(ID++, 0);

    this._data = new Buffer(buf);

    if(this._data.length) {
      let cipher = new Salsa20(key, this._iv);
      cipher.encrypt(this._data, true);
    }
  }

  get() {
    let res = new Buffer(this._data);
    if(res.length) {
      let cipher = new Salsa20(key, this._iv);
      cipher.encrypt(res, true);
    }
    return res;
  }
}
