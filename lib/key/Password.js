import crypto from 'crypto';
import Base from './Base';

class Password extends Base {
  constructor(rawPassword) {
    super();

    this.__hashBuffer = crypto
      .createHash('sha256')
      .update(rawPassword)
      .digest();
  }

  hash() {
    return this.__hashBuffer;
  }

  priority() {
    return 100;
  }
}

export default Password;
