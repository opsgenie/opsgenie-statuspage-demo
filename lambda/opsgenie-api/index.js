var https = require('https');
var config = require('./config.js');

//OpsGenie API Variables start
var ogHost = 'api.opsgenie.com';
var ogPort = 443;

var reqTimeout = 30000;

var listAlertsEndpoint = "/v1/json/alert";
var listAlertNotesEndpoint = "/v1/json/alert/note";
//OpsGenie API Variables end

var options = {
    host: ogHost,
    port: ogPort,
    agent: false,
    method: 'GET',
    headers: {
        'X-Js-Client': 'true',
        'Content-Type': 'application/json'
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
            if (res.statusCode === 200) {
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
    var path = listAlertsEndpoint + "?apiKey=" + config.opsgenieApiKey + "&limit="+ event.limit +"&tags=" + encodeURIComponent(config.statusPageTag)+ "," +  encodeURIComponent(config.serviceNameTagPrefix + event.serviceName) ;
    if(event.createdBefore){
        path += "&createdBefore=" + event.createdBefore;
    }
    doGetRequest(path, context);
}

function listAlertNotes(event, context){
    var path = listAlertNotesEndpoint + "?apiKey=" + config.opsgenieApiKey + "&limit="+ event.limit + "&id=" + event.id;
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
