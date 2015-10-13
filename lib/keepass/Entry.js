import UUID from './UUID';
import { boolXml, arrNode } from './util';
import Attribute from './Attribute';

import Icon from './Icon';
import {TimeInfo, HTimeInfo} from './TimeInfo';

const DEFAULT_ATTRIBUTES = [
  'Title',
  'UserName',
  'Password',
  'URL',
  'Notes'
];



class Entry extends HTimeInfo {
  constructor(db, parent) {
    super(parent);

    this._db = db;

    this._icon = Icon.Key;
    this._uuid = new UUID;

    this._strings = DEFAULT_ATTRIBUTES.map(name =>
      new Attribute(
        db,
        name,
        name === 'UserName' && this._db ? this._db.defaultUserName : '',
        this._db ? this._db.memoryProtection(name): name === 'Password'));

    //TODO binaries
    //TODO history
    //TODO autotype
    //TODO custom icon

    this._history = [];
  }

  get uuid() {
    this.touch()
    return this._uuid.value;
  }

  get icon() {
    this.touch()
    return this._icon;
  }

  attribute(name) {
    this.touch()
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
    this.touch()
    return this._strings;
  }

  set(name, value, _protected) {
    let existing = this.attribute(name);
    this.touch(true);
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

  icon() {
    this.touch();
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

    Times: TimeInfo.toXml(entry._times),

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


Entry.fromXml = function(xmlJson, db, parentGroup, opts) {
  let e = new Entry(db, parentGroup);

  e._uuid = UUID.fromXml(xmlJson.UUID);

  //console.log(new Buffer(xmlJson.UUID, 'base64').toString('hex'))
  e._icon = 1*xmlJson.IconID;

  e._times = TimeInfo.fromXml(xmlJson.Times);

  e._strings = arrNode(xmlJson.String)
    .map(str => Attribute.fromXml(str, db, opts));

  e._history = arrNode( xmlJson.History && xmlJson.History.Entry )
    .map(str => Entry.fromXml(str, db, parentGroup, opts));

  return e;
}

Entry.DEFAULT_ATTRIBUTES = DEFAULT_ATTRIBUTES;

export default Entry;
