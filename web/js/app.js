'use strict';
angular.module('myApp', ['infinite-scroll', 'cgBusy', 'ui.bootstrap', 'ui.router'])
    .run(['cgBusyDefaults', function (cgBusyDefaults) {
        cgBusyDefaults.templateUrl = 'templates/cgbusy.html';
        if (!("ontouchstart" in document.documentElement)) {
            document.documentElement.className += " no-touch";
        }
    }])
    .constant('cfg', {
        'apiLambdaFunctionUrl': 'api_lambda_url',
        'serviceLambdaFunctionUrl': 'service_lambda_url',
        'apiKey': 'api_key'
    })
    .config(['$stateProvider', '$urlRouterProvider', function ($stateProvider, $urlRouterProvider) {
        $stateProvider
            .state('dashboard', {
                url: '/',
                templateUrl: 'dashboard.html'
            })
            .state('service', {
                url: "/{serviceName}",
                templateUrl: "service.html"
            });

        $urlRouterProvider.otherwise("/");

    }])
    .controller('DashboardController', ['$scope', '$http', '$rootScope', 'cfg', function ($scope, $http, $rootScope, cfg) {
        $rootScope.title = 'Service Dashboard';
        $rootScope.defaultMessage = "All systems are operational";
        $scope.servicesPromise = $http({
            method: 'GET',
            headers: {
                "X-Api-Key": cfg.apiKey
            },

            url: cfg.serviceLambdaFunctionUrl
        });

        $scope.servicesPromise.success(function(result){
            if(angular.isDefined(result.errorMessage)){
                $scope.error = result.errorMessage;
            }else{
                $scope.services = result;
            }
        })
        .error(function (data) {
            $scope.error = "Error occurred while getting service data: " + JSON.stringify(data);
        });

        $scope.isEmptyObject = function(obj){
            return angular.equals({}, obj);
        }
    }])
    .controller('StatusPageController', ['$scope', '$http', '$stateParams', '$state', 'cfg', '$rootScope' ,function ($scope, $http, $stateParams, $state, cfg, $rootScope) {
        var serviceName = $state.params.serviceName;
        $scope.showState = false;
        $rootScope.title = serviceName + ' Status Page';


        var makeRequest = function (content, url) {
            return $http({
                method: 'POST',
                dataType: "json",
                headers: {
                    "Content-Type": "application/json",
                    "X-Api-Key": cfg.apiKey
                },

                url: url ? url : cfg.apiLambdaFunctionUrl,
                data: content
            });
        };

        $scope.servicePromise = makeRequest({serviceName: serviceName}, cfg.serviceLambdaFunctionUrl);
        $scope.servicePromise.then(function(response){
            $scope.service = response.data;
        });

        var severityMap = {
            green: 0,
            major: 1,
            critical: 2
        };

        var getAlertsSeverity = function (tags){
            var alertSeverity = 'green';
            for(var i=0; i< tags.length; i++){
                var tag = tags[i];
                if(severityMap[tag.toLowerCase()] != null){
                    alertSeverity = tag;
                    break;
                }
            }
            return alertSeverity;
        };

        var alertsSize = 0;
        var first = true;
        var alertLimit = 15;
        var alertsLock = false;

        $scope.loadAlerts = function(){
            if(first || alertsSize === alertLimit){
                if(!alertsLock){
                    alertsLock = true;
                    var params;
                    if(first){
                        params = {action: "alerts", limit: alertLimit, serviceName: serviceName};
                    }else{
                        params = {action: "alerts", limit: alertLimit, serviceName: serviceName, createdBefore: $scope.alerts[$scope.alerts.length - 1].createdAt};
                    }

                    $scope.listAlertPromise = makeRequest(params);
                    $scope.listAlertPromise.success(function(result){
                        if(angular.isDefined(result.errorMessage)){
                            $scope.error = result.errorMessage;
                            alertsLock = false;
                        }else{
                            $scope.alerts = $scope.alerts || [];
                            alertsSize = result.data.length;
                            for(var i=0; i<alertsSize; i++){
                                var alert = result.data[i];

                                var severity = getAlertsSeverity(alert.tags);
                                var alertObj = {severity: severity, status: alert.status, message: alert.message, date: alert.createdAt, createdAt: alert.createdAt, id: alert.id, isCollapsed: true};
                                $scope.alerts.push(alertObj);
                                if(i == 0){
                                    loadAlertNotes(0, alert.id);
                                }
                            }
                            first = false;
                            alertsLock = false;
                        }
                    })
                    .error(function (data) {
                        $scope.error = "Error occurred while listing alerts: " + JSON.stringify(data);
                    });
                }
            }
        };

        var loadAlertNotes = function(index,alertId){
            $scope.alerts[index].isCollapsed = !($scope.alerts[index].isCollapsed);
            var params = {action: 'notes', id: alertId, limit: 50};
            if($scope.alerts[index]['notes'] == null){
                var alertNotesPromise = makeRequest(params);
                $scope.alerts[index]['notesPromise'] = alertNotesPromise;
                alertNotesPromise.success(function(result){
                    if(angular.isDefined(result.errorMessage)){
                        $scope.error = result.errorMessage;
                    }else{
                        $scope.alerts[index]['notes'] = result.notes;
                    }
                    delete $scope.alerts[index]['notesPromise'];
                })
                .error(function (data) {
                    $scope.error = "Error occurred while listing notes: " + JSON.stringify(data);
                });
            }
        };

        $scope.loadAlertNotes = function(index,alertId) {
            loadAlertNotes(index,alertId);
        };
}]);
