import crypto from 'crypto';
import { Buffer } from 'buffer';

export class Cipher {
  name() {
    throw new Error('Not implemented');
  }

  uuid() {
    throw new Error('Not implemented');
  }

  encrypt(/*buffer, key, iv*/) {
    throw new Error('Not implemented');
  }

  decrypt(/*buffer, key, iv*/) {
    throw new Error('Not implemented');
  }
}

export class AesDefaultCipher extends Cipher {
  name() {
    return 'AES-256-CDC';
  }

  uuid() {
    return 'McHy5r9xQ1C+WAUhavxa/w==';
  }

  encrypt(buffer, key, iv) {
    let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
  }

  decrypt(buffer, key, iv) {
    let cipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    // Decrypt database with AES-256-CBC
    cipher.setAutoPadding(true);
    return Buffer.concat([
      cipher.update(buffer),
      cipher.final()
    ]);
  }
}

const aes = new AesDefaultCipher;

Cipher.ALL = {
  [aes.uuid()]: aes
};

Cipher.DEFAULT = aes.uuid();
