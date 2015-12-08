var aws = require('aws-sdk');
var Q = require('q');
var config = require('./config.js');

aws.config.update({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey });
var s3 = new aws.S3();

function getS3Object (key, serviceName, context){
    var def = Q.defer();
    s3.getObject({
        Bucket: config.serviceObjectBucket,
        Key: key
    }, function(err,data){
        if (err) {
            console.log(err, err.stack);
            def.reject(err);
            context.fail('Internal Error: Failed to list object [' + key + ']from s3.');
        } else{
            console.log("Successfully retrieved service data of [" + serviceName + "]");
            def.resolve({serviceName: serviceName, serviceData: JSON.parse(data.Body.toString())});
        }
    });
    return def.promise;
}

function getServiceData (data, context) {
    var getObjPromises = [];
    data.Contents.forEach(function(object){
        var re = new RegExp(config.serviceDataFolderNameInS3 + "\/(.+).json");
        var serviceName = object.Key.match(re);
        if(serviceName != null){
            getObjPromises.push(getS3Object(object.Key, serviceName[1], context));
        }
    });
    Q.all(getObjPromises).then(function(values){
        var serviceData = {};
        console.log("Successfully retrieved all service data");
        values.forEach(function(value){
            serviceData[value.serviceName] = value.serviceData;
        });
        console.log(serviceData);
        context.succeed(serviceData);
    });
}

function getAllServiceDataFromS3 (context){
    console.log("Trying to list all service objects in the service folder");
    s3.listObjects({
        Bucket: config.serviceObjectBucket,
        "Prefix": config.serviceDataFolderNameInS3 + "/"
    }, function(err,data){
        if (err) {
            console.log(err, err.stack);
            context.fail('Internal Error: Failed to list service objects from s3.')
        } else {
            console.log("Successfully listed objects in the folder. Will try to get service data contents..");
            getServiceData(data, context);
        }
    });
}

function getServiceDataFromS3 (context, serviceName){
    getS3Object(config.serviceDataFolderNameInS3 + "/" + serviceName + ".json", serviceName, context).then(function(data){
        console.log(data.serviceData);
        context.succeed(data.serviceData);
    });
}

exports.handler = function (event, context) {
    if(typeof event.serviceName != 'undefined'){
        getServiceDataFromS3(context, event.serviceName);
    }else{
        getAllServiceDataFromS3(context);
    }
};