import crypto from 'crypto';
import Base from './Base';

import ProtectedBuffer from '../crypto/ProtectedBuffer';

class Password extends Base {
  constructor(rawPassword) {
    super();

    this._hashBuffer =
      new ProtectedBuffer(crypto
        .createHash('sha256')
        .update(rawPassword)
        .digest())
  }

  hash() {
    return this._hashBuffer.get();
  }

  priority() {
    return 100;
  }
}

export default Password;
