'use strict';

/* Services */

// Define your services here if necessary
var appFilters = angular.module('app.filters', []);

appFilters.filter('timeSince', function() {
	
	
	return function(input) {
		var date = input || '';
		
		var seconds = Math.floor((new Date() - date) / 1000);

		var interval = Math.floor(seconds / 31536000);

		if (interval > 1) {
			return interval + " años";
		}
		interval = Math.floor(seconds / 2592000);
		if (interval > 1) {
			return interval + " meses";
		}
		interval = Math.floor(seconds / 86400);
		if (interval > 1) {
			return interval + " dias";
		}
		interval = Math.floor(seconds / 3600);
		if (interval > 1) {
			return interval + " horas";
		}
		interval = Math.floor(seconds / 60);
		if (interval > 1) {
			return interval + " minutos";
		}
		return Math.floor(seconds) + " segundos";

		return ;
	};
})