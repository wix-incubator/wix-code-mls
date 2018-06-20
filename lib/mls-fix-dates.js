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

module.exports = function fixDates(item, fields) {
  fields.forEach(field => {
    if (field.DataType === "Date" || field.DataType === "DateTime") {
      let value = item[field.SystemName];
      // '2017-06-27'
      // '2018-05-09T18:11:00'
      item[field.SystemName] = toDate(value);
    }
    else if (field.DataType === 'Decimal' || field.DataType === 'Small' || field.DataType === 'Int') {
      let value = item[field.SystemName];
      item[field.SystemName] = toNumber(value);
    }
  })
};