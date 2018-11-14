import camelize from './camelize';
import crypto from 'crypto';

function isValidDate(d) {
  return d instanceof Date && !isNaN(d);
}

function toDate(value) {
  try {
    let date = new Date(value);
    if (!isValidDate(date))
      return value;
    else
      return date;
  }
  catch(e) {
    return value;
  }
}

function toNumber(value) {
  try {
    let number = Number(value);
    if (isNaN(number))
      return value;
    else
      return number;
  }
  catch(e) {
    return value;
  }
}

export default function fixDates(item, fields, keyField) {
  let newItem = {};
  let hash = crypto.createHash('md5');
  newItem._id = ''+item[keyField];
  fields.forEach(field => {
    let systemName = field.SystemName;
    let newName = camelize(field.LongName);
    let value = item[systemName];
    if (value)
      hash.update(value);
    if (field.DataType === "Date" || field.DataType === "DateTime") {
      // '2017-06-27'
      // '2018-05-09T18:11:00'
      newItem[newName] = toDate(value);
    }
    else if (field.DataType === 'Decimal' || field.DataType === 'Small' || field.DataType === 'Int') {
      newItem[newName] = toNumber(value);
    }
    else {
      newItem[newName] = item[systemName];
    }
  });
  newItem._hash = hash.digest('hex');
  return newItem;
};