import UUID from './UUID';

class DeletedObject {
  constructor(uuid) {
    this._uuid = uuid;
    this._deletionTime = new Date;
  }
}

DeletedObject.toXml = function(d) {
  return {
    UUID: UUID.toXml(d._uuid),
    DeletionTime: d._deletionTime.toISOString()
  }
}

DeletedObject.fromXml = function(xmlJson) {
  let d = new DeletedObject;
  d._uuid = UUID.fromXml(xmlJson.UUID);
  d._deletionTime = new Date(xmlJson.DeletionTime);
  return d;
}

export default DeletedObject;
