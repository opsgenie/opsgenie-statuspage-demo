# OpsGenie Service Status Page

This project is a Demo of the Custom **Status Page Generation** solution by using OpsGenie Alerts & Webhook. It leverages AWS Lambda, S3 and API Gateway services.

## Installing npm

a package manager for JavaScript http://www.npmjs.com

npm is bundled with Node.js http://nodejs.org/download

## Installing Bower

a package manager for the Web http://bower.io

```sh
$ npm install -g bower
```

## Installing dependencies

```sh
# install web application's dependencies listed in bower.json
$ cd web
$ bower install
```

```sh
# install lambda functions' dependencies listed in package.json
$ cd lambda_function_directory
$ npm install
```

## Configurations

Project consists three lambda functions and a web application. Following configurations should be done:

* In lambda/opsgenie-api/config.js
```sh
    "opsgenieApiKey": "", // the API key of the API Integration in Opsgenie, which will be used to retrieve service's incident alerts.
    "statusPageTag": "statuspage", // identifier tag for the statuspage incidents
    "serviceNameTagPrefix": "servicename:" // tag prefix for service names in statuspage alerts.(ex: servicename:service1 -> service name will be extracted as service1)
```

* In lambda/opsgenie-webhook/config.js
```sh
    "opsgenieApiKey": "", // the API key of the API Integration in Opsgenie, which will be used to retrieve service's incident alerts.
    "serviceObjectBucket" : "", // name of the S3 bucket that stores the service data
    "statusPageTag": "statuspage", // identifier tag for the statuspage incidents
    "accessKeyId": "", // accessKeyId of the user credentials which has fullAccessRight to S3
    "secretAccessKey": "", // secretAccessKey of the user credentials which has fullAccessRight to S3
    "serviceNameTagPrefix": "servicename:", // tag prefix for service names in statuspage alerts.(ex: servicename:service1 -> service name will be extracted as service1)
    "serviceDataFolderNameInS3": "services" //folder of the service objects in S3 bucket
```

* In lambda/service-data/config.js
```sh
    "serviceObjectBucket" : "", // name of the S3 bucket that stores the service data
    "accessKeyId": "", // accessKeyId of the user credentials which has fullAccessRight to S3
    "secretAccessKey": "", // secretAccessKey of the user credentials which has fullAccessRight to S3
    "serviceDataFolderNameInS3": "services" //folder of the service objects in S3 bucket
```
* In web/js/app.js
```sh
    'apiLambdaFunctionUrl': 'api_lambda_url', // API Gateway URL of the Lambda function that retrieves alerts and alert notes from OpsGenie.
    'serviceLambdaFunctionUrl': 'service_lambda_url', // API Gateway URL of the Lambda function that retrieves service data from S3.
    'apiKey': 'apiKey' // API Key to make secure calls to API Gateway (both API Gateway endpoint can use same API Key.)
```
## Deploying Lambda functions
* Generate .zip file of all lambda functions including every file under the function's folder.
* For "opsgenie-api" lambda function, upload the zip and create an API Gateway Endpoint with POST method and Open it with API Key security options.
* For "opsgenie-webhook" lambda function, upload the zip and create an API Gateway Endpoint with POST method and Open it with API Key security options.
* For "service" lambda function, upload the zip and create two API Gateway Endpoints with POST and GET method of the same URL and Open it with API Key security options.
When called with GET method, function will return all available services state data to Web App (in dashboard page),
when called with POST method it will pass a service name in event and it will return only given services state data to Web App (service status page).
* In API Gateway console, Enable CORS for all API Gateway endpoints.

## Deploying Web Project
* **web** folder content can be deployed any Web Server.
