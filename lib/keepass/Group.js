import UUID from './UUID';
import { boolXml, arrNode } from './util';
import Icon from './Icon';
import Entry from './Entry';

class Group {
  constructor(db, name = '') {
    this._db = db;
    //this._parent = null;
    //
    this._icon = Icon.Folder;

    this._uuid = new UUID;

    let now = new Date();

    this._creationTime = now;
    this._lastModificationTime = now;
    this._lastAccessTime = now;
    this._locationChanged = now;
    this._expiryTime = now;
    this._expires = false;

    this._usageCount = 0;

    this._notes = '';
    this._name = name;

    this._expanded = true;

    this._entries = [];
    this._groups = [];
  }

  get uuid() {
    this.setAccessedNow();
    return this._uuid.value;
  }

  get icon() {
    this.setAccessedNow();
    return this._icon;
  }

  addEntry(entry) {
    this.setModifiedNow();
    entry._db = this._db;
    //entry._parent = this;
    this._entries.push(entry);
  }


  addGroup(group) {
    this.setModifiedNow();
    group._db = this._db;
    //group._parent = this;
    this._groups.push(group);
  }


  removeGroup(group) {
    this.removeGroupByIndex(this.groups.indexOf(group))
  }

  //TODO recycle bin
  removeGroupByIndex(idx) {
    if(idx >= 0 && idx < this._groups.length) {
      this._groups.splice(idx, 1);
      this.setModifiedNow();
    }
  }

  removeEntry(entry) {
    this.removeEntryByIndex(this.entries.indexOf(entry))
  }

  //TODO recycle bin
  removeEntryByIndex(idx) {
    if(idx >= 0 && idx < this._entries.length) {
      this._entries.splice(idx, 1);
      this.setModifiedNow();
    }
  }

  setAccessedNow() {
    this._lastAccessTime = new Date();
  }

  setModifiedNow() {
    this._lastModificationTime = new Date();
  }

  get name() {
    this.setAccessedNow();
    return this._name;
  }

  set name(value) {
    this.setModifiedNow();
    this._name = value;
  }

  set notes(value) {
    this.setModifiedNow();
    this._notes = value;
  }

  get notes() {
    this.setAccessedNow();
    return this._notes;
  }

  get expanded() {
    this.setAccessedNow();
    return this._expanded;
  }

  toggle() {
    this.expanded = !this.expanded;
  }

  set expanded(value) {
    this.setModifiedNow();
    this._expanded = value;
  }

  get groups() {
    this.setAccessedNow();
    return this._groups;
  }

  get entries() {
    this.setAccessedNow();
    return this._entries;
  }

  icon() {
    this.setAccessedNow();
    return this._icon;
  }
}

Group.toXml = function(group, opts) {
  return {
    UUID: UUID.toXml(group._uuid),
    Name: group._name,
    Notes: group._notes,

    IconID: group._icon,

    Times: {
      LastModificationTime: group._lastModificationTime.toISOString(),
      CreationTime: group._creationTime.toISOString(),
      LastAccessTime: group._lastAccessTime.toISOString(),
      ExpiryTime: group._expiryTime.toISOString(),
      Expires: boolXml(group._expires),
      UsageCount: group._usageCount,
      LocationChanged: group._locationChanged.toISOString()
    },

    IsExpanded: boolXml(group._expanded),

    DefaultAutoTypeSequence: '',
    EnableAutoType: 'null',
    EnableSearching: 'null',

    LastTopVisibleEntry: UUID.toXml(UUID.ZERO),

    Entry: group._entries.map(e => Entry.toXml(e, opts)),
    Group: group._groups.map(g => Group.toXml(g, opts))
  }
}

Group.fromXml = function(xmlJson, db, opts) {
  let g = new Group(db);

  g._uuid = UUID.fromXml(xmlJson.UUID);

  g._icon = 1*xmlJson.IconID;

  g._creationTime = new Date(xmlJson.Times.CreationTime);
  g._lastModificationTime = new Date(xmlJson.Times.LastModificationTime);
  g._lastAccessTime = new Date(xmlJson.Times.LastAccessTime);
  g._locationChanged = new Date(xmlJson.Times.LocationChanged);
  g._expiryTime = new Date(xmlJson.Times.ExpiryTime);
  g._expires = boolXml(xmlJson.Times.Expires);

  g._usageCount = 1 * xmlJson.Times.UsageCount;

  g._notes = xmlJson.Notes;
  g._name = xmlJson.Name;

  g._expanded = boolXml(xmlJson.IsExpanded);

  //console.log('Reading entries', g._name, new Buffer(xmlJson.UUID, 'base64').toString('hex'))

  g._entries = arrNode(xmlJson.Entry)
    .map(xmlJson => Entry.fromXml(xmlJson, db, opts));

  //console.log('Reading groups', g._name, new Buffer(xmlJson.UUID, 'base64').toString('hex'))

  g._groups = arrNode(xmlJson.Group)
    .map(xmlJson => Group.fromXml(xmlJson, db, opts));

  return g;
}

export default Group;
