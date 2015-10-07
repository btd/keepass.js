import { boolXml } from './util';
import {Buffer} from 'buffer';

import ProtectedBuffer from '../crypto/ProtectedBuffer';

class Attribute {
  constructor(db, key, value, _protected = false) {
    this._db = db;

    this._key = key || '';
    this._value = value || '';
    this._protected = !!_protected;

    if(this._protected) {
      this._value = new ProtectedBuffer(new Buffer(this._value))
    }
  }

  get key() {
    return this._key;
  }

  get value() {
    return this._protected ? this._value.get().toString('utf8'): this._value;
  }

  set value(v) {
    this._value = v;
    if(this._protected) {
      this._value = new ProtectedBuffer(new Buffer(this._value))
    }
  }

  set protected(value) {
    let attributeValue = this.value;//always unprotected
    this._protected = value;
    this.value = attributeValue;
  }

  get protected() {
    return this._protected;
  }

  toXml() {
    let res = {
      Key: this._key,
      Value: this._value
    };
    if(this._protected) {
      res.Value = {
        _: this._db.pack(this._value.get()),
        $: {
          Protected: boolXml(true)
        }
      }
    }
    return res;
  }
}

Attribute.fromXml = function(xmlJson, db) {
  if(xmlJson.Value.$) {
    return new Attribute(db, xmlJson.Key, xmlJson.Value._ ? db.unpack(xmlJson.Value._): '', true);
  } else {
    return new Attribute(db, xmlJson.Key, xmlJson.Value);
  }
}

export default Attribute;
