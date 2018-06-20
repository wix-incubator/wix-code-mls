let credentials = require('./media-manager-credentials');

let mediaSdk = require('@wix/media-manager-js-sdk');

let AddedBy = mediaSdk.AddedBy;

let MediaPlatform = mediaSdk.MediaPlatform;
let mediaPlatform = new MediaPlatform({
  domain: 'files.wix.com',
  appId: credentials.id,
  sharedSecret: credentials.secret.key
});
let fileUploader = mediaPlatform.fileUploader;
let UploadRequest = mediaSdk.file.UploadRequest;

let uploadRequest = new UploadRequest()
  .setFileName('str-image.jpg') // if the source is a stream or buffer, providing the file name is mandatory
  .setContentType('image/jpeg')
  .addTags('cat', 'fish');
//  .setParentFolderId('');

fileUploader.uploadSiteImage(/*metasite id*/ 'a705d72b-82c5-4920-9ef5-1d8f6c50fd39',
  new AddedBy('user', /*user id*/ 'c569b3d3-4d9b-4196-83ca-bb69f6d5684d'),
  './data-10-6-18/Property-255819507-2.jpeg', uploadRequest, function (error, response) {
  if (error) {
    console.error('upload failed: ', error.message, error.stack);
    return;
  }
  console.log('upload successful: ', response);
});



