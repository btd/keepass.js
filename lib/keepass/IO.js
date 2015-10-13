import crypto from 'crypto';
import zlib from 'zlib';
import { Buffer } from 'buffer';

import Promise from 'bluebird';
import xml2js from 'xml2js';

import Salsa20 from '../crypto/Salsa20';
import { Cipher } from '../crypto/Cipher';
import HashedBlockIO from '../utility/HashedBlockIO';
import CompositeKey from '../key/Composite';
import BufferReader from '../utility/BufferReader';

import Database from './Database';

import { FILE_SIGNATURE_1, FILE_SIGNATURE_2, FILE_VERSION, HEADER_FIELD_ID, COMPRESSION } from './KdbxFile';

const SALSA_20 = new Buffer([ 0x02, 0x00, 0x00, 0x00]);

const END = new Buffer('\r\n\r\n');

const STREAM_START_BYTES_LENGTH = 32;

export class DatabaseOptions {
  constructor({
    cipher = Cipher.DEFAULT,
    transformRounds = 6000,
    compression = COMPRESSION.GZIP,
    masterSeed = crypto.randomBytes(32),
    transformSeed = crypto.randomBytes(32),
    encryptionIV = crypto.randomBytes(16),
    protectedStreamKey = crypto.randomBytes(32),
    streamStartBytes = crypto.randomBytes(STREAM_START_BYTES_LENGTH)}) {

    this.cipher = cipher;
    this.transformRounds = transformRounds;
    this.compression = compression;
    this.masterSeed = masterSeed;
    this.transformSeed = transformSeed;
    this.encryptionIV = encryptionIV;
    this.protectedStreamKey = protectedStreamKey;
    this.streamStartBytes = streamStartBytes;

    this._salsa = new Salsa20(
      crypto.createHash('sha256').update(protectedStreamKey).digest(),
      [0xE8, 0x30, 0x09, 0x4B, 0x97, 0x20, 0x5D, 0x2A]
    );
  }

  pack(value) {
    return this._salsa.encrypt(new Buffer(value, 'utf8'), true).toString('base64');
  }

  unpack(value) {
    return this._salsa.encrypt(new Buffer(value, 'base64'), true).toString('utf8');
  }
}

DatabaseOptions.fromDatabase = function(db) {
  return new DatabaseOptions({
    compression: db._compression,
    transformRounds: db._transformRounds,
    cipher: db._cipher
  })
}

function _header(opts) {
  //keyEncryptionRounds written ans UInt64LE
  let transformRoundsBuf = new Buffer(8);
  transformRoundsBuf.writeUInt32LE(opts.transformRounds, 0);
  transformRoundsBuf.writeUInt32LE(0, 4);

  let compressionBuf = new Buffer(4);
  compressionBuf.writeUInt32LE(opts.compression);

  return Buffer.concat([
    FILE_SIGNATURE_1,
    FILE_SIGNATURE_2,
    FILE_VERSION,
    _headerField(HEADER_FIELD_ID.CipherID, new Buffer(opts.cipher, 'base64')),
    _headerField(HEADER_FIELD_ID.CompressionFlags, compressionBuf),
    _headerField(HEADER_FIELD_ID.MasterSeed, opts.masterSeed),
    _headerField(HEADER_FIELD_ID.TransformSeed, opts.transformSeed),
    _headerField(HEADER_FIELD_ID.TransformRounds, transformRoundsBuf),
    _headerField(HEADER_FIELD_ID.EncryptionIV, opts.encryptionIV),
    _headerField(HEADER_FIELD_ID.ProtectedStreamKey, opts.protectedStreamKey),
    _headerField(HEADER_FIELD_ID.StreamStartBytes, opts.streamStartBytes),
    _headerField(HEADER_FIELD_ID.InnerRandomStreamID, SALSA_20),
    _headerField(HEADER_FIELD_ID.EndOfHeader, END)
  ]);
}

function _headerField(id, data) {
  let headerFieldStart = new Buffer(1 + 2);
  headerFieldStart.writeUInt8(id, 0);
  headerFieldStart.writeUInt16LE(data.length, 1);
  return Buffer.concat([
    headerFieldStart,
    data
  ]);
}

export function toBuffer(_db, credentials) {
  let opts = DatabaseOptions.fromDatabase(_db)

  return Promise.resolve(_db)
    .then(db => {
      if(credentials) db._key = new CompositeKey(credentials);

      if(!db._key) throw new Error('Missing db credentials');
      return db;
    })
    .then(db => {
      let header = _header(opts);
      let headerHash = crypto.createHash('sha256').update(header).digest('base64');
      return [db, header, headerHash];
    })
    .then(([db, header, headerHash]) => {
      let xmlJson = Database.toXml(db, opts);
      xmlJson.KeePassFile.Meta.HeaderHash = headerHash;
      return [db, header, xmlJson];
    })
    .then(([db, header, xmlJson]) => {
      return [db, header, (new xml2js.Builder()).buildObject(xmlJson)];
    })
    .then(([db, header, xml]) => {
      console.log(xml);
      return new Promise((resolve, reject) => {
        zlib.gzip(xml, function(err, compressedXml) {
          if(err) return reject(err);
          return resolve([db, header, compressedXml]);
        });
      });
    })
    .then(([db, header, buf]) => {
      // Split database into HBIO blocks and concat it with StreamStartbytes
      buf = Buffer.concat([opts.streamStartBytes, HashedBlockIO.encrypt(buf)]);

      let masterKey = db._key.generateKey(
        opts.masterSeed,
        opts.transformSeed,
        opts.transformRounds
      );

      return Buffer.concat([header, Cipher.ALL[opts.cipher].encrypt(buf, masterKey, opts.encryptionIV)]);
    })
}


export function fromBuffer(buffer, credentials) {
  let r = new BufferReader(buffer);

  let sig1 = r.nextBuffer(FILE_SIGNATURE_1.length);
  if(!sig1.equals(FILE_SIGNATURE_1)) return Promise.reject(new Error('Not a KeePass 2 database'));

  let sig2 = r.nextBuffer(FILE_SIGNATURE_2.length);
  if(!sig2.equals(FILE_SIGNATURE_2)) return Promise.reject(new Error('Not a KeePass 2 database'));

  let version = r.nextBuffer(FILE_VERSION.length);
  if(version[0] !== FILE_VERSION[0] && version[1] !== FILE_VERSION[1])
    return Promise.reject(new Error('Version not supported'));

  return new Promise((resolve, reject) => {

    let opts = {};

    let endOfHeader = false;
    while(!endOfHeader) {
      let fieldId = r.nextUInt8();
      if(fieldId < 0 || fieldId >= HEADER_FIELD_ID.length)
        return reject(new Error(`Unknow field id ${fieldId}`));

      let fieldLength = r.nextUInt16LE();
      let data = r.nextBuffer(fieldLength);

      switch(fieldId) {
        case HEADER_FIELD_ID.EndOfHeader:
          endOfHeader = true;
          break;

        case HEADER_FIELD_ID.CipherID:
          let cipher = data.toString('base64');
          if(!Cipher.ALL[cipher])
            return reject(new Error('Not supported cipher'));
          opts.cipher = cipher;

          break;

        case HEADER_FIELD_ID.CompressionFlags:
          let id = data.readUInt32LE(0);
          if(id >= COMPRESSION.length)
            return reject(new Error('Unknow compression algorithm'));

          opts.compression = id;
          break;

        case HEADER_FIELD_ID.MasterSeed:
          if(data.length != 32) return reject(new Error('MasterSeed field must have length 32 bytes'));
          opts.masterSeed = data;

          break;

        case HEADER_FIELD_ID.TransformSeed:
          if(data.length != 32) return reject(new Error('TransformSeed field must have length 32 bytes'));
          opts.transformSeed = data;

          break;

        case HEADER_FIELD_ID.TransformRounds:
          opts.transformRounds = data.readUInt32LE(0);
          if(data.readUInt32LE(4) !== 0)
            return reject(new Error('Implementation does not support so many encryption rounds'));

          break;

        case HEADER_FIELD_ID.EncryptionIV:
          if(data.length != 16) return reject(new Error('EncryptionIV field must have length 16 bytes'));
          opts.encryptionIV = data;

          break;

        case HEADER_FIELD_ID.ProtectedStreamKey:
          if(data.length != 32) return reject(new Error('ProtectedStreamKey field must have length 32 bytes'));
          opts.protectedStreamKey = data;

          break;

        case HEADER_FIELD_ID.StreamStartBytes:
          if(data.length != STREAM_START_BYTES_LENGTH) return reject(new Error('StreamStartBytes field must have length 32 bytes'));
          opts.streamStartBytes = data;

          break;
        case HEADER_FIELD_ID.InnerRandomStreamID:
          if(!data.equals(SALSA_20)) {
            return reject(new Error('Only salsa20 supported'));
          }
      }
    }

    resolve(new DatabaseOptions(opts));
  })
    .then(opts => {

      let compositeKey = new CompositeKey(credentials);

      let masterKey = compositeKey.generateKey(
        opts.masterSeed,
        opts.transformSeed,
        opts.transformRounds
      );

      let payload = r.nextBuffer();

      payload = Cipher.ALL[opts.cipher].decrypt(payload, masterKey, opts.encryptionIV);

      // Check database consistency with HBIO
      let streamStartBytes = payload.slice(0, STREAM_START_BYTES_LENGTH);
      if(!streamStartBytes.equals(opts.streamStartBytes)) {
        throw new Error('Steam start bytes does not match');
      }

      return [compositeKey, opts, HashedBlockIO.decrypt(payload.slice(STREAM_START_BYTES_LENGTH))];

    })
    .then(([key, opts, payload]) => {
      return (opts.compression === COMPRESSION.GZIP ?
        new Promise((resolve, reject) => {
          zlib.gunzip(payload, function(err, buf) {
            if(err) return reject(err);
            return resolve([key, opts, buf]);
          });
        }) : Promise.resolve([key, opts, payload]))
    })
    .then(([key, opts, buf]) => ([key, opts, buf.toString('utf8')]))
    .then(([key, opts, xml]) => {
      return new Promise((resolve, reject) => {
        console.log(xml)
        xml2js.parseString(xml, { explicitArray: false }, function(err, database) {
          if(err) return reject(err);
          return resolve([key, opts, database]);
        });
      })
    })
    .then(([key, opts, db]) => [key, Database.fromXml(db, opts)])
    .then(([key, db]) => {
      db._key = key;
      return db;
    })
}

export function generateKey() {
  let keyJson = {
    KeyFile: {
      Meta: {
        Version: '1.00'
      },
      Key: {
        Data: crypto.randomBytes(32).toString('base64')
      }
    }
  };

  return (new xml2js.Builder()).buildObject(keyJson)
}
