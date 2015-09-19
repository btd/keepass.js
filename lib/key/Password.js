import crypto from 'crypto';
import Base from './Base';
import errors from '../utility/errors';

class Password extends Base {
  constructor(rawPassword) {
    errors.typeOf(rawPassword, 'string', 'rawPassword');
    super();

    this.__hashBuffer = crypto
      .createHash('sha256')
      .update(rawPassword, 'utf-8')
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
