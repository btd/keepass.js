import UUID from './UUID';
import { boolXml, arrNode } from './util';
import Attribute from './Attribute';

import errors from '../utility/errors';
import Icon from './Icon';

const DEFAULT_ATTRIBUTES = [
  'Notes',
  'Password',
  'Title',
  'UserName',
  'URL'
];

class Entry {
  constructor(db) {
    this._db = db;
    this._uuid = new UUID;

    let now = new Date;

    this._creationTime = now;
    this._lastModificationTime = now;
    this._lastAccessTime = now;
		this._expiryTime = now;
    this._expires = false;
    this._locationChanged = now;

    this._usageCount = 0;

    this._strings = DEFAULT_ATTRIBUTES.map(name =>
      new Attribute(db, name, name === 'UserName' ? this._db.defaultUserName : '', this._db.memoryProtection(name)));

    //TODO binaries
    //TODO history
    //TODO autotype
  }

  add(attr) {
    errors.instanceOf(attr, Attribute, 'attr');
    let same = this._strings.filter((s) => s.key === attr.key)[0];
    if(same) {
    } else {
      this._strings.push(attr);
    }
  }

  touch() {
    this._lastAccessTime = new Date;
  }

  use() {
    this._usageCount += 1;
  }

  toXml() {
    return {
      UUID: this._uuid.toXml(),

      IconID: Icon.Key,

      ForegroundColor: '',
      BackgroundColor: '',
      OverrideURL: '',
      Tags: '',

      Times: {
        LastModificationTime: this._lastModificationTime.toISOString(),
        CreationTime: this._creationTime.toISOString(),
        LastAccessTime: this._lastAccessTime.toISOString(),
        Expires: boolXml(this._expires),
        ExpiryTime: this._expiryTime.toISOString(),
        UsageCount: this._usageCount,
        LocationChanged: this._locationChanged.toISOString()
      },
      String: this._strings.map((str) => str.toXml()),
      AutoType: {
        Enabled: boolXml(true),
        DataTransferObfuscation: 0,
        DefaultSequence: ''
      }
    }
  }
}

Entry.fromXml = function(xmlJson, db) {
  let e = new Entry(db);

  e._uuid = UUID.fromXml(xmlJson.UUID);

  e._creationTime = new Date(xmlJson.Times.CreationTime);
  e._lastModificationTime = new Date(xmlJson.Times.LastModificationTime);
  e._lastAccessTime = new Date(xmlJson.Times.LastAccessTime);
  e._expiryTime = new Date(xmlJson.Times.ExpiryTime);
  e._expires = boolXml(xmlJson.Times.Expires);
  e._locationChanged = new Date(xmlJson.Times.LocationChanged);

  e._usageCount = 1 * xmlJson.Times.UsageCount;

  e._strings = arrNode(xmlJson.String)
    .map(str => Attribute.fromXml(str, db));

  return e;
}

export default Entry;
