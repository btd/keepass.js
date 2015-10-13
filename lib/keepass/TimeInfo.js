import {boolXml} from './util'

export class TimeInfo {
  constructor() {
    let now = new Date;

    this._creationTime = now;
    this._lastModificationTime = now;
    this._lastAccessTime = now;
		this._expiryTime = now;
    this._expires = false;
    this._locationChanged = now;

    this._usageCount = 0;
  }

  touch(modify = false) {
    let now = new Date;

    this._lastAccessTime = now;
    this._usageCount++;

    if(modify) {
      this._lastModificationTime = now;
    }
  }

  expired(value) {
    if(typeof value === 'boolean') {
      this._expires = value;
    } else if (value instanceof Date) {
      this._expires = true;
      this._expiryTime = value;
    } else {
      return this._expires && this._expiryTime < (new Date)
    }
  }
}

TimeInfo.toXml = function(ti) {
  return {
    LastModificationTime: ti._lastModificationTime.toISOString(),
    CreationTime: ti._creationTime.toISOString(),
    LastAccessTime: ti._lastAccessTime.toISOString(),
    Expires: boolXml(ti._expires),
    ExpiryTime: ti._expiryTime.toISOString(),
    UsageCount: ti._usageCount,
    LocationChanged: ti._locationChanged.toISOString()
  }
}

TimeInfo.fromXml = function(xmlJson) {
  let ti = new TimeInfo();
  ti._creationTime = new Date(xmlJson.CreationTime);
  ti._lastModificationTime = new Date(xmlJson.LastModificationTime);
  ti._lastAccessTime = new Date(xmlJson.LastAccessTime);
  ti._expiryTime = new Date(xmlJson.ExpiryTime);
  ti._expires = boolXml(xmlJson.Expires);
  ti._locationChanged = new Date(xmlJson.LocationChanged);

  ti._usageCount = 1 * xmlJson.UsageCount;

  return ti;
}

export class HTimeInfo {
  constructor(parent = null) {
    this._parent = parent;

    this._times = new TimeInfo();
  }

  touch(modify = false, touchParent = true) {
    this._times.touch(modify);

    if(touchParent && this._parent && this._parent.touch) {
      this._parent.touch(modify, touchParent);
    }
  }

  expired(value) {
    return this._times.expired(value);
  }
}
