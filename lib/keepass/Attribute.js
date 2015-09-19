import { boolXml } from './util';

class Attribute {
  constructor(db, key, value, _protected = false) {
    this._db = db;

    this._key = key || '';
    this._value = value || '';
    this._protected = !!_protected;
  }

  get key() {
    return this._key;
  }

  get value() {
    return this._protected ?
      this._db.unpack(this._value) :
      this._value;
  }

  set value(v) {
    this._value = this._protected ?
      this._db.pack(v) :
      v;
  }

  toXml() {
    let res = {
      Key: this._key,
      Value: this._value
    };
    if(this._protected) {
      res.Value = {
        _: this._value,
        $: {
          Protected: boolXml(true)
        }
      }
    }
    return res;
  }
}

Attribute.fromXml = function(xmlJson, db) {
  let a = new Attribute(db);
  a._key = xmlJson.Key;

  if(xmlJson.Value.$) {
    a._value = xmlJson.Value._ || '';
    a._protected = true;
  } else {
    a._value = xmlJson.Value;
    a._protected = false;
  }
  return a;
}

export default Attribute;
