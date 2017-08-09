var https = require('https');
var Q = require('q');
var aws = require('aws-sdk');

var config = require('./config.js');

//OpsGenie API Variables start
var ogHost = 'api.opsgenie.com';
var ogPort = 443;

var reqTimeout = 30000;

var listAlertsEndpoint = "/v2/alerts";
//OpsGenie API Variables end

aws.config.update({ accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey });
var s3 = new aws.S3();

var severityMap = {
    green: 0,
    major: 1,
    critical: 2
};

var options = {
    host: ogHost,
    port: ogPort,
    agent: false,
    method: 'GET',
    headers: {
        'X-Js-Client': 'true',
        'Content-Type': 'application/json',
        'Authorization': 'GenieKey ' + config.opsgenieApiKey

    }
};

function doGetRequest(context, path){
    var def = Q.defer();
    options['path'] = path;
    var req = https.request(options, function (res) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            if (res.statusCode > 199 && res.statusCode < 300) {
                def.resolve(JSON.parse(body));
            } else {
                var errMsg = 'Execution failed. Req Path:' + path + " Response Body: " + JSON.stringify(body);
                console.log(errMsg);
                context.fail(new Error(errMsg));
            }
        });
    });
    req.end();
    req.on('error', function (err) {
        def.reject(err);
        console.log("req err: " + err.message);
        context.fail(new Error('Request error: ' + err.message));
    });
    req.setTimeout(reqTimeout, function () {
        context.fail(new Error('request timeout after ' + reqTimeout + ' milliseconds.'));
    });

    return def.promise;
}

function listAlerts (context, serviceName){
    var path = listAlertsEndpoint + "?query=status%3Aopen&limit=100&query=tags%3A" + encodeURIComponent(config.statusPageTag ) + ","+ encodeURIComponent(config.serviceNameTagPrefix +serviceName);
    console.log("List Alerts URL: " + path);
    return doGetRequest(context, path);
}

function updateServiceObject(context,serviceName, serviceObj){
    console.log("Updating service [" + serviceName + "] object..");
    s3.upload({
        Bucket: config.serviceObjectBucket,
        Key: config.serviceDataFolderNameInS3 + "/" + serviceName + ".json",
        Body: JSON.stringify(serviceObj),
        ACL:'public-read'
    }, function(err, data) {
        if (err) {
            console.log("Error uploading data: ", err);
            context.fail('Failed to upload service object to s3: ' + err.stack);
        } else {
            var message = "Successfully uploaded data to s3";
            console.log(message);
            context.succeed(message);
        }
    });
}

function getServiceObjectFromS3 (context, serviceName){
    var def = Q.defer();
    var serviceObj;
    s3.getObject({
        Bucket: config.serviceObjectBucket,
        Key: config.serviceDataFolderNameInS3 + "/" + serviceName + ".json"
    }, function (err, data) {
        if (err) {
            if(err.code == 'NoSuchKey'){
                console.log("Service [" + serviceName + "] has no state object in s3. New state object will be uploaded");
                serviceObj = {state: "green", message: ""};
                def.resolve(serviceObj);
            }else{
                // Error
                def.reject(err);
                console.log(err, err.stack);
                context.fail('Internal Error: Failed to load service object from s3.')
            }
        } else {
            serviceObj = JSON.parse(data.Body.toString());
            console.log("Current State of Service ["+ serviceName +"]: " + serviceObj.state);
            def.resolve(serviceObj);
        }
    });
    return def.promise;
}

function populateServiceName(tags){
    var serviceName = null;
    for(var i=0; i< tags.length; i++){
        var tag = tags[i];
        if(tag.indexOf(config.serviceNameTagPrefix) > -1){
            serviceName = tag.substr(tag.indexOf(config.serviceNameTagPrefix) + config.serviceNameTagPrefix.length).trim();
            break;
        }
    }
    return serviceName;
}

function getAlertsSeverity(tags){
    var alertSeverity = null;
    for(var i=0; i< tags.length; i++){
        var tag = tags[i];
        if(severityMap[tag.toLowerCase()] != null){
            console.log("Alert's severity: " + tag);
            alertSeverity = tag;
            break;
        }
    }
    return alertSeverity;
}

function updateServiceStateIfNecessary(context, severity, alertMessage, serviceName){
    getServiceObjectFromS3(context, serviceName).then(function(serviceObj){
        if(severityMap[severity] > severityMap[serviceObj.state]){
            console.log("Will update service state");
            serviceObj.state = severity;
        }
        serviceObj.message = alertMessage;
        updateServiceObject(context, serviceName ,serviceObj);
    });
}

function calculateAndUpdateServiceState(context, serviceName){
    var state = "green";
    var message;
    listAlerts(context, serviceName).then(function(response){
        console.log(response.alerts.length + " alerts retrieved.");
        alertLoop:for(var i = 0; i < response.alerts.length; i++){
            var alert = response.alerts[i];
            if(i == 0){
                message = alert.message;
            }
            for(var j=0; j < alert.tags.length; j++){
                var tag = alert.tags[j];
                if(typeof severityMap[tag] != 'undefined'){
                    if(severityMap[tag] == 2){
                        console.log("Alert with tinyId: " + + alert.tinyId+ " have the highest severity. Skipping remaining alerts..");
                        state = tag;
                        break alertLoop;
                    }else if(severityMap[tag] > severityMap[state]){
                        state = tag;
                    }
                }
            }
        }
        console.log("Final state: " + state);
        var serviceObj = {state: state};
        if(state == "green"){
            serviceObj.message = "";
        }else{
            serviceObj.message = message;
        }
        updateServiceObject(context, serviceName, serviceObj);
    });
}

exports.handler = function (event, context) {
    console.log('Received event: ', event);
    if(event.type == 'refresh'){
        if(event.serviceName != null){
            calculateAndUpdateServiceState(context,event.serviceName);
        }else{
            console.log("Alert does not contain a valid servicename tag.. Terminating..");
            context.done(new Error("Alert does not contain a valid servicename tag.. Terminating."));
        }
    }else if(typeof event.alert !== 'undefined' && typeof event.action !== 'undefined'){
        var serviceName = populateServiceName(event.alert.tags);
        console.log("Action: " + event.action + " Service name: " + serviceName);
        if(event.action != "RemoveTags" && serviceName == null){
            console.log("Alert does not contain a valid servicename tag.. Terminating..");
            context.done(new Error("Alert does not contain a valid servicename tag.. Terminating."));
        }
        if(event.action == 'Create' || event.action == 'AddTags'){
            var severity = getAlertsSeverity(event.alert.tags);
            if(severity == null){
                console.log("Alert does not contain a valid severity tag.. Terminating..");
                context.done(new Error("Alert does not contain a valid severity tag.. Terminating."));
            }else{
                if(event.action == 'AddTags'){
                    var addedTagsAsList = event.alert.addedTags.split(",");
                    if(getAlertsSeverity(addedTagsAsList) == null && addedTagsAsList.indexOf(config.statusPageTag) == -1 && populateServiceName(addedTagsAsList) == null){
                        var msg = "Added tags [" + addedTagsAsList + "] does not have any effect on any service state.Discarding..";
                        console.log(msg);
                        context.succeed(msg)
                    }
                }
                updateServiceStateIfNecessary(context, severity, event.alert.message, serviceName);

            }
        }else if(event.action == 'Close'){
            calculateAndUpdateServiceState(context, serviceName);
        }else if(event.action == 'RemoveTags'){
            var removedTag = event.alert.removedTags;
            var removedServiceName = populateServiceName([removedTag]);
            serviceName = serviceName || removedServiceName;
            console.log("Service Name: " + serviceName);
            if(serviceName == null){
                console.log("Alert does not contain a valid servicename tag.. Terminating..");
                context.done(new Error("Alert does not contain a valid servicename tag.. Terminating."));
            }else if(getAlertsSeverity([removedTag]) != null || removedTag == config.statusPageTag || removedServiceName){
                calculateAndUpdateServiceState(context, serviceName);
            }else{
                var message = "Removed tag [" + removedTag + "] does not have any effect on any service state.Discarding..";
                console.log(message);
                context.succeed(message)
            }
        }else{
            console.log("No matching action found... Terminating.");
            context.done(new Error("No matching action found... Terminating."));
        }
    }else{
        console.log("Event data is invalid");
        context.fail("Event data is invalid");
    }
};
