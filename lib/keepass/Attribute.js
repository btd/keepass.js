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
}

Attribute.toXml = function(a, opts) {
  let res = {
    Key: a.key
  };
  if(a._protected) {
    res.Value = {
      _: opts.pack(a.value),
      $: {
        Protected: boolXml(true)
      }
    }
  } else {
    res.Value = a.value;
  }
  return res;
}

Attribute.fromXml = function(xmlJson, db, opts) {
  if(xmlJson.Value.$) {
    return new Attribute(db, xmlJson.Key, xmlJson.Value._ ? opts.unpack(xmlJson.Value._): '', true);
  } else {
    return new Attribute(db, xmlJson.Key, xmlJson.Value);
  }
}

export default Attribute;
