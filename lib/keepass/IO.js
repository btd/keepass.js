import crypto from 'crypto';
import zlib from 'zlib';
import { Buffer } from 'buffer';

import { makeEnum } from './util';

import { Promise } from 'es6-promise';
import xml2js from 'xml2js';

import Salsa20 from '../crypto/Salsa20';
import { Cipher } from '../crypto/Cipher';
import HashedBlockIO from '../utility/HashedBlockIO';
import CompositeKey from '../key/Composite';
import BufferReader from '../utility/BufferReader';

import Database from './Database';

import { FILE_SIGNATURE_1, FILE_SIGNATURE_2, FILE_VERSION, HEADER_FIELD_ID } from './KdbxFile';

const randomBytes = function(length) {
  return new Promise(function(resolve, reject) {
    crypto.randomBytes(length, function(err, res) {
      if(err) return reject(err);
      resolve(res);
    })
  });
}

const COMPRESSION = makeEnum(['NO', 'GZIP']);

const SALSA_20 = new Buffer([ 0x02, 0x00, 0x00, 0x00]);

const END = new Buffer('\r\n\r\n');

function uint32ToBuffer(n) {
  let b = new Buffer(4);
  b.writeUInt32LE(n);
  return b;
}

const STREAM_START_BYTES_LENGTH = 32;


function defaultFileInfo() {
  return Promise.all([
    randomBytes(32),
    randomBytes(32),
    randomBytes(16),
    randomBytes(32),
    randomBytes(STREAM_START_BYTES_LENGTH)
  ])
    .then(([masterSeed, transformSeed, encryptionIV, protectedStreamKey, streamStartBytes]) => {
      return new FileInfo({
        cipher: Cipher.DEFAULT,
        transformRounds: 6000,
        compression: COMPRESSION.GZIP,
        masterSeed,
        transformSeed,
        encryptionIV,
        protectedStreamKey,
        streamStartBytes
      });
    })
}

export class FileInfo {
  constructor({cipher, transformRounds, compression, masterSeed, transformSeed, encryptionIV, protectedStreamKey, streamStartBytes}) {
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
    return this._salsa.encrypt(new Buffer(value, 'utf8')).toString('base64');
  }

  unpack(value) {
    return this._salsa.decrypt(new Buffer(value, 'base64')).toString('utf8');
  }
}

export class Writer {
  _header(fileInfo) {
    //keyEncryptionRounds written ans UInt64LE
    let b = new Buffer(8);
    b.writeUInt32LE(fileInfo.transformRounds, 0);
    b.writeUInt32LE(0, 4);

    return Buffer.concat([
      FILE_SIGNATURE_1,
      FILE_SIGNATURE_2,
      FILE_VERSION,
      this._headerField(HEADER_FIELD_ID.CipherID, new Buffer(fileInfo.cipher, 'base64')),
      this._headerField(HEADER_FIELD_ID.CompressionFlags, uint32ToBuffer(fileInfo.compression)),
      this._headerField(HEADER_FIELD_ID.MasterSeed, fileInfo.masterSeed),
      this._headerField(HEADER_FIELD_ID.TransformSeed, fileInfo.transformSeed),
      this._headerField(HEADER_FIELD_ID.TransformRounds, b),
      this._headerField(HEADER_FIELD_ID.EncryptionIV, fileInfo.encryptionIV),
      this._headerField(HEADER_FIELD_ID.ProtectedStreamKey, fileInfo.protectedStreamKey),
      this._headerField(HEADER_FIELD_ID.StreamStartBytes, fileInfo.streamStartBytes),
      this._headerField(HEADER_FIELD_ID.InnerRandomStreamID, SALSA_20),
      this._headerField(HEADER_FIELD_ID.EndOfHeader, END)
    ]);
  }

  _headerField(id, data) {
    let headerFieldStart = new Buffer(1 + 2);
    headerFieldStart.writeUInt8(id, 0);
    headerFieldStart.writeUInt16LE(data.length, 1);
    return Buffer.concat([
      headerFieldStart,
      data
    ]);
  }

  buffer(_db) {
    return (_db._fileInfo ?
        Promise.resolve(_db) :
        defaultFileInfo().then(fileInfo => {
          _db._fileInfo = fileInfo;
          return _db;
        }))
      .then(db => {
        if(!db._key) throw new Error('Missing db credentials');
        return db;
      })
      .then(db => {
        let header = this._header(db._fileInfo);
        let headerHash = crypto.createHash('sha256').update(header).digest('base64');
        return [db, header, headerHash];
      })
      .then(([db, header, headerHash]) => {
        let xmlJson = db.toXml();
        xmlJson.KeePassFile.Meta.HeaderHash = headerHash;
        return [db, header, xmlJson];
      })
      .then(([db, header, xmlJson]) => {
        return [db, header, (new xml2js.Builder()).buildObject(xmlJson)];
      })
      .then(([db, header, xml]) => {
        //console.log(xml);
        return new Promise((resolve, reject) => {
          zlib.gzip(xml, function(err, compressedXml) {
            if(err) return reject(err);
            return resolve([db, header, compressedXml]);
          });
        });
      })
      .then(([db, header, buf]) => {
        // Split database into HBIO blocks and concat it with StreamStartbytes
        buf = Buffer.concat([db._fileInfo.streamStartBytes, HashedBlockIO.encrypt(buf)]);

        let masterKey = db._key.generateKey(
          db._fileInfo.masterSeed,
          db._fileInfo.transformSeed,
          db._fileInfo.transformRounds
        );

        return Buffer.concat([header, Cipher.ALL[db._fileInfo.cipher].encrypt(buf, masterKey, db._fileInfo.encryptionIV)]);
      })
  }
}


export class Reader {
  buffer(buffer, credentials) {
    let r = new BufferReader(buffer);

    let sig1 = r.nextBuffer(FILE_SIGNATURE_1.length);
    if(!sig1.equals(FILE_SIGNATURE_1)) return Promise.reject(new Error('Not a KeePass 2 database'));

    let sig2 = r.nextBuffer(FILE_SIGNATURE_2.length);
    if(!sig2.equals(FILE_SIGNATURE_2)) return Promise.reject(new Error('Not a KeePass 2 database'));

    let version = r.nextBuffer(FILE_VERSION.length);
    if(version[0] !== FILE_VERSION[0] && version[1] !== FILE_VERSION[1])
      return Promise.reject(new Error('Version not supported'));

    return new Promise((resolve, reject) => {

      let fileInfo = {};

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
            fileInfo.cipher = cipher;

            break;

          case HEADER_FIELD_ID.CompressionFlags:
            let id = data.readUInt32LE(0);
            if(id >= COMPRESSION.length)
              return reject(new Error('Unknow compression algorithm'));

            fileInfo.compression = id;
            break;

          case HEADER_FIELD_ID.MasterSeed:
            if(data.length != 32) return reject(new Error('MasterSeed field must have length 32 bytes'));
            fileInfo.masterSeed = data;

            break;

          case HEADER_FIELD_ID.TransformSeed:
            if(data.length != 32) return reject(new Error('TransformSeed field must have length 32 bytes'));
            fileInfo.transformSeed = data;

            break;

          case HEADER_FIELD_ID.TransformRounds:
            fileInfo.transformRounds = data.readUInt32LE(0);
            if(data.readUInt32LE(4) !== 0)
              return reject(new Error('Implementation does not support so many encryption rounds'));

            break;

          case HEADER_FIELD_ID.EncryptionIV:
            if(data.length != 16) return reject(new Error('EncryptionIV field must have length 16 bytes'));
            fileInfo.encryptionIV = data;

            break;

          case HEADER_FIELD_ID.ProtectedStreamKey:
            if(data.length != 32) return reject(new Error('ProtectedStreamKey field must have length 32 bytes'));
            fileInfo.protectedStreamKey = data;

            break;

          case HEADER_FIELD_ID.StreamStartBytes:
            if(data.length != STREAM_START_BYTES_LENGTH) return reject(new Error('StreamStartBytes field must have length 32 bytes'));
            fileInfo.streamStartBytes = data;

            break;
          case HEADER_FIELD_ID.InnerRandomStreamID:
            if(!data.equals(SALSA_20)) {
              return reject(new Error('Only salsa20 supported'));
            }
        }
      }

      resolve(new FileInfo(fileInfo));
    })
      .then(fileInfo => {

        let compositeKey = new CompositeKey(credentials);

        let masterKey = compositeKey.generateKey(
          fileInfo.masterSeed,
          fileInfo.transformSeed,
          fileInfo.transformRounds
        );

        let payload = r.nextBuffer();

        payload = Cipher.ALL[fileInfo.cipher].decrypt(payload, masterKey, fileInfo.encryptionIV);

        // Check database consistency with HBIO
        let streamStartBytes = payload.slice(0, STREAM_START_BYTES_LENGTH);
        if(!streamStartBytes.equals(fileInfo.streamStartBytes)) {
          throw new Error('Steam start bytes does not match');
        }

        return [compositeKey, fileInfo, HashedBlockIO.decrypt(payload.slice(STREAM_START_BYTES_LENGTH))];

      })
      .then(([key, fileInfo, payload]) => {
        return (fileInfo.compression === COMPRESSION.GZIP ?
          new Promise((resolve, reject) => {
            zlib.gunzip(payload, function(err, buf) {
              if(err) return reject(err);
              return resolve([key, fileInfo, buf]);
            });
          }) : Promise.resolve([key, fileInfo, payload]))
      })
      .then(([key, fileInfo, buf]) => ([key, fileInfo, buf.toString('utf8')]))
      .then(([key, fileInfo, xml]) => {
        console.log(xml);
        return new Promise((resolve, reject) => {
          xml2js.parseString(xml, { explicitArray: false }, function(err, database) {
            if(err) return reject(err);
            return resolve([key, fileInfo, database]);
          });
        })
      })
      .then(([key, fileInfo, db]) => [key, Database.fromXml(db, fileInfo)])
      .then(([key, db]) => {
        db._key = key;
        return db;
      })
  }
}

export function generateKey() {
  return randomBytes(32)
    .then((bytes) => {
      return {
        KeyFile: {
          Meta: {
            Version: '1.00'
          },
          Key: {
            Data: bytes.toString('base64')
          }
        }
      }
    })
    .then(xmlJson => (new xml2js.Builder()).buildObject(xmlJson))
}
