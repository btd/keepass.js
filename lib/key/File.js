import crypto from 'crypto';
import { Buffer } from 'buffer';
import Base from './Base';
import errors from '../utility/errors';

import ProtectedBuffer from '../crypto/ProtectedBuffer';

class File extends Base {
  constructor(content) {
    errors.buffer(content, 'content');
    super();

    let result = content.toString('utf8').match(/<Data>(.*?)<\/Data>/);
    if(result && result.length === 2) {
      this._hashBuffer = new Buffer(result[1], 'base64');
    } else {
      this._hashBuffer = crypto.createHash('sha256').update(content).digest();
    }

    this._hashBuffer = new ProtectedBuffer(this._hashBuffer);
  }

  hash() {
    return this._hashBuffer.get();
  }

  priority() {
    return 200;
  }
}

export default File;
