import UUID from './UUID';
import { boolXml, arrNode } from './util';
import Icon from './Icon';
import Entry from './Entry';

class Group {
  constructor(db, name = '') {
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

  addEntry(entry) {
    this._entries.push(entry);
  }

  get name() {
    return this._name;
  }

  get expanded() {
    return this._expanded;
  }

  toggle() {
    this.expanded = !this.expanded;
  }

  set expanded(value) {
    this._expanded = value;
  }

  toXml() {
    return {
      UUID: this._uuid.toXml(),
      Name: this._name,
      Notes: this._notes,

      IconID: Icon.Folder,

      Times: {
        LastModificationTime: this._lastModificationTime.toISOString(),
        CreationTime: this._creationTime.toISOString(),
        LastAccessTime: this._lastAccessTime.toISOString(),
        ExpiryTime: this._expiryTime.toISOString(),
        Expires: boolXml(this._expires),
        UsageCount: this._usageCount,
        LocationChanged: this._locationChanged.toISOString()
      },

      IsExpanded: boolXml(this._expanded),

      DefaultAutoTypeSequence: '',
      EnableAutoType: 'null',
      EnableSearching: 'null',

      LastTopVisibleEntry: UUID.ZERO.toXml(),

      Entry: this._entries.map((entry) => entry.toXml()),
      Group: this._groups.map((group) => group.toXml())
    }
  }
}

Group.fromXml = function(xmlJson, db) {
  let g = new Group(db);

  g._uuid = UUID.fromXml(xmlJson.UUID);

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

  g._entries = arrNode(xmlJson.Entry)
    .map(xmlJson => Entry.fromXml(xmlJson, db));

  g._groups = arrNode(xmlJson.Group)
    .map(xmlJson => Group.fromXml(xmlJson, db));

  return g;
}

export default Group;
