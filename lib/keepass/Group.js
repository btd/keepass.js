import UUID from './UUID';
import { boolXml, arrNode } from './util';
import Icon from './Icon';
import Entry from './Entry';

import {TimeInfo, HTimeInfo} from './TimeInfo';

class Group extends HTimeInfo {
  constructor(db, parent, name = '') {
    super(parent);
    this._db = db;
    this._icon = Icon.Folder;

    this._uuid = new UUID;

    this._notes = '';
    this._name = name;

    this._expanded = true;

    this._entries = [];
    this._groups = [];
  }

  get uuid() {
    this.touch();
    return this._uuid.value;
  }

  get icon() {
    this.touch();
    return this._icon;
  }

  addEntry(entry) {
    this.touch(true);
    entry._db = this._db;
    entry._parent = this;
    this._entries.push(entry);
  }


  addGroup(group) {
    this.touch(true);
    group._db = this._db;
    group._parent = this;
    this._groups.push(group);
  }


  removeGroup(group) {
    this.removeGroupByIndex(this.groups.indexOf(group))
  }

  //TODO recycle bin
  removeGroupByIndex(idx) {
    if(idx >= 0 && idx < this._groups.length) {
      this._groups.splice(idx, 1);
      this.touch(true);
    }
  }

  removeEntry(entry) {
    this.removeEntryByIndex(this.entries.indexOf(entry))
  }

  //TODO recycle bin
  removeEntryByIndex(idx) {
    if(idx >= 0 && idx < this._entries.length) {
      this._entries.splice(idx, 1);
      this.touch(true);
    }
  }

  get name() {
    this.touch();
    return this._name;
  }

  set name(value) {
    this.touch(true);
    this._name = value;
  }

  set notes(value) {
    this.touch(true);
    this._notes = value;
  }

  get notes() {
    this.touch();
    return this._notes;
  }

  get expanded() {
    this.touch();
    return this._expanded;
  }

  toggle() {
    this.touch(true);
    this.expanded = !this.expanded;
  }

  set expanded(value) {
    this.touch(true);
    this._expanded = value;
  }

  get groups() {
    this.touch();
    return this._groups;
  }

  get entries() {
    this.touch();
    return this._entries;
  }

  icon() {
    this.touch();
    return this._icon;
  }
}

Group.toXml = function(group, opts) {
  return {
    UUID: UUID.toXml(group._uuid),
    Name: group._name,
    Notes: group._notes,

    IconID: group._icon,

    Times: TimeInfo.toXml(group._times),

    IsExpanded: boolXml(group._expanded),

    DefaultAutoTypeSequence: '',
    EnableAutoType: 'null',
    EnableSearching: 'null',

    LastTopVisibleEntry: UUID.toXml(UUID.ZERO),

    Entry: group._entries.map(e => Entry.toXml(e, opts)),
    Group: group._groups.map(g => Group.toXml(g, opts))
  }
}

Group.fromXml = function(xmlJson, db, parentGroup, opts) {
  let g = new Group(db, parentGroup);

  g._uuid = UUID.fromXml(xmlJson.UUID);

  g._icon = 1*xmlJson.IconID;

  g._times = TimeInfo.fromXml(xmlJson.Times);

  g._notes = xmlJson.Notes;
  g._name = xmlJson.Name;

  g._expanded = boolXml(xmlJson.IsExpanded);

  //console.log('Reading entries', g._name, new Buffer(xmlJson.UUID, 'base64').toString('hex'))

  g._entries = arrNode(xmlJson.Entry)
    .map(xmlJson => Entry.fromXml(xmlJson, db, this, opts));

  //console.log('Reading groups', g._name, new Buffer(xmlJson.UUID, 'base64').toString('hex'))

  g._groups = arrNode(xmlJson.Group)
    .map(xmlJson => Group.fromXml(xmlJson, db, this, opts));

  return g;
}

export default Group;
