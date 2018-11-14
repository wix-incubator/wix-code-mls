import rets from 'rets-client';
import logger from './logger';

module.exports = function retsClient(retsUrl, retsUser, retsPass, func) {

  const clientSettings = {
    loginUrl: retsUrl,
    username: retsUser,
    password: retsPass,
    version: 'RETS/1.7.2',
    userAgent: 'RETS node-client/4.x',
    method: 'GET'  // this is the default, or for some servers you may want 'POST'
  };
  rets.getAutoLogoutClient(clientSettings, func)
    .catch(function (errorInfo) {
      const error = errorInfo ? (errorInfo.error || errorInfo) : 'unknown';
      logger.error("   ERROR: issue encountered:", error);
      logger.error('   ' + (error.stack || error).replace(/\n/g, '\n   '));
  });
};
