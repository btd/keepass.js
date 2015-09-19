import { boolXml, arrNode } from './util';
import UUID from './UUID';
import Group from './Group';
import DeletedObject from './DeletedObject';

class Database {
  constructor(fileInfo) {
    let now = new Date();

    this._fileInfo = fileInfo;

    this._databaseName = '';
    this._databaseNameChanged = now;

    this._databaseDescription = '';
    this._databaseDescriptionChanged = now;

    this._defaultUserName = '';
    this._defaultUserNameChanged = now;

    //not really used
    this._maintenanceHistoryDays = 365;

    //used not by all clients, e.g. KeePass uses, but KeePassX don't
    this._color = '';

    //TODO low priority
    this._masterKeyChanged = now;

    this._recycleBinEnabled = true;
    this._recycleBinUUID = UUID.ZERO;
    this._recycleBinChanged = now;

    this._entryTemplatesGroup = UUID.ZERO;
    this._entryTemplatesGroupChanged = now;

    this._memoryProtection = {
      Title: false,
      UserName: false,
      Password: true,
      URL: false,
      Notes: false
    };

    this._historyMaxItems = 10;
    this._historyMaxSize = 6291456;

    this._binaries = null;
    this._customData = null;

    this._root = new Group(this, 'Root');

    this._deletedObjects = [];
  }

  memoryProtection(name) {
    return !!this._memoryProtection[name];
  }

  get root() {
    return this._root;
  }

  get name() {
    return this._databaseName;
  }

  set name(value) {
    this._databaseName = value;
    this._databaseNameChanged = new Date;
  }

  get description() {
    return this._databaseDescription;
  }

  set description(value) {
    this._databaseDescription = value;
    this._databaseDescriptionChanged = new Date;
  }

  get defaultUserName() {
    return this._defaultUserName;
  }

  set defaultUserName(value) {
    this._defaultUserName = value;
    this._defaultUserNameChanged = new Date;
  }

  touchMasterKey() {
    this._masterKeyChanged = new Date;
  }

  unpack(value) {
    return this._fileInfo.unpack(value);
  }

  pack(value) {
    return this._fileInfo.pack(value);
  }

  toXml() {
    return {
      KeePassFile: {
        Meta: {
          Generator: 'keepass.js',
          HeaderHash: '',

          DatabaseName: this._databaseName,
          DatabaseNameChanged: this._databaseNameChanged.toISOString(),

          DatabaseDescription: this._databaseDescription,
          DatabaseDescriptionChanged: this._databaseDescriptionChanged.toISOString(),

          DefaultUserName: this._defaultUserName,
          DefaultUserNameChanged: this._defaultUserNameChanged.toISOString(),

          MaintenanceHistoryDays: this._maintenanceHistoryDays,

          Color: this._color,

          MasterKeyChanged: this._masterKeyChanged.toISOString(),
          MasterKeyChangeRec: -1,
          MasterKeyChangeForce: -1,

          MemoryProtection: {
            ProtectTitle: boolXml(this._memoryProtection.Title),
            ProtectUserName: boolXml(this._memoryProtection.UserName),
            ProtectPassword: boolXml(this._memoryProtection.Password),
            ProtectURL: boolXml(this._memoryProtection.URL),
            ProtectNotes: boolXml(this._memoryProtection.Notes)
          },

          CustomIcons: '',

          RecycleBinEnabled: boolXml(this._recycleBinEnabled),
          RecycleBinUUID: this._recycleBinUUID.toXml(),
          RecycleBinChanged: this._recycleBinChanged.toISOString(),

          EntryTemplatesGroup: this._entryTemplatesGroup.toXml(),
          EntryTemplatesGroupChanged: this._entryTemplatesGroupChanged.toISOString(),

          LastSelectedGroup: UUID.ZERO.toXml(),
          LastTopVisibleGroup: UUID.ZERO.toXml(),

          HistoryMaxItems: this._historyMaxItems,
          HistoryMaxSize: this._historyMaxSize,

          Binaries: this._binaries,//TODO
          CustomData: this._customData
        },
        Root: {
          Group: this._root.toXml(),
          DeletedObjects: {
            DeletedObject: this._deletedObjects.map(d => d.toXml())
          }
        }
      }
    }
  }
}

Database.fromXml = function(xmlJson, fileInfo) {
  let db = new Database(fileInfo);

  let meta = xmlJson.KeePassFile.Meta;

  db._databaseName = meta.DatabaseName;
  db._databaseNameChanged = new Date(meta.DatabaseNameChanged);

  db._description = meta.DatabaseDescription;
  db._databaseDescriptionChanged = new Date(meta.DatabaseDescriptionChanged);

  db._defaultUserName = meta.DefaultUserName;
  db._defaultUserNameChanged = new Date(meta.DefaultUserNameChanged);

  db._maintenanceHistoryDays = 1 * meta.MaintenanceHistoryDays;

  db._color = meta.Color;
  db._masterKeyChanged = new Date(meta.MasterKeyChanged);

  db._memoryProtection = {
    Title: boolXml(meta.MemoryProtection.ProtectTitle),
    UserName: boolXml(meta.MemoryProtection.ProtectUserName),
    Password: boolXml(meta.MemoryProtection.ProtectPassword),
    URL: boolXml(meta.MemoryProtection.ProtectURL),
    Notes: boolXml(meta.MemoryProtection.ProtectNotes)
  };

  db._recycleBinEnabled = boolXml(meta.RecycleBinEnabled);
  db._recycleBinUUID = UUID.fromXml(meta.RecycleBinUUID);
  db._recycleBinChanged = new Date(meta.RecycleBinChanged);

  db._entryTemplatesGroup = UUID.fromXml(meta.EntryTemplatesGroup);
  db._entryTemplatesGroupChanged = new Date(meta.EntryTemplatesGroupChanged);

  db._historyMaxItems = 1 * meta.HistoryMaxItems;
  db._historyMaxSize = 1 * meta.HistoryMaxSize;

  db._binaries = meta.Binaries;
  db._customData = meta.CustomData;

  db._root = Group.fromXml(xmlJson.KeePassFile.Root.Group, db);
  db._deletedObjects = arrNode(xmlJson.KeePassFile.Root.DeletedObjects.DeletedObject)
    .map(xmlJson => DeletedObject.fromXml(xmlJson));

  return db;
}

export default Database;
