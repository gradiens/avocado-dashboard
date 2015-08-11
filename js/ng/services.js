'use strict';

/* Services */

// Define your services here if necessary
var appServices = angular.module('app.services', []);





/**
 * Override default angular exception handler to log and alert info if debug mode
 */

/**
appServices.factory('$exceptionHandler', function ($log) {
    return function (exception, cause) {
        var errors = JSON.parse(localStorage.getItem('sing-angular-errors')) || {};
        errors[new Date().getTime()] = arguments;
        localStorage.setItem('sing-angular-errors', JSON.stringify(errors));
        app.debug && $log.error.apply($log, arguments);
        app.debug && alert('check errors');
    };
});

 */

/**
 * Sing Script loader. Loads script tags asynchronously and in order defined in a page
 */
appServices.factory('scriptLoader', ['$q', '$timeout', function($q, $timeout) {

    /**
     * Naming it processedScripts because there is no guarantee any of those have been actually loaded/executed
     * @type {Array}
     */
    var processedScripts = [];
    return {
        /**
         * Parses 'data' in order to find & execute script tags asynchronously as defined.
         * Called for partial views.
         * @param data
         * @returns {*} promise that will be resolved when all scripts are loaded
         */
        loadScriptTagsFromData: function(data) {
            var deferred = $q.defer();
            var $contents = $($.parseHTML(data, document, true)),
                $scripts = $contents.filter('script[data-src][type="text/javascript-lazy"]').add($contents.find('script[data-src][type="text/javascript-lazy"]')),
                scriptLoader = this;

            scriptLoader.loadScripts($scripts.map(function(){ return $(this).attr('data-src')}).get())
                .then(function(){
                    deferred.resolve(data);
                });

            return deferred.promise;
        },


        /**
         * Sequentially and asynchronously loads scripts (without blocking) if not already loaded
         * @param scripts an array of url to create script tags from
         * @returns {*} promise that will be resolved when all scripts are loaded
         */
        loadScripts: function(scripts) {
            var previousDefer = $q.defer();
            previousDefer.resolve();
            scripts.forEach(function(script){
                if (processedScripts[script]){
                    if (processedScripts[script].processing){
                        previousDefer = processedScripts[script];
                    }
                    return
                }

                var scriptTag = document.createElement('script'),
                    $scriptTag = $(scriptTag),
                    defer = $q.defer();
                scriptTag.src = script;
                defer.processing = true;

                $scriptTag.load(function(){
                    $timeout(function(){
                        defer.resolve();
                        defer.processing = false;
                        Pace.restart();
                    })
                });

                previousDefer.promise.then(function(){
                    document.body.appendChild(scriptTag);
                });

                processedScripts[script] = previousDefer = defer;
            });

            return previousDefer.promise;
        }
    }
}]);

appServices.factory('loginService', function ($state, $firebaseAuth, $firebase, gradMainService, fbURL) {

    //Authentication*********************
    var s = {};

    s.mainFb = new Firebase(fbURL);

    s.uid = {};
    s.authData = {};
    s.userData = {};
    s.auth = $firebaseAuth(s.mainFb);

    //Set listener*****
    s.auth.$onAuth(function (authData) {
      
        if (authData) {
            console.log("Saving user in fb", authData);
            s.mainFb.child("users").child(authData.uid).update(authData);
            var dataFb = s.mainFb.child("users").child(authData.uid).child("data");
            //set name and picture
            switch (authData.provider) {
            case 'facebook':
                dataFb.update({
                    name: authData.facebook.displayName,
                    pic_url: authData.facebook.cachedUserProfile.picture.data.url
                });
                break;
            case 'twitter':
                dataFb.update({
                    name: authData.twitter.displayName,
                    pic_url: authData.twitter.cachedUserProfile.profile_image_url
                });
                break;
            case 'password':
                dataFb.update({
                    pic_url: "http://www.milatacr.com/www/img/milata_icon_512.png"
                });
                break;
            };

            s.authData = authData;
            s.userData = $firebase(s.mainFb.child("users").child(authData.uid).child("data")).$asObject();
            //$rootScope.authData = authData;
            console.log("trying to go to home");
			
			gradMainService.start(s.authData.uid);
			
            $state.go('app.page', { page: 'widgets_gradiens', child: null });
        } else {
            console.log("not authorizing right now");
            $state.go('login');
        }
    });

    s.logout = function () {
        console.log("logging out...");
        s.auth.$unauth();
        s.authData = {};
		
		
		
        //$rootScope.authData = {};
    };

    s.checkSession = function () {
        var authData = s.auth.$getAuth();
        if (authData) {
            console.log("Already logged in.. rerouting to main", authData);
            $state.go("survey");
        } else {
            console.log("Not logged in.. redirecting to login page");
        }
    };

    return s;



});


/********************************************************/
/*   Helper Service   *********************/
/********************************************************/

appServices.factory('helperService', function ($firebase, fbURL) {
	var s = {};
	//Add groupBy Multti mixin
	_.mixin({groupByMulti: function (obj, values, context) {
		if (!values.length){
			return obj.length;
		}
		var byFirst = _.groupBy(obj, values[0], context),
			rest = values.slice(1);
		for (var prop in byFirst) {
			byFirst[prop] = _.groupByMulti(byFirst[prop], rest, context);
		}
		return byFirst;
	}});
	
    _.mixin({groupByMultiHour: function (obj, inQ, context) {
		
		var byFirst = _.groupBy(obj, inQ + "text" , context);
        
		for (var prop in byFirst) {
			byFirst[prop] = _.groupBy(byFirst[prop], roundHour, context);
        
            for (var prop2 in byFirst[prop]){
                byFirst[prop][prop2] = _.groupBy(byFirst[prop][prop2], inQ + "score", context);
                var avg = 0;
                var sum = 0;
                for( var prop3 in byFirst[prop][prop2]){
                    avg = avg + byFirst[prop][prop2][prop3].length * prop3;
                    sum = sum + byFirst[prop][prop2][prop3].length;
                    byFirst[prop][prop2][prop3] = byFirst[prop][prop2][prop3].length 
                }
                byFirst[prop][prop2].average = avg / sum
                
            }
		}
		return byFirst;
	}});
    
    function roundHour(inObj){
        var d = new Date(inObj.q1time);
        d.setMinutes(0,0,0);
        return d.getTime();
    };
    
    
	
	s.getTotals = function(inArr, inQ){
		var res =  _.groupByMulti(inArr, [inQ + 'text',inQ + 'score']);
        return res;
	};
    
    s.convertToLineMorris = function(inArr, inQ){
        var res = _.groupByMultiHour(inArr, inQ);
        var outObj = {};
        _.each(res, function(element, index){
            outObj[index] ={
                element: "line_" + index,
                xkey: 'z',
                ykeys: ['a'],
                labels: ['Series A'],
                data: []
            };
            _.each(element, function(el, ind){
                outObj[index].data.push({z: Number(ind), a: el.average});
            });
        
        });
        
        return outObj;
    
    };
	
	s.convertToMorris = function(inObj){
		var outObj = {};
		_.each(inObj, function(element, index){
			outObj[index] = {
				element: index,
				colors: ['#BF1E2D', '#D8766D', '#6CBC7A', '#0B9444'],
				data: []
			};
			_.each(element, function(el, ind){
				outObj[index].data.push({label: ind, value: el});
			});
		});
		return outObj;
	};

    return s;



});


/********************************************************/
/*   Main Service   *********************/
/********************************************************/

appServices.factory('gradMainService', function ($firebase, helperService, fbURL) {
	console.log("Loading mainService");
    var s = {};
	
	s.totals = {
		y: {},
		x: {}
	};
    
    s.averages = {
        y: {},
        x: {}
    };
    
    
	var fb = {};
	
	s.start = function(inUid){
		fb = new Firebase(fbURL + '/repo/' + inUid);
		
		//Sync status
		s.status = $firebase(fb.child("status")).$asObject();

		s.status.$loaded()
		  .then(function(data) {
			console.log("Loaded synced status", s.status); // true
		  })
		  .catch(function(error) {
			console.error("Error:", error);
		  });
		
		console.log("before calling fetch totals from gms start, loginService.uid :", inUid);
		s.fetchTotals();
/*		//Sync answers
		s.answers = $firebase(fb.child("answers")).$asArray();
		s.answers.$loaded()
		  .then(function(data) {
			console.log("Loaded synced answers", s.answers); // true
			s.totals = helperService.convertToMorris(helperService.getTotals(s.answers));
			console.log("After morris:", s.totals);
			
			s.answers.$watch(function(){
				console.log("answers data changed!, recalculating totals");
				s.totals = helperService.convertToMorris(helperService.getTotals(s.answers));
				//s.totals.Prueba.data[0].value = 7;
			});
			
		  })
		  .catch(function(error) {
			console.error("Error:", error);
		  });
		
*/		
		
	}

	
	s.fetchTotals = function(){
		console.log("in fetch totals");
			var promise = new Promise(function(resolve, reject){
				s.answers = $firebase(fb.child("answers")).$asArray();
				s.answers.$loaded()
				  .then(function(data) {
					console.log("Loaded synced answers", s.answers); // true
					s.totals.y = helperService.convertToMorris(helperService.getTotals(s.answers, 'q1'));
					s.totals.x = helperService.convertToMorris(helperService.getTotals(s.answers, 'q2'));
					console.log("After morris:", s.totals);
                    
                    s.averages.y = helperService.convertToLineMorris(s.answers, 'q1');
                    s.averages.x = helperService.convertToLineMorris(s.answers, 'q2');
                    console.log("After morris lines:", s.averages);

					s.answers.$watch(function(){
						console.log("answers data changed!, recalculating totals");
						s.totals.y = helperService.convertToMorris(helperService.getTotals(s.answers, 'q1'));
						s.totals.x = helperService.convertToMorris(helperService.getTotals(s.answers, 'q2'));
						//s.totals.Prueba.data[0].value = 7;
                        
                        s.averages.y = helperService.convertToLineMorris(s.answers, 'q1');
                        s.averages.x = helperService.convertToLineMorris(s.answers, 'q2');
					});
                    
                    
                    //MorrisLine Part
                  //  console.log("Testing convertToLineMorris", helperService.convertToLineMorris(s.answers, 'q2'));
					
					resolve("Loading ready in promise!");

				  })
				  .catch(function(error) {
					console.error("Error:", error);
					reject(Error("It broke"));
				  });
			});
			
			return promise;
	}
	
	return s;
});


var ansJSON = {
  "-JeCMVsoFsT-WFJy9Uz9" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419710962509,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419710963067
  },
  "-JeCMY6dIWRhM_sdR139" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419710971229,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419710972192
  },
  "-JeCMiHcN-te_NWsdZa6" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711017387,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419711017953
  },
  "-JeCMjGXs6u_NPPjZgo9" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711021460,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419711021979
  },
  "-JeCMlwCfMZnMh8hHYsj" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711032193,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419711032903
  },
  "-JeCMmxkNPJOHYGUw_Co" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711036460,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419711037098
  },
  "-JeCMnx4e2htdwK66qUp" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711040596,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419711041151
  },
  "-JeCMp29L-1ug0I1nCRC" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711045008,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419711045636
  },
  "-JeCMq45wvgBDfuZ53Tx" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711049193,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419711049856
  },
  "-JeCMr3DyiD5ofRErlIj" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711053305,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419711053896
  },
  "-JeCMs2_XPfAElQMIs63" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711057467,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419711057950
  },
  "-JeCMt0_CdSI6HsBxBQW" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711061399,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419711061918
  },
  "-JeCMu0Gh3NC-UKDDzGq" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711065523,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419711065994
  },
  "-JeCNCnz3XTl1APLyCJs" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711141644,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419711142222
  },
  "-JeCNHAH649TUbbOhV2G" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711159322,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419711160131
  },
  "-JeCNIP9DqlrkYGjVXFf" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711164276,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419711165188
  },
  "-JeCNJhQcpqAV1kJVOLO" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711169526,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419711170511
  },
  "-JeCNLq1nah4cqKX2OKM" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711178338,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419711179256
  },
  "-JeCNQ7Xn3RHi_uAWxIq" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711195970,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419711196823
  },
  "-JeCNcvfPpDO0WSq6uyZ" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419711252395,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419711253345
  },
  "-JeCRi9NAKK8MO0xvDwI" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419712322521,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419712323263
  },
  "-JeCRrA99gZpgfFjFcy0" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419712359272,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419712360247
  },
  "-JeCRvS-qVEiFQnmn5mo" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419712376276,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419712377781
  },
  "-JeCbKepZR-NzsBpUWF3" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715109977,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715111389
  },
  "-JeCbLkZxNLhdQK_blX5" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715115382,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419715115853
  },
  "-JeCbMoTluC6o7SPbNyL" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715119695,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419715120198
  },
  "-JeCbt4qaE0wcIlk-Tde" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715255950,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715256480
  },
  "-JeCcPiYDgFEqWa8dA8c" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715389281,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715390432
  },
  "-JeCcQvYm1h1h0cAqKc1" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715394454,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419715395398
  },
  "-JeCcS0INwC9VWpi3HUN" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715399091,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419715399862
  },
  "-JeCcTB6HIWYfcVG1u3d" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715403760,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715404649
  },
  "-JeCcULjA3RGUGrhP9vG" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715408561,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419715409428
  },
  "-JeCcV_GuL34vZzmUQIo" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715413447,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419715414435
  },
  "-JeCcWh0rQ5adaUJ3vwj" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715418131,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715419047
  },
  "-JeCcXpUiAoF1CAiOGU2" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715422823,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419715423669
  },
  "-JeCdQKlWQDCComP7_9w" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715653869,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419715654582
  },
  "-JeCdakoDfwQgrTDxosu" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715700857,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419715701479
  },
  "-JeCdblqqa18NF0gfna1" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715705138,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715705644
  },
  "-JeCddG2HCq-6_fRb4Lj" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715710879,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419715711737
  },
  "-JeCdhs6zFZ20qjHd5z0" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715730224,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419715730620
  },
  "-JeCdiozHNm_4NJlopBN" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715734105,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715734518
  },
  "-JeCdjsuufhJIUhSc-IR" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715738238,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419715738864
  },
  "-JeCdpUhkKJ2gBQxj8C1" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419715761342,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419715761710
  },
  "-JeDTer17XSVVDtcy92_" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419729607868,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419729611501
  },
  "-JeDTg8XbjLm9c41cwGw" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419729615645,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419729616785
  },
  "-JeDVj0UgKk1tIC8FT2S" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419731127011,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419731135778
  },
  "-JeDVz0Zph2zFYb_pPkR" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419730218189,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419730219404
  },
  "-JeDW-KfvZwS0LDiXeb0" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419730223796,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419730224790
  },
  "-JeDWWV00oNZ24vqbjf1" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419730356107,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419730358586
  },
  "-JeDaF2XW2PCz_LuNe3P" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419731597064,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419731600996
  },
  "-JeDcvw053UmJPeGZNDh" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419732306767,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419732307347
  },
  "-JeDeEX54yC2KHxV5LUR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419732644512,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419732649718
  },
  "-JeDebQpFSPxjcHu2RI_" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419732744185,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419732747621
  },
  "-JeDehxFu5U1ybBT0Wdf" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419732768990,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419732774340
  },
  "-JeDeknAgo6YIcYoNmED" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419732779551,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419732785983
  },
  "-JeDgg0HBfW4q548kWfa" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419733290056,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419733290732
  },
  "-JeDgiLX3ExKTMKvFcCY" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419733296130,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419733300238
  },
  "-JeDglFyy2GPEnBe4ZCF" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419733311335,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419733312216
  },
  "-JeDjfEWtl19EEUXtwJR" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734073500,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734073959
  },
  "-JeDjgFMMnnsRdl05ZKi" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734077580,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734078110
  },
  "-JeDjxKt7gOvvCl36ofb" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734147347,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734148107
  },
  "-JeDjyMLc9T1GW41SxjZ" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734151776,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Esta es una prueba",
    "q2time" : 1419734152296
  },
  "-JeDk58ZmchnI9RqFwH5" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734180739,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734184180
  },
  "-JeDkCRNg9G-GdEgAJ8S" : {
    "q1key" : "y2",
    "q1score" : 4,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734209654,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734214060
  },
  "-JeDkDbTy11DHs2iZcnU" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734218406,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734218864
  },
  "-JeDkEZlFd3sN5lfNS-Y" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734222329,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734222788
  },
  "-JeDkFX3_JbbrZEavlKV" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734226264,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734226710
  },
  "-JeDkGVtJF15wVUpSAZL" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734230152,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734230731
  },
  "-JeDkHSSPaHypxC4fH50" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734228927,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Esta es una prueba",
    "q2time" : 1419734234609
  },
  "-JeDkHbb6TTXT3Sp1D2x" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734234243,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Esta es una prueba",
    "q2time" : 1419734235257
  },
  "-JeDkJt5mgUl2HCwHLLo" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734240038,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734244570
  },
  "-JeDkM0_S6sCE9YYCLN7" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734249710,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734253305
  },
  "-JeDkVz3vtYxYq6-qoJV" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734292271,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734294104
  },
  "-JeDkantbvFr0SDD7nwv" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734306202,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734317965
  },
  "-JeDkd0mOZpNzYLmoHHT" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734323839,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Esta es una prueba",
    "q2time" : 1419734327046
  },
  "-JeDkmI6wmipn6A0e-0e" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734364463,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734365018
  },
  "-JeDknGZgqc9eZlGQuPm" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734368458,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734369014
  },
  "-JeDkoICwbUYP1Xumiu6" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734372781,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Esta es una prueba",
    "q2time" : 1419734373216
  },
  "-JeDkpG4yYEM7FEcDsyp" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419734376669,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734377175
  },
  "-JeDl-6ZOoxczmYuRt6W" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734421104,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734421611
  },
  "-JeDl05M8Rz0niUViFaN" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734425232,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734425631
  },
  "-JeDl13n1vmKSQXwQrNc" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734429204,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734429627
  },
  "-JeDl25Hoy3cEBEumsZk" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734433491,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734433817
  },
  "-JeDlB5mEQOyLMnj0KSa" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734470218,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734470713
  },
  "-JeDlC37Xfq-cHqZ0Nmp" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734474204,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734474639
  },
  "-JeDlD26rJdd-0WoHKVR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734478273,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734478671
  },
  "-JeDlE4JKXEtDjfYGG1r" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419734482159,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734482908
  },
  "-JeDlF0VvAwzUh9BOmql" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419734486385,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734486760
  },
  "-JeDlFwwoC7WstMiovj1" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419734490214,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734490564
  },
  "-JeDlPO9coxaZYVKbTLY" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419734528787,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419734529233
  },
  "-JeDlUgMmVBIsdCZsuhP" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419734550483,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419734550943
  },
  "-JeDlutUjvhhIngN1kqz" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419734662055,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419734662368
  },
  "-JeDnCyojUPxdENfvIoc" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419735002222,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419735002680
  },
  "-JeDoQhBmOZ7dlw0rSa6" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419735319986,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419735321036
  },
  "-JeDoUZXPbX0PLYsrlIZ" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419735335744,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419735336867
  },
  "-JeDp6-3uDLJ5ghJDaUh" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419735496923,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419735498372
  },
  "-JeDp75NYyIz7rjioYim" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Prueba",
    "q1time" : 1419735502353,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419735502872
  },
  "-JeDrncDB9HdkXa-YCGU" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419736193451,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419736205457
  },
  "-JeDrog3AXsUDlNlJgQE" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419736209400,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419736209799
  },
  "-JeDrq-dnZ3bbLwwlNcs" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Prueba",
    "q1time" : 1419736214890,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419736215203
  },
  "-JeDrznUpLR0BjWtWGNn" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prueba",
    "q1time" : 1419736254957,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419736255320
  },
  "-JeDs0aeiQVEowuq0YIl" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419736262172,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419736262691
  },
  "-JeEDa7kr0pltDmmuJWk" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419742177816,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742179865
  },
  "-JeEDcV3XOz358p4ki4x" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419742186299,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419742189553
  },
  "-JeEDfFzDQWBdyzRHEH5" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion general en Denny's?",
    "q1time" : 1419742197184,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Esta es una prueba",
    "q2time" : 1419742200876
  },
  "-JeEDhvAkEN_MsJ-byCL" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Sera que funciona?",
    "q1time" : 1419742208172,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742211768
  },
  "-JeEEIp_iNKJXsFmGGHk" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Prueba",
    "q1time" : 1419742366095,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la comida?",
    "q2time" : 1419742366661
  },
  "-JeEFLb8SaNAfNfyv_Dl" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742639412,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742640171
  },
  "-JeEFMexP9i7lJNqXrDj" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prusadfsadfeba",
    "q1time" : 1419742644066,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742644511
  },
  "-JeEFNjMNtHXkl_Ofu2a" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Prusadfsadfeba",
    "q1time" : 1419742648660,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742648889
  },
  "-JeEFOkwJks68Lo49d15" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742652747,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742653086
  },
  "-JeEFegUMYqjgPJR6KYA" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742722143,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742722433
  },
  "-JeEFfbTi7PVOvbrLdGa" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742725991,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742726208
  },
  "-JeEFga1f3vs2eaP2Mho" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742729791,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742730212
  },
  "-JeEFhYSFoNLpkMq0gCP" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742733757,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742734143
  },
  "-JeEG6fCChs0LHUg1nBH" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742840737,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742841135
  },
  "-JeEG7k-evTTLaUSbdII" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742845044,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742845539
  },
  "-JeEG8eomx0YE8QkOrcz" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742848977,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742849302
  },
  "-JeEG9a-CnAEarh6ULED" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cual es su satisfaccion generalsss en Denny's?",
    "q1time" : 1419742852765,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742853090
  },
  "-JeEGAvmnVBqZzkaQTCX" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419742858301,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742858580
  },
  "-JeEGE1FWBsxFSF2XmRy" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419742871089,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742871282
  },
  "-JeEGEw5XRgKOT3Fmzpf" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419742874744,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419742874984
  },
  "-JeEGFxgD4_uKZxov7Ef" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419742878941,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742879183
  },
  "-JeEGGxy44sVTma1zAmV" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419742882971,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419742883296
  },
  "-JeEGO91Fm7C17F0JSqJ" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419742908398,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742912741
  },
  "-JeEGPYauzUylOPEK1vg" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419742917289,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742918472
  },
  "-JeEGQjw5u4FIdiH5E_4" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419742922875,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419742923359
  },
  "-JeEGWJbFkQ5HQQUCy95" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419742945788,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419742946186
  },
  "-JeEGXSB8owbmQYIqzv1" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419742950469,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419742950830
  },
  "-JeEGZWX7CIPLC8eAWFS" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419742958589,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419742959300
  },
  "-JeEJBdrHL4Zednt_Jnh" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419743644738,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419743648273
  },
  "-JeEJF8yoix_EWapdOzE" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419743656749,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419743662616
  },
  "-JeEJeAgofGanxVNx8wL" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419743766640,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419743769222
  },
  "-JeEJfpK9h6jzvY8r5Vx" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419743773758,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419743775983
  },
  "-JeEJlqUNP6VNlZFb9Ys" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419743798858,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419743800633
  },
  "-JeEJnbQP6tPmcXea6Ej" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419743805216,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419743807861
  },
  "-JeGQBWg5gfA408GS9We" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Cual es su grado de satisfaccion en Denny's en esta visita? ",
    "q1time" : 1419779036522,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419779037275
  },
  "-JeGQIfxHmmZX774nSsn" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779066291,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Le gusto el inodoro?",
    "q2time" : 1419779066605
  },
  "-JeGQtG29xGCJZ8GTgTc" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779219398,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció el servicio?",
    "q2time" : 1419779220530
  },
  "-JeGQuFIzALopFfT2ixU" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779224134,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779224579
  },
  "-JeGQy50iXzSHJYXOyQ8" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779239811,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779240306
  },
  "-JeGQz0ulADHbK5lcLt_" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779243741,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "X3",
    "q2time" : 1419779244139
  },
  "-JeGR10c5u7jl4jxSdFx" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1419779256022,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779256409
  },
  "-JeGR1xseKERLXA6PcQC" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779259892,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "X3",
    "q2time" : 1419779260265
  },
  "-JeGR2xAOytKUXcID6Tu" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779263893,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779264315
  },
  "-JeGR6cDhDM5TbwwqHyV" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1419779256022,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779279358
  },
  "-JeGR7czGjFwk46bW9TD" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1419779283143,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779283503
  },
  "-JeGRCfZNg18hG2vYccm" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Y2",
    "q1time" : 1419779303916,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779304143
  },
  "-JeGRJHt-jKKh3Z02q0v" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419779330969,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779331246
  },
  "-JeGRKBW54D6t7F95WfT" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Y2",
    "q1time" : 1419779334668,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419779334934
  },
  "-JeGWESnpWXgjPju0K54" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Y2",
    "q1time" : 1419780621860,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "X2",
    "q2time" : 1419780622173
  },
  "-JeGWFLu2tcKanUUHc3y" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Y2",
    "q1time" : 1419780625550,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419780625829
  },
  "-JeGWGEbn1YUV6un73pd" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419780629216,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419780629457
  },
  "-JeGWH6ZsHQleOjkkdWP" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419780632870,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "X2",
    "q2time" : 1419780633039
  },
  "-JeGqcBrIW8nAx_S-riW" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419786227982,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "X2",
    "q2time" : 1419786228499
  },
  "-JeGqd8jhqt1GfEZNGhT" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Y2",
    "q1time" : 1419786232119,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419786232396
  },
  "-JeGqe5HXWVmf58Com7V" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419786235860,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419786236270
  },
  "-JeGqlf3F4wlWwelo5QM" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1419786266089,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419786267297
  },
  "-JeGqtJlXGQ05nkARMgm" : {
    "q1key" : "y2",
    "q1score" : 4,
    "q1text" : "Y2",
    "q1time" : 1419786298239,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "X2",
    "q2time" : 1419786298638
  },
  "-JeGquGIH3OPFOswZ52i" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419786302126,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419786302513
  },
  "-JeGqvCIxtxNOChAfci_" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419786305919,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Hola",
    "q2time" : 1419786306351
  },
  "-JeGqyFz0-NY29Vs6_Ft" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1419786318697,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Hola",
    "q2time" : 1419786318877
  },
  "-JeGr00vSqytIVaDjMVJ" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419786329970,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "X2",
    "q2time" : 1419786330200
  },
  "-JeJ2ce_15bctmw6yhjp" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1419823192037,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419823194253
  },
  "-JeJ2eKXys6RdLrtBkT4" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Y2",
    "q1time" : 1419823199036,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "X2",
    "q2time" : 1419823201098
  },
  "-JeLpwDN8RT_XMhZ-NVl" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419869934149,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1419869935045
  },
  "-JeLpxJzqCqp4X2caB5Y" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1419869938909,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "X2",
    "q2time" : 1419869939583
  },
  "-JedPgN6S5xgdAIPukhh" : {
    "q1key" : "y2",
    "q1score" : 3,
    "q1text" : "Y2",
    "q1time" : 1420181541642,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1420181541882
  },
  "-JedPiyUtPqwmDUjaEGh" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1420181564570,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "X2",
    "q2time" : 1420181564940
  },
  "-JedPpNBRuGzIqhfRRPU" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1420181590671,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "X2",
    "q2time" : 1420181591076
  },
  "-JedPsV1-D2a3XdXV2JV" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Y2",
    "q1time" : 1420181603545,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1420181603863
  },
  "-JedPtVROl1Ss0WZv8LE" : {
    "q1key" : "y2",
    "q1score" : 4,
    "q1text" : "Y2",
    "q1time" : 1420181607692,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "X2",
    "q2time" : 1420181607988
  },
  "-JfiJPYJoiDp2wCjS7t2" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Y2",
    "q1time" : 1421337543601,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1421337544962
  },
  "-JfiJVSkbJz19t-2Ytqe" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1421337568582,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "X2",
    "q2time" : 1421337569182
  },
  "-JfiK0gVV9lKDUQ7R1y-" : {
    "q1key" : "y2",
    "q1score" : 4,
    "q1text" : "Y2",
    "q1time" : 1421337704010,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1421337705297
  },
  "-JfiK1szTxNf9niqmvMx" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1421337709363,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1421337710193
  },
  "-JfiK2zoh8ujcc2kGK1M" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1421337714027,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Hola",
    "q2time" : 1421337714726
  },
  "-JfiK41Vy3cir5y_4kZO" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1421337718398,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Hola",
    "q2time" : 1421337718995
  },
  "-JfiyrZguLGLo-9LhQ3w" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1421348672578,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "X2",
    "q2time" : 1421348673752
  },
  "-JfiysoALthMtzGdfFuC" : {
    "q1key" : "y2",
    "q1score" : 2,
    "q1text" : "Y2",
    "q1time" : 1421348677665,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué le pareció la limpieza?",
    "q2time" : 1421348678841
  },
  "-Jfiyu6REkng4PpbAddt" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "Volveria a Denny's?",
    "q1time" : 1421348683438,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Hola",
    "q2time" : 1421348684170
  },
  "-JfiyvkHXp_cdJe1AaQa" : {
    "q1key" : "y2",
    "q1score" : 1,
    "q1text" : "Y2",
    "q1time" : 1421348689830,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "X2",
    "q2time" : 1421348690880
  },
  "-JfjOGTE8RAi_IAJl4VZ" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355594527,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355595644
  },
  "-JfjOHXUMnUR0Zp0Sf8e" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355599408,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421355600012
  },
  "-JfjOIavIbLbV4v4rSzu" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355603691,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421355604392
  },
  "-JfjOJmPgU09H5FHUgx5" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355608426,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421355609223
  },
  "-JfjOKrDbtXKWvzTauu8" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355612994,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355613627
  },
  "-JfjObAJs3D4R7DiP61i" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355683851,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421355684546
  },
  "-JfjOcIrv_6ankYtFwnk" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355688355,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421355689188
  },
  "-JfjOdTmwrx3_7at5atX" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355692913,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355693980
  },
  "-JfjOebuLY0E8PhXLnm_" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355697831,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421355698664
  },
  "-JfjOg04iNvh0TMd_9wj" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355703258,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421355704370
  },
  "-JfjOhCoPh31v9tFxSIA" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355708363,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421355709279
  },
  "-JfjOiKaod1jOxAm3VRt" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355713024,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355713874
  },
  "-JfjOrMCJBSV_2tmu_vs" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355748298,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421355750842
  },
  "-JfjOt38W76u_W_XvRWO" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355756431,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1421355757815
  },
  "-JfjOv-c1PG6u9uUm2ji" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355764831,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421355765782
  },
  "-JfjOw3XOwsaFShXOzNI" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355769487,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355770124
  },
  "-JfjOx9nVJYYQC0Ac7Ij" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355773891,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421355774625
  },
  "-JfjOyBBR2iba7Bq7izO" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355778273,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "Pregunta 3",
    "q2time" : 1421355778808
  },
  "-JfjOzKrGcveqBn_R_bO" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355782366,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421355783521
  },
  "-JfjP02p3PG5nllG-Rzv" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355788676,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355790561
  },
  "-JfjP1FOq0h0iSINRVCm" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355794728,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421355795462
  },
  "-JfjP2afxa6X_1R3PaVR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355799867,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421355800985
  },
  "-JfjP4mxR2TJAqgCDgOF" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355809096,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421355809963
  },
  "-JfjP6NBem3oCzmY58ve" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355815656,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421355816441
  },
  "-JfjPB4reyUMhlgNerP4" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421355833799,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421355835748
  },
  "-JfjUVnb0KvAV7MmD0Zu" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421353626894,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421353633758
  },
  "-JfjUXOg6mx1jv21nYVV" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421353638713,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421353640292
  },
  "-JfjUYgde2gACHx2yO1F" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421353644309,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421353645600
  },
  "-JfjUZwZnMzJ07N3ELEY" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421353649601,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421353650715
  },
  "-JfjUa9eJTo-Czq4hP-m" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421353654645,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421353655715
  },
  "-JfjUcv2dxZFkfqdqy5n" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421353664936,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421353667004
  },
  "-Jfj_W5mU8R9VmknrN3B" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421358796067,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421358797525
  },
  "-Jfja65pRJQgC0rRByW7" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421358950380,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421358952939
  },
  "-JfjaAMZPQFqkij6st3G" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421358963275,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421358970395
  },
  "-JfjaC7vhAHQbTup14ie" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421358975634,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421358977650
  },
  "-JfjaFWfBcGcyA5OEl76" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421358985082,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421358991522
  },
  "-JfjaPUddKHv5QcW3axc" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421359028189,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Pregunta 4",
    "q2time" : 1421359032352
  },
  "-JfjaS8GvQbtCNDRUpZM" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421359039614,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421359043208
  },
  "-JfjaSiPS64pJsJXihT1" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421359042371,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421359043249
  },
  "-JfjaTp3m0t85ZOr2A3t" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421359047199,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421359047773
  },
  "-JfjaUvtOmvGpFosgjLE" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421359051591,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421359052306
  },
  "-JfjfXUbFFfKo0FvJLuL" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421360374706,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421360375861
  },
  "-JfjfYnpjTBwd9t2MpEC" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421360380278,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421360381251
  },
  "-Jfjv-iEGB28WmPJdAqK" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421364430926,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421364431814
  },
  "-Jfk1wCQ8asUDHMc3xhT" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421366518020,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1421366519013
  },
  "-Jfk6GkZdgZmgxiRNdHt" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421367650580,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421367656190
  },
  "-JfkI6ReJ63xnIQAc2-L" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421370750012,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421370750867
  },
  "-JfkIJnqODj5GAaFVKhn" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421370804583,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421370805599
  },
  "-JfkILiKv6HwrfnwlUWC" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421370812670,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421370813438
  },
  "-JfkIMzKQYVFIfRPa_Ws" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421370817710,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421370818622
  },
  "-JfkLyLF5n0_KIfEjpKH" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371710761,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421371712422
  },
  "-JfkM-iW6zLaJti2K6C-" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371720470,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421371722168
  },
  "-JfkM1aXSzVnXTM_xp04" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371726489,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421371729849
  },
  "-JfkM2tROTuOwKkgjIDc" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371733906,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421371735154
  },
  "-JfkM7FyVIwI5F_Xj8rg" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371750481,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421371753044
  },
  "-JfkMABwLKUVK_AUv3Da" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371760470,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421371765074
  },
  "-JfkMDCU1VCw7RgUkUnf" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371772075,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421371777397
  },
  "-JfkMEwBz7I7SS-nvfvs" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371782811,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421371784479
  },
  "-JfkMGz1sahOJ_cNNWUT" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371788520,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421371792857
  },
  "-JfkMMhDlR7DDx4IOKMi" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371815156,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421371816292
  },
  "-JfkMONeU5jhY-pSBtdX" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371820624,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421371823170
  },
  "-JfkMQ8Aa5f3ISeViVwQ" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371829048,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421371830371
  },
  "-JfkMRiWfEMG6t_waGb4" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371835306,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421371836857
  },
  "-JfkMTXI0IlF69T_PKAu" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371841603,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421371844266
  },
  "-JfkMUzWfjfPsxeo544w" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371848857,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421371850232
  },
  "-JfkMXA0kqtymxvsq0LP" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421371857966,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "Pregunta 3",
    "q2time" : 1421371859157
  },
  "-JfkwVAWOwfNnoXPMjJG" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421381549182,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421381550215
  },
  "-Jfkz6h1A9OnP7R1xxIR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382229653,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382236390
  },
  "-JfkzA5vAPbYKnn20X9u" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382248764,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382250337
  },
  "-JfkzBUp1HgoUPJ4t3MS" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382254931,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421382256027
  },
  "-JfkzJA1ZBUqAz7wp_Y2" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382281657,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382287464
  },
  "-JfkzLBa9Z4IUyLpVE12" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382293954,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382295756
  },
  "-JfkzOQTiSuANp4oUvEl" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382305368,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382308995
  },
  "-JfkzSFe2No3ARrWuPyB" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382322989,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421382324686
  },
  "-JfkzZNJuJTxIY3qIV-L" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382348414,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382353851
  },
  "-Jfl-uZ_MOIlHxWBSvzF" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382704993,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382706874
  },
  "-Jfl-vs0u9P9ILxdA2bC" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382711107,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382712228
  },
  "-Jfl-xGEYbQp3MDGh9eV" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382716944,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382717939
  },
  "-Jfl0E-bQypjl9Zslhpj" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382838531,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382840291
  },
  "-Jfl0Iirnj6gu53sRqmZ" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382859275,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421382859635
  },
  "-Jfl0LWZctdiCBUPjPDw" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382870605,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382871067
  },
  "-Jfl0NDqQgPJeTzBqdRr" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382877484,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382878059
  },
  "-Jfl0OXMzNaK4iGOEGay" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382883010,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382883403
  },
  "-Jfl0R-5kRkPutlFnJRo" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382841632,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421382843777
  },
  "-Jfl0SDc4rCGtpdOpSh7" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382847748,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382848803
  },
  "-Jfl0TPPVi18YflXXd5x" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382852709,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382853651
  },
  "-Jfl0UcDYffMJ_czDrv-" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382857899,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382858632
  },
  "-Jfl0VsHzFVd4XwlJVZK" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382862761,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421382863755
  },
  "-Jfl0X3mbxT0hOr_sYPM" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382867788,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382868646
  },
  "-Jfl0YLigvvlhKMUfYwD" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382872468,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382873895
  },
  "-Jfl0Zhsanx0cmPzppTi" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382878453,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421382879469
  },
  "-Jfl0_q5iP2ypJWqJvMH" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382883281,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421382884094
  },
  "-Jfl0bKS2Xz5fJfYKxB_" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382889382,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1421382890195
  },
  "-Jfl0cknWipPncw1J3kg" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421382895298,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421382896047
  },
  "-Jfl1wLCcXbTVM-fb8-Q" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421383237633,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421383238391
  },
  "-Jfl3T-F9MoMpWYyKYoR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421383637643,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1421383638397
  },
  "-Jfl3UHygEKGwOrPpbrT" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421383642793,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421383643692
  },
  "-Jfl3bJuKFpIxOKBC1nW" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421383675474,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421383676583
  },
  "-JfnHimc0YRv7gfcWGpR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421420928508,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421420931784
  },
  "-JfnHkXX2p4fixT7a0xR" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421420936596,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "Pregunta 3",
    "q2time" : 1421420938947
  },
  "-JfnIwvskbj_iONJyobb" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421421250727,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421421251829
  },
  "-JfnNIcO9Z9uDGyAWx-1" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421422389840,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421422393412
  },
  "-JfnNL-KmvLRwop4k66V" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421422400799,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1421422403136
  },
  "-JfnaXtoIcsrGoTgeJZj" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421426124915,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421426125910
  },
  "-JfnaZorh-58g-GRA1Yo" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421426129833,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421426133784
  },
  "-JfnbvJ9yXujsYcx4USP" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421426478570,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421426488042
  },
  "-JfpF7U5zR5RaIbkCbuA" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421453851916,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1421453857063
  },
  "-JfpFC4-vzjIxPtjNw1G" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421453865620,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421453875874
  },
  "-JfpFDq8TyyGfyG3B-_y" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421453881551,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1421453883116
  },
  "-JfpFFGdJCUe5dUQ3e2X" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421453887089,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1421453888971
  },
  "-Jg40KEv1SeHNmWcINLS" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421718408766,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1421718410336
  },
  "-Jg40RTsuw133UZ0tmZA" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1421718428608,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1421718439965
  },
  "-JgU7FALW-mRYVDPWXmE" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422156427767,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1422156432309
  },
  "-JgU7GmDvqBpJPhqXHnw" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422156436830,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1422156438893
  },
  "-JgU7ISgcX5RogdD13eV" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422156443557,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1422156445772
  },
  "-JgU7LJF8tA4B6LWys__" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422156452407,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1422156457456
  },
  "-JgWcH7ci5kNjhoFpM4z" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422198382698,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1422198383754
  },
  "-JgWcIICvfw3ekaTzvyu" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422198387502,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1422198388527
  },
  "-JgWcNLNiTGW3nuDB-NW" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422198408751,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1422198409205
  },
  "-JgWc_jhXO6EZWOMhRCu" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422198463028,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1422198464074
  },
  "-JgWcaod9xzYylpv8Cf8" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422198467823,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1422198468486
  },
  "-JgWfHwJ2kqo-PHbSzoB" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422199172755,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1422199173489
  },
  "-JgWndHQ8HO6M5fCCX-H" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422201361225,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1422201362159
  },
  "-JgWneM_eZbvI5lbcRmo" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422201365816,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1422201366585
  },
  "-Jh1PycQ_4nfBM_7iBhb" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422748542387,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1422748543477
  },
  "-Jh1Q3Bb0UydLheHdcQY" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422748563691,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1422748566274
  },
  "-Jh1Q5Ej6B7obtWd4oh9" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422748573763,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1422748574666
  },
  "-Jh1Q7A7IG6iYbkAM2K1" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422748581755,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1422748582562
  },
  "-Jh1UL6Mt_IXQ1TKS31N" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1422749687469,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1422749688188
  },
  "-Jhfq3-wvpGeJfI5WHGC" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423443503925,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423443509324
  },
  "-JhfvrapFeHsAXR5JDNs" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445030707,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423445031353
  },
  "-JhfvufSBp56OGIds48l" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445041913,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423445043937
  },
  "-JhfwKN7aAyqbxzc5CKP" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445150137,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Pregunta 4",
    "q2time" : 1423445153296
  },
  "-JhfwLbk4_xA5ZZamXvC" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445157785,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423445158393
  },
  "-JhfwMnkQBj3NAgyhDs1" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445162602,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423445163256
  },
  "-JhfwQN8W4j0rBfrBUAb" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445168937,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423445177873
  },
  "-JhfwZ8_ZUqq2gCULbOz" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445210978,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423445213810
  },
  "-JhfwmLsx9MaIusoG9Ws" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445271137,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423445271991
  },
  "-Jhfws5Nr2n-N-vKaIsY" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445293592,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423445295529
  },
  "-JhfxEp4hbnd4yd5QwRi" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445391399,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423445392713
  },
  "-JhfxRoAL0wjNZV2xRul" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445444918,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423445445903
  },
  "-JhfxTXmwbEOt0QIbhFV" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423445452119,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1423445452983
  },
  "-JhgCqtyteuJ_BxcHXxw" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423449746129,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423449747041
  },
  "-JhgDoeDVQCMsDec121n" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423449997401,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423449999984
  },
  "-JhgDqGSbQhWSkb2bpd_" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450005160,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423450006591
  },
  "-JhgDwX_B3FoTkrvL8j3" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450031534,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423450032263
  },
  "-JhgDxlw2k9SN3P19mqt" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450036559,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423450037342
  },
  "-JhgFOSu3-et08cOLaup" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450411644,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423450412892
  },
  "-JhgFdbN-a8rdnewWNXN" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450439864,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423450442458
  },
  "-JhgFfi87jZUBJF_bB6D" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450450112,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423450451083
  },
  "-JhgFgnjFTdCBO2FWm4i" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450454820,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423450455537
  },
  "-JhgFhyjhsP5SFB0DZ-o" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450459492,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423450460338
  },
  "-JhgFnbfrWevg9lkaKyT" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450482769,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423450483446
  },
  "-JhgFuTv4k23nYETsyX4" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450509894,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423450511560
  },
  "-JhgGAnuVH9DqswI-ViS" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450581642,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423450582592
  },
  "-JhgGCKIzCpj5Jfz-JBg" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450586828,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423450588828
  },
  "-JhgGFkVH7vzzRhKhsca" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450602182,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423450602858
  },
  "-JhgGfGY0EMBq85EIn0D" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450710636,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423450711409
  },
  "-JhgGgY-GYwe_D2K_a_4" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450715971,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423450716622
  },
  "-JhgGiupKVeuqcm8cTaK" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450725758,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423450726340
  },
  "-JhgH_qxC8kCHosMq0Xf" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450950482,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1423450951360
  },
  "-JhgHbXr2ciygaXSF0ZW" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423450957360,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423450958266
  },
  "-JhgM6a6pNzVmMSps72c" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452173833,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423452174727
  },
  "-JhgM7gU_iaHlPOr1RHj" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452178383,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1423452179231
  },
  "-JhgM8vrd8v4NcQwttJK" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452183407,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1423452184311
  },
  "-JhgMACVa6iPF4MZJPA8" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452187984,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423452189535
  },
  "-JhgMIqJ3jTcakxqGAE3" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452223911,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423452224895
  },
  "-JhgNUWPhx_JqLZBaSHY" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452497139,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423452498398
  },
  "-JhgNVeVmdsi7MA90WS0" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452502320,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "Pregunta 3",
    "q2time" : 1423452503076
  },
  "-JhgNX1IqMvr4SfJNCmC" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452507697,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423452508696
  },
  "-JhgNa_GQUTRwgMIqCqu" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452526614,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Pregunta 4",
    "q2time" : 1423452527310
  },
  "-JhgOYC7gTB8hBNaBNWM" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452811354,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423452812083
  },
  "-JhgOZCMKSdVmNqvoUCm" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452815570,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423452816194
  },
  "-JhgOaeEIMzSOkPMUycN" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452825530,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423452826234
  },
  "-JhgOboUDtrUIFOnUIzy" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452830299,
    "q2key" : "x4",
    "q2score" : 2,
    "q2text" : "Pregunta 4",
    "q2time" : 1423452830987
  },
  "-JhgOd-EwMQHANhxGJdx" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452834530,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1423452835834
  },
  "-JhgOhmMgngxWn7mhcvi" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452854010,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1423452855426
  },
  "-JhgOnCLTY0K9p_089r4" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452876706,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423452877634
  },
  "-JhgOqKUJ2t9aeVZo6wj" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452876706,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423452890442
  },
  "-JhgOsQaQ9esaALpM1m8" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452894049,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423452899025
  },
  "-JhgOz_T4FX-4OmWeMKD" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423452927514,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423452928323
  },
  "-Jhl3cOpYgWNrrOzNW1C" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531176979,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423531178029
  },
  "-Jhl3e4d1DGG4voihHK_" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531183370,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423531184930
  },
  "-Jhl4pGfzX9O56Av7eo1" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531491597,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Pregunta 4",
    "q2time" : 1423531492899
  },
  "-Jhl4saeWPrYl56yx3bW" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531501004,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1423531506529
  },
  "-Jhl53p-Dv2O-gn12C-z" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531555962,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423531556600
  },
  "-Jhl5CUk0nR7EYxL4sZQ" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531591442,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423531592103
  },
  "-Jhl5E8J9u3MZHnG5mRq" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531598183,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423531598860
  },
  "-Jhl6INO9u6yl7pRsD1r" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423531877072,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423531878364
  },
  "-Jhl9d5H2jIAiCHG_-3i" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423532752914,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423532753747
  },
  "-JhlG6cxaiY1XVFZ1Vk5" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423534450897,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423534451711
  },
  "-JhlGC36SlQY1W3oG90W" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423534463549,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423534473929
  },
  "-JhlGDQyK-moOwE4qm-j" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423534477947,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423534479552
  },
  "-JhlGFousZd9gnbmyqyA" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423534485153,
    "q2key" : "x2",
    "q2score" : 2,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423534489332
  },
  "-JhlGHPIfsnCUkKQtnDJ" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423534494756,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1423534495829
  },
  "-JhlGIbuSwKWEUunMSms" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423534499992,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423534500794
  },
  "-JhlOKOUfKsKpT1zBjgN" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423536604469,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423536605272
  },
  "-JhlQBy99ZLJsaSuZ058" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423537094163,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423537095035
  },
  "-JhlQOeVnkUQvEOcegU9" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423537146018,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423537147025
  },
  "-JhlajMAvsH4m7dyjPA0" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423540115157,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423540119469
  },
  "-JhlakiY5-GQrHTpwMF-" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423540123940,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423540125066
  },
  "-Jhlan59HppiAkEFLGKX" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423540132633,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423540134769
  },
  "-JhlaokUtAxpmCulDKty" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423540138924,
    "q2key" : "x3",
    "q2score" : 1,
    "q2text" : "Pregunta 3",
    "q2time" : 1423540141575
  },
  "-Jhlaqd2LhfgMqavzg_P" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423540148272,
    "q2key" : "x1",
    "q2score" : 1,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423540149291
  },
  "-Jhlare0nFD2jvcvdOkd" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423540152942,
    "q2key" : "x2",
    "q2score" : 3,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423540153448
  },
  "-Jho4R6_i00KN81ORqGp" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423581719261,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423581721581
  },
  "-Jho50lPS2EoTvH4b4FR" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423581874631,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1423581875808
  },
  "-Jho53Wu0_gf37ABRzCS" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423581886530,
    "q2key" : "x1",
    "q2score" : 3,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423581887106
  },
  "-Jho5bEnOlc3SA4gxfQo" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423582023304,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423582029308
  },
  "-Jho5kEykcs5fD4el6B0" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423582059374,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423582066184
  },
  "-Jhr9XSyTCbhFm7RHoMf" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633389296,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423633390259
  },
  "-Jhr9ZVCY2qoAwJVqkDV" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633398035,
    "q2key" : "x3",
    "q2score" : 4,
    "q2text" : "Pregunta 3",
    "q2time" : 1423633398595
  },
  "-Jhr9_enwsWaTaCy8nzz" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633402625,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Pregunta 4",
    "q2time" : 1423633403369
  },
  "-Jhr9d-U9g5guSFPqbSb" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633416433,
    "q2key" : "x1",
    "q2score" : 2,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423633417045
  },
  "-Jhr9e5Gh4vjAp25M2CH" : {
    "q1key" : "y1",
    "q1score" : 2,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633420773,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423633421508
  },
  "-Jhr9fDPpOeQegjBLFV-" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633425304,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423633426125
  },
  "-Jhr9gT0mku5SjZyMRrz" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633430331,
    "q2key" : "x4",
    "q2score" : 1,
    "q2text" : "Pregunta 4",
    "q2time" : 1423633431223
  },
  "-Jhr9hnijnNhijGlnxXX" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633436169,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423633436708
  },
  "-Jhr9jZtb19sExWSA66A" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633440480,
    "q2key" : "x2",
    "q2score" : 1,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423633443951
  },
  "-Jhr9lcHeFMV5w_aMx8l" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633447938,
    "q2key" : "x3",
    "q2score" : 2,
    "q2text" : "Pregunta 3",
    "q2time" : 1423633452359
  },
  "-JhrAf6cdQ-Fg-Ny9kgI" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633687204,
    "q2key" : "x4",
    "q2score" : 4,
    "q2text" : "Pregunta 4",
    "q2time" : 1423633687829
  },
  "-JhrBFwwihLvH5u_OPa_" : {
    "q1key" : "y1",
    "q1score" : 4,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423633841904,
    "q2key" : "x1",
    "q2score" : 4,
    "q2text" : "¿Qué tal estuvo el plato o bebida que ordenó?",
    "q2time" : 1423633842765
  },
  "-Ji-JokApPw4b-bgf3nH" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423787116398,
    "q2key" : "x4",
    "q2score" : 3,
    "q2text" : "Pregunta 4",
    "q2time" : 1423787117509
  },
  "-Ji-KdXzkNl7MBxg1dQT" : {
    "q1key" : "y1",
    "q1score" : 3,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423787332960,
    "q2key" : "x2",
    "q2score" : 4,
    "q2text" : "¿Cómo fue su experiencia con el servicio y atención de nuestro personal?",
    "q2time" : 1423787333752
  },
  "-Ji-KegTxBRuJU8AOKlg" : {
    "q1key" : "y1",
    "q1score" : 1,
    "q1text" : "¿Cómo fue su experiencia general en Denny's hoy?",
    "q1time" : 1423787337632,
    "q2key" : "x3",
    "q2score" : 3,
    "q2text" : "Pregunta 3",
    "q2time" : 1423787338456
  }
}