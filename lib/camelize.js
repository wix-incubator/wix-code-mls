function logFunc() {
  console.log(...arguments);
}

function nohop() {}

function camelize(str, explain) {
  let log = explain?logFunc:nohop;
  log('###', str);
  // let res = str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
  let res = str.replace(/(?:^\w|[A-Z]|\W+\w|\s+|\W+$)/g, function(match, index) {
    // console.log(match, index);
    if (+match === 0) { // or if (/\s+/.test(match)) for white spaces
      log('br1', `[${match}]`);
      return "";
    }
    if (index === 0) {
      log('br2', `[${match}]`);
      return match[match.length-1].toLowerCase();
    }
    if (!/[a-zA-Z0-9]/.test(match[match.length-1])) {
      log('br3', `[${match}]`);
      return '';
    }
    log('br4', `[${match}]`);
    return match[match.length-1].toUpperCase();
  });
  log('=> ', res);
  return res;
}

module.exports = camelize;



// super dumb testing
// camelize("Address Direction", true);
// camelize("List Firm 2 Code", true);
// camelize("Sub-Area/Community", true);
// camelize("--some /aergaer", true);
// camelize("--some   =-/aergaer", true);
// camelize("ML #", true);
// camelize("No. Floor Levels", true);
// camelize("Floor Area -Grand Total", true);
// camelize("Floor Area Fin - Main Flr", true);
// camelize("Lot Sz (Sq.Ft.)", true);
// camelize("Update Date/Time", true);
