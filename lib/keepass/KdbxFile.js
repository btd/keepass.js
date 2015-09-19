import { makeEnum } from './util';
import { Buffer } from 'buffer';

export const FILE_SIGNATURE_1 = new Buffer([ 0x03, 0xD9, 0xA2, 0x9A ]);
export const FILE_SIGNATURE_2 = new Buffer([ 0x67, 0xFB, 0x4B, 0xB5 ]);
export const FILE_VERSION = new Buffer([ 0x01, 0x00, 0x03, 0x00 ]);

export const HEADER_FIELD_ID = makeEnum([
  'EndOfHeader',
  'Comment',
  'CipherID',
  'CompressionFlags',
  'MasterSeed',
  'TransformSeed',
  'TransformRounds',
  'EncryptionIV',
  'ProtectedStreamKey',
  'StreamStartBytes',
  'InnerRandomStreamID'
]);
