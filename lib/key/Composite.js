import crypto from 'crypto';
import errors from '../utility/errors';
import BaseKey from './Base';


class Composite extends BaseKey {
  constructor(keys) {
		super();
    this.reset();
    (keys || []).forEach(this.add, this);
  }

  add(key) {
    errors.instanceOf(key, BaseKey, 'key');
    this._keys.push(key);
  }

  hash() {
    // Check if there are any credentials
    if(!this._keys || this._keys.length === 0) {
      throw new Error('Can not build composite hash when no keys were given');
    }

    this._keys = this._keys.sort((a, b) => a.priority() - b.priority());

    // Merge all credentials together and hash them with SHA256
    let compositeHash = crypto.createHash('sha256');
    this._keys.forEach(c => {
      compositeHash.update(c.hash());
    });
    return compositeHash.digest();
  }

  reset() {
    this._keys = [];
  }
}

export default Composite;
