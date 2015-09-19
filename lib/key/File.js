import crypto from 'crypto';
import { Buffer } from 'buffer';
import Base from './Base';
import errors from '../utility/errors';

class File extends Base {
  constructor(content) {
    errors.buffer(content, 'content');
    super();

    let result = content.toString('utf8').match(/<Data>(.*?)<\/Data>/);
    if(result && result.length === 2) {
      this.__isBinary = false;
      this.__hashBuffer = new Buffer(result[1], 'base64');
    } else {
      this.__isBinary = true;
      this.__hashBuffer = crypto.createHash('sha256').update(content).digest('hex');
    }
  }

  type() {
    return this.__isBinary ? 'binary' : 'xml';
  }

  hash() {
    return this.__hashBuffer;
  }

  priority() {
    return 200;
  }
}

export default File;
