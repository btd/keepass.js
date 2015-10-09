import UUID from './UUID';
import { boolXml, arrNode } from './util';
import Attribute from './Attribute';

import Icon from './Icon';

export const DEFAULT_ATTRIBUTES = [
  'Title',
  'UserName',
  'Password',
  'URL',
  'Notes'
];

class Entry {
  constructor(db) {
    this._db = db;
    //this._parent = null;

    this._icon = Icon.Key;
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
      new Attribute(
        db,
        name,
        name === 'UserName' && this._db ? this._db.defaultUserName : '',
        this._db ? this._db.memoryProtection(name): name === 'Password'));

    //TODO binaries
    //TODO history
    //TODO autotype
    //
    this._history = [];
  }

  get uuid() {
    this.setAccessedNow()
    return this._uuid.value;
  }

  get icon() {
    this.setAccessedNow()
    return this._icon;
  }

  attribute(name) {
    this.setAccessedNow()
    return this._strings.filter((s) => s.key === name)[0];
  }

  get title() {
    return this.get('Title');
  }

  get userName() {
    return this.get('UserName');
  }

  get password() {
    return this.get('Password');
  }

  get url() {
    return this.get('URL');
  }

  get notes() {
    return this.get('Notes');
  }

  get attributes() {
    this.setAccessedNow()
    return this._strings;
  }

  set(name, value, _protected) {
    let existing = this.attribute(name);
    this.setModifiedNow();
    if(existing) {
      if(typeof _protected == 'boolean') {
        existing.protected = _protected;
      }
      if(value != null) {
        existing.value = value;
      }
    } else {
      this._strings.push(new Attribute(this._db, name, value, !!_protected));
    }
  }

  get(name) {
    let existing = this.attribute(name);
    return existing && existing.value;
  }

  setAccessedNow() {
    this._lastAccessTime = new Date();
  }

  setModifiedNow() {
    this._lastModificationTime = new Date();
  }

  icon() {
    this.setAccessedNow();
    return this._icon;
  }
}

Entry.toXml = function(entry, opts) {

  let res = {
    UUID: UUID.toXml(entry._uuid),

    IconID: entry._icon,

    ForegroundColor: '',
    BackgroundColor: '',
    OverrideURL: '',
    Tags: '',

    Times: {
      LastModificationTime: entry._lastModificationTime.toISOString(),
      CreationTime: entry._creationTime.toISOString(),
      LastAccessTime: entry._lastAccessTime.toISOString(),
      Expires: boolXml(entry._expires),
      ExpiryTime: entry._expiryTime.toISOString(),
      UsageCount: entry._usageCount,
      LocationChanged: entry._locationChanged.toISOString()
    },
    String: entry._strings.map(s => Attribute.toXml(s, opts)),
    AutoType: {
      Enabled: boolXml(true),
      DataTransferObfuscation: 0,
      DefaultSequence: ''
    }
  };

  //we should not add History if it is empty (other clients do not like this)
  if(entry._history.length) {
    res.History = {
      Entry: entry._history.map(e => Entry.toXml(e, opts))
    }
  }

  return res;
}


Entry.fromXml = function(xmlJson, db, opts) {
  let e = new Entry(db);

  e._uuid = UUID.fromXml(xmlJson.UUID);

  //console.log(new Buffer(xmlJson.UUID, 'base64').toString('hex'))
  e._icon = 1*xmlJson.IconID;

  e._creationTime = new Date(xmlJson.Times.CreationTime);
  e._lastModificationTime = new Date(xmlJson.Times.LastModificationTime);
  e._lastAccessTime = new Date(xmlJson.Times.LastAccessTime);
  e._expiryTime = new Date(xmlJson.Times.ExpiryTime);
  e._expires = boolXml(xmlJson.Times.Expires);
  e._locationChanged = new Date(xmlJson.Times.LocationChanged);

  e._usageCount = 1 * xmlJson.Times.UsageCount;

  e._strings = arrNode(xmlJson.String)
    .map(str => Attribute.fromXml(str, db, opts));

  e._history = arrNode( xmlJson.History && xmlJson.History.Entry )
    .map(str => Entry.fromXml(str, db, opts));

  return e;
}

export default Entry;
