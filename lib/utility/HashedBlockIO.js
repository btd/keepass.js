import crypto from 'crypto';
import { Buffer } from 'buffer';
import errors from './errors';

import BufferReader from './BufferReader';

class HashedBlockIO {}

const BLOCK_SIZE = 1024 * 1024;

HashedBlockIO.decrypt = function(database) {
  errors.buffer(database, 'database');

  let r = new BufferReader(database);
  let blocks = [];
  while(true) {
    r.nextUInt32LE();//index in theory it could be in any order?
    let blockHash = r.nextBuffer(32);
    let blockLength = r.nextUInt32LE();
    if(blockLength === 0) {
      break;
    }
    let blockData = r.nextBuffer(blockLength);

    var calculatedHash = crypto.createHash('sha256').update(blockData).digest();

    // Compare calculated with stored hash
    if(!calculatedHash.equals(blockHash)) {
      throw new Error('HBIO hash mismatch. The database seems to be corrupt.');
    } else {
      blocks.push(blockData);
    }
  }

  return Buffer.concat(blocks);
};

HashedBlockIO.encrypt = function(database) {
  errors.buffer(database, 'database');

  let databaseSize = database.length;
  let parts = [];
  let index = 0;
  for(let offset = 0; offset < databaseSize; index++, offset += BLOCK_SIZE) {
    let blockLength = Math.min(BLOCK_SIZE, databaseSize - offset);
    let blockData = database.slice(offset, offset + blockLength);
    let blockHash = crypto.createHash('sha256').update(blockData).digest();

    let blockHeader = new Buffer(4 + 32 + 4);
    blockHeader.writeUInt32LE(index, 0);
    blockHash.copy(blockHeader, 4);
    blockHeader.writeUInt32LE(blockLength, 36);

    parts.push(blockHeader);
    parts.push(blockData);
  }

  let endBlock = new Buffer(40);
  endBlock.fill(0);
  endBlock.writeUInt32LE(index, 0);

  parts.push(endBlock);
  return Buffer.concat(parts);
};

export default HashedBlockIO;
