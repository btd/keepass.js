import crypto from 'crypto';
import zlib from 'zlib';
import { Buffer } from 'buffer';

import { makeEnum } from './util';

import { Promise } from 'es6-promise';
import xml2js from 'xml2js';

import Salsa20 from '../utility/Salsa20';
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

const AES_UUID = new Buffer([
  0x31, 0xC1, 0xF2, 0xE6, 0xBF, 0x71, 0x43, 0x50,
  0xBE, 0x58, 0x05, 0x21, 0x6A, 0xFC, 0x5A, 0xFF
]);

const COMPRESSION = makeEnum(['NO', 'GZIP']);

const SALSA_20 = new Buffer([ 0x02, 0x00, 0x00, 0x00]);

const END = new Buffer('\r\n\r\n');

const SALSA_IV = [0xE8, 0x30, 0x09, 0x4B, 0x97, 0x20, 0x5D, 0x2A];

function uint32ToBuffer(n) {
  let b = new Buffer(4);
  b.writeUInt32LE(n);
  return b;
}

const STREAM_START_BYTES_LENGTH = 32;

function buildMasterKey(compositeHash, masterSeed, transformSeed, transformRounds) {
  while(transformRounds--) {
    var cipher = crypto.createCipheriv('aes-256-ecb', transformSeed, '');
    cipher.setAutoPadding(false);
    compositeHash = Buffer.concat([cipher.update(compositeHash), cipher.final()]);
  }

  var transformedHash = crypto.createHash('sha256').update(compositeHash).digest();

  return crypto.createHash('sha256').update(Buffer.concat([masterSeed, transformedHash])).digest();
}

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
  constructor({transformRounds, compression, masterSeed, transformSeed, encryptionIV, protectedStreamKey, streamStartBytes}) {
    this.transformRounds = transformRounds;
    this.compression = compression;
    this.masterSeed = masterSeed;
    this.transformSeed = transformSeed;
    this.encryptionIV = encryptionIV;
    this.protectedStreamKey = protectedStreamKey;
    this.streamStartBytes = streamStartBytes;

    this._salsa = new Salsa20(
      crypto.createHash('sha256').update(protectedStreamKey).digest(),
      SALSA_IV
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
  constructor(credentials) {
    this._compositeKey = new CompositeKey(credentials);
  }

  _header(fileInfo) {
    //keyEncryptionRounds written ans UInt64LE
    let b = new Buffer(8);
    b.writeUInt32LE(fileInfo.transformRounds, 0);
    b.writeUInt32LE(0, 4);

    return Buffer.concat([
      FILE_SIGNATURE_1,
      FILE_SIGNATURE_2,
      FILE_VERSION,
      this._headerField(HEADER_FIELD_ID.CipherID, AES_UUID),
      this._headerField(HEADER_FIELD_ID.CompressionFlags, uint32ToBuffer(COMPRESSION.GZIP)),
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

        let hash = this._compositeKey.hash();
        let masterKey = buildMasterKey(
          hash,
          db._fileInfo.masterSeed,
          db._fileInfo.transformSeed,
          db._fileInfo.transformRounds
        );

        // Encrypt database with AES-256-CBC
        let cipher = crypto.createCipheriv('aes-256-cbc', masterKey, db._fileInfo.encryptionIV);
        return Buffer.concat([
          header,
          cipher.update(buf),
          cipher.final()
        ]);
      })
  }
}


export class Reader {
  constructor(credentials) {
    this._compositeKey = new CompositeKey(credentials);
  }

  buffer(buffer) {
    let r = new BufferReader(buffer);

    let sig1 = r.nextBuffer(FILE_SIGNATURE_1.length);
    if(!sig1.equals(FILE_SIGNATURE_1)) throw new Error('Not a KeePass 2 database');

    let sig2 = r.nextBuffer(FILE_SIGNATURE_2.length);
    if(!sig2.equals(FILE_SIGNATURE_2)) throw new Error('Not a KeePass 2 database');

    let version = r.nextBuffer(FILE_VERSION.length);
    if(version[0] !== FILE_VERSION[0] && version[1] !== FILE_VERSION[1])
      throw new Error('Version not supported');

    let fileInfo = {};

    let endOfHeader = false;
    while(!endOfHeader) {
      let fieldId = r.nextUInt8();
      if(fieldId < 0 || fieldId >= HEADER_FIELD_ID.length)
        throw new Error(`Unknow field id ${fieldId}`);

      let fieldLength = r.nextUInt16LE();
      let data = r.nextBuffer(fieldLength);

      switch(fieldId) {
        case HEADER_FIELD_ID.EndOfHeader:
          endOfHeader = true;
          break;

        case HEADER_FIELD_ID.CipherID:
          if(!AES_UUID.equals(data))
            throw new Error('Not supported cipher');

          break;

        case HEADER_FIELD_ID.CompressionFlags:
          let id = data.readUInt32LE(0);
          if(id >= COMPRESSION.length)
            throw new Error('Unknow compression algorithm');

          fileInfo.compression = id;
          break;

        case HEADER_FIELD_ID.MasterSeed:
          if(data.length != 32) throw new Error('MasterSeed field must have length 32 bytes');
          fileInfo.masterSeed = data;

          break;

        case HEADER_FIELD_ID.TransformSeed:
          if(data.length != 32) throw new Error('TransformSeed field must have length 32 bytes');
          fileInfo.transformSeed = data;

          break;

        case HEADER_FIELD_ID.TransformRounds:
          fileInfo.transformRounds = data.readUInt32LE(0);
          if(data.readUInt32LE(4) !== 0)
            throw new Error('Implementation does not support so many encryption rounds');

          break;

        case HEADER_FIELD_ID.EncryptionIV:
          if(data.length != 16) throw new Error('EncryptionIV field must have length 16 bytes');
          fileInfo.encryptionIV = data;

          break;

        case HEADER_FIELD_ID.ProtectedStreamKey:
          if(data.length != 32) throw new Error('ProtectedStreamKey field must have length 32 bytes');
          fileInfo.protectedStreamKey = data;

          break;

        case HEADER_FIELD_ID.StreamStartBytes:
          if(data.length != STREAM_START_BYTES_LENGTH) throw new Error('StreamStartBytes field must have length 32 bytes');
          fileInfo.streamStartBytes = data;

          break;
        case HEADER_FIELD_ID.InnerRandomStreamID:
          if(!data.equals(SALSA_20)) {
            throw new Error('Only salsa20 supported');
          }
      }
    }

    fileInfo = new FileInfo(fileInfo);

    let masterKey = buildMasterKey(
      this._compositeKey.hash(),
      fileInfo.masterSeed,
      fileInfo.transformSeed,
      fileInfo.transformRounds
    );

    let payload = r.nextBuffer();

    let cipher = crypto.createDecipheriv('aes-256-cbc', masterKey, fileInfo.encryptionIV);
    // Decrypt database with AES-256-CBC
    cipher.setAutoPadding(true);
    payload = Buffer.concat([cipher.update(payload), cipher.final()]);

    // Check database consistency with HBIO
    let streamStartBytes = payload.slice(0, STREAM_START_BYTES_LENGTH);
    if(!streamStartBytes.equals(fileInfo.streamStartBytes)) {
      throw new Error('Steam start bytes does not match');
    }
    payload = HashedBlockIO.decrypt(payload.slice(STREAM_START_BYTES_LENGTH));

    return (fileInfo.compression === COMPRESSION.GZIP ?
      new Promise((resolve, reject) => {
        zlib.gunzip(payload, function(err, buf) {
          if(err) return reject(err);
          return resolve(buf);
        });
      }) : Promise.resolve(payload))
      .then(buf => buf.toString('utf8'))
      .then(xml => {
        return new Promise((resolve, reject) => {
          xml2js.parseString(xml, { explicitArray: false }, function(err, database) {
            if(err) return reject(err);
            return resolve(database);
          });
        })
      })
      .then(db => Database.fromXml(db, fileInfo))
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
