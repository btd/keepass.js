export const boolXml = function(v) {
  if(typeof v === 'boolean')
    return v ? 'True' : 'False';

  return v === 'True';
}

export const makeEnum = function(arr) {
  let res = {};
  arr.forEach((a, idx) => res[a] = idx);
  Object.defineProperty(res, 'length', {
    value: arr.length,
    enumerable: false
  });
  return res;
}

export const arrNode = function(json) {
  if(Array.isArray(json)) return json;
  if(json) return [json];

  return [];
}
