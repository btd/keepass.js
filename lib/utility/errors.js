import { Buffer } from 'buffer';

const errors = {
  typeOf: function (arg, type, name) {
    if(typeof arg !== type) {
      throw new Error('Expected `' + name +'` to be a ' + type);
    }
  },

  instanceOf: function (arg, type, name) {
    if(!(arg instanceof type)) {
      throw new Error('Expected `' + name +'` to implement ' + type.name);
    }
  },

  buffer: function(arg, name) {
    if(!Buffer.isBuffer(arg)) {
      throw new Error('Expected `' + name +'` to be buffer');
    }
  }
}

export default errors;
