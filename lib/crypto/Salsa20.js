
const SIGMA = [0x61707865, 0x3320646E, 0x79622D32, 0x6B206574];

function Salsa20Cipher(key, iv) {
  this._state = new Array(16);

  this._output = new Array(64);
  this._outputPos = 64;

  this.setKey(key);
  this.setIV(iv);
}

function U8To32Little(pb, offset) {
  return (pb[offset] & 0xFF) |
    ((pb[offset + 1] & 0xFF) << 8) |
    ((pb[offset + 2] & 0xFF) << 16) |
    ((pb[offset + 3] & 0xFF) << 24);
}

function Rotl32(x, b) {
  return ((x << b) | (x >>> (32 - b)));
}

Salsa20Cipher.prototype = {
  setKey(k) {
    if(k == null || k.length !== 32) throw new Error("Key must not be null and has length 32 bytes");

    this._state[1] = U8To32Little(k, 0);
    this._state[2] = U8To32Little(k, 4);
    this._state[3] = U8To32Little(k, 8);
    this._state[4] = U8To32Little(k, 12);
    this._state[11] = U8To32Little(k, 16);
    this._state[12] = U8To32Little(k, 20);
    this._state[13] = U8To32Little(k, 24);
    this._state[14] = U8To32Little(k, 28);
    this._state[0] = SIGMA[0];
    this._state[5] = SIGMA[1];
    this._state[10] = SIGMA[2];
    this._state[15] = SIGMA[3];
  },

  setIV(iv) {
    if(iv == null || iv.length != 8) throw new Error("iv must not be null and has length 8 bytes");

    this._state[6] = U8To32Little(iv, 0);
    this._state[7] = U8To32Little(iv, 4);
    this._state[8] = 0;
    this._state[9] = 0;
  },

  _nextOutput() {
		let x = new Array(16);

		for(let i = 0; i < 16; i++) {
			x[i] = this._state[i];
		}

    for(let i = 0; i < 10; ++i) // (let i = 20; i > 0; i -= 2)
    {
      x[ 4] ^= Rotl32(x[ 0] + x[12],  7);
      x[ 8] ^= Rotl32(x[ 4] + x[ 0],  9);
      x[12] ^= Rotl32(x[ 8] + x[ 4], 13);
      x[ 0] ^= Rotl32(x[12] + x[ 8], 18);
      x[ 9] ^= Rotl32(x[ 5] + x[ 1],  7);
      x[13] ^= Rotl32(x[ 9] + x[ 5],  9);
      x[ 1] ^= Rotl32(x[13] + x[ 9], 13);
      x[ 5] ^= Rotl32(x[ 1] + x[13], 18);
      x[14] ^= Rotl32(x[10] + x[ 6],  7);
      x[ 2] ^= Rotl32(x[14] + x[10],  9);
      x[ 6] ^= Rotl32(x[ 2] + x[14], 13);
      x[10] ^= Rotl32(x[ 6] + x[ 2], 18);
      x[ 3] ^= Rotl32(x[15] + x[11],  7);
      x[ 7] ^= Rotl32(x[ 3] + x[15],  9);
      x[11] ^= Rotl32(x[ 7] + x[ 3], 13);
      x[15] ^= Rotl32(x[11] + x[ 7], 18);
      x[ 1] ^= Rotl32(x[ 0] + x[ 3],  7);
      x[ 2] ^= Rotl32(x[ 1] + x[ 0],  9);
      x[ 3] ^= Rotl32(x[ 2] + x[ 1], 13);
      x[ 0] ^= Rotl32(x[ 3] + x[ 2], 18);
      x[ 6] ^= Rotl32(x[ 5] + x[ 4],  7);
      x[ 7] ^= Rotl32(x[ 6] + x[ 5],  9);
      x[ 4] ^= Rotl32(x[ 7] + x[ 6], 13);
      x[ 5] ^= Rotl32(x[ 4] + x[ 7], 18);
      x[11] ^= Rotl32(x[10] + x[ 9],  7);
      x[ 8] ^= Rotl32(x[11] + x[10],  9);
      x[ 9] ^= Rotl32(x[ 8] + x[11], 13);
      x[10] ^= Rotl32(x[ 9] + x[ 8], 18);
      x[12] ^= Rotl32(x[15] + x[14],  7);
      x[13] ^= Rotl32(x[12] + x[15],  9);
      x[14] ^= Rotl32(x[13] + x[12], 13);
      x[15] ^= Rotl32(x[14] + x[13], 18);
    }

//		console.log(x);

    for(let i = 0; i < 16; ++i)
      x[i] += this._state[i];

//		console.log(x);

    for(let i = 0; i < 16; ++i)
    {
      this._output[i << 2] = x[i] & 0xFF;
      this._output[(i << 2) + 1] = (x[i] >>> 8) & 0xFF;
      this._output[(i << 2) + 2] = (x[i] >>> 16) & 0xFF;
      this._output[(i << 2) + 3] = (x[i] >>> 24) & 0xFF;
    }

    this._outputPos = 0;

		this._state[8] += 1;
		if(this._state[8] == 0)
			this._state[9] += 1;

  },

  encrypt(bytes, xor) {
    let bytesCount = bytes.length;
    let bytesRem = bytesCount, offset = 0;
    while(bytesRem > 0) {
      if(this._outputPos == 64) this._nextOutput();

      let copy = Math.min(64 - this._outputPos, bytesRem);

      if(xor) {
        for(let i = 0; i < copy; i++) {
          bytes[i + offset] ^= this._output[i + this._outputPos];
        }
      } else {
        for(let i = 0; i < copy; i++) {
          bytes[i + offset] = this._output[i + this._outputPos];
        }
      }

      this._outputPos += copy;
      bytesRem -= copy;
      offset += copy;
    }
    return bytes;
  }
}

export default Salsa20Cipher;
