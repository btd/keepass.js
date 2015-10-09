import { boolXml, arrNode } from './util';
import UUID from './UUID';
import Group from './Group';
import DeletedObject from './DeletedObject';

import { Cipher } from '../crypto/Cipher';

import { COMPRESSION } from './KdbxFile';

class Database {
  constructor({
    transformRounds = 6000,
    compression = COMPRESSION.GZIP,
    cipher = Cipher.DEFAULT }) {

    let now = new Date();

    this._transformRounds = transformRounds;
    this._compression = compression;
    this._cipher = cipher;

    this._generator = 'keepass.js'

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
}

Database.toXml = function(db, opts) {
  return {
    KeePassFile: {
      Meta: {
        Generator: db._generator,
        HeaderHash: '',

        DatabaseName: db._databaseName,
        DatabaseNameChanged: db._databaseNameChanged.toISOString(),

        DatabaseDescription: db._databaseDescription,
        DatabaseDescriptionChanged: db._databaseDescriptionChanged.toISOString(),

        DefaultUserName: db._defaultUserName,
        DefaultUserNameChanged: db._defaultUserNameChanged.toISOString(),

        MaintenanceHistoryDays: db._maintenanceHistoryDays,

        Color: db._color,

        MasterKeyChanged: db._masterKeyChanged.toISOString(),
        MasterKeyChangeRec: -1,
        MasterKeyChangeForce: -1,

        MemoryProtection: {
          ProtectTitle: boolXml(db._memoryProtection.Title),
          ProtectUserName: boolXml(db._memoryProtection.UserName),
          ProtectPassword: boolXml(db._memoryProtection.Password),
          ProtectURL: boolXml(db._memoryProtection.URL),
          ProtectNotes: boolXml(db._memoryProtection.Notes)
        },

        CustomIcons: '',//TODO

        RecycleBinEnabled: boolXml(db._recycleBinEnabled),//TODO
        RecycleBinUUID: UUID.toXml(db._recycleBinUUID),//TODO
        RecycleBinChanged: db._recycleBinChanged.toISOString(),//TODO

        EntryTemplatesGroup: UUID.toXml(db._entryTemplatesGroup),
        EntryTemplatesGroupChanged: db._entryTemplatesGroupChanged.toISOString(),

        LastSelectedGroup: UUID.toXml(UUID.ZERO),
        LastTopVisibleGroup: UUID.toXml(UUID.ZERO),

        HistoryMaxItems: db._historyMaxItems,//TODO
        HistoryMaxSize: db._historyMaxSize,//TODO

        Binaries: db._binaries,//TODO
        CustomData: db._customData//TODO
      },
      Root: {
        Group: Group.toXml(db._root, opts),
        DeletedObjects: {
          DeletedObject: db._deletedObjects.map(DeletedObject.toXml)
        }
      }
    }
  }
}

Database.fromXml = function(xmlJson, opts) {
  let db = new Database(opts);

  let meta = xmlJson.KeePassFile.Meta;

  db._generator = meta.Generator;

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

  db._root = Group.fromXml(xmlJson.KeePassFile.Root.Group, db, opts);
  db._deletedObjects = arrNode(xmlJson.KeePassFile.Root.DeletedObjects.DeletedObject)
    .map(xmlJson => DeletedObject.fromXml(xmlJson));

  return db;
}

export default Database;
