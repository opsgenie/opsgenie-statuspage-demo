var https = require('https');
var config = require('./config.js');

//OpsGenie API Variables start
var ogHost = 'api.opsgenie.com';
var ogPort = 443;

var reqTimeout = 30000;

var listAlertsEndpoint = "/v2/alerts/";
//OpsGenie API Variables end

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

function doGetRequest (path, context){
    options['path'] = path;
    var req = https.request(options, function (res) {
        var body = '';
        res.setEncoding('utf8');
        res.on('data', function (chunk) {
            body += chunk;
        });
        res.on('end', function () {
            if (res.statusCode > 199 && res.statusCode < 300) {
                console.log("Execution completed successfully.");
                context.succeed(JSON.parse(body));
            } else {
                var errMsg = 'Execution failed. Req Path:' + path + " Response Body: " + JSON.stringify(body);
                console.log(errMsg);
                context.fail(new Error(errMsg));
            }
        });
    });
    req.end();
    req.on('error', function (err) {
        console.log("req err: " + err.message);
        context.fail(new Error('Request error: ' + err.message));
    });
    req.setTimeout(reqTimeout, function () {
        context.fail(new Error('request timeout after ' + reqTimeout + ' milliseconds.'));
    });
}

function listAlerts(event, context){
    var path = listAlertsEndpoint + "?limit=" + event.limit + "&query=tag%3A%27" + encodeURIComponent(config.statusPageTag) + "%27%20tag%3A%27" + encodeURIComponent(config.serviceNameTagPrefix + event.serviceName) + "%27";
    if(event.createdBefore){
        path += "&query=createdBefore%3A" + event.createdBefore;
    }
    doGetRequest(path, context);
}

function listAlertNotes(event, context){
    var path = listAlertsEndpoint + event.id + "/notes?limit="+ event.limit;
    doGetRequest(path, context);
}

exports.handler = function (event, context) {
    console.log('Received event: ', event);
    var ogApiKey = config.opsgenieApiKey;
    if(event.action == 'alerts'){
        listAlerts(event, context);
    }else if(event.action == 'notes'){
        listAlertNotes(event, context);
    }else{
        context.done(new Error("No matching action found... Terminating."));
    }
};
