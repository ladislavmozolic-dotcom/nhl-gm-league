// Statview Version 1.4.1 - statview-1.4.1/js/ht-controller.js

app.config(['$httpProvider', function ($httpProvider) {
	$httpProvider.defaults.useXDomain = true;
	delete $httpProvider.defaults.headers.common['X-Requested-With'];
}
]);

//disable debug mode which makes code faster
//https://docs.angularjs.org/guide/production
app.config(['$compileProvider', function ($compileProvider) {
	$compileProvider.debugInfoEnabled(false);
}]);

app.run(function ($rootScope) {
	$rootScope.getHiddenProp = function () {
		var prefixes = ['webkit', 'moz', 'ms', 'o'];
		if ('hidden' in document) return 'hidden';
		for (var i = 0; i < prefixes.length; i++) {
			if ((prefixes[i] + 'Hidden') in document)
				return prefixes[i] + 'Hidden';
		}
		return null;
	},
		$rootScope.pageIsHidden = function () {
			var prop = $rootScope.getHiddenProp();
			if (!prop) return false;
			return document[prop];
		}
});

app.controller('ScorebarCtrl', ['$scope', '$http', '$rootScope', '$timeout', '$interval', 'HockeyTechService', '$attrs', 'Firebase',
	function ($scope, $http, $rootScope, $timeout, $interval, HockeyTechService, $attrs, Firebase) {
		var season = $scope.season;
		var leagueId = $scope.leagueId;
		var leagueCode = $scope.leagueCode;
		var divisionId = $attrs.division;
		var svf_language = $attrs.lang;
		if (typeof svf_language === 'undefined') {
			svf_language = 'en';
		}
		$scope.language = svf_language;
		$scope.urlGameSummary = "game-summary";
		$scope.urlGameCenter = "game-center";
		if (svf_language == 'fr') {
			$scope.urlGameSummary = "sommaire-du-match";
			$scope.urlGameCenter = "game-centre";
		}
		if (!season) {
			season = 'latest';
		}
		if (!leagueCode) {
			if (typeof $attrs.leaguecode != 'undefined') {
				leagueCode = $attrs.leaguecode;
			}
		}

		$scope.floUtm = '?utm_medium=partner&utm_source=leaguestatwatchnow&utm_content=watchgame&utm_campaign=' + clientCode;

		var isPro = lsp_stats;
		if (typeof $attrs.ispro != 'undefined' && $attrs.ispro != '') {
			isPro = true;
		}

		var daysBack = 5;
		if (typeof $attrs.daysback != 'undefined' && $attrs.daysback != '') {
			daysBack = parseInt($attrs.daysback);
		}
		var daysAhead = 7;
		if (typeof $attrs.daysahead != 'undefined' && $attrs.daysahead != '') {
			daysAhead = parseInt($attrs.daysahead);
		}
		var limit = 1000;
		if (typeof $attrs.limit != 'undefined' && $attrs.limit != '') {
			limit = parseInt($attrs.limit);
		}
		//determine how many tiles display see slickConfig below.
		var tilesFull = 8;

		if (isPro) {
			tilesFull = 8;
		}
		if ($attrs.displayTeam === 'teamName') {
			tilesFull = 5;
		}
		if (typeof $attrs.displaytiles != 'undefined' && $attrs.displaytiles != '') {
			tilesFull = parseInt($attrs.displaytiles);
		}

		var tiles1367 = tilesFull - 1;
		var tiles1320 = tilesFull - 2;
		var tiles1025 = tilesFull - 3;
		var tiles769 = tilesFull - 4;
		if (tiles769 <= 5 || tiles769 >= 5) {
			tiles769 = 4;
		}

		var teamId = '';
		if (typeof $attrs.team != 'undefined' && $attrs.team != '') {
			teamId = parseInt($attrs.team);
		}

		var bootstrapPromise = HockeyTechService.bootstrap(season, 'scorebar', leagueId, leagueCode, svf_language).then(function (data) {
			$scope.firebaseUrl = data.firebaseUrl;
			$scope.firebaseToken = data.firebaseToken;
			$scope.firebaseApiKey = data.firebaseApiKey;

			$scope.currentSeasonId = data.current_season_id;
			$scope.showAd = (typeof data.svfConfig.daily_schedule.show_ad != 'undefined') ? data.svfConfig.daily_schedule.show_ad : false;
			$scope.svfConfig = data.svfConfig;
			$scope.svfLang = data.svfLang;
			$scope.current_league_id = data.current_league_id;
			$scope.leagues = data.leagues;
			$scope.useGameCenterUrl = (typeof data.svfConfig.game_center != 'undefined') ? data.svfConfig.game_center : false;
			$scope.htvUrl = (typeof data.svfConfig.hockeytv_url != 'undefined') ? data.svfConfig.hockeytv_url : '';
			$scope.urlGameLink = $scope.urlGameSummary;
			if ($scope.useGameCenterUrl || isPro) {
				$scope.urlGameLink = $scope.urlGameCenter;
			}

			//league_id returned from WP
			var wpLeagueId = league_id;
			var setLeagueId = $scope.current_league_id;
			if (wpLeagueId != '') {
				setLeagueId = wpLeagueId
			}

			if (setLeagueId && $scope.leagues && $scope.leagues.length > 0) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.leagueId = $scope.leagues[i].id;
						break;
					}
				}
			}

			// if we're still without a league
			if ($scope.leagueId == null) {
				$scope.leagueId = '';
			}

			// Check for 'advancing' the calendar link if the season hasn't started yet
			$scope.calScheduleLinkSuffix = '';
			let useSmartCalUrl = ((typeof data.svfConfig.scorebar !== 'undefined') && (typeof data.svfConfig.scorebar.smart_calendar_link !== 'undefined')) ? data.svfConfig.scorebar.smart_calendar_link : false;
			if (useSmartCalUrl) {
				// const foundNumber = numbers.find(num => num > 25); // Returns 30
				const currentSeasonInfo = data.seasons.find(s => s.id == data.current_season_id);
				if (currentSeasonInfo) {
					const seasonStartDate = new Date(currentSeasonInfo.start_date);
					const seasonStartMonth = seasonStartDate.getMonth();
					const seasonStartYear = seasonStartDate.getFullYear();
					const now = new Date();
					const curMonth = now.getMonth();
					const curYear = now.getFullYear();
					// Check the year as well, so we don't set the calendar link to month 11 when the current month is Jan (as an example)
					if ((seasonStartYear === curYear) && (seasonStartMonth > curMonth)) {
						$scope.calScheduleLinkSuffix = '/all-teams/' + data.current_season_id + '/' + (seasonStartMonth + 1) + '?league=' + data.current_league_id;
					}
				}
			}

			$scope.getData($scope.leagueId);

		}).catch(function () {
			$scope.loadError = true;
		});

		// Code to setup live firebase updates (if enabled)
		bootstrapPromise.then(function () {
			if (!$scope.svfConfig.liveScoreUpdates) {
				return;
			}

			var fbPubClockRef;
			$scope.PubGameClock = {};
			var fbRunningClocks = {};
			var fbGoalSummary;
			$scope.GoalSummary = {};

			Firebase.authenticate($scope.firebaseUrl, $scope.firebaseApiKey, $scope.firebaseToken);

			//check for firebase published clock
			if ($scope.language == "en") {
				fbPubClockRef = firebase.database().ref().child("/svf/" + clientCode + "/publishedclock/1/games/");
			} else if ($scope.language == "fr") {
				fbPubClockRef = firebase.database().ref().child("/svf/" + clientCode + "/publishedclock/2/games/");
			} else {
				console.log("ERROR: ScorebarCtrl, after the 'fbAuthorizedPromise', saw an invalid language value", $scope.language);
			}

			var fbRunningClocksRef = firebase.database().ref().child("/svf/" + clientCode + "/runningclock/games/");

			if (fbPubClockRef) {

				//get todays date to get todays game data
				var todaysDate = new Date();
				var getYear = todaysDate.getFullYear();
				var theMonth = todaysDate.getMonth() + 1;
				var getMonth = theMonth < 10 ? '0' + theMonth.toString() : theMonth.toString();
				var getDay = todaysDate.getDate() < 10 ? '0' + todaysDate.getDate().toString() : todaysDate.getDate().toString();
				var subscribeDate = getYear + '-' + getMonth + '-' + getDay;

				/*
					Logic for getting the clock from firebase
				*/

				$scope.fbClockSubscribe = function (date) {
					// Remove the old listeners (if they exist)

					// Listen for published clock firebase updates
					var fbPubClockDateFilteredRef = fbPubClockRef.orderByChild('DatePlayed').equalTo(date);
					fbPubClockDateFilteredRef.on('child_added', $scope.fbPubClockUpdate);
					fbPubClockDateFilteredRef.on('child_changed', $scope.fbPubClockUpdate);

					// Listen for running clock firebase updates
					var fbRunningClocksDateFilteredRef = fbRunningClocksRef.orderByChild('DatePlayed').equalTo(date);
					fbRunningClocksDateFilteredRef.on('child_added', $scope.fbRunningClockUpdate);
					fbRunningClocksDateFilteredRef.on('child_changed', $scope.fbRunningClockUpdate);
					fbRunningClocksDateFilteredRef.on('child_removed', $scope.fbRunningClockRemoved);

					// Remove the firebase listeners when the controller is destroyed
					$scope.$on('$destroy', function () {
						fbPubClockDateFilteredRef.off('child_changed', $scope.fbPubClockUpdate);
						fbPubClockDateFilteredRef.off('child_added', $scope.fbPubClockUpdate);
						fbRunningClocksDateFilteredRef.off('child_added', $scope.fbRunningClockUpdate);
						fbRunningClocksDateFilteredRef.off('child_changed', $scope.fbRunningClockUpdate);
						fbRunningClocksDateFilteredRef.off('child_removed', $scope.fbRunningClockRemoved);
					});

				}

				$scope.fbPubClockUpdate = function (snapshot) {
					// Store the game data
					$scope.PubGameClock[snapshot.key] = snapshot.val();
					$scope.updateClockWithFbData();
				}

				$scope.fbRunningClockUpdate = function (snapshot) {
					var fbRunningClock = snapshot.val();
					if (fbRunningClock.Clock && fbRunningClock.Clock.Minutes && fbRunningClock.Clock.Seconds) {
						fbRunningClocks[snapshot.key] = {
							minutes: parseInt(fbRunningClock.Clock.Minutes) || 0,
							seconds: parseInt(fbRunningClock.Clock.Seconds) || 0
						};
						$scope.updateClockWithFbData();
					}
				};

				$scope.fbRunningClockRemoved = function (snapshot) {
					delete fbRunningClocks[snapshot.key]
					$scope.updateClockWithFbData();
				};

				$scope.updateClockWithFbData = function () {

					if ($scope.GameData) {

						angular.forEach($scope.GameData, function (svGame) {

							var svGameId = parseInt(svGame.ID);
							var fbGame = $scope.PubGameClock[svGameId];

							if (fbGame) { // We get to use firebase data... yay!

								//check game status. Might change if scorebar left open before games starts
								if (fbGame.StatusId) {
									svGame.GameStatus = fbGame.StatusId.toString();
									//game in progress
									if (fbGame.StatusId == 2) {

										var gameMin;
										var gameSec;

										if (fbRunningClocks[svGameId]) { // Check if this game has a running clock

											var runningClock = fbRunningClocks[svGameId];

											gameMin = runningClock.minutes < 10 ? '0' + runningClock.minutes.toString() : runningClock.minutes.toString();
											gameSec = runningClock.seconds < 10 ? '0' + runningClock.seconds.toString() : runningClock.seconds.toString();

										} else { // Use this game's published clock

											gameMin = fbGame.ClockMinutes < 10 ? '0' + fbGame.ClockMinutes.toString() : fbGame.ClockMinutes.toString();
											gameSec = fbGame.ClockSeconds < 10 ? '0' + fbGame.ClockSeconds.toString() : fbGame.ClockSeconds.toString();

										}

										var gamePer = fbGame.PeriodLongName;

										svGame.GameStatusStringLong = gameMin + ':' + gameSec + ' ' + gamePer;

									} else {

										svGame.GameStatusStringLong = fbGame.ProgressString;

									}
								}
							}
						});
					}
				};

				$scope.fbClockSubscribe(subscribeDate);

				/*
					Logic for getting the goals from firebase
				*/

				//subscribe to goal summary
				if ($scope.language == "en") {
					fbGoalSummary = firebase.database().ref().child("/svf/" + clientCode + "/goalssummary/1/games/");
				} else if ($scope.language == "fr") {
					fbGoalSummary = firebase.database().ref().child("/svf/" + clientCode + "/goalssummary/2/games/");
				} else {
					console.log("ERROR: ScorebarCtrl, after the 'fbAuthorizedPromise', saw an invalid language value", $scope.language);
				}

				if (fbGoalSummary) {

					$scope.fbGoalSummarySubscribe = function (date) {
						// Remove the old listeners (if they exist)
						// Listen for firebase updates
						var fbGoalsSummaryDateFilteredRef = fbGoalSummary.orderByChild('DatePlayed').equalTo(date);
						fbGoalsSummaryDateFilteredRef.on('child_added', $scope.fbGoalSummaryUpdate);
						fbGoalsSummaryDateFilteredRef.on('child_changed', $scope.fbGoalSummaryUpdate);

						// Remove the firebase listeners when the controller is destroyed
						$scope.$on('$destroy', function () {
							fbGoalsSummaryDateFilteredRef.off('child_added', $scope.fbGoalSummaryUpdate);
							fbGoalsSummaryDateFilteredRef.off('child_changed', $scope.fbGoalSummaryUpdate);
						});
					}

					$scope.fbGoalSummaryUpdate = function (snapshot) {
						$scope.GoalSummary[snapshot.key] = snapshot.val();
						$scope.updateGoalSummaryData();
					}

					$scope.updateGoalSummaryData = function () {
						if ($scope.GameData) {
							angular.forEach($scope.GameData, function (svGame) {
								var svGameId = parseInt(svGame.ID);
								var fbGame = $scope.GoalSummary[svGameId];
								if (fbGame) {

									// Update total goals
									svGame.HomeGoals = fbGame.HomeGoalTotal;
									svGame.VisitorGoals = fbGame.VisitorGoalTotal;
								}
							});
						}
					}

					$scope.fbGoalSummarySubscribe(subscribeDate);
				}
			}
		});

		HockeyTechService.getScorebarRollover().then(function (data) {
			$scope.rolloverDateTime = new Date();
			$scope.rolloverDateTime.setHours(data.rollover, 0, 0, 0);
		});

		$scope.getData = function (leagueId) {
			$scope.GameData = null;
			$scope.dataLoaded = false;
			$scope.loading = true;
			$scope.theMethod = 'jsonp';
			if (teamId != '') {
				$scope.url = prodUrl + '/feed/index.php?feed=modulekit&key=' + appKey + '&client_code=' + clientCode + '&view=scorebar&numberofdaysahead=' + daysAhead + '&numberofdaysback=' + daysBack + '&limit=' + limit + '&fmt=json&team_id=' + teamId + '&lang=' + svf_language + '&league_id=' + leagueId + '&division_id=' + divisionId + '&callback=JSON_CALLBACK';
			} else {
				$scope.url = prodUrl + '/feed/index.php?feed=modulekit&key=' + appKey + '&client_code=' + clientCode + '&view=scorebar&numberofdaysahead=' + daysAhead + '&numberofdaysback=' + daysBack + '&limit=' + limit + '&fmt=json&site_id=' + site_id + '&lang=' + svf_language + '&league_id=' + leagueId + '&division_id=' + divisionId + '&callback=JSON_CALLBACK';
			}
			$http({ method: $scope.theMethod, url: $scope.url })
				.success(function (data, status, headers, config) {
					$rootScope.feedUrl = $scope.url;
					$scope.linkPrefix = $scope.linkPrefix;
					$scope.status = status;
					$scope.GameData = data.SiteKit.Scorebar;
					$scope.todaysDate = new Date();
					$scope.dataLoaded = true;
					$interval(callDataLoaded, 200);

					$scope.updateClockWithFbData();
					$scope.updateGoalSummaryData();
				}).
				error(function (data, status, headers, config) {
					// called asynchronously if an error occurs
					// or server returns response with an error status.
				});
		}

		//small wait until the data is all loaded so don't see a flicker
		function callDataLoaded() {
			$scope.loading = false;
		}

		$scope.slickConfigInline = {
			infinite: false,
			arrows: true,
			slidesToShow: tilesFull,
			slidesToScroll: 1,
			responsive: [
				{
					breakpoint: 1368,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles1367,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 1025,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles1025,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 769,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles769,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 569,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 3,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 440,
					settings: {
						infinite: false,
						slidesToShow: 2,
						slidesToScroll: 1,
						arrows: false
					}
				}
			],
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

		$scope.slickConfigTeamName = {
			infinite: false,
			arrows: true,
			slidesToScroll: 1,
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

		//used for external scorebar (custom html)
		$scope.slickConfig = {
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

		//Pro scorebar
		$scope.slickConfigPro = {
			infinite: false,
			arrows: true,
			slidesToShow: tilesFull,
			slidesToScroll: 1,
			responsive: [
				{
					breakpoint: 1441,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles1367,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 1321,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles1320,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 1025,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 5,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 961,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 4,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 741,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 3,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 620,
					settings: {
						infinite: false,
						slidesToShow: 2,
						slidesToScroll: 1,
						arrows: false
					}
				}
			],
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

		//Pro scorebar Team Name
		$scope.slickConfigProTeamName = {
			infinite: false,
			arrows: true,
			slidesToShow: tilesFull,
			slidesToScroll: 1,
			responsive: [
				{
					breakpoint: 1441,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 4,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 1321,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 3,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 961,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 2,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 520,
					settings: {
						infinite: false,
						slidesToShow: 1,
						slidesToScroll: 1,
						arrows: false
					}
				}
			],
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

	}]);


// This is pretty much a duplicated PlayerStatsControlsCtrl with just enough options removed to not let me use the existing one.
// we need to cleanup all these controllers and have them share more generic services.  soon! :)
app.controller('PlayerStatsControlsInlineCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $attrs) {
	$scope.season = $attrs.season;
	if (typeof $scope.season === 'undefined' || $scope.season == '') {
		$scope.season = 'latest';
	}
	$scope.division = $attrs.division;
	if (typeof $scope.division === 'undefined') {
		$scope.division = '';
	}
	var leagueId = $scope.leagueId;
	var leagueCode = $scope.leagueCode;
	var svf_language = $attrs.lang;
	if (typeof svf_language === 'undefined' || svf_language == '') {
		svf_language = 'en';
	}
	$scope.language = svf_language;

	HockeyTechService.bootstrap($scope.season, 'skater-leaders-stats', leagueId, leagueCode, svf_language).then(function (data) {
		$scope.current_league_id = data.current_league_id;
		if ($scope.season === 'latest') {
			$scope.current_season_id = data.current_season_id;
		} else {
			$scope.current_season_id = $scope.season;
		}
		$scope.leagues = data.leagues;
		$scope.seasons = data.seasons;
		$scope.svfLang = data.svfLang;
		$scope.divOverall = { "id": "-1", "name": $scope.svfLang.Overall };
		data.divisions.push($scope.divOverall);
		$scope.divisions = data.divisions;
		$scope.selectedDivision = {};
		$scope.selectedDivision.id = -1;
		$scope.positions = data.positions;
		$scope.rosterstatus = data.rosterstatus;
		$scope.quickViews = data.quickViews;
		$scope.playerType = 'skater';
		$scope.sortKey = 'points';
		$scope.selectedQuickView = $scope.quickViews[0];
		$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;
		if ($scope.division != '') {
			$scope.selectedDivision = {};
			$scope.selectedDivision.id = $scope.division;
		}
		$scope.getPlayerStats();
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.toggleStats = function (ctrl) {
		$scope.selectedQuickView = ctrl;
		$scope.sortKey = ctrl.params.sort;
		$scope.getPlayerStats();
	};

	$scope.getPlayerStats = function () {
		var position;
		if ($scope.playerType == 'goalie') {
			position = { id: 'goalies', name: 'Goalies' };
		} else {
			position = $scope.selectedPosition;
		}

		$scope.setScopeFromDefault();

		var teamId = $scope.team_id;
		if (typeof teamId == 'undefined') {
			teamId = 'all';
		}
		var leagueId = $scope.selectedLeague.id;

		$scope.getData(
			$scope.playerType,
			teamId,
			leagueId,
			$scope.current_season_id,
			$scope.selectedDivision.id,
			position,
			0,
			'qualified',
			null,
			1,
			'inline',
			$scope.sortKey,
			svf_language
		);
	};

	$scope.getData = function (playerType, team, league, season, division, position, rookies, qualified, rosterstatus, page, statsType, sortKey, svf_language) {

		var resultsPerPage = 5;

		var first = resultsPerPage * (parseInt(page) - 1);
		var limit = resultsPerPage;

		if (position == null) {
			position = 'skaters';
		}

		if (playerType == 'goalie') {
			position = 'goalies';
		} else {
			position = 'skaters';
		}

		if (rookies == null) {
			rookies = 0;
		} else {
			if (rookies == 'yes') {
				rookies = 1;
			} else {
				rookies = 0;
			}
		}

		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.CheckData = 0;
		var method = 'jsonp';

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=players' +
			'&league_id=' + league +
			'&season=' + season +
			'&division=' + division +
			'&team=' + team +
			'&position=' + position +
			'&rookies=' + rookies +
			'&statsType=' + statsType +
			'&rosterstatus=' + rosterstatus +
			'&first=' + first +
			'&limit=' + limit +
			'&lang=' + svf_language +
			'&sort=' + sortKey;

		if (position == 'goalies') {
			url += '&qualified=' + qualified;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				if (data) {
					$scope.CheckData = data[0].sections[0].data.length;
					$scope.CheckData = data.length;
				} else {
					$scope.CheckData = 0;
				}

				$scope.statsButton = "";
				if (svf_language == 'en') {
					if ($scope.playerType == 'skater') {
						$scope.statsButton = "player-stats";
					} else {
						$scope.statsButton = "goalie-stats";
					}
				} else {
					if ($scope.playerType == 'skater') {
						$scope.statsButton = "statistiques-des-joueurs";
					} else {
						$scope.statsButton = "statistiques-des-gardiens";
					}
				}
				if (season) {
					///player-stats/all-teams/2
					$scope.statsButton = $scope.statsButton + "/all-teams/" + season;
				}
				if (season && division && division != -1) {
					$scope.statsButton = $scope.statsButton + "?division=" + division;
				}

				$rootScope.playerNoPicLogoOverride = $scope.playerNoPicLogoOverride;
				$scope.dataLoaded = true;
				$scope.loading = false;
				$scope.setSort();
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.sortKey) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				if ($scope.playerType == 'goalie') {
					$scope.sortKey = 'gaa';
				} else {
					$scope.sortKey = 'points';
				}
			}
		} else {
			if ($scope.playerType == 'goalie') {
				$scope.sortKey = 'gaa';
			} else {
				$scope.sortKey = 'points';
			}
		}
	};

	$scope.sortStats = function (sortKey) {
		$scope.sortKey = sortKey;
		$scope.currentPage = 1;
		$scope.getPlayerStats();
	};

	$scope.changePlayerType = function (playerType) {
		$scope.playerType = playerType;
		if ($scope.playerType == 'goalie') {
			var bootstrapType = 'goalie-leaders-stats';
			$scope.sortKey = 'gaa';
		} else {
			$scope.sortKey = 'points';
			var bootstrapType = 'skater-leaders-stats';
		}

		HockeyTechService.bootstrap($scope.current_season_id, bootstrapType, leagueId, leagueCode, svf_language).then(function (data) {
			$scope.leagues = data.leagues;
			$scope.seasons = data.seasons;
			$scope.svfLang = data.svfLang;
			$scope.divOverall = { "id": "-1", "name": $scope.svfLang.Overall };
			data.divisions.push($scope.divOverall);
			$scope.divisions = data.divisions;
			$scope.positions = data.positions;
			$scope.rosterstatus = data.rosterstatus;
			$scope.quickViews = data.quickViews;
			$scope.playerType = $scope.playerType;
			$scope.selectedQuickView = $scope.quickViews[0];
			$scope.svfConfig = data.svfConfig;
			if ($scope.division != '') {
				$scope.selectedDivision = {};
				$scope.selectedDivision.id = $scope.division;
			}
			$scope.getPlayerStats();
		}).catch(function () {
			$scope.loadError = true;
		});
	};

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
			$scope.current_season_id = $scope.selectedSeason.id;
			$scope.changedSeason();
		});
	};

	$scope.changedSeason = function () {
		HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, 0).then(function (divisions) {
			$scope.current_season_id = $scope.selectedSeason.id;
			$scope.divOverall = { "id": "-1", "name": $scope.svfLang.Overall };
			divisions.push($scope.divOverall);
			$scope.divisions = divisions;
			$scope.selOverall = $scope.divisions.length - 1;
			$scope.selectedDivision = $scope.divisions[$scope.selOverall];
			$scope.changedDivision();
		});
	};

	$scope.changedDivision = function () {
		$scope.getPlayerStats();
	};

	$scope.setScopeFromDefault = function () {

		// LEAGUES
		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId && $scope.leagues && $scope.leagues.length > 0) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
			// if we're still without a league
			if ($scope.selectedLeague == null) {
				$scope.selectedLeague = $scope.leagues[0];
			}
		}

		// SEASONS
		if ($scope.selectedSeason == null && $scope.current_season_id && $scope.seasons && $scope.seasons.length > 0) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					$scope.current_season_id = $scope.selectedSeason.id;
					break;
				}
			}
			// if we're still without a season
			if ($scope.selectedSeason == null) {
				$scope.selectedSeason = $scope.seasons[0];
				$scope.current_season_id = $scope.selectedSeason.id;
			}
		}


		// If the league doesn't have any non-hidden seasons, selectedSeason won't be set
		if ($scope.selectedSeason == null) {
			$scope.selectedSeason = {};
			$scope.selectedSeason.id = -1;
		}

		// If the season doesn't have any divisions, selectedDivision won't be set
		if ($scope.selectedDivision == null) {
			$scope.selectedDivision = {};
			$scope.selectedDivision.id = -1;
		}
	};

	$scope.selectTableRow = function (key) {
		var theRow = key;
		if (!$scope[theRow]) {
			$scope[theRow] = true;
		} else {
			$scope[theRow] = false;
		}
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});

app.controller('TeamLandingPageCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $route) {
	// be careful with this one..  the $routeParams can switch the global clientCode.
	if ($routeParams.hasOwnProperty("facility")) {
		clientCode = $routeParams.facility;
		$scope.facility = clientCode;
	} else {
		$scope.facility = '';
	}

	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	$scope.regPlay = "regular";

	HockeyTechService.bootstrap('latest', 'team-stats', league, leagueCode, svf_language).then(function (data) {
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null && $scope.current_league_id) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $scope.current_league_id) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($scope.selectedLeague) {
			$scope.leagueName = $scope.selectedLeague.name;
		} else {
			$scope.leagueName = data.leagues[0].name;
		}

		$scope.current_season_id = data.current_season_id;
		$scope.seasons = data.regularSeasons;
		$scope.playoffSeasons = data.playoffSeasons;
		$scope.svfLang = data.svfLang;
	}).catch(function () {
		$scope.loadError = true;
	});

	// REGULAR SEASON CONTROLS
	$scope.changedSeason = function () {
		if ($scope.selectedSeason !== null) {
			HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.teams = [];
			});
		} else {
			$scope.divisions = [];
		}
	};

	$scope.changedDivision = function () {
		if ($scope.selectedDivision !== null) {
			HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id).then(function (teams) {
				$scope.teams = teams;
			});
		} else {
			$scope.teams = [];
		}
	};

	// PLAYOFF SEASON CONTROLS
	$scope.changedPlayoffSeason = function () {
		if ($scope.selectedPlayoffSeason !== null) {
			HockeyTechService.getDivisionsBySeasonId($scope.selectedPlayoffSeason.id).then(function (divisions) {
				$scope.playoffDivisions = divisions;
			});
		} else {
			$scope.playoffDivisions = [];
		}
	};

	$scope.redirectPage = function () {
		var url = '#/div-schedule/' + $scope.selectedTeam.id + '/' + $scope.selectedSeason.id + '?division=' + $scope.selectedDivision.id;
		//var url = '#/div-schedule?season=' + $scope.selectedSeason.id + '&division=' + $scope.selectedDivision.id + '&team=' + $scope.selectedTeam.id;
		window.location.href = url;
	};

	$scope.playoffRedirectPage = function () {
		var url = '#/div-schedule/all-teams/' + $scope.selectedPlayoffSeason.id + '/all-months?division=' + $scope.selectedPlayoffDivision.id;
		//var url = '#/div-schedule?season=' + $scope.selectedPlayoffSeason.id + '&division=' + $scope.selectedPlayoffDivision.id;
		window.location.href = url;
	};
});

app.controller('TeamStatsInlineCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $attrs) {
	var season = $attrs.season;
	var leagueId = $scope.leagueId;
	var leagueCode = $scope.leagueCode;

	$scope.division = $attrs.division;
	if (typeof $scope.division === 'undefined') {
		$scope.division = 0;
	}
	$scope.selectedDivision = {};
	$scope.selectedDivision.id = -1;

	var svf_language = $attrs.lang;
	var showConference = $attrs.showConference;
	if (typeof showConference === 'undefined') {
		showConference = 'false';
	}
	if (typeof svf_language === 'undefined') {
		svf_language = 'en';
	}
	$scope.language = svf_language;

	if (!season) {
		season = 'latest';
	}

	HockeyTechService.bootstrap(season, 'teams', leagueId, leagueCode, svf_language).then(function (data) {
		$scope.current_league_id = data.current_league_id;
		if ($scope.season && $scope.season != 'latest') {
			$scope.current_season_id = $scope.season;
		} else {
			$scope.current_season_id = data.current_season_id;
		}
		$scope.leagues = data.leagues;
		$scope.seasons = data.seasons;
		$scope.conferences = data.conferences;

		$scope.divisions = data.divisions;
		for (var i = 0; i < $scope.divisions.length; i++) {
			if ($scope.divisions[i].id == $scope.division) {
				$scope.selectedDivision = $scope.divisions[i];
				$scope.selectedDivision.id = $scope.divisions[i].id;
				$scope.divSelected = $scope.divisions[i].name;
				break;
			}
		}
		$scope.divisionsAll = data.divisionsAll;

		$scope.teams = data.teams;
		$scope.footerinfo = data.standingsFooter;
		$scope.quickViews = data.quickViews;
		$scope.selectedQuickView = $scope.quickViews[0];
		$scope.svfLang = data.svfLang;
		$scope.setScopeFromDefault();

		// TODO: This uses the ranking_configurations.label, which is just a name set by the user, so could be changed at any time
		// Use the actual value in the rank_string
		for (var i = 0; i < $scope.seasons.length; i++) {
			if ($scope.seasons[i].id == $scope.current_season_id) {
				$scope.sortKey = ($scope.seasons[i].default_sort != 'null' && $scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
			}
		}

		$scope.getData($scope.selectedLeague.id, $scope.selectedSeason.id, $scope.selectedDivision.id, $scope.sortKey, $scope.selectedConference);

	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.getData = function (league, season, division, sortKey, conference) {
		if (!html5ModeEnabled) {
			$scope.linkPrefix = '#/';
		} else {
			$scope.linkPrefix = baseRoute;
		}
		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = season;
		$scope.league = league;
		$scope.divisionId = division;

		if (conference != '' && typeof conference != 'undefined') {
			var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=teams' +
				'&groupTeamsBy=conference' +
				'&context=overall' +
				'&season=' + season +
				'&conference_id=' + conference +
				'&key=' + appKey +
				'&client_code=' + clientCode +
				'&league_id=' + league +
				'&statsType=inline' +
				'&lang=' + svf_language +
				'&sort=' + sortKey +
				'&callback=JSON_CALLBACK';

		} else {
			var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=teams' +
				'&groupTeamsBy=division' +
				'&context=overall' +
				'&season=' + season +
				'&division=' + division +
				'&key=' + appKey +
				'&client_code=' + clientCode +
				'&league_id=' + league +
				'&statsType=inline' +
				'&lang=' + svf_language +
				'&sort=' + sortKey +
				'&callback=JSON_CALLBACK';
		}

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
				$scope.setSort();
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
			$scope.changedSeason();
		});
	};

	$scope.changedSeason = function () {
		//update teams by season
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teamdata) {
			$scope.teams = teamdata;
		});

		HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id).then(function (divisions) {
			$scope.divisions = divisions;
			$scope.divisionsAll = divisions;
			$scope.selectedDivision = $scope.divisions[0];
			$scope.changedDivision();
		});

		for (var i = 0; i < $scope.seasons.length; i++) {
			if ($scope.seasons[i].id == $scope.selectedSeason.id) {
				$scope.sortKey = ($scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
				break;
			}
		}
	};

	$scope.toggleConf = function (conf) {
		$scope.selectedConference = conf.conference_id;

		if (typeof conf.conference_name == 'undefined') {
			$scope.divSelected = conf.name;
		} else {
			$scope.confSelected = conf.conference_name;
			//get divisions by conference
			$scope.divsByConf = [];
			var newConf = {};
			newConf.id = "-1";
			newConf.name = "Conf";
			newConf.conference_id = $scope.selectedConference.toString();
			$scope.divsByConf.push(newConf);
			for (var i = 0; i < $scope.divisions.length; i++) {
				if ($scope.selectedConference == $scope.divisions[i].conference_id) {
					$scope.divsByConf.push($scope.divisions[i]);
				}
			}
			$scope.divSelected = "Conf";
		}

		$scope.getData($scope.selectedLeague.id, $scope.selectedSeason.id, $scope.selectedDivision.id, $scope.sortKey, $scope.selectedConference);
	}

	$scope.changedDivision = function () {
		$scope.getData($scope.selectedLeague.id, $scope.selectedSeason.id, $scope.selectedDivision.id, $scope.sortKey);
	};

	$scope.toggleStats = function (div) {
		$scope.selectedDivision = div;
		//check if -1 for conf selection
		if ($scope.selectedDivision.id == "-1") {
			$scope.toggleConf(div);
		} else {
			$scope.divSelected = $scope.selectedDivision.name;
			$scope.getData($scope.selectedLeague.id, $scope.selectedSeason.id, $scope.selectedDivision.id, $scope.sortKey);
		}
	}

	$scope.setScopeFromDefault = function () {

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null || typeof $scope.selectedLeague == 'undefined' && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		$scope.selectedConference = "";
		$scope.divsByConf = [];
		if (showConference == 'true') {
			$scope.selectedConference = $scope.conferences[0].conference_id;
			$scope.confSelected = $scope.conferences[0].conference_name;
			//get division by conference
			var conf = {};
			conf.id = "-1";
			conf.name = "Conf";
			conf.conference_id = $scope.selectedConference.toString();
			$scope.divsByConf.push(conf);

			for (var i = 0; i < $scope.divisions.length; i++) {
				if ($scope.selectedConference == $scope.divisions[i].conference_id) {
					$scope.divsByConf.push($scope.divisions[i]);
				}
			}
			$scope.divSelected = "Conf";
		} else {
			//load divisions normally
			if (typeof $scope.divisionId != 'undefined') {
				for (var i = 0; i < $scope.divisions.length; i++) {
					if ($scope.divisions[i].id == $scope.divisionId) {
						$scope.selectedDivision = $scope.divisions[i];
						$scope.divSelected = $scope.divisions[i].name;
						break;
					}
				}
				if (typeof $scope.selectedDivision == 'undefined') {
					$scope.selectedDivision = $scope.divisions[0];
					$scope.divSelected = $scope.divisions[0].name;
				}
			}
			else if ($scope.selectedDivision == null && $scope.current_division_id) {
				for (var i = 0; i < $scope.divisions.length; i++) {
					if ($scope.divisions[i].id == $scope.current_division_id) {
						$scope.selectedDivision = $scope.divisions[i];
						$scope.divSelected = $scope.divisions[i].name;
						break;
					}
				}
			}
			else {
				$scope.selectedDivision = $scope.divisions[0];
				$scope.divSelected = $scope.divisions[0].name;
			}
		}

		$scope.setSort();
	};

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.sortKey) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				$scope.sortKey = 'points';
			}
		} else {
			$scope.sortKey = 'points';
		}
	};
});


app.controller('LeadersCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService) {
	var season = 'latest';

	HockeyTechService.bootstrap(season, 'leaders', null, null, svf_language).then(function (data) {
		$scope.svfLang = data.svfLang;
		$scope.getData();
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.getData = function () {
		$scope.Leaders = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = season;

		var season = $scope.season;
		var teamId = $scope.team_id;

		if (!season) {
			season = 'latest';
		}

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=leaders' +
			'&season_id=' + season +
			'&key=' + appKey +
			'&site_id=' + site_id +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&team_id=' + teamId +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.Leaders = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};
});

app.controller('LeadersExtendedCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $attrs) {
	var season = $attrs.season;
	var teamId = $attrs.team;
	var activeOnly = $attrs.activeOnly;
	var divisionId = $attrs.division;
	var conferenceId = $attrs.conference;
	if (typeof conferenceId === 'undefined') {
		conferenceId = "";
		$scope.conference = "";
	} else {
		$scope.conference = conferenceId;
	}
	if (typeof divisionId === 'undefined') {
		divisionId = "";
		$scope.division = "";
	} else {
		$scope.division = divisionId;
	}
	if (typeof activeOnly === 'undefined') {
		activeOnly = 0;
	}
	$scope.activeOnly = activeOnly;

	if (typeof teamId === 'undefined') {
		teamId = "";
	}
	var leagueId = $scope.leagueId;
	var leagueCode = $scope.leagueCode;
	var svf_language = $attrs.lang;
	if (typeof svf_language === 'undefined') {
		svf_language = 'en';
	}
	$scope.language = svf_language;

	//heading url
	$scope.headerPlayerUrl = "";
	$scope.headerGoalieUrl = "";

	if (!season) {
		season = 'latest';
	}

	HockeyTechService.bootstrap(season, 'leadersExtended', leagueId, leagueCode, svf_language).then(function (data) {

		if (season == 'latest') {
			$scope.season = data.current_season_id;
		} else {
			$scope.season = season;
		}
		$scope.teams = data.teams;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;
		$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;
		$scope.getData();
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.getData = function () {
		var playerTypes = $scope.playerTypes;
		var skaterStatTypes = $scope.skaterStatTypes;
		var goalieStatTypes = $scope.goalieStatTypes;
		var linkPrefix = $scope.linkPrefix;
		var activeOnly = $scope.activeOnly;
		var season = $scope.season;
		if (!season) {
			season = 'latest';
		}
		$scope.clientCode = clientCode;
		$scope.LeadersExtended = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.linkPrefix = linkPrefix;

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=leadersExtended' +
			'&key=' + appKey +
			'&league_id=' + leagueId +
			'&season_id=' + season +
			'&division=' + divisionId +
			'&conference=' + conferenceId +
			'&team_id=' + teamId +
			'&site_id=' + site_id +
			'&client_code=' + clientCode +
			'&playerTypes=' + playerTypes +
			'&skaterStatTypes=' + skaterStatTypes +
			'&goalieStatTypes=' + goalieStatTypes +
			'&activeOnly=' + activeOnly +
			'&lang=' + $scope.language +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.LeadersExtended = data;

				$scope.headerPlayerUrl = "player-stats";
				$scope.headerGoalieUrl = "goalie-stats";
				if (teamId != "") {
					$scope.headerPlayerUrl = $scope.headerPlayerUrl + "/" + teamId;
					$scope.headerGoalieUrl = $scope.headerGoalieUrl + "/" + teamId;
					if (season != 'latest') {
						$scope.headerPlayerUrl = $scope.headerPlayerUrl + "/" + season;
						$scope.headerGoalieUrl = $scope.headerGoalieUrl + "/" + season;
					}
				}
				if (teamId == "" && season != 'latest') {
					$scope.headerPlayerUrl = $scope.headerPlayerUrl + "/all-teams/" + season;
					$scope.headerGoalieUrl = $scope.headerGoalieUrl + "/all-teams/" + season;
				}

				$scope.defaultNoPic = 'https://lscluster.hockeytech.com/statview-1.4.1/img/headshot-default.jpg';
				if ($scope.playerNoPicLogoOverride) {
					$scope.defaultNoPic = $scope.playerNoPicLogoOverride;
				}

				$scope.dataLoaded = true;
				$scope.loading = false;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};
});

app.controller('TeamStatsCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;

	var season = 'latest';
	if ($routeParams.hasOwnProperty("season")) {
		season = $routeParams.season;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	var conference = '';
	if ($routeParams.hasOwnProperty("conference")) {
		conference = $routeParams.conference;
	}

	HockeyTechService.bootstrap(season, 'teams', league, leagueCode, svf_language, null, conference).then(function (data) {
		$scope.divisions = data.divisionsAll;
		$scope.conferences = data.conferencesAll;
		$scope.current_season_id = data.current_season_id;
		$scope.current_league_id = data.current_league_id;
		$scope.seasons = data.seasons;
		$scope.leagues = data.leagues;
		$scope.teams = data.teams;
		$scope.footerinfo = data.standingsFooter;
		$scope.quickViews = data.quickViews;
		$scope.selectedQuickView = $scope.quickViews[0];
		$scope.svfConfig = data.svfConfig;
		$scope.hasDivision = (typeof $scope.svfConfig.divisionDropdown != 'undefined' ? true : false);
		$scope.hasConference = (typeof $scope.svfConfig.conferenceDropdown != 'undefined' ? true : false);
		$scope.hideDivisionButton = (typeof $scope.svfConfig.hideDivisionButton != 'undefined' ? true : false);
		$scope.svfLang = data.svfLang;
		$scope.setScopeFromUrl();
		$scope.getData($scope.standingsType, $scope.context, $scope.selectedSeason.id, $scope.specialTeams, $scope.sortKey, $scope.selectedLeague.id, $scope.selectedConference.conference_id, $scope.selectedDivision.id, $scope.orderDirection);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
		});
		$scope.getTeamStats(true);
	};

	$scope.setScopeFromUrl = function () {
		if ($routeParams.hasOwnProperty("standingstype")) {
			$scope.standingsType = $routeParams.standingstype;
			if ($scope.standingsType != 'division' &&
				$scope.standingsType != 'conference'
			) {
				$scope.standingsType = 'division';
			}
		} else {
			if ($scope.hideDivisionButton) {
				$scope.standingsType = 'conference';
			} else {
				$scope.standingsType = 'division';
			}
		}

		if ($routeParams.hasOwnProperty("context")) {
			$scope.context = $routeParams.context;

			if ($scope.context != 'overall' &&
				$scope.context != 'home' &&
				$scope.context != 'visiting'
			) {
				$scope.context = "overall";
			}
		} else {
			$scope.context = "overall";
		}

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($routeParams.hasOwnProperty("conference") && $routeParams.conference != -1) {
			for (let i = 0; i < $scope.conferences.length; i++) {
				if ($scope.conferences[i].conference_id === $routeParams.conference) {
					$scope.selectedConference = $scope.conferences[i];
					break;
				}
			}
			if ($scope.selectedConference == null) {
				$scope.selectedConference = $scope.conferences[0];
			}
		} else {
			$scope.selectedConference = $scope.conferences[0];
		}

		if ($routeParams.hasOwnProperty("division") && $routeParams.division != -1) {
			for (var i = 0; i < $scope.divisions.length; i++) {
				if ($scope.divisions[i].id == $routeParams.division) {
					$scope.selectedDivision = $scope.divisions[i];
					break;
				}
			}
			if ($scope.selectedDivision == null) {
				$scope.selectedDivision = $scope.divisions[0];
			}
		} else {
			$scope.selectedDivision = $scope.divisions[0];
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.hasOwnProperty("season")) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.season) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];

					//check if current season is hidden
					if ($scope.selectedSeason.hide_in_standings === true) {
						//find first season that is not hidden
						for (let s = 0; s < $scope.seasons.length; s++) {
							if ($scope.seasons[s].hide_in_standings === false) {
								$scope.selectedSeason = $scope.seasons[s];
								$scope.current_season_id = $scope.selectedSeason.id;
								break;
							}
						}
					}

					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		// If the league doesn't have any non-hidden seasons, selectedSeason won't be set
		if ($scope.selectedSeason == null) {
			$scope.selectedSeason = {};
			$scope.selectedSeason.id = -1;
		}

		//if only season passed in get the league by season
		if ($routeParams.hasOwnProperty("season") && !$routeParams.hasOwnProperty("league") && wpLeagueId == '') {
			//update league id based on season
			HockeyTechService.getLeagueIdBySeasonId($routeParams.season).then(function (league_id) {
				setLeagueId = league_id;
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			});
		}

		if ($routeParams.hasOwnProperty("specialteams")) {
			$scope.specialTeams = $routeParams.specialteams == 'true';
		} else {
			$scope.specialTeams = false;
		}

		if ($routeParams.hasOwnProperty("sortkey")) {
			$scope.sortKey = $routeParams.sortkey;
		} else {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.selectedSeason.id) {
					$scope.sortKey = ($scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
					break;
				}
			}
			$scope.setSort();
		}

		$scope.orderDirection = ($routeParams.order_direction === 'reverse') ? 'reverse' : 'normal';
	};


	$scope.changedConference = function () {
		if ($scope.hasDivision) {
			$scope.selectedDivision.id = -1;
			HockeyTechService.getDivisionsBySeasonIdAndConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, false).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];
			});
			$scope.getTeamStats(true);
		}
	}

	$scope.changedSeason = function () {
		if ($scope.hasConference) {
			$scope.selectedConference.conference_id = -1;
			$location.search('conference', -1);
			HockeyTechService.getConferencesBySeasonId($scope.selectedSeason.id, false).then(function (conferences) {
				$scope.conferences = conferences;
				$scope.selectedConference = $scope.conferences[0];
			});
		}

		if ($scope.hasDivision) {
			$scope.selectedDivision.id = -1;
			$location.search('division', -1);
			HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, true).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];
			});
		}

		for (var i = 0; i < $scope.seasons.length; i++) {
			if ($scope.seasons[i].id == $scope.selectedSeason.id) {
				$scope.sortKey = ($scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
				break;
			}
		}
		//update league id based on season
		HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
			$scope.selectedLeague.id = league_id;
		});

		//update teams by season
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teamdata) {
			$scope.teams = teamdata;
		});

		$scope.getTeamStats(true);
	};

	$scope.changedDivision = function () {
		if ($scope.selectedDivision !== null) {
			HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, true).then(function (teams) {
				$scope.teams = teams;
				$scope.selectedTeam = $scope.teams[0];
			});
		} else {
			$scope.teams = [];
		}
		$scope.getTeamStats(true);
	};

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.sortKey) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				for (var i = 0; i < $scope.seasons.length; i++) {
					if ($scope.seasons[i].id == $scope.current_season_id) {
						$scope.sortKey = ($scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
					}
				}
			}
		} else {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.sortKey = ($scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
				}
			}
		}
	};

	$scope.$on('$locationChangeSuccess', function () {
		var params = $location.search();
		// this was an issue
		if ($scope.selectedSeason === undefined) {
			$scope.selectedSeason = {}
			$scope.selectedSeason.id = 'latest';
		}

		if (params.specialteams == "true") {
			params.specialteams = true;
		} else {
			params.specialteams = false;
		}

		var orderDirection = (params.order_direction === 'reverse') ? 'reverse' : 'normal';

		if (params.standingstype != $scope.standingsType ||
			params.context != $scope.context ||
			params.specialteams != $scope.specialTeams ||
			($scope.selectedSeason && params.season != $scope.selectedSeason.id) ||
			params.sortkey != $scope.sortKey ||
			orderDirection != $scope.orderDirection ||
			params.division != $scope.selectedDivision.id ||
			params.conference != $scope.selectedConference.conference_id ||
			($scope.selectedLeague && (
				params.league != $scope.selectedLeague.id ||
				params.leaguecode != $scope.selectedLeague.code)
			)
		) {
			if ($scope.selectedSeason === undefined) {
				// Initialize
				$scope.selectedSeason = {};
			}
			if ($scope.selectedLeague === undefined) {
				// Initialize
				$scope.selectedLeague = {};
			}
			$scope.standingsType = params.standingstype;
			$scope.context = params.context;
			$scope.specialTeams = params.specialteams;
			$scope.selectedSeason.id = params.season;
			$scope.selectedDivision.id = params.division;
			$scope.sortKey = params.sortkey;
			$scope.orderDirection = orderDirection;
			if ($scope.selectedLeague.id != params.league) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == params.league) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}
			else if ($scope.selectedLeague.code != params.leaguecode) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].code == params.leaguecode) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}

			$scope.getData(
				$scope.standingsType,
				$scope.context,
				$scope.selectedSeason.id,
				$scope.specialTeams,
				$scope.sortKey,
				$scope.selectedLeague.id,
				$scope.selectedConference.conference_id,
				$scope.selectedDivision.id,
				$scope.orderDirection
			);
		}
	});

	$scope.orderDirection = 'normal';   // 'normal' = DESC (leaders first), 'reverse' = ASC

	$scope.sortStats = function (sortKey) {
		if ($scope.sortKey === sortKey) {
			// toggle direction on the active column
			$scope.orderDirection = ($scope.orderDirection === 'normal') ? 'reverse' : 'normal';
		} else {
			$scope.sortKey = sortKey;
			$scope.orderDirection = 'normal'; // new column defaults to DESC (leaders first)
		}
		$scope.currentPage = 1;
		$scope.getTeamStats(true);
	};

	$scope.loadQuickView = function () {
		if ($scope.selectedQuickView.id != 'none') {
			$scope.standingsType = $scope.selectedQuickView.params.standingsType;
			$scope.context = $scope.selectedQuickView.params.context;
			$scope.orderDirection = 'normal'; // quick views always start DESC (leaders first)
			if (typeof $scope.selectedQuickView.params.sort === "undefined" || $scope.selectedQuickView.params.sort == "") {
				for (var i = 0; i < $scope.seasons.length; i++) {
					if ($scope.seasons[i].id == $scope.current_season_id) {
						$scope.sortKey = ($scope.seasons[i].default_sort != '') ? $scope.seasons[i].default_sort : 'points';
					}
				}
			}
			else {
				$scope.sortKey = $scope.selectedQuickView.params.sort;
			}
			$scope.specialTeams = $scope.selectedQuickView.params.specialTeams;
			$scope.currentPage = 1;
			$scope.getTeamStats(false);
		}
	};

	$scope.getTeamStats = function (resetQuickLinkMenu) {
		if (resetQuickLinkMenu) {
			$scope.selectedQuickView = $scope.quickViews[0];
		}
		if (typeof $scope.selectedSeason == 'undefined') {
			$scope.selectedSeason = {};
		}
		if (typeof $scope.selectedLeague == 'undefined') {
			$scope.selectedLeague = {};
		}
		$scope.getData($scope.standingsType, $scope.context, $scope.selectedSeason.id, $scope.specialTeams, $scope.sortKey, $scope.selectedLeague.id, $scope.selectedConference.conference_id, $scope.selectedDivision.id, $scope.orderDirection);
		var specialTeamsText = "false";
		if ($scope.specialTeams) {
			specialTeamsText = "true";
		}
		$location.search('standingstype', $scope.standingsType);
		$location.search('context', $scope.context);
		$location.search('specialteams', specialTeamsText);
		$location.search('season', $scope.selectedSeason.id);
		if ($scope.hasConference) {
			$location.search('conference', $scope.selectedConference.conference_id);
		}
		if ($scope.hasDivision) {
			$location.search('division', $scope.selectedDivision.id);
		}
		$location.search('sortkey', $scope.sortKey);
		$location.search('order_direction', $scope.orderDirection);
		$location.search('league', $scope.selectedLeague.id);
	};

	$scope.getData = function (standingsType, context, season, specialTeams, sortKey, leagueId, conference, division, orderDirection) {
		if (orderDirection !== 'reverse') {
			orderDirection = 'normal'; // default: DESC (leaders first)
		}
		$scope.orderDirection = orderDirection;
		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = season;
		if ($scope.hasConference) {
			$scope.conferenceId = conference;
		} else {
			$scope.conferenceId = "";
		}
		if ($scope.hasDivision) {
			$scope.divisionId = division;
		} else {
			$scope.divisionId = "";
		}

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=teams' +
			'&groupTeamsBy=' + standingsType +
			'&context=' + context +
			'&site_id=' + site_id +
			'&season=' + season +
			'&special=' + specialTeams +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&conference=' + conference +
			'&division=' + division +
			'&sort=' + sortKey +
			'&order_direction=' + orderDirection +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.setSort();
				$scope.dataLoaded = true;
				$scope.loading = false;

				$scope.setName = $scope.selectedLeague.name;
				$rootScope.seoTitle = $scope.setName + ' ' + $scope.svfLang.Team_Stats + ' ' + $scope.selectedSeason.name;
				var setPath = baseRoute + $scope.pageName;
				$rootScope.seoPath = setPath;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});


app.controller('GameSummaryCtrl', ['$scope', '$http', '$rootScope', '$routeParams', '$location', '$timeout', 'HockeyTechService', '$route', 'svfFb',
	function ($scope, $http, $rootScope, $routeParams, $location, $timeout, HockeyTechService, $route, svfFb) {
		$scope.pageName = $route.current.$$route.name;
		var svf_language = $route.current.$$route.language;
		$scope.language = svf_language;

		$scope.urlRoster = "roster";
		$scope.urlPlayerStats = "player-stats";
		$scope.urlPlayer = "player";
		$scope.urlCoach = "coach";
		if (svf_language == 'fr') {
			$scope.urlRoster = "alignement";
			$scope.urlPlayerStats = "statistiques-des-joueurs";
			$scope.urlPlayer = "joueur";
			$scope.urlCoach = "entraineur";
		}
		if (!html5ModeEnabled) {
			$scope.linkPrefix = '#/';
		} else {
			$scope.linkPrefix = baseRoute;
		}

		$scope.floUtm = '?utm_medium=partner&utm_source=leaguestatwatchnow&utm_content=watchgame&utm_campaign=' + clientCode;

		$scope.gameId = $routeParams.gameId;

		var league = '';
		if ($routeParams.hasOwnProperty("league")) {
			league = $routeParams.league;
		}
		var leagueCode = '';
		if ($routeParams.hasOwnProperty("leaguecode")) {
			leagueCode = $routeParams.leaguecode;
		}

		$scope.dataLoaded = false;
		$scope.loading = true;

		$scope.getGameData = function () {
			if ($scope.gameId == null) {
				//Show some kind of message to the user, gameId is required.  They should not get here normally.
				console.log('Missing gameId');
				$scope.missingGameID = true;
				return $q(function (resolve, reject) {
					reject("Game id was missing");
				});
			} else {
				return $scope.getData($scope.gameId);
			}
		};

		$scope.createScoringBox = function () {
			// Create Scoring box info
			// headers
			$scope.scoreSummaryHeadings = [];
			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				$scope.scoreSummaryHeadings.push($scope.gameSummary.periods[period].info.shortName);
			}
			if ($scope.gameSummary.hasShootout) $scope.scoreSummaryHeadings.push($scope.svfLang.Shootout_Abbrev);
			$scope.scoreSummaryHeadings.push($scope.svfLang.Total);
			$scope.scoreSummaryHeadings.push($scope.svfLang.PP);

			// visiting team scoring
			$scope.visitingScoreSummary = [];
			var visitingPeriodTotal = 0;
			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				var visitingPeriodGoals = $scope.gameSummary.periods[period].stats.visitingGoals;
				$scope.visitingScoreSummary.push(visitingPeriodGoals);
				visitingPeriodTotal += parseInt(visitingPeriodGoals, 10) || 0;
			}
			if ($scope.gameSummary.hasShootout) {
				// SO column = total - regulation/OT period sum. For clients with count_all_shootout_goals
				// this is the actual number of shootout round goals scored (LEAGUE-3090).
				// For most clients this is 0 or 1 (winner bump)
				$scope.visitingScoreSummary.push(
					Math.max(0, ($scope.gameSummary.visitingTeam.stats.goals || 0) - visitingPeriodTotal)
				);
			}
			$scope.visitingScoreSummary.push($scope.gameSummary.visitingTeam.stats.goals);

			$scope.visitingScoreSummary.push(
				$scope.gameSummary.visitingTeam.stats.powerPlayGoals.toString() +
				" / " +
				$scope.gameSummary.visitingTeam.stats.powerPlayOpportunities.toString()
			);

			// home team scoring
			$scope.homeScoreSummary = [];
			var homePeriodTotal = 0;
			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				var homePeriodGoals = $scope.gameSummary.periods[period].stats.homeGoals;
				$scope.homeScoreSummary.push(homePeriodGoals);
				homePeriodTotal += parseInt(homePeriodGoals, 10) || 0;
			}
			if ($scope.gameSummary.hasShootout) {
				$scope.homeScoreSummary.push(
					Math.max(0, ($scope.gameSummary.homeTeam.stats.goals || 0) - homePeriodTotal)
				);
			}
			$scope.homeScoreSummary.push($scope.gameSummary.homeTeam.stats.goals);

			$scope.homeScoreSummary.push(
				$scope.gameSummary.homeTeam.stats.powerPlayGoals.toString() +
				" / " +
				$scope.gameSummary.homeTeam.stats.powerPlayOpportunities.toString()
			);

			// Create Shots box info
			// headers
			$scope.shotSummaryHeadings = [];
			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				$scope.shotSummaryHeadings.push($scope.gameSummary.periods[period].info.shortName);
			}
			if ($scope.gameSummary.hasShootout) $scope.shotSummaryHeadings.push($scope.svfLang.Shootout_Abbrev);
			$scope.shotSummaryHeadings.push($scope.svfLang.Total);
			// visiting shots
			$scope.visitingShotSummary = [];
			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				$scope.visitingShotSummary.push($scope.gameSummary.periods[period].stats.visitingShots);
			}
			if ($scope.gameSummary.hasShootout) {
				if ($scope.gameSummary.visitingTeam.stats.goals > $scope.gameSummary.homeTeam.stats.goals) {
					$scope.visitingShotSummary.push(1);
				}
				else {
					$scope.visitingShotSummary.push(0);
				}
			}
			$scope.visitingShotSummary.push($scope.gameSummary.visitingTeam.stats.shots);
			// home shots
			$scope.homeShotSummary = [];
			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				$scope.homeShotSummary.push($scope.gameSummary.periods[period].stats.homeShots);
			}
			if ($scope.gameSummary.hasShootout) {
				if ($scope.gameSummary.homeTeam.stats.goals > $scope.gameSummary.visitingTeam.stats.goals) {
					$scope.homeShotSummary.push(1);
				}
				else {
					$scope.homeShotSummary.push(0);
				}
			}
			$scope.homeShotSummary.push($scope.gameSummary.homeTeam.stats.shots);

			for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
				for (var goalIndex = 0; goalIndex < $scope.gameSummary.periods[period].goals.length; goalIndex++) {
					var props = $scope.gameSummary.periods[period].goals[goalIndex].properties;
					var allGoalPropertiesOb = [];
					if (props.isPowerPlay == '1') {
						allGoalPropertiesOb.push($scope.svfLang.PP);
					}
					if (props.isEmptyNet == '1') {
						allGoalPropertiesOb.push($scope.svfLang.EN);
					}
					if (props.isShortHanded == '1') {
						allGoalPropertiesOb.push($scope.svfLang.SHAND);
					}
					if (props.isPenaltyShot == '1') {
						allGoalPropertiesOb.push($scope.svfLang.PS);
					}
					$scope.gameSummary.periods[period].goals[goalIndex].properties.allGoalProperties = allGoalPropertiesOb.join(', ');
				}
			}
		};

		$scope.getData = function (gameId) {
			var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=gameSummary' +
				'&game_id=' + gameId +
				'&key=' + appKey +
				'&site_id=' + site_id +
				'&client_code=' + clientCode +
				'&lang=' + svf_language +
				'&league_id=' + leagueId +
				'&callback=JSON_CALLBACK';

			return $http({ method: 'jsonp', url: url })
				.success(function (data) {

					$rootScope.feedUrl = url;
					$scope.gameSummary = data;

					$scope.gameSummaryId = data.details.id;

					$scope.gameSummarySeasonId = data.details.seasonId;

					// Create Scoring box info
					$scope.createScoringBox();

					$scope.dataLoaded = true;
					$scope.loading = false;

					var awayTeam = $scope.gameSummary.visitingTeam.info.name;
					var homeTeam = $scope.gameSummary.homeTeam.info.name;

					$rootScope.seoTitle = awayTeam + ' @ ' + homeTeam + ' ' + $scope.gameSummary.details.date;

					$scope.defaultNoPic = 'https://lscluster.hockeytech.com/statview-1.4.1/img/headshot-default.jpg';
					if ($scope.playerNoPicLogoOverride) {
						$scope.defaultNoPic = $scope.playerNoPicLogoOverride;
					}

					var setPath = baseRoute + $scope.pageName;
					if ($routeParams.gameId) {
						setPath = setPath + '/' + $routeParams.gameId;
					}
					$rootScope.seoPath = setPath;

				})
				.error(function (data, status, headers, config) {
					$scope.loadError = true;
				});
		};

		HockeyTechService.getGameSettings($scope.gameId).then(function (data) {

			// Season specific appsettings to use
			$scope.track_faceoffs = data.track_faceoffs;
			$scope.track_hits = data.track_hits;

			var bootstrapPromise = HockeyTechService.bootstrap(null, 'game-summary', league, leagueCode, svf_language, $scope.gameId).then(function (data) {
				$scope.firebaseUrl = data.firebaseUrl;
				$scope.firebaseToken = data.firebaseToken;
				$scope.firebaseApiKey = data.firebaseApiKey;
				$scope.showAd = (typeof data.svfConfig.daily_schedule.show_ad != 'undefined') ? data.svfConfig.daily_schedule.show_ad : false;
				$scope.linkCoaches = (typeof data.svfConfig.link_coaches != 'undefined') ? data.svfConfig.link_coaches : false;
				$scope.svfConfig = data.svfConfig;

				$scope.hidePlayerPlusMinus = (typeof $scope.svfConfig.game_summary != 'undefined' && typeof $scope.svfConfig.game_summary.hidePlayerPlusMinus != 'undefined')
					? $scope.svfConfig.game_summary.hidePlayerPlusMinus
					: false;
				$scope.hidePlayerShots = (typeof $scope.svfConfig.game_summary != 'undefined' && typeof $scope.svfConfig.game_summary.hidePlayerShots != 'undefined')
					? $scope.svfConfig.game_summary.hidePlayerShots
					: false;

				$scope.svfLang = data.svfLang;
				$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;
				return $scope.getGameData(); // Return promise of when getGameData will resolve

			}).catch(function () {
				$scope.loadError = true;
			});

			bootstrapPromise.then(function () {
				if (!$scope.svfConfig.liveScoreUpdates) {
					return;
				}

				var fbGoalSummary;
				var fbShotSummary;
				var langId = $scope.language == "en" ? 1 : 2;

				// If the game is not final, subscribe to Firebase updates
				if ($scope.gameSummary.details.final != 1) {
					svfFb.authenticate($scope.firebaseUrl, $scope.firebaseApiKey);

					$scope.updateClockWithFbData = function (fbClockData) {

						if ($scope.gameSummary && fbClockData) {

							var newProgressString;

							//game in progress
							if (fbClockData.StatusId == '2') {

								// Clock values we are going to use:
								var clockMinutes = fbClockData.ClockMinutes < 10 ? '0' + fbClockData.ClockMinutes.toString() : fbClockData.ClockMinutes.toString();
								var clockSeconds = fbClockData.ClockSeconds < 10 ? '0' + fbClockData.ClockSeconds.toString() : fbClockData.ClockSeconds.toString();

								// We need to update the 'fbClockData.ProgressString' with data in the fbClockData
								//  object. Because the 'fbClockData.ProgressString' format comes from deep in the dart depths
								//  of Leaguestat, we go out of our way not to recreate it. I say this to justify the trick
								//  I'm about to code... Proceed with caution:

								// Split the progress sting into 5 components
								//  eg. "In Progress (05:31 remaining in 1st)".split(/([(:])/g) == ["In Progress ", "(", "05", ":", "31 remaining in 1st)"]
								var splitProgressString = fbClockData.ProgressString.split(/([(:])/g);
								if (splitProgressString.length != 5) {
									console.log("ERROR: GameSummaryCtrl::updateClockWithFbData saw an invalid splitProgressString", splitProgressString);
									return;
								}

								// Replace the minutes
								splitProgressString[2] = clockMinutes;

								// Replace the seconds
								var splitSecondsString = splitProgressString[4].split(/( )/g);
								splitSecondsString[0] = clockSeconds;
								splitProgressString[4] = splitSecondsString.join('');

								// Glue everything back together
								newProgressString = splitProgressString.join('');

							} else if (fbClockData.ProgressString) {
								newProgressString = fbClockData.ProgressString;
							}

							if (newProgressString) {
								$timeout(function () {
									$scope.gameSummary.details.status = newProgressString;
								});
							}
						}
					};

					svfFb.subscribeToGameClock(clientCode, $scope.gameId, langId, $scope.updateClockWithFbData);
					$scope.$on('$destroy', function () {
						svfFb.unsubscribeFromGameClock(clientCode, $scope.gameId, langId, $scope.updateClockWithFbData);
					});

					$scope.updateGoalSummaryWithFbData = function (fbGameGoalSummaryData) {
						fbGoalSummary = fbGameGoalSummaryData;
						$scope.updateSummaryData();
					};

					svfFb.subscribeToGameGoalSummary(clientCode, $scope.gameId, langId, $scope.updateGoalSummaryWithFbData);
					$scope.$on('$destroy', function () {
						svfFb.unsubscribeFromGameGoalSummary(clientCode, $scope.gameId, langId, $scope.updateGoalSummaryWithFbData);
					});

					$scope.updateShotSummaryWithFbData = function (fbGameShotSummaryData) {
						fbShotSummary = fbGameShotSummaryData;
						$scope.updateSummaryData();
					};

					svfFb.subscribeToGameShotSummary(clientCode, $scope.gameId, langId, $scope.updateShotSummaryWithFbData);
					$scope.$on('$destroy', function () {
						svfFb.unsubscribeFromGameShotSummary(clientCode, $scope.gameId, langId, $scope.updateShotSummaryWithFbData);
					});
				}

				$scope.updateSummaryData = function () {
					if ($scope.gameSummary) {

						if (fbGoalSummary && fbShotSummary) {

							$timeout(function () {

								// Update total goals
								$scope.gameSummary.homeTeam.stats.goals = fbGoalSummary.HomeGoalTotal;
								$scope.gameSummary.visitingTeam.stats.goals = fbGoalSummary.VisitorGoalTotal;

								// Update shot totals
								$scope.gameSummary.homeTeam.stats.shots = fbShotSummary.HomeShotTotal;
								$scope.gameSummary.visitingTeam.stats.shots = fbShotSummary.VisitorShotTotal;

								// Update shootout status
								$scope.gameSummary.hasShootout = fbGoalSummary.Shootout;

								// Update powerplay data
								$scope.gameSummary.homeTeam.stats.powerPlayGoals = fbGoalSummary.HomePowerPlayGoals;
								$scope.gameSummary.visitingTeam.stats.powerPlayGoals = fbGoalSummary.VisitorPowerPlayGoals;
								$scope.gameSummary.homeTeam.stats.powerPlayOpportunities = fbGoalSummary.HomePowerPlayAttempts;
								$scope.gameSummary.visitingTeam.stats.powerPlayOpportunities = fbGoalSummary.VisitorPowerPlayAttempts;

								// Update period specific data
								if (fbGoalSummary.PeriodsInfo) {

									angular.forEach($scope.gameSummary.periods, function (svPeriod) {
										svPeriod.dirty = true; // Set each period to 'dirty' so we can remove the 'dirty' ones after the FB update
									});

									// Update period specific info
									angular.forEach(fbGoalSummary.PeriodsInfo, function (periodInfo, periodId) {

										if (periodId) { // Needs to be here because sometimes firebase will give back undefined keys (the 'array problem')

											var periodExists = false;

											for (var key in $scope.gameSummary.periods) {
												if ($scope.gameSummary.periods[key] && $scope.gameSummary.periods[key].info) {
													var gameSummaryPeriodId = parseInt($scope.gameSummary.periods[key].info.id);

													if (parseInt(periodId) === gameSummaryPeriodId) {
														$scope.gameSummary.periods[key].stats.homeGoals = fbGoalSummary.HomeGoalsByPeriod[periodId].toString();
														$scope.gameSummary.periods[key].stats.visitingGoals = fbGoalSummary.VisitorGoalsByPeriod[periodId].toString();

														if (fbShotSummary.PeriodsInfo && fbShotSummary.PeriodsInfo[periodId]) { // Update the shots for this period if they are available
															$scope.gameSummary.periods[key].stats.homeShots = fbShotSummary.HomeShotsByPeriod[periodId].toString();
															$scope.gameSummary.periods[key].stats.visitingShots = fbShotSummary.VisitorShotsByPeriod[periodId].toString();
														}

														$scope.gameSummary.periods[key].dirty = false;
														periodExists = true;
														break;
													}
												}
											}

											if (!periodExists) {

												var newGameDataPeriod = {
													info: { shortName: periodInfo.ShortName, longName: periodInfo.LongName },
													stats: {
														homeGoals: fbGoalSummary.HomeGoalsByPeriod[periodId].toString(),
														visitingGoals: fbGoalSummary.VisitorGoalsByPeriod[periodId].toString()
													},
													goals: [], // TODO: when we want to add Firebase goals, do this here.
													penalties: [] // TODO: when we want to add Firebase penalties, do this here.
												};

												if (fbShotSummary.PeriodInfo && fbShotSummary.PeriodInfo[periodId]) { // Update the shots for this period if they are available
													newGameDataPeriod.stats.homeShots = fbShotSummary.HomeShotsByPeriod[periodId].toString();
													newGameDataPeriod.stats.visitingShots = fbShotSummary.VisitorShotsByPeriod[periodId].toString();
												}

												$scope.gameSummary.periods.push(newGameDataPeriod);
											}
										}
									});

									// Remove all the 'dirty' periods (ie. periods we don't want anymore)
									$scope.gameSummary.periods = $scope.gameSummary.periods.filter(function (svPeriod) {
										return !svPeriod.dirty;
									});

									// Trigger the scorebox to be re-created
									$scope.createScoringBox();

								}
							});
						}
					}
				};
			});

		}).catch(function () {
			$scope.loadError = true;
		});
	}]);

app.controller('GameCenterCtrl', ['$scope', '$http', '$rootScope', '$routeParams', '$location', '$compile', 'HockeyTechService', '$interval', '$route', '$timeout', 'svfFb',
	function ($scope, $http, $rootScope, $routeParams, $location, $compile, HockeyTechService, $interval, $route, $timeout, svfFb) {
		$scope.pageName = $route.current.$$route.name;
		var svf_language = $route.current.$$route.language;
		$scope.language = svf_language;
		//check if flosports
		$scope.isFloSports = floSvf;

		$scope.urlRoster = "roster";
		$scope.urlPlayerStats = "player-stats";
		$scope.urlPlayer = "player";
		$scope.urlGameCenter = "game-center";
		$scope.urlCoach = "coach";

		if (svf_language == 'fr') {
			$scope.urlRoster = "alignement";
			$scope.urlPlayerStats = "statistiques-des-joueurs";
			$scope.urlPlayer = "joueur";
			$scope.urlGameCenter = "game-centre";
			$scope.urlCoach = "entraineur";
		}

		if (!html5ModeEnabled) {
			$scope.linkPrefix = '#/';
		} else {
			$scope.linkPrefix = baseRoute;
		}

		$scope.floUtm = '?utm_medium=partner&utm_source=leaguestatwatchnow&utm_content=watchgame&utm_campaign=' + clientCode;
		$scope.gameId = $routeParams.gameId;

		var svfVersion = 'statview-1.4.1';
		// this increments like r1, r2, r3, etc.
		var svfRevision = 'r1';

		$scope.PlayByPlayTemplate = prodUrl + '/' + svfVersion + '/views/play-by-play.' + svfRevision + '.html';

		$scope.client_code = clientCode;

		var league = '';
		if ($routeParams.hasOwnProperty("league")) {
			league = $routeParams.league;
		}
		var leagueCode = '';
		if ($routeParams.hasOwnProperty("league_code")) {
			leagueCode = $routeParams.league_code;
		}

		$scope.PreviewDataLoaded = false;
		$scope.dataLoaded = false;
		$scope.PlayByPlayDataLoaded = false;
		$scope.loading = true;
		$scope.onPageLoad = true;
		$scope.gameStarted = false;
		$scope.gameFinished = false;

		$scope.showHeatmap = false;
		$scope.showHomeHeatmap = true;
		$scope.showAwayHeatmap = true;

		// Stores of data from Firebase
		var fbClockData;
		var fbGoalSummary;
		var fbShotSummary;
		var fbPenaltySummary;

		//show hide events by type
		$scope.showhideevents = function (value) {
			if ($scope[value] == true) {
				$scope[value] = false;
				//if faceoff turn everything back on
				if (value == 'ht_faceoff') {
					$scope.ht_goal = true;
					$scope.ht_shot = true;
					$scope.ht_hit = true;
				}
			} else {
				$scope[value] = true;
				//if faceoff turn everything else off
				if (value == 'ht_faceoff') {
					$scope.ht_goal = false;
					$scope.ht_shot = false;
					$scope.ht_hit = false;
				}
			}
			if ($scope.showHeatmap) {
				refreshHeatmap();
			}
		}

		$scope.showPin = function (pinId) {
			var headShotDefault = "https://lscluster.hockeytech.com/statview-1.4.1/img/headshot-default.jpg";
			var locatePin = pinId.replace('ht_pin_', '');
			var visitingTeam = $scope.gameSummary.visitingTeam.info.id;
			var homeTeam = $scope.gameSummary.homeTeam.info.id;
			var currentPin = $scope.gamePBP[locatePin];
			var eventType = currentPin.event;
			var periodName = currentPin.details.period.longName;
			var pinContainerShot = angular.element(document.querySelector('#ht-show-pin-shot'));
			var pinContainerGoal = angular.element(document.querySelector('#ht-show-pin-goal'));
			var pinContainerHit = angular.element(document.querySelector('#ht-show-pin-hit'));
			var pinHTML = "";
			if (eventType == 'shot') {

				pinHTML = "<div class='ht-pin-header'>";
				pinHTML = pinHTML + "<span class='ht-pin-period'>" + periodName + " " + currentPin.details.time + "</span>";
				pinHTML = pinHTML + "<span class='ht-pin-close' ng-click='hidePin()'>X</span>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "<div class='ht-pin-container'>";
				pinHTML = pinHTML + "<div class='ht-pin-player-container'>";
				pinHTML = pinHTML + "<div class='ht-pin-headshot'>";
				pinHTML = pinHTML + "<img ng-src='https://assets.leaguestat.com/" + $scope.client_code + "/120x160/" + currentPin.details.shooter.id + ".jpg' on-error=" + headShotDefault + ">";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "<div class='ht-pin-data'>";
				pinHTML = pinHTML + "<div class='ht-pin-event' ng-if='" + visitingTeam + "==" + currentPin.details.shooterTeamId + "'><span class='ht-visitingteam'>" + $scope.svfLang.Shot + "</span><span class='ht-shot-goal' ng-if='" + currentPin.details.isGoal + "'>" + $scope.svfLang.Goal + "</span></div>";
				pinHTML = pinHTML + "<div class='ht-pin-event' ng-if='" + homeTeam + "==" + currentPin.details.shooterTeamId + "'><span class='ht-hometeam'>" + $scope.svfLang.Shot + "</span><span class='ht-shot-goal' ng-if='" + currentPin.details.isGoal + "'>" + $scope.svfLang.Goal + "</span></div>";
				pinHTML = pinHTML + "<div class='ht-pin-player'><span class='ht-pin-num'>#" + currentPin.details.shooter.jerseyNumber + "</span>&nbsp;<a ng-href='" + $scope.linkPrefix + $scope.urlPlayer + "/" + currentPin.details.shooter.id + "' target='_self'>" + currentPin.details.shooter.firstName + " " + currentPin.details.shooter.lastName + "</a>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "<div class='ht-pin-player-container'>";
				pinHTML = pinHTML + "<div class='ht-pin-headshot'>";
				pinHTML = pinHTML + "<img ng-src='https://assets.leaguestat.com/" + $scope.client_code + "/120x160/" + currentPin.details.goalie.id + ".jpg' on-error=" + headShotDefault + ">";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "<div class='ht-pin-data'>";
				pinHTML = pinHTML + "<div class='ht-pin-event' ng-if='" + visitingTeam + "!=" + currentPin.details.shooterTeamId + "'><span class='ht-visitingteam'>" + $scope.svfLang.Goalie + "</span></div>";
				pinHTML = pinHTML + "<div class='ht-pin-event' ng-if='" + homeTeam + "!=" + currentPin.details.shooterTeamId + "'><span class='ht-hometeam'>" + $scope.svfLang.Goalie + "</span></div>";
				pinHTML = pinHTML + "<div class='ht-pin-player'><span class='ht-pin-num'>#" + currentPin.details.goalie.jerseyNumber + "</span>&nbsp;<a ng-href='" + $scope.linkPrefix + $scope.urlPlayer + "/" + currentPin.details.goalie.id + "' target='_self'>" + currentPin.details.goalie.firstName + " " + currentPin.details.goalie.lastName + "</a>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";

				//compile pin data
				var pinDataHTML = angular.element(pinHTML);
				pinContainerGoal.html($compile(pinDataHTML)($scope));
				//show popup
				$scope.htPinShotPopup = false;
				$scope.htPinHitPopup = false;
				$scope.htPinGoalPopup = true;

			} else if (eventType == 'goal') {

				pinHTML = "<div class='ht-pin-header'>";
				pinHTML = pinHTML + "<span class='ht-pin-period'>" + periodName + " " + currentPin.details.time + "</span>";
				pinHTML = pinHTML + "<span class='ht-pin-close' ng-click='hidePin()'>X</span>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "<div class='ht-pin-container'>";
				pinHTML = pinHTML + "<div class='ht-pin-player-container'>";
				pinHTML = pinHTML + "<div class='ht-pin-headshot'>";
				pinHTML = pinHTML + "<img ng-src='https://assets.leaguestat.com/" + $scope.client_code + "/120x160/" + currentPin.details.scoredBy.id + ".jpg' on-error=" + headShotDefault + ">";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "<div class='ht-pin-data'>";
				pinHTML = pinHTML + "<div class='ht-pin-event' ng-if='" + visitingTeam + "==" + currentPin.details.team.id + "'><span class='ht-visitingteam'>" + $scope.svfLang.Goal + "</span></div>";
				pinHTML = pinHTML + "<div class='ht-pin-event' ng-if='" + homeTeam + "==" + currentPin.details.team.id + "'><span class='ht-hometeam'>" + $scope.svfLang.Goal + "</span></div>";
				pinHTML = pinHTML + "<div class='ht-pin-player'><span class='ht-pin-num'>#" + currentPin.details.scoredBy.jerseyNumber + "</span>&nbsp;<a ng-href='" + $scope.linkPrefix + $scope.urlPlayer + "/" + currentPin.details.scoredBy.id + "' target='_self'>" + currentPin.details.scoredBy.firstName + " " + currentPin.details.scoredBy.lastName + "</a></div>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";
				pinHTML = pinHTML + "</div>";

				//compile pin data
				var pinDataHTML = angular.element(pinHTML);
				pinContainerShot.html($compile(pinDataHTML)($scope));
				//show popup
				$scope.htPinGoalPopup = false;
				$scope.htPinHitPopup = false;
				$scope.htPinShotPopup = true;

			} else if (eventType == 'hit') {
				pinHTML = "<div class='ht-pin-header'>";
				pinHTML += "<span class='ht-pin-period'>" + periodName + " " + currentPin.details.time + "</span>";
				pinHTML += "<span class='ht-pin-close' ng-click='hidePin()'>X</span>";
				pinHTML += "</div>";
				pinHTML += "<div class='ht-pin-container'>";
				pinHTML += "<div class='ht-pin-player-container'>";
				pinHTML += "<div class='ht-pin-headshot'>";
				pinHTML += "<img ng-src='" + currentPin.details.player.playerImageURL + "' on-error=" + headShotDefault + ">";
				pinHTML += "</div>";
				pinHTML += "<div class='ht-pin-data'>";
				pinHTML += "<div class='ht-pin-event' ng-if='" + visitingTeam + "==" + currentPin.details.teamId + "'><span class='ht-visitingteam'>" + $scope.svfLang.HitBy + "</span></div>";
				pinHTML += "<div class='ht-pin-event' ng-if='" + homeTeam + "==" + currentPin.details.teamId + "'><span class='ht-hometeam'>" + $scope.svfLang.HitBy + "</span></div>";
				pinHTML += "<div class='ht-pin-player'><span class='ht-pin-num'>#" + currentPin.details.player.jerseyNumber + "</span>&nbsp;<a ng-href='" + $scope.linkPrefix + $scope.urlPlayer + "/" + currentPin.details.player.id + "' target='_self'>" + currentPin.details.player.firstName + " " + currentPin.details.player.lastName + "</a>";
				pinHTML += "</div>";
				pinHTML += "</div>";
				pinHTML += "</div>";
				if (currentPin.details.onPlayer && currentPin.details.onPlayer.id && currentPin.details.onPlayer.id > 0) {
					pinHTML += "<div class='ht-pin-player-container'>";
					pinHTML += "<div class='ht-pin-headshot'>";
					pinHTML += "<img ng-src='" + currentPin.details.onPlayer.playerImageURL + "' on-error=" + headShotDefault + ">";
					pinHTML += "</div>";
					pinHTML += "<div class='ht-pin-data'>";
					pinHTML += "<div class='ht-pin-event' ng-if='" + visitingTeam + "!=" + currentPin.details.teamId + "'><span class='ht-visitingteam'>" + $scope.svfLang.On + "</span></div>";
					pinHTML += "<div class='ht-pin-event' ng-if='" + homeTeam + "!=" + currentPin.details.teamId + "'><span class='ht-hometeam'>" + $scope.svfLang.On + "</span></div>";
					pinHTML += "<div class='ht-pin-player'><span class='ht-pin-num'>#" + currentPin.details.onPlayer.jerseyNumber + "</span>&nbsp;<a ng-href='" + $scope.linkPrefix + $scope.urlPlayer + "/" + currentPin.details.onPlayer.id + "' target='_self'>" + currentPin.details.onPlayer.firstName + " " + currentPin.details.onPlayer.lastName + "</a>";
					pinHTML += "</div>";
					pinHTML += "</div>";
				}
				pinHTML += "</div>";
				pinHTML += "</div>";

				//compile pin data
				let pinDataHTML = angular.element(pinHTML);
				pinContainerHit.html($compile(pinDataHTML)($scope));
				//show popup
				$scope.htPinShotPopup = false;
				$scope.htPinGoalPopup = false;
				$scope.htPinHitPopup = true;
			}
		}

		$scope.hidePin = function () {
			$scope.htPinShotPopup = false;
			$scope.htPinGoalPopup = false;
			$scope.htPinHitPopup = false;
		};

		var updateClockWithFbData = function () {

			$timeout(function () {

				if ($scope.gameSummary && fbClockData) {

					var newProgressString;

					//game in progress
					if (fbClockData.StatusId == '2') {
						$scope.gameStarted = true;

						// Clock values we are going to use:
						var clockMinutes = fbClockData.ClockMinutes < 10 ? '0' + fbClockData.ClockMinutes.toString() : fbClockData.ClockMinutes.toString();
						var clockSeconds = fbClockData.ClockSeconds < 10 ? '0' + fbClockData.ClockSeconds.toString() : fbClockData.ClockSeconds.toString();

						// We need to update the 'fbClockData.ProgressString' with data in the fbClockData
						//  object. Because the 'fbClockData.ProgressString' format comes from deep in the dart depths
						//  of Leaguestat, we go out of our way not to recreate it. I say this to justify the trick
						//  I'm about to code... Proceed with caution:

						// Split the progress sting into 5 components
						//  eg. "In Progress (05:31 remaining in 1st)".split(/([(:])/g) == ["In Progress ", "(", "05", ":", "31 remaining in 1st)"]
						var splitProgressString = fbClockData.ProgressString.split(/([(:])/g);
						if (splitProgressString.length != 5) {
							console.log("ERROR: GameSummaryCtrl::updateClockWithFbData saw an invalid splitProgressString", splitProgressString);
							return;
						}

						// Replace the minutes
						splitProgressString[2] = clockMinutes;

						// Replace the seconds
						var splitSecondsString = splitProgressString[4].split(/( )/g);
						splitSecondsString[0] = clockSeconds;
						splitProgressString[4] = splitSecondsString.join('');

						// Glue everything back together
						newProgressString = splitProgressString.join('');

					} else if (fbClockData.ProgressString) {
						newProgressString = fbClockData.ProgressString;

						if (fbClockData.StatusId == '1') {
							$scope.gameStarted = false;
						}

					}

					if (newProgressString) {
						$scope.gameSummary.details.status = newProgressString;
					}
				}

			});

		};

		var updateSummaryWithFbData = function () {
			if ($scope.gameSummary && fbGoalSummary && fbShotSummary && fbPenaltySummary) {

				var svGameId = parseInt($scope.gameSummary.details.id);
				var svGame = $scope.gameSummary;

				$timeout(function () {

					// Update total goals
					$scope.gameSummary.homeTeam.stats.goals = fbGoalSummary.HomeGoalTotal;
					$scope.gameSummary.visitingTeam.stats.goals = fbGoalSummary.VisitorGoalTotal;

					// Update shot totals
					$scope.gameSummary.homeTeam.stats.shots = fbShotSummary.HomeShotTotal;
					$scope.gameSummary.visitingTeam.stats.shots = fbShotSummary.VisitorShotTotal;

					// Update shootout status
					$scope.gameSummary.hasShootout = fbGoalSummary.Shootout;

					// Update powerplay data
					$scope.gameSummary.homeTeam.stats.powerPlayGoals = fbGoalSummary.HomePowerPlayGoals;
					$scope.gameSummary.visitingTeam.stats.powerPlayGoals = fbGoalSummary.VisitorPowerPlayGoals;
					$scope.gameSummary.homeTeam.stats.powerPlayOpportunities = fbGoalSummary.HomePowerPlayAttempts;
					$scope.gameSummary.visitingTeam.stats.powerPlayOpportunities = fbGoalSummary.VisitorPowerPlayAttempts;
					$scope.gameSummary.homeTeam.stats.infractionCount = fbPenaltySummary.HomeInfractionsTotal;
					$scope.gameSummary.visitingTeam.stats.infractionCount = fbPenaltySummary.VisitorInfractionsTotal;
					$scope.gameSummary.homeTeam.stats.penaltyMinuteCount = fbPenaltySummary.HomePIMTotal;
					$scope.gameSummary.visitingTeam.stats.penaltyMinuteCount = fbPenaltySummary.VisitorPIMTotal;

					// Update goal and assist counts
					$scope.gameSummary.homeTeam.stats.goalCount = fbGoalSummary.HomeGoalTotal;
					$scope.gameSummary.visitingTeam.stats.goalCount = fbGoalSummary.VisitorGoalTotal;
					$scope.gameSummary.homeTeam.stats.assistCount = fbGoalSummary.HomeAssistPoints;
					$scope.gameSummary.visitingTeam.stats.assistCount = fbGoalSummary.VisitorAssistPoints;

					// Update period specific data
					if (fbGoalSummary.PeriodsInfo) {

						angular.forEach($scope.gameSummary.periods, function (svPeriod) {
							svPeriod.dirty = true; // Set each period to 'dirty' so we can remove the 'dirty' ones after the FB update
						});

						// Update period specific info
						angular.forEach(fbGoalSummary.PeriodsInfo, function (periodInfo, periodId) {

							if (periodId) { // Needs to be here because sometimes firebase will give back undefined keys (the 'array problem')

								var periodExists = false;

								for (var key in $scope.gameSummary.periods) {
									var gameSummaryPeriodId = parseInt($scope.gameSummary.periods[key].info.id);

									if (parseInt(periodId) === gameSummaryPeriodId) {
										$scope.gameSummary.periods[key].stats.homeGoals = fbGoalSummary.HomeGoalsByPeriod[periodId].toString();
										$scope.gameSummary.periods[key].stats.visitingGoals = fbGoalSummary.VisitorGoalsByPeriod[periodId].toString();

										if (fbShotSummary.PeriodsInfo && fbShotSummary.PeriodsInfo[periodId]) { // Update the shots for this period if they are available
											$scope.gameSummary.periods[key].stats.homeShots = fbShotSummary.HomeShotsByPeriod[periodId].toString();
											$scope.gameSummary.periods[key].stats.visitingShots = fbShotSummary.VisitorShotsByPeriod[periodId].toString();
										}

										$scope.gameSummary.periods[key].dirty = false;
										periodExists = true;
										break;
									}
								}

								if (!periodExists) {

									var newGameDataPeriod = {
										info: { shortName: periodInfo.ShortName, longName: periodInfo.LongName },
										stats: {
											homeGoals: fbGoalSummary.HomeGoalsByPeriod[periodId].toString(),
											visitingGoals: fbGoalSummary.VisitorGoalsByPeriod[periodId].toString()
										},
										goals: [], // TODO: when we want to add Firebase goals, do this here.
										penalties: [] // TODO: when we want to add Firebase penalties, do this here.
									};

									if (fbShotSummary.PeriodInfo && fbShotSummary.PeriodInfo[periodId]) { // Update the shots for this period if they are available
										newGameDataPeriod.stats.homeShots = fbShotSummary.HomeShotsByPeriod[periodId].toString();
										newGameDataPeriod.stats.visitingShots = fbShotSummary.VisitorShotsByPeriod[periodId].toString();
									}

									$scope.gameSummary.periods.push(newGameDataPeriod);
								}
							}

						});

						// Remove all the 'dirty' periods (ie. periods we don't want anymore)
						$scope.gameSummary.periods = $scope.gameSummary.periods.filter(function (svPeriod) {
							return !svPeriod.dirty;
						});

					}

				});

			}
		};


		// Updates the 'summary area' of the game center (ie. scoring summary, shots on goal summary and penalty/points summary)
		var updateSummaryArea = function () {

			// Update goal summary
			if ($scope.gameSummary) {

				$timeout(function () {

					// Create Scoring box info
					// headers
					$scope.scoreSummaryHeadings = [];
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						$scope.scoreSummaryHeadings.push($scope.gameSummary.periods[period].info.shortName);
					}
					if ($scope.gameSummary.hasShootout) $scope.scoreSummaryHeadings.push("SO");
					$scope.scoreSummaryHeadings.push("T");

					// visiting team scoring
					$scope.visitingScoreSummary = [];
					var visitingPeriodTotal = 0;
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						var visitingPeriodGoals = $scope.gameSummary.periods[period].stats.visitingGoals;
						$scope.visitingScoreSummary.push(visitingPeriodGoals);
						visitingPeriodTotal += parseInt(visitingPeriodGoals, 10) || 0;
					}
					if ($scope.gameSummary.hasShootout) {
						// SO column = total - regulation/OT period sum. LEAGUE-3090.
						$scope.visitingScoreSummary.push(
							Math.max(0, ($scope.gameSummary.visitingTeam.stats.goals || 0) - visitingPeriodTotal)
						);
					}
					$scope.visitingScoreSummary.push($scope.gameSummary.visitingTeam.stats.goals);

					// home team scoring
					$scope.homeScoreSummary = [];
					var homePeriodTotal = 0;
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						var homePeriodGoals = $scope.gameSummary.periods[period].stats.homeGoals;
						$scope.homeScoreSummary.push(homePeriodGoals);
						homePeriodTotal += parseInt(homePeriodGoals, 10) || 0;
					}
					if ($scope.gameSummary.hasShootout) {
						$scope.homeScoreSummary.push(
							Math.max(0, ($scope.gameSummary.homeTeam.stats.goals || 0) - homePeriodTotal)
						);
					}
					$scope.homeScoreSummary.push($scope.gameSummary.homeTeam.stats.goals);

					// Update shot summary
					// Create Shots box info
					// headers
					$scope.shotSummaryHeadings = [];
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						$scope.shotSummaryHeadings.push($scope.gameSummary.periods[period].info.shortName);
					}
					$scope.shotSummaryHeadings.push("T");
					// visiting shots
					$scope.visitingShotSummary = [];
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						$scope.visitingShotSummary.push($scope.gameSummary.periods[period].stats.visitingShots);
					}
					$scope.visitingShotSummary.push($scope.gameSummary.visitingTeam.stats.shots);
					// home shots
					$scope.homeShotSummary = [];
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						$scope.homeShotSummary.push($scope.gameSummary.periods[period].stats.homeShots);
					}
					$scope.homeShotSummary.push($scope.gameSummary.homeTeam.stats.shots);

					// Update penalty and points summary


					// Doing this thing... should probably be somewhere else?
					for (var period = 0; period < $scope.gameSummary.periods.length; period++) {
						for (var goalIndex = 0; goalIndex < $scope.gameSummary.periods[period].goals.length; goalIndex++) {
							var props = $scope.gameSummary.periods[period].goals[goalIndex].properties;
							var allGoalPropertiesOb = [];
							if (props.isPowerPlay == '1') {
								allGoalPropertiesOb.push('PP');
							}
							if (props.isEmptyNet == '1') {
								allGoalPropertiesOb.push('EN');
							}
							if (props.isShortHanded == '1') {
								allGoalPropertiesOb.push('SH');
							}
							if (props.isPenaltyShot == '1') {
								allGoalPropertiesOb.push('PS');
							}
							$scope.gameSummary.periods[period].goals[goalIndex].properties.allGoalProperties = allGoalPropertiesOb.join(', ');
						}
					}

				});
			}

		};

		$scope.getGameData = function () {
			if ($scope.gameId == null) {
				//Show some kind of message to the user, gameId is required.  They should not get here normally.
				console.log('Missing gameId');
				$scope.missingGameID = true;
				return $q(function (resolve, reject) {
					reject("Game id was missing");
				});
			} else {
				$scope.getAlltheData($scope.gameId);
			}
		};

		$scope.getAlltheData = function (gameId) {

			//get Game Center Preview
			$scope.gameCP = "";
			$scope.gameSummary = "";
			$scope.gamePBP = "";
			$scope.gameStarted = false;
			$scope.gameFinished = false;

			var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=gameCenterPreview' +
				'&game_id=' + gameId +
				'&key=' + appKey +
				'&client_code=' + clientCode +
				'&lang=' + svf_language +
				'&league_id=' + leagueId +
				'&callback=JSON_CALLBACK';

			$http({ method: 'jsonp', url: url })
				.success(function (dataPreview) {
					$scope.gameCP = dataPreview;
					$scope.getIntervalData(gameId);
				})
				.error(function (data, status, headers, config) {
					$scope.loadError = true;
				});
		}

		$scope.toggleHeatmap = function (showHeatmap) {
			$scope.showHeatmap = showHeatmap;

			if ($scope.showHeatmap) {
				refreshHeatmap();
			} else {
				refreshPins();
			}
		}

		function refreshPins() {
			showPins();
			removeHeatmapCanvases();
			plotPins();
		}

		function plotPins() {
			var realRinkX = 1005;
			var realRinkY = 430;
			var trumpRinkX = 600;
			var trumpRinkY = 300;

			$scope.PlayByPlayPeriodBreakdown = [];

			var periodContainer = angular.element(document.querySelector('#ht-period-buttons'));
			for (var index = 0; index < $scope.gameSummary.periods.length; index++) {
				var period = {};
				period.shortName = $scope.gameSummary.periods[index].info.shortName;
				period.longName = $scope.gameSummary.periods[index].info.longName;
				period.events = [];
				$scope.PlayByPlayPeriodBreakdown.push(period);

				//game play by play periods to display
				var pName = "ht_" + period.shortName;

				//check to see if already exists on the page
				var checkForPeriod = angular.element(document.querySelector('#ht-period-buttons #' + pName + '_button'));
				if (checkForPeriod.length == 0) {
					$scope[pName] = true;
					var periodHTML = "<div id='" + pName + "_button' class='ht-event-button-container'>";
					periodHTML = periodHTML + "<div class='ht-event-button'>";
					periodHTML = periodHTML + "<span ng-class='gcOnOfLabel'>" + period.longName + "</span>";
					periodHTML = periodHTML + "<div class='onoffswitch'>";
					periodHTML = periodHTML + "<input type='checkbox' name='" + pName + "' class='onoffswitch-checkbox' id='" + pName + "' ng-model='" + pName + "'  ng-click='showhideevents(" + pName + ")'>";
					periodHTML = periodHTML + "<label class='onoffswitch-label' for='" + pName + "'>";
					periodHTML = periodHTML + "<span class='onoffswitch-inner'></span>";
					periodHTML = periodHTML + "<span class='onoffswitch-switch'></span>";
					periodHTML = periodHTML + "</label></div></div></div>";
					var periodButtons = angular.element(periodHTML);
					periodContainer.append(periodButtons);
				}
			}
			if (periodContainer) {
				$compile(periodContainer)($scope);
			}
			//render ice rink pins

			var iceRinkContainer = angular.element(document.querySelector('#ht-icerink'));
			var isShootout = false;

			//faceoff locations
			$scope.foLocTotals = { 1: { H: 0, V: 0 }, 2: { H: 0, V: 0 }, 3: { H: 0, V: 0 }, 4: { H: 0, V: 0 }, 5: { H: 0, V: 0 }, 6: { H: 0, V: 0 }, 7: { H: 0, V: 0 }, 8: { H: 0, V: 0 }, 9: { H: 0, V: 0 } };
			//Center Ice (5), End North West (1), End South West (2), End North East (8), End South East (9)
			//Neutral North West (3), Neutral South West (4), Neutral North East (6), Neutral South East (7)

			for (var pin = 0; pin < $scope.gamePBP.length; pin++) {
				var currentGamePeriod = $scope.gameSummary.periods.length;
				var pinPeriod = ($scope.gamePBP[pin].hasOwnProperty("details") && $scope.gamePBP[pin].details.hasOwnProperty("period") &&
					$scope.gamePBP[pin].details.period.hasOwnProperty("id")) ? parseInt($scope.gamePBP[pin].details.period.id) : currentGamePeriod + 1;

				if ($scope.gamePBP[pin].event == "shootout") {
					if (!isShootout) {
						var shootout = {};
						shootout.shortName = "SO";
						shootout.longName = "Shootout";
						shootout.events = [];
						$scope.PlayByPlayPeriodBreakdown.push(shootout);
						period = $scope.PlayByPlayPeriodBreakdown.length;
						$scope.ht_SO = true;
						isShootout = true;
					}

					$scope.PlayByPlayPeriodBreakdown[period - 1].events.push($scope.gamePBP[pin]);

				} else if (pinPeriod <= currentGamePeriod) { // Don't show pins for events that are in future periods

					period = parseInt($scope.gamePBP[pin].details.period.id);
					$scope.PlayByPlayPeriodBreakdown[period - 1].events.push($scope.gamePBP[pin]);
					var pId = "ht_pin_" + pin;
					var pName = "ht_" + $scope.PlayByPlayPeriodBreakdown[period - 1].shortName;
					var eType = $scope.gamePBP[pin].event;
					var trumpX = $scope.gamePBP[pin].details.xLocation;
					var trumpY = $scope.gamePBP[pin].details.yLocation;
					var newX = trumpX * (realRinkX / trumpRinkX);
					var newY = trumpY * (realRinkY / trumpRinkY);
					var calcPerX = newX / realRinkX * 100;
					var calcPerY = newY / realRinkY * 100;
					var pinHTML = "";

					//check to see if the pin already exists
					var checkForPin = angular.element(document.querySelector('#ht-icerink #' + pId));
					if (checkForPin.length == 0) {

						if (eType == 'shot') {
							var teamHit = $scope.gamePBP[pin].details.shooterTeamId;
							if (teamHit == $scope.setHomeTeam) {
								isHomeVisit = "ht-gc-home-pin";
							} else {
								isHomeVisit = "ht-gc-visiting-pin";
							}

							pinHTML = "<div id='" + pId + "' ng-click=showPin('" + pId + "') ng-show='ht_shot && " + pName + "' class='ht-gc-pin " + isHomeVisit + "' style='top:" + calcPerY + "%;left:" + calcPerX + "%;'>";
							pinHTML = pinHTML + "<span class='ht-gc-pin-type'>S</span></div>";

						} else if (eType == 'hit') {
							var teamHit = $scope.gamePBP[pin].details.teamId;
							if (teamHit == $scope.setHomeTeam) {
								isHomeVisit = "ht-gc-home-pin";
							} else {
								isHomeVisit = "ht-gc-visiting-pin";
							}

							pinHTML = "<div id='" + pId + "' ng-click=showPin('" + pId + "') ng-show='ht_hit && " + pName + "' class='ht-gc-pin " + isHomeVisit + "' style='top:" + calcPerY + "%;left:" + calcPerX + "%;'>";
							pinHTML = pinHTML + "<span class='ht-gc-pin-type'>H</span></div>";

						} else if (eType == 'icing') {
							var teamHit = $scope.gamePBP[pin].details.teamId;
							if (teamHit == $scope.setHomeTeam) {
								isHomeVisit = "ht-gc-home-pin";
							} else {
								isHomeVisit = "ht-gc-visiting-pin";
							}

							pinHTML = "<div id='" + pId + "' ng-click=showPin('" + pId + "') ng-show='ht_icing && " + pName + "' class='ht-gc-pin " + isHomeVisit + "' style='top:" + calcPerY + "%;left:" + calcPerX + "%;'>";
							pinHTML = pinHTML + "<span class='ht-gc-pin-type'>I</span></div>";

						} else if (eType == 'offside') {
							var teamHit = $scope.gamePBP[pin].details.teamId;
							if (teamHit == $scope.setHomeTeam) {
								isHomeVisit = "ht-gc-home-pin";
							} else {
								isHomeVisit = "ht-gc-visiting-pin";
							}

							pinHTML = "<div id='" + pId + "' ng-click=showPin('" + pId + "') ng-show='ht_offside && " + pName + "' class='ht-gc-pin " + isHomeVisit + "' style='top:" + calcPerY + "%;left:" + calcPerX + "%;'>";
							pinHTML = pinHTML + "<span class='ht-gc-pin-type'>O</span></div>";
						} else if (eType == 'breakout') {
							var home = $scope.gamePBP[pin].details.home;
							if (home == 1) {
								isHomeVisit = "ht-gc-home-pin";
							} else {
								isHomeVisit = "ht-gc-visiting-pin";
							}

							pinHTML = "<div id='" + pId + "' ng-click=showPin('" + pId + "') ng-show='ht_breakout && " + pName + "' class='ht-gc-pin " + isHomeVisit + "' style='top:" + calcPerY + "%;left:" + calcPerX + "%;'>";
							pinHTML = pinHTML + "<span class='ht-gc-pin-type'>B</span></div>";
						} else if (eType == 'goal') {
							var teamHit = $scope.gamePBP[pin].details.team.id;
							if (teamHit == $scope.setHomeTeam) {
								isHomeVisit = "ht-gc-home-pin-goal";
							} else {
								isHomeVisit = "ht-gc-visiting-pin-goal";
							}

							pinHTML = "<div id='" + pId + "' ng-click=showPin('" + pId + "') ng-show='ht_goal && " + pName + "' class='ht-gc-pin " + isHomeVisit + "' style='top:" + calcPerY + "%;left:" + calcPerX + "%;'>";
							pinHTML = pinHTML + "<span class='ht-gc-pin-type'>G</span></div>";
						} else if (eType == 'faceoff') {
							var whoWon = $scope.gamePBP[pin].details.homeWin;
							var folocation;
							//Center Ice (5), End North West (1), End South West (2), End North East (8), End South East (9)
							//Neutral North West (3), Neutral South West (4), Neutral North East (6), Neutral South East (7)
							//trumpRinkX = 600;
							//trumpRinkY = 300;
							folocation = 1;
							//Center Ice (5)
							if (trumpX == 300 && trumpY == 150) {
								folocation = 5;
								//End North West (1)
							} else if (trumpX == 457 && trumpY == 206) {
								folocation = 1;
								//End South West (2)
							} else if (trumpX == 457 && trumpY == 49) {
								folocation = 2;
								//End North East (8)
							} else if (trumpX == 100 && trumpY == 206) {
								folocation = 8;
								//End South East (9)
							} else if (trumpX == 100 && trumpY == 49) {
								folocation = 9;
								//Neutral North West (3)
							} else if (trumpX == 353 && trumpY == 227) {
								folocation = 3;
								//Neutral South West (4)
							} else if (trumpX == 353 && trumpY == 27) {
								folocation = 4;
								//Neutral North East (6)
							} else if (trumpX == 203 && trumpY == 227) {
								folocation = 6;
								//Neutral South East (7)
							} else if (trumpX == 203 && trumpY == 27) {
								folocation = 7;
							}
							if (whoWon == 1) {
								$scope.foLocTotals[folocation].H += 1;
							} else if (whoWon == 0) {
								$scope.foLocTotals[folocation].V += 1;
							}
						}

						if (pinHTML != "") {
							var pinDrop = angular.element(pinHTML);
							iceRinkContainer.append(pinDrop);
						}
					}
				}
			}
			if (iceRinkContainer) {
				$compile(iceRinkContainer)($scope);
			}
		}

		function showPins() {
			let pins = document.querySelectorAll('.ht-gc-pin');

			pins.forEach(function (x, i) {
				x.style.display = "block";
			});
		}

		function hidePins() {
			let pins = document.querySelectorAll('.ht-gc-pin');

			pins.forEach(function (x, i) {
				x.style.display = "none";
			});
		}

		function refreshHeatmap() {
			hidePins();
			removeHeatmapCanvases();
			plotGameCenterHeatMap();
		}

		function removeHeatmapCanvases() {
			let canvases = document.querySelectorAll('.heatmap-canvas');

			canvases.forEach(function (x, i) {
				x.remove();
			});
		}

		function plotGameCenterHeatMap() {
			let heatmap = h337.create({
				container: document.querySelector('#ht-icerink')
			});

			setDimensions();

			const data = getGameCenterHeatMapData();
			if (data.data.length > 0) {
				heatmap.setData(data);
				heatmap.repaint();
			}
		};

		function setDimensions() {
			const rinkImage = document.getElementById('rinkImage');
			let heatmapCanvas = angular.element(document.querySelector('.heatmap-canvas'));
			heatmapCanvas.attr("height", rinkImage.height);
			heatmapCanvas.attr("width", rinkImage.width);
		}

		function matchesPeriodFilter(x) {
			for (var i = 0; i < $scope.gameSummary.periods.length; i++) {
				const pName = "ht_" + $scope.gameSummary.periods[i].info.shortName;
				if ($scope[pName] && x.details.period.shortName == $scope.gameSummary.periods[i].info.shortName) {
					return true;
				}
			}
			return false;
		}

		function matchesTeamFilter(x) {
			return ($scope.showHomeHeatmap && x.details.shooterTeamId == $scope.setHomeTeam) || ($scope.showAwayHeatmap && x.details.shooterTeamId == $scope.setVisitingTeam);
		}

		function getGameCenterHeatMapData() {
			const rawShots = $scope.gamePBP.filter(function (x) {
				return x.event == 'shot' && matchesPeriodFilter(x) && matchesTeamFilter(x)
			}).map(function (x) {
				return {
					xLocation: x.details.xLocation,
					yLocation: x.details.yLocation
				}
			});

			const rinkImage = document.getElementById('rinkImage');

			const baseWidth = 1005;
			const baseHeight = 430;

			const widthCoefficent = 1.68;
			const heightCoefficent = 1.4;

			const widthChange = (rinkImage.width * 100) / baseWidth;
			const xRatio = (widthChange * widthCoefficent) / 100;

			const heightChange = (rinkImage.height * 100) / baseHeight;
			const yRatio = (heightChange * heightCoefficent) / 100;

			let shotLocations = [];
			let max = 0;

			for (let i = 0; i < rawShots.length; i++) {
				let x = parseFloat(rawShots[i].xLocation);
				let y = parseFloat(rawShots[i].yLocation);

				const newX = Math.round(x * xRatio);
				const newY = Math.round(y * yRatio);

				let location = {
					x: newX,
					y: newY,
					radius: 17 * xRatio,
					value: 1,
				};
				shotLocations.push(location);
			}

			return { max: 1, data: shotLocations }
		}

		$scope.getIntervalData = function (gameId) {
			//get Game Summary Data
			var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=gameSummary' +
				'&game_id=' + gameId +
				'&key=' + appKey +
				'&site_id=' + site_id +
				'&client_code=' + clientCode +
				'&lang=' + $scope.language +
				'&league_id=' + leagueId +
				'&callback=JSON_CALLBACK';

			$http({ method: 'jsonp', url: url })
				.success(function (dataSumm) {
					$scope.gameSummary = dataSumm;
					$scope.setHomeTeam = $scope.gameSummary.homeTeam.info.id;
					$scope.setVisitingTeam = $scope.gameSummary.visitingTeam.info.id;
					var gcSeasonId = $scope.gameSummary.details.seasonId;
					//update teams by season
					HockeyTechService.getTeamsBySeasonId(gcSeasonId).then(function (teamdata) {
						$scope.teams = teamdata;
						$scope.visitLogo = "";
						$scope.homeLogo = "";
						var isDataObj = angular.isObject(teamdata);
						if (isDataObj) {
							var teamLogos = Object.keys(teamdata);
							for (var i = 0; i < teamLogos.length; ++i) {
								if (teamdata[i].id == $scope.setVisitingTeam) {
									$scope.visitLogo = teamdata[i].logo;
								}
							}
							for (var i = 0; i < teamLogos.length; ++i) {
								if (teamdata[i].id == $scope.setHomeTeam) {
									$scope.homeLogo = teamdata[i].logo;
								}
							}
						}
					});

					if ($scope.gameSummary.details.started == 1) {
						$scope.gameStarted = true;
					} else {
						$scope.gameStarted = false;
					}

					if ($scope.gameSummary.details.final == 1) {
						$scope.gameFinished = true;
					}

					$scope.vidUrl = $scope.gameSummary.homeTeam.media.videoUrl;
					if ($scope.vidUrl == '') {
						$scope.vidUrl = $scope.gameSummary.homeTeam.media.webcastUrl;
					} else {
						let vidUrl = new URL($scope.vidUrl);

						// Add the floUtm params if they are not set and the link is to flohockey
						if (vidUrl.hostname == "www.flohockey.tv") {
							let params = new URLSearchParams(vidUrl.search);

							// There is no guarantee the user will watch the game after following
							// whatever link was set, so the 'utm_content=watchgame' will be excluded
							if (!params.has("utm_medium")) {
								params.append("utm_medium", "partner");
							}
							if (!params.has("utm_source")) {
								params.append("utm_source", "leaguestatwatchnow");
							}
							if (!params.has("utm_campaign")) {
								params.append("utm_campaign", clientCode);
							}

							$scope.vidUrl = vidUrl.toString();
							if (params.toString() !== "") {
								$scope.vidUrl += "?" + params.toString();
							}
						}
					}

					var awayTeam = $scope.gameSummary.visitingTeam.info.name;
					var homeTeam = $scope.gameSummary.homeTeam.info.name;
					$rootScope.seoTitle = awayTeam + ' @ ' + homeTeam + ' ' + $scope.gameSummary.details.date;
					var setPath = baseRoute + $scope.pageName;
					if ($routeParams.gameId) {
						setPath = setPath + '/' + $routeParams.gameId;
					}
					$rootScope.seoPath = setPath;

					$scope.defaultNoPic = 'https://lscluster.hockeytech.com/statview-1.4.1/img/headshot-default.jpg';
					if ($scope.playerNoPicLogoOverride) {
						$scope.defaultNoPic = $scope.playerNoPicLogoOverride;
					}

					if ($scope.gameSummary.details.final != 1) {
						subscribeToFb();

						updateClockWithFbData();
						updateSummaryWithFbData();
					}

					// Update the goal, shot and penalty summary with our new data
					updateSummaryArea();

					//always require preview and summary
					$scope.PreviewDataLoaded = true;
					$scope.dataLoaded = true;

					//get game date
					var getGameDate = new Date($scope.gameSummary.details.date);
					var getTodaysDate = new Date();
					$scope.TodaysDate = getTodaysDate.getFullYear() + '-' + (getTodaysDate.getMonth() + 1) + '-' + getTodaysDate.getDate();
					$scope.GameDate = getGameDate.getFullYear() + '-' + (getGameDate.getMonth() + 1) + '-' + getGameDate.getDate();
					if (!$scope.gameFinished) {
						// Interval needs to be stopped and restarted.
						if (angular.isDefined($scope.upDateGameCenter)) {
							$interval.cancel($scope.upDateGameCenter);
						};
						//refresh interval 2 min
						$scope.upDateGameCenter = $interval(function () {
							$scope.getIntervalData($scope.gameId)
						}, 30000);
					} else if ($scope.TodaysDate == $scope.GameDate) {
						// Interval needs to be stopped
						if (angular.isDefined($scope.upDateGameCenter)) {
							$interval.cancel($scope.upDateGameCenter);
						};
					}

					//get Game Center Play By Play
					$scope.gamePBP = "";
					var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=gameCenterPlayByPlay' +
						'&game_id=' + $scope.gameId +
						'&key=' + appKey +
						'&client_code=' + clientCode +
						'&lang=' + $scope.language +
						'&league_id=' + leagueId +
						'&callback=JSON_CALLBACK';

					$http({ method: 'jsonp', url: url })
						.success(function (dataPlay) {
							$scope.gamePBP = dataPlay;

							if (dataPlay.length > 0) {
								$scope.PlayByPlayDataLoaded = true;

								if ($scope.showHeatmap) {
									refreshHeatmap();
								} else {
									refreshPins();
								}
								window.addEventListener('resize', function () {
									if ($scope.showHeatmap) {
										refreshHeatmap();
									}
								});
							}
							if ($scope.onPageLoad) {
								$scope.loading = false;
							}
						})
						.error(function (data, status, headers, config) {
							//  Do some error handling here
							$scope.loadError = true;
						});
				})
				.error(function (data, status, headers, config) {
					//  Do some error handling here
					$scope.loadError = true;
				});
		}

		// Logic related to orientation (0 means home team on right; 1 means home team on the left)
		$scope.orientation = 0;

		// Orientation 0 indicates that the home team is on the right, Orientation 1 indicates that the home team is on the left
		$scope.getPinTopPercent = function (gameEventY, gameEventOrientation) {
			var pinTopFraction = gameEventY / 350;
			if (gameEventOrientation != $scope.orientation) {
				pinTopFraction = 1 - pinTopFraction;
			}
			return 100 * pinTopFraction;
		};

		$scope.getPinLeftPercent = function (gameEventX, gameEventOrientation) {
			var pinLeftFraction = gameEventX / 700;
			if (gameEventOrientation != $scope.orientation) {
				pinLeftFraction = 1 - pinLeftFraction;
			}
			return 100 * pinLeftFraction;
		};

		$scope.getFaceoffTopPercent = function (gameEventY) {
			return $scope.getPinTopPercent(gameEventY, 0);
		};

		$scope.getFaceoffLeftPercent = function (gameEventX) {
			return $scope.getPinLeftPercent(gameEventX, 0);
		};

		let subscribeToFb = function () {
			if (!$scope.svfConfig.liveScoreUpdates) {
				return;
			}

			// Trigger the scorebox to be re-created
			svfFb.authenticate($scope.firebaseUrl, $scope.firebaseApiKey);

			var wrapUpdateClockWithFbData = function (fbGameClockData) {
				fbClockData = fbGameClockData;
				updateClockWithFbData();
			};

			svfFb.subscribeToGameClock(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, wrapUpdateClockWithFbData);
			$scope.$on('$destroy', function () {
				svfFb.unsubscribeFromGameClock(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, wrapUpdateClockWithFbData);
			});

			var updateGoalSummaryWithFbData = function (fbGameGoalSummaryData) {
				fbGoalSummary = fbGameGoalSummaryData;
				updateSummaryWithFbData();
				updateSummaryArea();
			};

			svfFb.subscribeToGameGoalSummary(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, updateGoalSummaryWithFbData);
			$scope.$on('$destroy', function () {
				svfFb.unsubscribeFromGameGoalSummary(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, updateGoalSummaryWithFbData);
			});

			var updatePenaltySummaryWithFbData = function (fbGamePenaltySummaryData) {
				fbPenaltySummary = fbGamePenaltySummaryData;
				updateSummaryWithFbData();
				updateSummaryArea();
			};

			svfFb.subscribeToGamePenaltySummary(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, updatePenaltySummaryWithFbData);
			$scope.$on('$destroy', function () {
				svfFb.unsubscribeFromGamePenaltySummary(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, updatePenaltySummaryWithFbData);
			});

			var updateShotSummaryWithFbData = function (fbGameShotSummaryData) {
				fbShotSummary = fbGameShotSummaryData;
				updateSummaryWithFbData();
				updateSummaryArea();
			};

			svfFb.subscribeToGameShotSummary(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, updateShotSummaryWithFbData);
			$scope.$on('$destroy', function () {
				svfFb.unsubscribeFromGameShotSummary(clientCode, $scope.gameId, $scope.language == 'en' ? 1 : 2, updateShotSummaryWithFbData);
			});
		};

		HockeyTechService.getGameSettings($scope.gameId).then(function (data) {
			//display rink
			$scope.displayrink = data.track_shot_location || data.track_hits;
			$scope.gameCenterHeatmap = data.game_center_heat_map;

			//game play by play types controls what is displayed by default
			//should get these values from the bootstrap cause all leagues have different types
			$scope.displaybreakouts = data.track_breakouts;
			$scope.displaygoal = true;
			$scope.displayshot = data.track_shot_location;
			$scope.displayhit = data.track_hits;
			$scope.displayicing = data.track_icing;
			$scope.displayOddManRush = data.track_odd_man_rush;
			$scope.displayoffside = data.track_offside;
			$scope.displayfaceoff = data.track_faceoffs;
			$scope.displaypenalty = true;
			$scope.displayBlockedShots = data.track_shots_blocked;
			$scope.displayWideShots = data.track_shots_wide;
			$scope.displayTimeouts = data.track_timeouts;

			//which events should be on by default
			$scope.ht_goalie_change = true;
			$scope.ht_goal = true;
			$scope.ht_blocked_shot = data.track_shots_blocked;
			$scope.ht_wide_shot = data.track_shots_wide;
			$scope.ht_shot = data.track_shots;
			$scope.ht_hit = data.track_hits;
			$scope.ht_icing = data.track_icing;
			$scope.ht_offside = data.track_offside;
			$scope.ht_breakout = data.track_breakouts;
			$scope.ht_faceoff = false;
			$scope.ht_penalty = true;
			$scope.ht_shootout = true;
			$scope.ht_penaltyshot = true;
			$scope.ht_timeouts = data.track_timeouts;
			$scope.ht_odd_man_rush = data.track_odd_man_rush;

			// random display options
			$scope.show_hits_on_roster = data.show_hits_on_roster;
			$scope.show_faceoffs_on_roster = data.show_faceoffs_on_roster;
			$scope.show_blocked_shots_on_roster = data.show_blocked_shots_on_roster;
			$scope.show_toi_on_roster = data.show_toi_on_roster;
			$scope.hide_pts_on_team_stats = data.hide_pts_on_team_stats;
			$scope.show_faceoffs_on_team_stats = data.show_faceoffs_on_team_stats;
		});

		HockeyTechService.bootstrap(null, 'game-summary', league, leagueCode, svf_language).then(function (data) {
			$scope.firebaseUrl = data.firebaseUrl;
			$scope.firebaseToken = data.firebaseToken;
			$scope.firebaseApiKey = data.firebaseApiKey;
			$scope.showAd = (typeof data.svfConfig.daily_schedule.show_ad != 'undefined') ? data.svfConfig.daily_schedule.show_ad : false;
			$scope.linkCoaches = (typeof data.svfConfig.link_coaches != 'undefined') ? data.svfConfig.link_coaches : false;
			$scope.svfConfig = data.svfConfig;
			$scope.svfLang = data.svfLang;
			$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;

			return $scope.getGameData(); // Return promise of when getGameData will resolve

		}).catch(function () {
			$scope.loadError = true;
		});
	}]);

app.controller('AllTimePlayerStatsCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, playerTypeOverride, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	$scope.language = svf_language;
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	HockeyTechService.bootstrap(-1, 'player-stats-all-time', league, leagueCode, svf_language).then(function (data) {
		$scope.quickViews = data.quickViews;
		$scope.selectedQuickView = $scope.quickViews[0];
		$scope.minimumGoalieMinutesForQualified = data.minimumGoalieMinutes;
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;
		$scope.setScopeFromUrl(playerTypeOverride);
		$scope.getData(
			$scope.playerType,
			$scope.currentPage,
			$scope.sortKey,
			$scope.selectedLeague.id,
			$scope.orderDirection
		);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.sortKey) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				if ($scope.playerType == 'goalie') {
					$scope.sortKey = 'gaa';
				} else {
					$scope.sortKey = 'points';
				}
			}
		} else {
			if ($scope.playerType == 'goalie') {
				$scope.sortKey = 'gaa';
			} else {
				$scope.sortKey = 'points';
			}
		}
	};

	$scope.setScopeFromUrl = function (playerTypeOverride) {

		if ($routeParams.hasOwnProperty("playerType")) {
			if ($routeParams.playerType == 'goalie') {
				$scope.playerType = 'goalie';
			} else {
				$scope.playerType = 'skater';
			}
		} else {
			if (playerTypeOverride == 'goalie') {
				$scope.playerType = 'goalie';
			} else {
				$scope.playerType = 'skater';
			}
		}

		if ($scope.playerType == 'goalie') {
			$scope.selectedPosition = 'goalie';
		} else {
			$scope.selectedPosition = 'skater';
		}

		if ($routeParams.hasOwnProperty("page")) {
			$scope.currentPage = $routeParams.page;
		} else {
			$scope.currentPage = 1;
		}

		if ($routeParams.hasOwnProperty("sort")) {
			$scope.sortKey = $routeParams.sort;
		} else {
			$scope.setSort();
		}

		$scope.orderDirection = ($routeParams.order_direction === 'reverse') ? 'reverse' : 'normal';

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}
	};

	$scope.$on('$locationChangeSuccess', function () {
		$scope.setScopeFromUrl();

		var position;
		if ($scope.playerType == 'goalie') {
			position = { id: 'goalies', name: 'Goalies' };
		} else {
			position = $scope.selectedPosition;
		}

		if ($scope.lastRequest.playerType != $scope.playerType ||
			$scope.lastRequest.page != $scope.currentPage ||
			$scope.lastRequest.sortKey != $scope.sortKey ||
			$scope.lastRequest.orderDirection != $scope.orderDirection ||
			($scope.selectedLeague && (
				$scope.lastRequest.league != $scope.selectedLeague.id ||
				$scope.lastRequest.leaguecode != $scope.selectedLeague.code)
			)
		) {
			if ($scope.selectedLeague === undefined) {
				// Initialize
				$scope.selectedLeague = {};
			}
			if ($scope.selectedLeague.id != $scope.lastRequest.league) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == $scope.lastRequest.league) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}
			else if ($scope.selectedLeague.code != $scope.lastRequest.leaguecode) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].code == $scope.lastRequest.leaguecode) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}

			$scope.getData(
				$scope.playerType,
				$scope.currentPage,
				$scope.sortKey,
				$scope.selectedLeague.id,
				$scope.orderDirection
			);
		}
	});

	$scope.orderDirection = 'normal';   // 'normal' = DESC (leaders first), 'reverse' = ASC

	$scope.sortStats = function (sortKey) {
		if ($scope.sortKey === sortKey) {
			// toggle direction on the active column
			$scope.orderDirection = ($scope.orderDirection === 'normal') ? 'reverse' : 'normal';
		} else {
			$scope.sortKey = sortKey;
			$scope.orderDirection = 'normal'; // new column defaults to DESC (leaders first)
		}
		$scope.currentPage = 1;
		$scope.getPlayerStats();
	};

	$scope.loadQuickView = function () {
		if ($scope.selectedQuickView.id != 'none') {
			$scope.playerType = $scope.selectedQuickView.params.playerType;
			$scope.sortKey = $scope.selectedQuickView.params.sort;
			$scope.orderDirection = 'normal'; // quick views always start DESC (leaders first)
			$scope.currentPage = 1;
			$scope.getPlayerStats();
		}
	};

	$scope.nextPage = function () {
		$scope.currentPage = parseInt($scope.currentPage) + 1;
		$scope.getPlayerStats(false);
	};

	$scope.previousPage = function () {
		var startPage = $scope.currentPage;
		$scope.currentPage = ($scope.currentPage) - 1;
		if ($scope.currentPage < 1) {
			$scope.currentPage = 1;
		}

		if (startPage != $scope.currentPage) {
			$scope.getPlayerStats(false);
		}
	};

	$scope.getPlayerStats = function (resetPage) {

		if (resetPage) {
			$scope.currentPage = 1;
		}

		var position;
		if ($scope.playerType == 'goalie') {
			position = { id: 'goalies', name: 'Goalies' };
		} else {
			position = { id: 'skaters', name: 'Skaters' };
		}

		$scope.getData(
			$scope.playerType,
			$scope.currentPage,
			$scope.sortKey,
			$scope.selectedLeague,
			$scope.orderDirection
		);

		$location.search('playerType', $scope.playerType);
		$location.search('statsType', $scope.statsType);
		$location.search('sort', $scope.sortKey);
		$location.search('order_direction', $scope.orderDirection);
		$location.search('page', $scope.currentPage);
		$location.search('league', $scope.selectedLeague.id);
		//$location.search('leaguecode', $scope.selectedLeague.code);

	};

	$scope.selectTableRow = function (key) {
		var theRow = key;
		if (!$scope[theRow]) {
			$scope[theRow] = true;
		} else {
			$scope[theRow] = false;
		}
	};

	$scope.getData = function (playerType, page, sortKey, leagueId, orderDirection) {
		if (orderDirection !== 'reverse') {
			orderDirection = 'normal'; // default: DESC (leaders first)
		}
		$scope.orderDirection = orderDirection;

		$scope.lastRequest = {
			playerType: playerType,
			page: page,
			sortKey: sortKey,
			leagueId: leagueId,
			orderDirection: orderDirection
		};

		var position;
		if (playerType == 'skater') {
			position = 'skaters';
		} else {
			position = 'goalies';
		}

		var resultsPerPage = 20;

		var first = resultsPerPage * (parseInt(page) - 1);
		var limit = resultsPerPage;

		if (first < 0) {
			first = 0;
		}

		var team = 'all';

		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.CheckData = 0;

		var method = 'jsonp';

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=playersAllTime' +
			'&playerType=' + playerType +
			'&position=' + position +
			'&first=' + first +
			'&limit=' + limit +
			'&sort=' + sortKey +
			'&order_direction=' + orderDirection;

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&site_id=' + site_id +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				if ($scope.GameData && data[0].sections && data[0].sections[0].data) {
					$scope.CheckData = data[0].sections[0].data.length;
				}

				$scope.setSort();
				$scope.hasNextPage = $scope.CheckData >= resultsPerPage;
				$scope.dataLoaded = true;
				$scope.loading = false;

				$scope.setName = $scope.selectedLeague.name;
				if (playerType == 'skater') {
					$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Alt_Skater_Stats;
				} else {
					$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Alt_Goalie_Stats;
				}
				var setPath = baseRoute + $scope.pageName;
				$rootScope.seoPath = setPath;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}

});

app.controller('PlayerStatsCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, playerTypeOverride, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	$scope.loadError = false;
	var season = 'latest';
	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}
	let conference = '';
	if ($routeParams.hasOwnProperty("conference")) {
		conference = $routeParams.conference;
	}
	let division = '';
	if ($routeParams.hasOwnProperty("division")) {
		division = $routeParams.division; // k
	}
	HockeyTechService.bootstrap(season, 'player-stats', league, leagueCode, svf_language, null, division, conference).then(function (data) {
		$scope.current_season_id = data.current_season_id;
		$scope.current_league_id = data.current_league_id;
		$scope.seasons = data.seasons;
		$scope.conferences = data.conferencesAll;
		$scope.divisions = data.divisionsAll;
		$scope.leagues = data.leagues;
		$scope.teams = data.teams;
		$scope.positions = data.positions;
		$scope.qualifiedGoalies = data.goalies;
		$scope.showExpandedGoaliesOption = data.showExpandedGoaliesOption;
		$scope.rosterstatus = data.rosterstatus;
		$scope.quickViews = data.quickViews;
		$scope.selectedQuickView = $scope.quickViews[0];
		$scope.showRosterStatus = data.showRosterStatus;
		$scope.footerinfo = data.playerStatsFooter;
		$scope.footerinfolegend = data.rosterFooter;
		$scope.svfConfig = data.svfConfig;
		$scope.hasConference = (typeof $scope.svfConfig.conferenceDropdown != 'undefined' ? true : false);
		$scope.hasDivision = (typeof $scope.svfConfig.divisionDropdown != 'undefined' ? true : false);
		$scope.svfLang = data.svfLang;
		$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;

		$scope.setScopeFromUrl(playerTypeOverride);

		var position;
		if ($scope.playerType == 'goalie') {
			position = { id: 'goalies', name: 'Goalies' };
		} else {
			position = $scope.selectedPosition;
		}

		// Preserve team selection if team id passed from parameter
		if ($routeParams.teamId) {
			if ($routeParams.teamId == "all-teams") {
				$routeParams.teamId = "-1";
			}
			for (var i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.teamId) {
					$scope.selectedTeam = $scope.teams[i];
					break;
				}
			}
			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		//$scope.getData = function (playerType, team, season, position, rookies, qualified, rosterstatus, page, statsType, sortKey)
		$scope.getData(
			$scope.playerType,
			$scope.selectedTeam.id,
			$scope.selectedSeason.id,
			position.id,
			$scope.rookie,
			$scope.selectedQualified.id,
			$scope.selectedRosterStatus.id,
			$scope.currentPage,
			$scope.statsType,
			$scope.sortKey,
			$scope.selectedLeague.id,
			$scope.selectedConference.conference_id,
			$scope.selectedDivision.id,
			$scope.orderDirection
		);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.setScopeFromUrl = function (playerTypeOverride) {

		if ($routeParams.hasOwnProperty("playertype")) {
			if ($routeParams.playertype == 'goalie') {
				$scope.playerType = 'goalie';
			} else {
				$scope.playerType = 'skater';
			}
		} else {
			if (playerTypeOverride == 'goalie') {
				$scope.playerType = 'goalie';
			} else {
				$scope.playerType = 'skater';
			}
		}

		if ($scope.playerType == 'goalie') {
			$scope.selectedPosition = $scope.positions[0];
		} else {
			var foundPosition = false;
			for (var i = 0; i < $scope.positions.length; i++) {
				if ($scope.positions[i].id == $routeParams.position) {
					$scope.selectedPosition = $scope.positions[i];
					foundPosition = true;
					break;
				}
			}
			if (!foundPosition) {
				$scope.selectedPosition = $scope.positions[0];
			}
		}

		if ($routeParams.hasOwnProperty("page")) {
			$scope.currentPage = $routeParams.page;
		} else {
			$scope.currentPage = 1;
		}

		if ($scope.selectedSeason === undefined) {
			// Initialize
			$scope.selectedSeason = {};
		}

		if ($routeParams.seasonId) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else if ($scope.current_season_id && $scope.selectedSeason.id == null) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		// If the league doesn't have any non-hidden seasons, selectedSeason won't be set
		if ($scope.selectedSeason == null) {
			$scope.selectedSeason = {};
			$scope.selectedSeason.id = -1;
		}

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//if only season passed in get the league by season
		if ($scope.selectedSeason.id && !$routeParams.hasOwnProperty("league") && wpLeagueId == '') {
			//update league id based on season
			HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
				setLeagueId = league_id;
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			});
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.hasOwnProperty("conference") && $routeParams.conference !== -1) {
			for (let i = 0; i < $scope.conferences.length; i++) {
				if ($scope.conferences[i].conference_id === $routeParams.conference) {
					$scope.selectedConference = $scope.conferences[i];
					break;
				}
			}
			if ($scope.selectedConference == null) {
				$scope.selectedConference = $scope.conferences[0];
			}
		} else {
			$scope.selectedConference = $scope.conferences[0];
		}

		if ($routeParams.hasOwnProperty("division") && $routeParams.division != -1) {
			for (var i = 0; i < $scope.divisions.length; i++) {
				if ($scope.divisions[i].id == $routeParams.division) {
					$scope.selectedDivision = $scope.divisions[i];
					HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, true).then(function (teams) {
						$scope.teams = teams;
					});
					break;
				}
			}
			if ($scope.selectedDivision == null) {
				$scope.selectedDivision = $scope.divisions[0];
			}
		} else {
			$scope.selectedDivision = $scope.divisions[0];
		}

		if ($routeParams.teamId) {
			for (var i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.teamId) {
					$scope.selectedTeam = $scope.teams[i];
					break;
				}
			}
			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		if ($routeParams.hasOwnProperty("rookie")) {
			if ($routeParams.rookie == 'yes') {
				$scope.rookie = 'yes';
			} else {
				$scope.rookie = 'no';
			}
		} else {
			$scope.rookie = 'no';
		}

		if ($routeParams.hasOwnProperty("statstype")) {
			if ($routeParams.statstype == 'expanded') {
				$scope.statsType = 'expanded';
			} else {
				$scope.statsType = 'standard';
			}
		} else {
			$scope.statsType = 'standard';
		}

		if ($routeParams.hasOwnProperty("qualified")) {
			for (var i = 0; i < $scope.qualifiedGoalies.length; i++) {
				if ($scope.qualifiedGoalies[i].id == $routeParams.qualified) {
					$scope.selectedQualified = $scope.qualifiedGoalies[i];
					break;
				}
			}
			if ($scope.selectedQualified == null) {
				$scope.selectedQualified = $scope.qualifiedGoalies[0];
			}
		} else {
			$scope.selectedQualified = $scope.qualifiedGoalies[0];
		}

		if ($routeParams.hasOwnProperty("sort")) {
			$scope.sortKey = $routeParams.sort;
		} else {
			$scope.setSort();
		}

		$scope.orderDirection = ($routeParams.order_direction === 'reverse') ? 'reverse' : 'normal';

		if ($routeParams.hasOwnProperty("rosterstatus")) {
			for (i = 0; i < $scope.rosterstatus.length; i++) {
				if ($scope.rosterstatus[i].id == $routeParams.rosterstatus) {
					$scope.selectedRosterStatus = $scope.rosterstatus[i];
					break;
				}
			}
			if ($scope.selectedRosterStatus == null) {
				$scope.selectedRosterStatus = $scope.rosterstatus[0];
			}
		} else {
			$scope.selectedRosterStatus = $scope.rosterstatus[0];
		}
		if (!$scope.showRosterStatus) {
			$scope.selectedRosterStatus = 0;
		}

	};

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.sortKey) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				if ($scope.playerType == 'goalie') {
					$scope.sortKey = 'gaa';
				} else {
					$scope.sortKey = 'points';
				}
			}
		} else {
			if ($scope.playerType == 'goalie') {
				$scope.sortKey = 'gaa';
			} else {
				$scope.sortKey = 'points';
			}
		}
	};

	$scope.orderDirection = 'normal';   // 'normal' = DESC (leaders first), 'reverse' = ASC

	$scope.sortStats = function (sortKey) {
		if ($scope.sortKey === sortKey) {
			// toggle direction on the active column
			$scope.orderDirection = ($scope.orderDirection === 'normal') ? 'reverse' : 'normal';
		} else {
			$scope.sortKey = sortKey;
			$scope.orderDirection = 'normal'; // new column defaults to DESC (leaders first)
		}
		$scope.currentPage = 1;
		$scope.getPlayerStats();
	};

	$scope.loadQuickView = function () {
		if ($scope.selectedQuickView.id != 'none') {
			$scope.playerType = $scope.selectedQuickView.params.playerType;
			$scope.rookie = $scope.selectedQuickView.params.rookie;

			if ($scope.selectedQuickView.params.position) {
				for (var i = 0; i < $scope.positions.length; i++) {
					if ($scope.positions[i].id == $scope.selectedQuickView.params.position) {
						$scope.selectedPosition = $scope.positions[i];
						break;
					}
				}
			}
			$scope.sortKey = $scope.selectedQuickView.params.sort;
			$scope.orderDirection = 'normal'; // quick views always start DESC (leaders first)
			$scope.statsType = $scope.selectedQuickView.params.statType;
			$scope.currentPage = 1;
			$scope.getPlayerStats();
		}
	};

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
			$scope.changedSeason();
		});
	};

	$scope.changedSeason = function () {
		if ($scope.hasDivision) {
			$scope.selectedDivision.id = -1;
			$location.search('division', -1);
			HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, true).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];
			});
		}

		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
			$scope.teams = teams;
			$scope.selectedTeam = "";
			// Preserve team selection if team also plays in season that was selected in dropdown
			if ($routeParams.teamId) {
				if ($routeParams.teamId == "all-teams") {
					$routeParams.teamId = "-1";
				}
				for (var i = 0; i < $scope.teams.length; i++) {
					if ($scope.teams[i].id == $routeParams.teamId) {
						$scope.selectedTeam = $scope.teams[i];
						break;
					}
				}
				if (!$scope.selectedTeam) {
					$scope.selectedTeam = $scope.teams[0];
				}
			} else {
				$scope.selectedTeam = $scope.teams[0];
			}
			var teamsNoAll = teams.slice();
			teamsNoAll.shift();
			$scope.teamsNoAll = teamsNoAll;
			if ($scope.selectedTeam) {
				$scope.selectedTeamNoAll = $scope.selectedTeam;
			} else {
				$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
			}
			$scope.getPlayerStats();
		});
		//update league id based on season
		HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
			$scope.selectedLeague.id = league_id;
		});
	};

	$scope.changedConference = function () {
		if ($scope.hasDivision) {
			$scope.selectedDivision.id = -1;
			HockeyTechService.getDivisionsBySeasonIdAndConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, false).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];
				HockeyTechService.getTeamsBySeasonIdConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, true).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = $scope.teams[0];
					$scope.getPlayerStats();
				});
			});
		}
	}

	$scope.changedDivision = function () {
		if ($scope.selectedDivision !== null) {
			if ($scope.hasConference && this.selectedConference.conference_id !== -1 && $scope.selectedDivision.id === -1) {
				HockeyTechService.getTeamsBySeasonIdConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, true).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = $scope.teams[0];
				});
			} else {
				HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, true).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = $scope.teams[0];
				});
			}
		} else {
			$scope.teams = [];
		}
		$scope.getPlayerStats();
	};

	$scope.nextPage = function () {
		$scope.currentPage = parseInt($scope.currentPage) + 1;
		$scope.getPlayerStats(false);
	};

	$scope.previousPage = function () {
		var startPage = $scope.currentPage;
		$scope.currentPage = ($scope.currentPage) - 1;
		if ($scope.currentPage < 1) {
			$scope.currentPage = 1;
		}

		if (startPage != $scope.currentPage) {
			$scope.getPlayerStats(false);
		}
	};

	$scope.getPlayerStats = function (resetPage) {
		var previousUrl = $location.$$url;

		if (resetPage) {
			$scope.currentPage = 1;
		}

		var position;
		if ($scope.playerType == 'goalie') {
			position = { id: 'goalies', name: 'Goalies' };
		} else {
			position = $scope.selectedPosition;
		}

		//don't want to see -1 in the url
		var setTeamUrl = "";
		var team = "";
		if ($scope.selectedTeam.id == "-1") {
			setTeamUrl = "all-teams";
			team = "all";
		} else {
			setTeamUrl = $scope.selectedTeam.id;
			team = $scope.selectedTeam.id;
		}

		$location.path('/' + $scope.pageName + '/' + setTeamUrl + '/' + $scope.selectedSeason.id);

		$location.search('playertype', $scope.playerType);
		if ($scope.playerType != 'goalie') {
			$location.search('position', position.id);
			$location.search('qualified', null);
		} else {
			$location.search('qualified', $scope.selectedQualified.id);
			$location.search('position', null);
		}
		$location.search('rookie', $scope.rookie);
		$location.search('rosterstatus', $scope.selectedRosterStatus.id);
		$location.search('sort', $scope.sortKey);
		$location.search('order_direction', $scope.orderDirection);
		$location.search('statstype', $scope.statsType);
		$location.search('page', $scope.currentPage);
		$location.search('league', $scope.selectedLeague.id);
		if ($scope.hasConference) {
			$location.search('conference', $scope.selectedConference.conference_id);
		}
		if ($scope.hasDivision) {
			$location.search('division', $scope.selectedDivision.id);
		}

		// The $location.path() call above will end up calling getData if the team or season has changed.
		// This prevents the double call.
		if (previousUrl != $location.$$url && $scope.previousTeam == team && $scope.previousSeason == $scope.selectedSeason.id) {
			$scope.getData(
				$scope.playerType,
				$scope.selectedTeam.id,
				$scope.selectedSeason.id,
				position.id,
				$scope.rookie,
				$scope.selectedQualified.id,
				$scope.selectedRosterStatus.id,
				$scope.currentPage,
				$scope.statsType,
				$scope.sortKey,
				$scope.selectedLeague.id,
				$scope.selectedConference.conference_id,
				$scope.selectedDivision.id,
				$scope.orderDirection
			);
		}
	};

	$scope.selectTableRow = function (key) {
		var theRow = key;
		if (!$scope[theRow]) {
			$scope[theRow] = true;
		} else {
			$scope[theRow] = false;
		}
	};

	$scope.expandtablerow = function (key) {
		var theRow = key;
		if (!$scope[theRow]) {
			$scope[theRow] = true;
		} else {
			$scope[theRow] = false;
		}
	};



	$scope.getData = function (playerType, team, season, position, rookies, qualified, rosterstatus, page, statsType, sortKey, leagueId, conference, division, orderDirection) {
		if (orderDirection !== 'reverse') {
			orderDirection = 'normal'; // default: DESC (leaders first)
		}
		$scope.orderDirection = orderDirection;
		$scope.lastRequest = {
			playerType: playerType,
			team: team,
			season: season,
			position: position,
			rookies: rookies,
			qualified: qualified,
			rosterstatus: rosterstatus,
			page: page,
			statsType: statsType,
			sortKey: sortKey,
			leagueId: leagueId,
			conference: conference,
			division: division,
			orderDirection: orderDirection
		};

		var resultsPerPage = 20;

		var first = resultsPerPage * (parseInt(page) - 1);
		var limit = resultsPerPage;

		if (first < 0) {
			first = 0;
		}

		if (team == '-1' || team == null) {
			team = 'all';
		}

		if (position == null) {
			position = 'skaters';
		}

		if (playerType == 'goalie') {
			position = 'goalies';
		}

		if (rookies == null) {
			rookies = 0;
		} else {
			if (rookies == 'yes') {
				rookies = 1;
			} else {
				rookies = 0;
			}
		}

		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.CheckData = 0;
		$scope.seasonId = season;
		$scope.teamId = team;

		$scope.previousTeam = team;
		$scope.previousSeason = season;

		var method = 'jsonp';

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=players' +
			'&season=' + season +
			'&team=' + team +
			'&position=' + position +
			'&rookies=' + rookies +
			'&statsType=' + statsType +
			'&rosterstatus=' + rosterstatus +
			'&site_id=' + site_id +
			'&first=' + first +
			'&limit=' + limit +
			'&sort=' + sortKey +
			'&order_direction=' + orderDirection +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&division=' + division +
			'&conference=' + conference;

		if (position == 'goalies') {
			url += '&qualified=' + qualified;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				if ($scope.GameData && data[0].sections && data[0].sections[0].data) {
					$scope.CheckData = data[0].sections[0].data.length;
				}
				$scope.dataLoaded = true;
				$scope.loading = false;

				$scope.setSort();

				$scope.minimumGoalieMinutesForQualified = $scope.selectedSeason.minimumGoalieMinutes;
				$scope.hasNextPage = $scope.CheckData >= resultsPerPage;

				if (team == "all") {
					$scope.setName = $scope.selectedLeague.name;
				} else {
					$scope.setName = $scope.selectedTeam.name;
				}
				if ($scope.playerType == 'goalie') {
					$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Goalie_Stats + " " + $scope.selectedSeason.name;
				} else {
					$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Skater_Stats + " " + $scope.selectedSeason.name;
				}
				$rootScope.playerNoPicLogoOverride = $scope.playerNoPicLogoOverride;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.teamId && $routeParams.seasonId) {
					var setTeamUrl = "";
					if ($routeParams.teamId == "-1") {
						setTeamUrl = "all-teams";
					} else {
						setTeamUrl = $routeParams.teamId;
					}
					setPath = setPath + '/' + setTeamUrl + '/' + $routeParams.seasonId;
				}
				$rootScope.seoPath = setPath;

				$scope.pageTitle = "skater";
				if ($scope.playerType == 'goalie') {
					$scope.pageTitle = "goalie";
				}
				if ($scope.pageName == "div-leaders") {
					$scope.pageTitle = "leaders";
				}

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});

app.controller('StreakStatsCtrl', function ($scope, $http, $rootScope, $location, $routeParams, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}
	HockeyTechService.bootstrap(null, 'streaks', league, leagueCode, svf_language).then(function (data) {
		$scope.seasons = data.seasons;
		$scope.current_season_id = data.current_season_id;
		$scope.current_league_id = data.current_league_id;
		$scope.divisions = data.divisionsAll;
		$scope.leagues = data.leagues;
		$scope.teams = data.teams;
		$scope.svfConfig = data.svfConfig;
		$scope.hasDivision = (typeof $scope.svfConfig.divisionDropdown != 'undefined' ? true : false);
		$scope.team = null;
		$scope.svfLang = data.svfLang;

		if ($routeParams.hasOwnProperty("page")) {
			$scope.currentPage = $routeParams.page;
		} else {
			$scope.currentPage = 1;
		}

		if ($routeParams.hasOwnProperty("division")) {
			for (var i = 0; i < $scope.divisions.length; i++) {
				if ($scope.divisions[i].id == $routeParams.division) {
					$scope.selectedDivision = $scope.divisions[i];
					break;
				}
			}
			if ($scope.selectedDivision == null) {
				$scope.selectedDivision = $scope.divisions[0];
			}
		} else {
			$scope.selectedDivision = $scope.divisions[0];
		}

		if ($routeParams.hasOwnProperty("season")) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.season) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		// If the league doesn't have any non-hidden seasons, selectedSeason won't be set
		if ($scope.selectedSeason == null) {
			$scope.selectedSeason = {};
			$scope.selectedSeason.id = -1;
		}

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//if only season passed in get the league by season
		if ($routeParams.hasOwnProperty("season") && !$routeParams.hasOwnProperty("league") && wpLeagueId == '') {
			//update league id based on season
			HockeyTechService.getLeagueIdBySeasonId($routeParams.season).then(function (league_id) {
				setLeagueId = league_id;
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			});
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.hasOwnProperty("streaktype")) {
			if ($routeParams.streaktype == 'team') {
				$scope.streakType = 'team';
			} else {
				$scope.streakType = 'player';
			}
		} else {
			$scope.streakType = 'player';
		}

		if ($routeParams.hasOwnProperty("showteamsby")) {
			if ($routeParams.showteamsby == 'conference') {
				$scope.showTeamsBy = 'conference';
			} else {
				$scope.showTeamsBy = 'division';
			}
		} else {
			$scope.showTeamsBy = 'division';
		}

		if ($scope.streakType == "player") {
			if ($routeParams.hasOwnProperty("team")) {
				$scope.team = $routeParams.team;
			}

			if ($routeParams.hasOwnProperty("playerstreakstat")) {
				if ($routeParams.playerstreakstat == 'assists') {
					$scope.playerStreakStat = 'assists';
				} else if ($routeParams.playerstreakstat == 'points') {
					$scope.playerStreakStat = 'points';
				} else {
					$scope.playerStreakStat = 'goals';
				}
			} else {
				$scope.playerStreakStat = 'goals';
			}
		}
		else if ($scope.streakType == "team") {
			if ($routeParams.hasOwnProperty("teamstreakstat")) {
				if ($routeParams.teamstreakstat == 'longest_win') {
					$scope.teamStreakStat = 'longest_win';
				} else if ($routeParams.teamstreakstat == 'longest_losses') {
					$scope.teamStreakStat = 'longest_losses';
				} else if ($routeParams.teamstreakstat == 'longest_winless') {
					$scope.teamStreakStat = 'longest_winless';
				} else {
					$scope.teamStreakStat = 'longest_win';
				}
			} else {
				$scope.teamStreakStat = 'longest_win';
			}
		}

		if ($routeParams.hasOwnProperty("orderby")) {
			$scope.orderBy = $routeParams.orderBy;
		} else {
			$scope.orderBy = '';
		}

		$scope.getData(
			$scope.streakType,
			$scope.playerStreakStat,
			$scope.selectedSeason.id,
			$scope.showTeamsBy,
			$scope.currentPage,
			$scope.teamStreakStat,
			$scope.orderBy,
			$scope.selectedLeague.id,
			$scope.team,
			$scope.selectedDivision.id
		);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
			$scope.getStreakStats(true);
		});
	};

	$scope.changedSeason = function () {
		if ($scope.hasDivision) {
			$scope.selectedDivision.id = -1;
			$location.search('division', $scope.selectedDivision.id);
			// Update division list based on seasons
			HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, true).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];
			});
		}

		// Update league id based on season
		HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
			$scope.selectedLeague.id = league_id;
		});

		//update teams by season
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teamdata) {
			$scope.teams = teamdata;
		});
		$scope.getStreakStats(true);
	};


	$scope.changedDivision = function () {
		if ($scope.selectedDivision !== null) {
			HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, true).then(function (teams) {
				$scope.teams = teams;
				$scope.selectedTeam = $scope.teams[0];
				$scope.getStreakStats(true);
			});
		} else {
			$scope.teams = [];
		}
	};

	$scope.$on('$locationChangeSuccess', function () {
		var params = $location.search();

		if (params.streaktype != $scope.streakType ||
			params.showteamsby != $scope.showTeamsBy ||
			params.playerstreakstat != $scope.playerStreakStat ||
			($scope.selectedSeason && params.season != $scope.selectedSeason.id) ||
			params.page != $scope.currentPage ||
			params.teamstreakstat != $scope.teamStreakStat ||
			params.orderby != $scope.orderBy ||
			($scope.selectedLeague && (
				params.league != $scope.selectedLeague.id ||
				params.leaguecode != $scope.selectedLeague.code)
			)
		) {
			$scope.streakType = params.streaktype;
			$scope.showTeamsBy = params.showteamsby;
			$scope.playerStreakStat = params.playerstreakstat;
			$scope.selectedSeason.id = params.season;
			$scope.currentPage = params.page;
			$scope.teamStreakStat = params.teamstreakstat;
			$scope.orderBy = params.orderby;

			if ($scope.selectedLeague === undefined) {
				// Initialize
				$scope.selectedLeague = {};
			}
			if ($scope.selectedLeague.id != params.league) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == params.league) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}
			else if ($scope.selectedLeague.code != params.leaguecode) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].code == params.leaguecode) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}

			$scope.getData(
				$scope.streakType,
				$scope.playerStreakStat,
				$scope.selectedSeason.id,
				$scope.showTeamsBy,
				$scope.currentPage,
				$scope.teamStreakStat,
				$scope.orderBy,
				$scope.selectedLeague.id,
				$scope.team,
				$scope.selectedDivision.id
			);
		}
	});

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.teamStreakStat) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				$scope.teamStreakStat = 'longest_win';
			}
		} else {
			$scope.teamStreakStat = 'longest_win';
		}
	};

	$scope.nextPage = function () {
		$scope.currentPage = parseInt($scope.currentPage) + 1;
		$scope.getStreakStats(false);
	};

	$scope.previousPage = function () {
		var startPage = $scope.currentPage;
		$scope.currentPage = parseInt($scope.currentPage) - 1;
		if ($scope.currentPage < 1) {
			$scope.currentPage = 1;
		}

		if (startPage != $scope.currentPage) {
			$scope.getStreakStats(false);
		}
	};

	$scope.sortStats = function (sortKey) {
		if ($scope.streakType == "player") {
			$scope.orderBy = sortKey;
		}
		else {
			$scope.teamStreakStat = sortKey;
		}
		$scope.getStreakStats(false);
	};

	$scope.getStreakStats = function (resetPage) {
		if (resetPage) {
			$scope.currentPage = 1;
		}

		$scope.getData($scope.streakType, $scope.playerStreakStat, $scope.selectedSeason.id, $scope.showTeamsBy, $scope.currentPage, $scope.teamStreakStat, $scope.orderBy, $scope.selectedLeague.id, $scope.team, $scope.selectedDivision.id);

		$location.search('streaktype', $scope.streakType);
		$location.search('season', $scope.selectedSeason.id);
		if ($scope.streakType == "player") {
			$location.search('playerstreakstat', $scope.playerStreakStat);
		}
		if ($scope.streakType == "team") {
			$location.search('showteamsby', $scope.showTeamsBy);
			$location.search('teamstreakstat', $scope.teamStreakStat);
		}
		if ($scope.orderBy) {
			$location.search('orderby', $scope.orderBy);
		}
		$location.search('page', $scope.currentPage);
		$location.search('league', $scope.selectedLeague.id);
		if ($scope.hasDivision) {
			$location.search('division', $scope.selectedDivision.id);
		}
	};

	$scope.getData = function (type, stat, season, teamType, page, teamStreakStat, orderBy, $leagueId, teamId, divisionId) {
		var resultsPerPage = 20;
		var first = resultsPerPage * (parseInt(page) - 1);
		var limit = resultsPerPage;

		if (first < 0) {
			first = 0;
		}

		if (type != 'team') {
			type = 'player';
		}

		if (stat == null) {
			stat = 'goals';
		}

		if (teamType != 'division') {
			teamType = 'conference';
		}

		if (teamStreakStat == null) {
			teamStreakStat = 'longest_win';
		}

		if (typeof orderBy === 'undefined') {
			orderBy = '';
		}

		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = season;

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed' +
			'&view=streaks_' + type +
			'&stat=' + stat +
			'&order_by=' + orderBy +
			'&season=' + season;

		if (type == 'team') {
			url += '&teamType=' + teamType +
				'&team_stat=' + teamStreakStat;
		}

		if (type == 'player' && teamId != null) {
			url += '&team=' + teamId;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&division=' + divisionId +
			'&first=' + first +
			'&limit=' + limit +
			'&lang=' + svf_language +
			'&site_id=' + site_id +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.setSort();
				if ($scope.GameData && data[0].sections && data[0].sections[0].data) {
					$scope.CheckData = data[0].sections[0].data.length;
				}
				$scope.hasNextPage = $scope.CheckData >= resultsPerPage;

				$scope.dataLoaded = true;
				$scope.loading = false;

				$scope.setName = $scope.selectedLeague.name;
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Streaks + " " + $scope.selectedSeason.name;

				var setPath = baseRoute + $scope.pageName;
				$rootScope.seoPath = setPath;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});

app.controller('CalendarCtrl', ['$scope', '$http', '$rootScope', '$timeout', '$interval', 'HockeyTechService', '$location', '$routeParams', '$route', 'Firebase',
	function ($scope, $http, $rootScope, $timeout, $interval, HockeyTechService, $location, $routeParams, $route, Firebase) {

		$scope.pageName = $route.current.$$route.name;
		var svf_language = $route.current.$$route.language;
		$scope.language = svf_language;

		if (!html5ModeEnabled) {
			$scope.linkPrefix = '#/';
		} else {
			$scope.linkPrefix = baseRoute;
		}

		var season = 'latest';

		var leagueId = '';
		if ($routeParams.hasOwnProperty("league")) {
			leagueId = $routeParams.league;
		}
		var leagueCode = '';
		if ($routeParams.hasOwnProperty("leaguecode")) {
			leagueCode = $routeParams.leaguecode;
		}
		$scope.teamId = '';
		if ($routeParams.teamId) {
			$scope.teamId = $routeParams.teamId;
		}

		$scope.urlGameCenter = "game-center";
		if (svf_language == 'fr') {
			$scope.urlGameCenter = "game-centre";
		}

		var daysBack = 0;
		var daysAhead = 14;
		var limit = 500;

		$scope.time = '11:00 AM';
		var today = new Date();
		var nowTime = new Date((today.getMonth() + 1) + "/" + today.getDate() + "/" + today.getFullYear() + " " + today.getHours() + ":" + today.getMinutes());
		var userTime = new Date((today.getMonth() + 1) + "/" + today.getDate() + "/" + today.getFullYear() + " " + $scope.time);

		//if Monday before 11am go 2 days back to show the weekend
		if (today.getDay() == 1 || today.getDay() == 0 && nowTime.getTime() <= userTime.getTime()) {
			daysBack = 2;
		}

		$scope.urlRoster = "roster";
		if (svf_language == 'fr') {
			$scope.urlRoster = "alignement";
		}

		var bootstrapPromise = HockeyTechService.bootstrap(season, 'scorebar', leagueId, leagueCode, svf_language).then(function (data) {
			$scope.firebaseUrl = data.firebaseUrl;
			$scope.firebaseToken = data.firebaseToken;
			$scope.firebaseApiKey = data.firebaseApiKey;
			$scope.currentSeasonId = data.current_season_id;
			$scope.svfConfig = data.svfConfig;
			$scope.svfLang = data.svfLang;
			$scope.teams = data.teams;
			$scope.current_league_id = data.current_league_id;
			$scope.leagues = data.leagues;
			$scope.useGameCenterUrl = (typeof data.svfConfig.game_center != 'undefined') ? data.svfConfig.game_center : false;
			$scope.urlGameLink = $scope.urlGameCenter;

			//league_id returned from WP
			var wpLeagueId = league_id;
			var setLeagueId = $scope.current_league_id;
			if (wpLeagueId != '') {
				setLeagueId = wpLeagueId
			}

			if (setLeagueId && $scope.leagues && $scope.leagues.length > 0) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.leagueId = $scope.leagues[i].id;
						$scope.leagueName = $scope.leagues[i].name;
						break;
					}
				}
			}

			// if we're still without a league
			if ($scope.leagueId == null) {
				$scope.leagueId = '';
				$scope.leagueName = '';
			}

			if ($routeParams.teamId) {
				if ($routeParams.teamId == "all-teams") {
					$routeParams.teamId = "-1";
				}
				for (i = 0; i < $scope.teams.length; i++) {
					if ($scope.teams[i].id == $routeParams.teamId) {
						$scope.selectedTeam = $scope.teams[i];
						break;
					}
				}
				if ($scope.selectedTeam == null) {
					$scope.selectedTeam = $scope.teams[0];
				}
			} else {
				$scope.selectedTeam = $scope.teams[0];
			}

			$scope.getData($scope.leagueId);

		}).catch(function () {
			$scope.loadError = true;
		});

		$scope.getData = function (leagueId) {
			$scope.GameData = null;
			$scope.dataLoaded = false;
			$scope.loading = true;
			$scope.theMethod = 'jsonp';
			if ($scope.teamId != '' && $scope.teamId != '-1') {
				$scope.url = prodUrl + '/feed/index.php?feed=modulekit&key=' + appKey + '&client_code=' + clientCode + '&view=scorebar&numberofdaysahead=' + daysAhead + '&numberofdaysback=' + daysBack + '&limit=' + limit + '&fmt=json&team_id=' + $scope.teamId + '&lang=' + svf_language + '&league_id=' + leagueId + '&callback=JSON_CALLBACK';
			} else {
				$scope.url = prodUrl + '/feed/index.php?feed=modulekit&key=' + appKey + '&client_code=' + clientCode + '&view=scorebar&numberofdaysahead=' + daysAhead + '&numberofdaysback=' + daysBack + '&limit=' + limit + '&fmt=json&site_id=' + site_id + '&lang=' + svf_language + '&league_id=' + leagueId + '&callback=JSON_CALLBACK';
			}
			$http({ method: $scope.theMethod, url: $scope.url })
				.success(function (data, status, headers, config) {
					$rootScope.feedUrl = $scope.url;
					$scope.linkPrefix = $scope.linkPrefix;
					$scope.status = status;
					$scope.todaysDate = new Date();
					//group data by date
					var schData = data.SiteKit.Scorebar;
					var monthSch = [];
					var sections = [];
					var s = 0;

					for (var i = 0; i < schData.length; i++) {
						var getDate = schData[i].GameDate;

						var preDate = "";
						if (i > 0) {
							preDate = schData[i - 1].GameDate;
						}
						var dataRow = schData[i];
						if (getDate != preDate) {
							newSection = ({ title: getDate, data: [dataRow] });
							sections.push(newSection);
							s++;
						} else {
							//add to data section
							sections[s - 1].data.push(dataRow);
						}
					}
					monthSch.push({ sections: sections });
					$scope.GameData = monthSch;

					$scope.dataLoaded = true;
					$interval(callDataLoaded, 200);

					if ($scope.teamId == '-1' || $scope.teamId == -1 || $scope.teamId == '') {
						$scope.setName = $scope.leagueName;
					} else {
						$scope.setName = $scope.selectedTeam.name;
					}

					//set page title and meta data
					$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Schedule;

					var setPath = baseRoute + $scope.pageName;
					if ($routeParams.teamId) {
						var setTeamUrl = "";
						if ($routeParams.teamId != "-1") {
							setTeamUrl = $routeParams.teamId;
							setPath = setPath + '/' + setTeamUrl;
						}
					}
					$rootScope.seoPath = setPath;

				}).
				error(function (data, status, headers, config) {
					// called asynchronously if an error occurs
					// or server returns response with an error status.
				});
		}

		//small wait until the data is all loaded so don't see a flicker
		function callDataLoaded() {
			$scope.loading = false;
		}

		$scope.changedTeam = function (location) {
			$scope.teamId = $scope.selectedTeam.id;
			$routeParams.teamId = $scope.teamId;
			var setPath = '';
			//setting the path triggers getting the new data
			if ($routeParams.teamId == '-1') {
				setPath = '/' + $scope.pageName;
				$location.path(setPath);
			} else {
				setPath = '/' + $scope.pageName + '/' + $scope.teamId;
				$location.path(setPath);
			}
		}
	}]);


app.controller('SeasonScheduleCtrl', function ($scope, $http, $rootScope, $location, $routeParams, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season = 'latest';
	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}
	let conference = '';
	if ($routeParams.hasOwnProperty("conference")) {
		conference = $routeParams.conference;
	}
	let division = '';
	if ($routeParams.hasOwnProperty("division")) {
		division = $routeParams.division;
	}
	$scope.isProStats = lsp_stats;

	$scope.filterTeamByDivision = function (team) {
		// Include 'All Teams' option with -1, otherwise filter by 'All Divisions' selected or all teams in division
		return team.id == -1 || $scope.selectedDivision.id == -1 || team.division_id == $scope.selectedDivision.id;
	};

	HockeyTechService.bootstrap(season, 'schedule', league, leagueCode, svf_language, null, division, conference).then(function (data) {
		$scope.conferences = data.conferencesAll;
		$scope.divisions = data.divisionsAll;
		$scope.months = data.monthsAll;
		$scope.seasons = data.seasons;
		$scope.teams = data.teams;
		$scope.teamsLogos = data.teams;
		$scope.current_season_id = data.current_season_id;
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		$scope.svfConfig = data.svfConfig;
		$scope.hasConference = (typeof $scope.svfConfig.conferenceDropdown != 'undefined' ? true : false);
		$scope.hasDivision = (typeof $scope.svfConfig.divisionDropdown != 'undefined' ? true : false);
		$scope.hasGameType = (typeof $scope.svfConfig.use_game_type_filter != 'undefined' ? $scope.svfConfig.use_game_type_filter : false);
		$scope.svfLang = data.svfLang;
		$scope.showScheduleButton = (typeof data.svfConfig.schedule != 'undefined' && typeof data.svfConfig.schedule.showScheduleButton != 'undefined')
			? data.svfConfig.schedule.showScheduleButton
			: false;

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		//if only season passed in get the league by season
		if ($routeParams.seasonId && !$routeParams.hasOwnProperty("league") && wpLeagueId == '') {
			//update league id based on season
			HockeyTechService.getLeagueIdBySeasonId($routeParams.seasonId).then(function (league_id) {
				setLeagueId = league_id;
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			});
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.seasonId) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		// If the league doesn't have any non-hidden seasons, selectedSeason won't be set
		if ($scope.selectedSeason == null) {
			$scope.selectedSeason = {};
			$scope.selectedSeason.id = -1;
		}

		if ($routeParams.hasOwnProperty("conference") && $routeParams.conference != -1) {
			for (let i = 0; i < $scope.conferences.length; i++) {
				if ($scope.conferences[i].conference_id === $routeParams.conference) {
					$scope.selectedConference = $scope.conferences[i];
					break;
				}
			}
			if ($scope.selectedConference == null) {
				$scope.selectedConference = $scope.conferences[0];
			}
		} else {
			$scope.selectedConference = $scope.conferences[0];
		}

		if ($routeParams.hasOwnProperty("division") && $routeParams.division != -1) {
			for (var i = 0; i < $scope.divisions.length; i++) {
				if ($scope.divisions[i].id == $routeParams.division) {
					$scope.selectedDivision = $scope.divisions[i];

					break;
				}
			}
			if ($scope.selectedDivision == null) {
				$scope.selectedDivision = $scope.divisions[0];
			}
		} else {
			$scope.selectedDivision = $scope.divisions[0];
		}

		if ($routeParams.teamId) {
			if ($routeParams.teamId == "all-teams") {
				$routeParams.teamId = "-1";
			}
			for (i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.teamId) {
					$scope.selectedTeam = $scope.teams[i];
					if ($routeParams.hasOwnProperty("division") && $scope.selectedDivision.id == -1) {
						for (j = 0; j < $scope.divisions.length; j++) {
							if ($scope.divisions[j].id == $scope.teams[i].division_id) {
								$scope.selectedDivision = $scope.divisions[j];
							}
						}
					}
					break;
				}
			}
			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		if ($routeParams.monthId) {
			if ($routeParams.teamId == "all-months") {
				$routeParams.teamId = "-1";
			}
			for (i = 0; i < $scope.months.length; i++) {
				if ($scope.months[i].id == $routeParams.monthId) {
					$scope.selectedMonth = $scope.months[i];
					break;
				}
			}
			if ($scope.selectedMonth == null) {
				$scope.selectedMonth = $scope.months[0];
			}
		} else {
			var TodayDate = new Date();
			// take into account additional items in the dropdown when setting the offset for the current month
			var monthOffset = $scope.months.length - 12;
			var thisMonth = (TodayDate.getMonth() + monthOffset);
			$scope.selectedMonth = $scope.months[thisMonth];
		}

		if ($routeParams.location) {
			if ($routeParams.location == 'home') {
				$scope.location = 'home';
			} else if ($routeParams.location == 'away') {
				$scope.location = 'away';
			} else {
				$scope.location = 'homeaway';
			}
		} else {
			$scope.location = 'homeaway';
		}

		$scope.gameTypes = "";
		$scope.selectedGameType = {};
		$scope.selectedGameType.id = -1;
		if ($scope.hasGameType) {
			HockeyTechService.getGameTypes().then(function (gameTypes) {
				$scope.gameTypes = gameTypes;
				if ($routeParams.hasOwnProperty("gametype")) {
					for (i = 0; i < $scope.gameTypes.length; i++) {
						if ($scope.gameTypes[i].id == $routeParams.gametype) {
							$scope.selectedGameType = $scope.gameTypes[i];
						}
					}
				}
				$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.selectedMonth.id, $scope.location, $scope.selectedLeague.id, $scope.selectedConference.conference_id, $scope.selectedDivision.id, $scope.selectedGameType.id);
			});
		} else {
			$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.selectedMonth.id, $scope.location, $scope.selectedLeague.id, $scope.selectedConference.conference_id, $scope.selectedDivision.id, $scope.selectedGameType.id);
		}
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;

			var maintainSeason = false;
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.selectedLeague.id) {
					maintainSeason = true;
					break;
				}
			}
			// if the selected season is in the returned seasons, maintain it
			if (!maintainSeason) {
				$scope.selectedSeason = $scope.seasons[0];
				$scope.changedSeason();
			}
		});

		$scope.getSeasonSchedule();
	};

	$scope.changedSeason = function () {
		if ($scope.hasConference) {
			$scope.selectedConference.conference_id = -1;
			$location.search('conference', -1);
		}

		HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, true).then(function (divisions) {
			$scope.divisions = divisions;
			$scope.selectedDivision = $scope.divisions[0];
		});

		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
			$scope.teams = teams;
			$scope.selectedTeam = "";
			// Preserve team selection if team also plays in season that was selected in dropdown
			if ($routeParams.teamId) {
				if ($routeParams.teamId == "all-teams") {
					$routeParams.teamId = "-1";
				}
				for (var i = 0; i < $scope.teams.length; i++) {
					if ($scope.teams[i].id == $routeParams.teamId) {
						$scope.selectedTeam = $scope.teams[i];
						break;
					}
				}
				if (!$scope.selectedTeam) {
					$scope.selectedTeam = $scope.teams[0];
				}
			} else {
				$scope.selectedTeam = $scope.teams[0];
			}
			var teamsNoAll = teams.slice();
			teamsNoAll.shift();
			$scope.teamsNoAll = teamsNoAll;
			if ($scope.selectedTeam) {
				$scope.selectedTeamNoAll = $scope.selectedTeam;
			} else {
				$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
			}
		});

		//update league id based on season
		HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
			$scope.selectedLeague.id = league_id;
			$scope.getSeasonSchedule();
		});
	};

	$scope.changedConference = function () {
		if ($scope.hasDivision) {
			$scope.selectedDivision.id = -1;
			HockeyTechService.getDivisionsBySeasonIdAndConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, false).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];

				HockeyTechService.getTeamsBySeasonIdConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, true).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = $scope.teams[0];
					$scope.getSeasonSchedule();
				});
			});
		}
	}

	$scope.changedDivision = function () {
		if ($scope.selectedDivision !== null) {
			if ($scope.hasConference && this.selectedConference.conference_id !== -1 && $scope.selectedDivision.id === -1) {
				HockeyTechService.getTeamsBySeasonIdConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, true).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = $scope.teams[0];
					$scope.getSeasonSchedule();
				});
			} else {
				HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, true).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = $scope.teams[0];
					$scope.getSeasonSchedule();
				});
			}
		} else {
			$scope.teams = [];
		}
	};

	$scope.changedTeam = function () {
		$scope.getSeasonSchedule();
	};

	$scope.changedMonth = function () {
		$scope.getSeasonSchedule();
	};

	$scope.changedType = function () {
		$scope.getSeasonSchedule();
	};

	$scope.getData = function (team, season, month, location, leagueId, conferenceId, divisionId, gameType) {
		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = season;

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=schedule';

		if (team != null) {
			url += '&team=' + team;
		}

		if (season != null) {
			url += '&season=' + season;
		}

		if (month != null) {
			url += '&month=' + month;
		}

		if (location != null) {
			url += '&location=' + location;
		}

		if (gameType != null && gameType != -1 && gameType != "-1") {
			url += '&game_type=' + gameType;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&site_id=' + site_id +
			'&league_id=' + leagueId +
			'&conference_id=' + conferenceId +
			'&division_id=' + divisionId +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
				$scope.NecessaryGame = false;
				if (typeof data == 'undefined') {
					return;
				}

				for (var gameIndex = 0; gameIndex < $scope.GameData[0].sections[0].data.length; gameIndex++) {
					// keep a record of if there is at least one necessary
					if ($scope.GameData[0].sections[0].data[gameIndex].ifNecessary != "") {
						$scope.NecessaryGame = true;
					}
				}

				// For hiding and showing the "download all games to calendar" button
				$scope.include_icalendar_functions = false;
				for (var i = 0; i < data[0].sections[0].data.length; i++) {
					if (("mobile_calendar" in data[0].sections[0].data[i].prop)) {
						$scope.include_icalendar_functions = true;
						break;
					}
				}

				if (team == "-1" || team == -1) {
					$scope.setName = $scope.selectedLeague.name;
				} else {
					$scope.setName = $scope.selectedTeam.name;
				}

				//set page title and meta data
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Schedule + " " + $scope.selectedMonth.name + " " + $scope.selectedSeason.name;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.teamId && $routeParams.seasonId && $routeParams.monthId) {
					var setTeamUrl = "";
					if ($routeParams.teamId == "-1") {
						setTeamUrl = "all-teams";
					} else {
						setTeamUrl = $routeParams.teamId;
					}
					setPath = setPath + '/' + setTeamUrl + '/' + $routeParams.seasonId + '/' + $routeParams.monthId;

					if ($scope.hasDivision) {
						$location.search('division', divisionId);
					}
					if ($scope.selectedGameType.id != -1 && $scope.selectedGameType.id != "-1") {
						$location.search('gametype', $scope.selectedGameType.id);
					}
				}
				$rootScope.seoPath = setPath;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.getSeasonSchedule = function () {
		var previousUrl = $location.$$url;
		var setTeamUrl = "";
		if ($scope.selectedTeam.id == "-1") {
			setTeamUrl = "all-teams";
		} else {
			setTeamUrl = $scope.selectedTeam.id;
		}
		var setMonthUrl = "";
		if ($scope.selectedMonth.id == "-1") {
			setMonthUrl = "all-months";
		} else {
			setMonthUrl = $scope.selectedMonth.id;
		}

		var setPath = "";
		if (setTeamUrl == "all-teams") {
			setPath = '/' + $scope.pageName + '/' + setTeamUrl + '/' + $scope.selectedSeason.id + '/' + setMonthUrl;
			$location.path(setPath);
		} else {
			setPath = '/' + $scope.pageName + '/' + setTeamUrl + '/' + $scope.selectedSeason.id + '/' + setMonthUrl + '/' + $scope.location;
			$location.path(setPath);
		}

		$location.search('league', $scope.selectedLeague.id);

		if (typeof $scope.selectedGameType.id != "" && typeof $scope.selectedGameType.id != "undefined" && $scope.selectedGameType.id != "-1") {
			$location.search('gametype', $scope.selectedGameType.id);
		}

		if ($scope.hasDivision) {
			$location.search('division', $scope.selectedDivision.id);
		}

		if ($scope.hasConference) {
			$location.search('conference', $scope.selectedConference.conference_id);
		}

		if (previousUrl != $location.$$url) {
			$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.selectedMonth.id, $scope.location, $scope.selectedLeague.id, $scope.selectedConference.conference_id, $scope.selectedDivision.id, $scope.selectedGameType.id);
		}
	};

	$scope.downloadAllGamesToCalendar = function () {
		var game_ids = [];
		var data = $scope.GameData[0].sections[0].data;
		for (var i = 0; i < data.length; i++) {
			game_ids.push(data[i].row.game_id);
		}
		window.location.href = prodUrl + '/components/calendar/ical_add_games.php?client_code=' + clientCode + '&game_ids=' + game_ids;
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});

app.controller('LSGameReport', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $attrs) {
	var svf_language = $attrs.lang;
	if (typeof svf_language === 'undefined') {
		svf_language = 'en';
	}
	$scope.language = svf_language;
	$scope.loading = true;
	$scope.clients = $attrs.clients;
	$scope.daysahead = ($attrs.daysahead) ? $attrs.daysahead : 7;

	// Get the current date
	const currentDate = new Date();

	// Calculate the future date by adding daysAhead
	const futureDate = new Date(currentDate.getTime() + $scope.daysahead * 24 * 60 * 60 * 1000);

	// Format the dates as strings (e.g., "2023-09-17")
	const formatDate = (date) => {
		const year = date.getFullYear();
		const month = String(date.getMonth() + 1).padStart(2, '0');
		const day = String(date.getDate()).padStart(2, '0');
		return `${year}-${month}-${day}`;
	};

	const date1 = formatDate(currentDate);
	const date2 = formatDate(futureDate);

	// Build the date string
	$scope.dateSpan = `${date1} - ${date2}`;

	// if no clients passed in, default to AHL
	if (!$scope.clients || $scope.clients.length === 0) {
		$scope.clients = 'ahl';
	}

	$scope.getData = function () {
		$scope.lsData = null;
		$scope.dataLoaded = false;
		$scope.loading = true;
		$scope.theMethod = 'jsonp';
		$scope.url = prodUrl + '/feed/?feed=modulekit&key=' + appKey + '&view=lstoday&client_code=' + clientCode + '&clients=' + $scope.clients + '&fmt=json&lang=' + svf_language + '&daysahead=' + $scope.daysahead + '&callback=JSON_CALLBACK';
		$scope.loadError = false;
		$http({ method: $scope.theMethod, url: $scope.url })
			.success(function (data, status, headers, config) {
				$rootScope.feedUrl = $scope.url;
				$scope.status = status;
				$scope.lsData = data.SiteKit.Lstoday;
				$scope.dataLoaded = true;
				$scope.loading = false;
			}).
			error(function () {
				$scope.loadError = true;
				$scope.loading = false;
				// called asynchronously if an error occurs
				// or server returns response with an error status.
			});
	}
	$scope.getData();
});

app.controller('DailyScheduleCtrl', ['$scope', '$http', '$rootScope', '$routeParams', '$q', '$location', 'HockeyTechService', '$interval', '$timeout', 'Firebase', '$filter', '$route', 'svfFb',
	function ($scope, $http, $rootScope, $routeParams, $q, $location, HockeyTechService, $interval, $timeout, Firebase, $filter, $route, svfFb) {

		var svf_language = "en";
		$scope.language = svf_language;
		if ($route.current) {
			$scope.pageName = $route.current.$$route.name;
			svf_language = $route.current.$$route.language;
			$scope.language = svf_language;
		} else {
			$scope.pageName = '';
		}
		if (!html5ModeEnabled) {
			$scope.linkPrefix = '#/';
		} else {
			$scope.linkPrefix = baseRoute;
		}
		$scope.isProStats = lsp_stats;

		$scope.urlRoster = "roster";
		$scope.urlPlayerStats = "player-stats";
		$scope.urlPlayer = "player";
		$scope.urlGameSummary = "game-summary";
		$scope.urlGameCenter = "game-center";
		$scope.urlSchedule = "schedule";
		$scope.forceDate = false;
		if (svf_language == 'fr') {
			$scope.urlRoster = "alignement";
			$scope.urlPlayerStats = "statistiques-des-joueurs";
			$scope.urlPlayer = "joueur";
			$scope.urlGameSummary = "sommaire-du-match";
			$scope.urlGameCenter = "game-centre";
			$scope.urlSchedule = "calendrier";
		}

		var league = '';
		if ($routeParams.hasOwnProperty("league")) {
			league = $routeParams.league;
		}
		var leagueCode = '';
		if ($routeParams.hasOwnProperty("leaguecode")) {
			leagueCode = $routeParams.leaguecode;
		}

		var season = '';
		if ($routeParams.hasOwnProperty("season")) {
			season = $routeParams.season;
		} else {
			season = 'latest';
		}

		let conference = '';
		if ($routeParams.hasOwnProperty("conference")) {
			conference = $routeParams.conference;
		}

		var division = '';
		if ($routeParams.hasOwnProperty("division")) {
			division = $routeParams.division;
		}

		var todaysDate = new Date();
		var yesterDay = new Date();
		var yesterDate = new Date(yesterDay.setDate(yesterDay.getDate() - 1));
		$scope.YesToday = false;

		var bootstrapPromise = HockeyTechService.bootstrap(season, 'daily_schedule', league, leagueCode, svf_language, null, division, conference).then(function (data) {
			$scope.firebaseUrl = data.firebaseUrl;
			$scope.firebaseToken = data.firebaseToken;
			$scope.firebaseApiKey = data.firebaseApiKey;
			$scope.conferences = data.conferencesAll;
			$scope.divisions = data.divisionsAll;
			$scope.seasons = data.seasons;
			$scope.first_season_year = data.first_season_year;
			$scope.svfConfig = data.svfConfig;
			$scope.current_season_id = data.current_season_id;
			$scope.current_league_id = data.current_league_id;
			$scope.leagues = data.leagues;
			$scope.teams = data.teams;
			$scope.svfLanguages = data.svfLanguages;
			$scope.svfLang = data.svfLang;
			$scope.showAd = (typeof data.svfConfig.daily_schedule.show_ad != 'undefined') ? data.svfConfig.daily_schedule.show_ad : false;
			$scope.showTotalGamesCount = (typeof data.svfConfig.daily_schedule.show_total_games_count != 'undefined') ? data.svfConfig.daily_schedule.show_total_games_count : false;
			$scope.combinedLeagues = (typeof data.svfConfig.daily_schedule.combined_leagues != 'undefined') ? data.svfConfig.daily_schedule.combined_leagues : false;
			$scope.useGameCenterUrl = (typeof data.svfConfig.game_center != 'undefined') ? data.svfConfig.game_center : false;
			$scope.showSummaryButton = (typeof data.svfConfig.daily_schedule.summary_button != 'undefined') ? data.svfConfig.daily_schedule.summary_button : false;
			$scope.showScheduleButton = (typeof data.svfConfig.daily_schedule != 'undefined' && typeof data.svfConfig.daily_schedule.showScheduleButton != 'undefined')
				? data.svfConfig.daily_schedule.showScheduleButton
				: false;
			$scope.hideScores = (typeof data.svfConfig.daily_schedule.hide_scores_for_in_progress_games != 'undefined') ? data.svfConfig.daily_schedule.hide_scores_for_in_progress_games : false;
			$scope.miniKit = (typeof data.svfConfig.daily_schedule.minikit != 'undefined') ? data.svfConfig.daily_schedule.minikit : false;
			$scope.refreshInterval = 180000; // time in milliseconds
			$scope.hasGameType = (typeof $scope.svfConfig.use_game_type_filter != 'undefined' ? $scope.svfConfig.use_game_type_filter : false);
			$scope.htvUrl = (typeof data.svfConfig.hockeytv_url != 'undefined') ? data.svfConfig.hockeytv_url : '';
			// Daily schedule can suppress the season/conference/division dropdowns via
			// per-page flags (statview_configuration.daily_schedule.*Dropdown). When a
			// per-page flag is defined we honour its boolean value; otherwise fall back to
			// the global dropdown flags (existence check) for backwards compatibility.
			const dsConfig = $scope.svfConfig.daily_schedule || {};

			$scope.hasConference = (typeof dsConfig.conferenceDropdown != 'undefined')
				? !!dsConfig.conferenceDropdown
				: (typeof $scope.svfConfig.conferenceDropdown != 'undefined');

			$scope.hasSeason = (typeof dsConfig.seasonDropdown != 'undefined')
				? !!dsConfig.seasonDropdown
				: false;

			$scope.hasDivision = (typeof dsConfig.divisionDropdown != 'undefined')
				? !!dsConfig.divisionDropdown
				: (typeof $scope.svfConfig.divisionDropdown != 'undefined');

			// We allow both a league_id and a league_code, league_id takes precendence.
			if ($routeParams.hasOwnProperty("league")) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == $routeParams.league) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}
			else if ($routeParams.hasOwnProperty("leaguecode")) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].code == $routeParams.leaguecode) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}
			if ($routeParams.hasOwnProperty("season")) {
				for (var i = 0; i < $scope.seasons.length; i++) {
					if ($scope.seasons[i].id == $routeParams.season) {
						$scope.selectedSeason = $scope.seasons[i];
						break;
					}
				}
			}
			if ($routeParams.teamId) {
				if ($routeParams.teamId == "all-teams") {
					$routeParams.teamId = "-1";
				}
				$scope.team = $routeParams.teamId;
			} else {
				if (!$scope.team) {
					$scope.team = "-1";
				}
			}

			// Check for force_league property in route params
			$scope.forceLeague = false;
			if ($routeParams.hasOwnProperty("force_league") && $routeParams.force_league == 1) {
				$scope.forceLeague = true;
			}

			//league_id returned from WP
			var wpLeagueId = league_id;
			var setLeagueId = $scope.current_league_id;
			if (wpLeagueId != '') {
				setLeagueId = wpLeagueId
			}

			if ($scope.selectedLeague == null && setLeagueId) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			}

			if ($scope.selectedLeague == null) {
				$scope.selectedLeague = $scope.leagues[0];
			}

			if ($scope.selectedSeason == null && $scope.current_season_id) {
				for (var i = 0; i < $scope.seasons.length; i++) {
					if ($scope.seasons[i].id == $scope.current_season_id) {
						$scope.selectedSeason = $scope.seasons[i];
						break;
					}
				}
			}

			if ($scope.selectedSeason == null) {
				$scope.selectedSeason = $scope.seasons[0];
			}
			$scope.selectedConference = {};
			$scope.selectedConference.id = -1;
			if ($scope.hasConference) {
				if ($routeParams.hasOwnProperty("conference") && $routeParams.conference != -1) {
					for (let i = 0; i < $scope.conferences.length; i++) {
						if ($scope.conferences[i].conference_id === $routeParams.conference) {
							$scope.selectedConference = $scope.conferences[i];
							break;
						}
					}
					if ($scope.selectedConference == null) {
						$scope.selectedConference = $scope.conferences[0];
					}
					HockeyTechService.getDivisionsBySeasonIdAndConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, false).then(function (divisions) {
						$scope.divisions = divisions;
						$scope.selectedDivision = $scope.divisions[0];
					});
				} else {
					$scope.selectedConference = $scope.conferences[0];
				}
			}

			$scope.selectedDivision = {};
			$scope.selectedDivision.id = -1;

			if ($scope.hasDivision) {
				if ($routeParams.hasOwnProperty("division")) {
					$scope.selectedDivision.id = division;
				}
				HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, true).then(function (divisions) {
					$scope.divisions = divisions;
					$scope.selectedDivision = $scope.divisions[0];
					if ($routeParams.hasOwnProperty("division")) {
						for (var i = 0; i < $scope.divisions.length; i++) {
							if ($scope.divisions[i].id == $routeParams.division) {
								$scope.selectedDivision = $scope.divisions[i];
								break;
							}
						}
					}
				});
			}

			if ($routeParams.getDate || $scope.gameDate) {
				$scope.forceDate = true;
				//Take the text from the given date and convert it into a javascript date object
				var rawDate = "";
				if ($routeParams.getDate) {
					rawDate = $routeParams.getDate;
				} else {
					rawDate = $scope.gameDate;
				}
				var dateParts = rawDate.split('-');
				if (dateParts.length != 3) {
					//Invalid format
					$scope.selectedDate = new Date();
				} else {
					$scope.selectedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
				}
			}
			else {
				//Use today
				$scope.selectedDate = new Date();

				if (typeof data.dailySchedChangeoverHour !== 'undefined') {
					// If the hour of the day is earlier than the daily schedule changeover,
					// we need to update the selected date to yesterday by default
					if (todaysDate.getHours() < parseInt(data.dailySchedChangeoverHour)) {
						$scope.selectedDate.setDate(todaysDate.getDate() - 1);
					}
				}
			}

			//Check for valid date
			if (Object.prototype.toString.call($scope.selectedDate) === "[object Date]") {
				if (isNaN($scope.selectedDate.getTime())) {
					$scope.selectedDate = new Date();
				}
			}
			else {
				$scope.selectedDate = new Date();
			}

			//set date for the calendar
			var monthNumber = Number($filter('date')($scope.selectedDate, 'MM')); // 01-12 like
			var day = Number($filter('date')($scope.selectedDate, 'dd')); //01-31 like
			var year = Number($filter('date')($scope.selectedDate, 'yyyy'));//2014 like
			$scope.onloadDate = monthNumber + "/" + day + "/" + year;

			//set min date for calendar
			$scope.calMinDate = "01/01/" + $scope.first_season_year;
			//set max date for calendar
			var curYear = Number($filter('date')(new Date(), 'yyyy'));
			var nextYear = curYear + 1;
			$scope.calMaxDate = "12/31/" + nextYear;

			$scope.gameTypes = "";
			$scope.selectedGameType = {};
			$scope.selectedGameType.id = -1;
			if ($scope.hasGameType) {
				var gameTypePromise = HockeyTechService.getGameTypes().then(function (gameTypes) {
					$scope.gameTypes = gameTypes;
					if ($routeParams.hasOwnProperty("gametype")) {
						for (i = 0; i < $scope.gameTypes.length; i++) {
							if ($scope.gameTypes[i].id == $routeParams.gametype) {
								$scope.selectedGameType = $scope.gameTypes[i];
							}
						}
					}
					$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
				});
			} else {
				$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
			}

			//$scope.setPageRefresh();

		}).catch(function () {
			$scope.loadError = true;
		});

		$scope.changedGameType = function () {
			$location.search('league', $scope.selectedLeague.id);
			$location.search('season', $scope.selectedSeason.id);
			$location.search('division', $scope.selectedDivision.id);
			$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
		};

		$scope.changedSeason = function () {
			$location.search('league', $scope.selectedLeague.id);
			$location.search('season', $scope.selectedSeason.id);
			if ($scope.hasConference) {
				$scope.selectedConference.conference_id = -1;
				$location.search('conference', -1);
				HockeyTechService.getConferencesBySeasonId($scope.selectedSeason.id, false).then(function (conferences) {
					$scope.conferences = conferences;
					$scope.selectedConference = $scope.conferences[0];
				});
			}
			if ($scope.hasDivision) {
				HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, true).then(function (divisions) {
					$scope.divisions = divisions;
					$scope.selectedDivision = $scope.divisions[0];
					$location.search('division', $scope.selectedDivision.id);
					$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
				});
			} else {
				$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
			}
		};

		$scope.changedConference = function () {
			if ($scope.hasConference) {
				$location.search('conference', $scope.selectedConference.conference_id);
				$scope.selectedDivision.id = -1;
				HockeyTechService.getDivisionsBySeasonIdAndConferenceId($scope.selectedSeason.id, $scope.selectedConference.conference_id, false).then(function (divisions) {
					$scope.divisions = divisions;
					$scope.selectedDivision = $scope.divisions[0];
					$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
				});
			}
		}

		$scope.changedDivision = function () {
			$location.search('division', $scope.selectedDivision.id);
			$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
		}

		$scope.setPageRefresh = function () {
			// Daily schedule needs to refresh if the page is for the current day.
			if (!$scope.selectedDate || ($scope.selectedDate.getFullYear() == todaysDate.getFullYear() && $scope.selectedDate.getMonth() == todaysDate.getMonth()
				&& $scope.selectedDate.getDate() == todaysDate.getDate())) {
				if ($scope.refreshInterval > 0) {
					$scope.scheduleInterval = $interval(function () {
						$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedConference.conference_id, $scope.selectedDivision.id);
					}, $scope.refreshInterval);
				}
				else {
					$interval.cancel($scope.scheduleInterval);
				}
			}
		}

		$scope.subtractDay = function () {
			$scope.selectedDate = new Date($scope.selectedDate.setDate($scope.selectedDate.getDate() - 1));
			$scope.getSelectedDateData();
		};

		$scope.addDay = function () {
			$scope.selectedDate = new Date($scope.selectedDate.setDate($scope.selectedDate.getDate() + 1));
			$scope.getSelectedDateData();
		};

		$scope.getSelectedDateData = function () {
			var dateString = $scope.selectedDate.getFullYear() + '-' + ($scope.selectedDate.getMonth() + 1) + '-' + $scope.selectedDate.getDate();
			$scope.forceDate = true;

			var setTeamUrl = "";
			if ($scope.team == "-1") {
				setTeamUrl = "all-teams"
			} else {
				setTeamUrl = $scope.team;
			}

			if ($scope.pageName) {
				var setPath = "";
				if (setTeamUrl == "all-teams") {
					setPath = '/' + $scope.pageName + '/' + dateString;
				} else {
					setPath = '/' + $scope.pageName + '/' + dateString + '/' + setTeamUrl;
				}
				$location.path(setPath);
				$location.search('league', $scope.selectedLeague.id);
				$location.search('season', $scope.selectedSeason.id);
				$location.search('division', $scope.selectedDivision.id);
			} else {
				$scope.getData($scope.selectedDate, $scope.selectedLeague.id, $scope.selectedSeason.id, $scope.team, $scope.selectedDivision.id);
			}
		};

		$scope.$watch('calDate', function (calDate, oldValue) {
			if (typeof calDate != 'undefined' && typeof oldValue != 'undefined') {
				if (Date.parse(calDate)) {
					$scope.selectedDate = new Date(calDate);
					$scope.calDate = $filter('date')($scope.selectedDate, 'EEEE, MMM d, y');
					if (svf_language == 'fr') {
						$scope.calDate = $filter('date')($scope.selectedDate, 'EEEE, d MMMM, y');
					}
					$scope.dateShow = true;
					$scope.getSelectedDateData();
				}
			}
		});

		$scope.getData = function (forDate, leagueId, seasonId, teamId, conferenceId, divisionId) {
			var dateString = forDate.getFullYear() + '-' + (forDate.getMonth() + 1) + '-' + forDate.getDate();
			$scope.GameData = null;
			$scope.loading = true;
			$scope.dataLoaded = false;
			$scope.CheckData = null;

			let allLeagues = 0;
			if ($scope.combinedLeagues && !$scope.forceLeague) {
				allLeagues = 1;
			}

			var url = prodUrl + '/feed/index.php?feed=statviewfeed' +
				'&view=schedule_day';

			if ($scope.selectedGameType.id != -1 && $scope.selectedGameType.id != "-1") {
				url += '&game_type=' + $scope.selectedGameType.id;
			}

			url += '&date=' + dateString +
				'&site_id=' + site_id +
				'&key=' + appKey +
				'&client_code=' + clientCode +
				'&league_id=' + leagueId +
				'&season_id=' + seasonId +
				'&conference_id=' + conferenceId +
				'&division_id=' + divisionId +
				'&team=' + teamId +
				'&lang=' + svf_language +
				'&forceDate=' + $scope.forceDate +
				'&useSeason=' + $scope.hasSeason +
				'&allLeagues=' + allLeagues +
				'&callback=JSON_CALLBACK';

			$http({ method: 'jsonp', url: url })
				.success(function (data) {
					$rootScope.feedUrl = url;
					$scope.GameData = data;
					$scope.NecessaryGame = false;

					for (var gameIndex = 0; gameIndex < $scope.GameData.length; gameIndex++) {

						if (gameIndex === 0 && ($scope.GameData[gameIndex].seasonId != $scope.selectedSeason.id)) {
							// Feed determined a different season for this date than what we have loaded.
							// Sync scope, URL, and teams collection so logos resolve and date nav doesn't
							// pin a stale season into the URL on the next click.
							$scope.selectedSeason.id = $scope.GameData[gameIndex].seasonId;
							$location.search('season', $scope.selectedSeason.id);
							HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
								$scope.teams = teams;
							});
						}
						// Check the date on the first game returned. If the rollover has kicked in, we
						// could be seeing games from yetesrday and need to update the UI accordingly
						if ((gameIndex === 0) && ($scope.GameData[gameIndex].date != dateString)) {
							var dateParts = $scope.GameData[gameIndex].date.split('-');
							if (dateParts.length == 3) {
								$scope.selectedDate = new Date(dateParts[0], dateParts[1] - 1, dateParts[2]);
								if (angular.isDefined($scope.date)) {
									$scope.date.day = dateParts[2];
								}
							}
						}

						var homeGoals = [];
						var visitingGoals = [];
						// keep a record of if there is at least one necessary game
						if ($scope.GameData[gameIndex].ifNecessary == 1) {
							$scope.NecessaryGame = true;
						}

						for (var periodIndex = 0; periodIndex < $scope.GameData[gameIndex].periods.length; periodIndex++) {
							for (var goalIndex = 0; goalIndex < $scope.GameData[gameIndex].periods[periodIndex].goals.length; goalIndex++) {
								$scope.GameData[gameIndex].periods[periodIndex].goals[goalIndex].period = $scope.GameData[gameIndex].periods[periodIndex].info.longName;
								if ($scope.GameData[gameIndex].periods[periodIndex].goals[goalIndex].team.id == $scope.GameData[gameIndex].homeTeam.info.id) {
									homeGoals.push($scope.GameData[gameIndex].periods[periodIndex].goals[goalIndex]);
								} else {
									visitingGoals.push($scope.GameData[gameIndex].periods[periodIndex].goals[goalIndex]);
								}
							}
						}

						$scope.GameData[gameIndex].homeTeam.goals = homeGoals;
						$scope.GameData[gameIndex].visitingTeam.goals = visitingGoals;

						//display HockeyTV Watch button
						$scope.GameData[gameIndex].showWatchBtn = false;
						if ($scope.GameData[gameIndex].flohockeyUrl !== '' && $scope.GameData[gameIndex].flohockeyUrl !== undefined) {
							$scope.GameData[gameIndex].showWatchBtn = true;
							$scope.GameData[gameIndex].class = 'ht-game-htv';
							$scope.GameData[gameIndex].title = $scope.svfLang.Watch_On_Flo;
							let floUtm = '?utm_medium=partner&utm_source=leaguestatwatchnow&utm_content=watchgame&utm_campaign=' + clientCode;
							$scope.GameData[gameIndex].floUrl = $scope.GameData[gameIndex].flohockeyUrl + floUtm;
						}
						if ($scope.GameData[gameIndex].status == 'Postponed' || $scope.GameData[gameIndex].status == 'Home Forfeit' || $scope.GameData[gameIndex].status == 'Visiting Forfeit') {
							$scope.GameData[gameIndex].showWatchBtn = false;
						}

					}

					$scope.CheckData = data.length + ' ' + $scope.svfLang.Games;
					$scope.dataLoaded = true;
					$scope.loading = false;
					$scope.calDate = $filter('date')(forDate, 'EEEE, MMM d, y');
					if (svf_language == 'fr') {
						$scope.calDate = $filter('date')(forDate, 'EEEE, d MMMM, y');
					}
					$scope.dateShow = true;

					var dateRangeMinus = new Date(forDate);
					var dateRangePlus = new Date(forDate);
					var prevDate = dateRangeMinus.setDate(forDate.getDate() - 1);
					$scope.prevDate = $filter('date')(prevDate, 'EEEE, MMM d');
					if (svf_language == 'fr') {
						$scope.prevDate = $filter('date')(prevDate, 'EEEE, d MMM');
					}
					var nextDate = dateRangePlus.setDate(forDate.getDate() + 1);
					$scope.nextDate = $filter('date')(nextDate, 'EEEE, MMM d');
					if (svf_language == 'fr') {
						$scope.nextDate = $filter('date')(nextDate, 'EEEE, d MMM');
					}

					var setName = $scope.selectedLeague.name;
					var setDate = $filter('date')(forDate, 'EEEE, MMM d, y');
					$rootScope.seoTitle = setName + ' ' + $scope.svfLang.Daily_Schedule + ' ' + setDate;

					if ($scope.pageName) {
						var setPath = baseRoute + $scope.pageName;
						if ($routeParams.getDate) {
							var setTeamUrl = "";
							if ($routeParams.teamId == "-1" || !$routeParams.teamId) {
								setTeamUrl = "all-teams";
							} else {
								setTeamUrl = $routeParams.teamId;
							}
							if (setTeamUrl == "all-teams") {
								setPath = setPath + '/' + $routeParams.getDate
							} else {
								setPath = setPath + '/' + $routeParams.getDate + '/' + setTeamUrl
							}
						}
						$rootScope.seoPath = setPath;
					}

				})
				.error(function (data, status, headers, config) {
					$scope.loadError = true;
				});
		};

		$scope.countCols = function (Obj) {
			return Object.keys(Obj).length;
		}

		// Code to setup live firebase updates (if enabled)
		bootstrapPromise.then(function () {
			if (!$scope.svfConfig.liveScoreUpdates) {
				return;
			}

			var fbPubClockRef;
			$scope.PubGameClock = {};
			var fbRunningClocks = {};
			var fbGoalSummary;
			$scope.GoalSummary = {};
			var fbShotSummary;
			$scope.ShotSummary = {};
			var fbGoalsRef;
			$scope.Goals = {};

			var fbNodePath = $scope.firebaseUrl + "/svf/" + clientCode;

			svfFb.authenticate($scope.firebaseUrl, $scope.firebaseApiKey);

			// Get clock firebase references
			if ($scope.language == "en") {
				fbPubClockRef = firebase.database().ref().child("/svf/" + clientCode + "/publishedclock/1/games/");
			} else if ($scope.language == "fr") {
				fbPubClockRef = firebase.database().ref().child("/svf/" + clientCode + "/publishedclock/2/games/");
			} else {
				console.log("ERROR: DailyScheduleCtrl saw an invalid language after resolving the fbAuthorizedPromise", $scope.language);
			}

			fbRunningClocksRef = firebase.database().ref().child("/svf/" + clientCode + "/runningclock/games/");

			if (fbPubClockRef) {

				$scope.fbClockSubscribe = function (date) {
					// Remove the old listeners (if they exist)

					// Listen for published clock firebase updates
					var fbPubClockDateFilteredRef = fbPubClockRef.orderByChild('DatePlayed').equalTo(date);
					fbPubClockDateFilteredRef.on('child_added', $scope.fbPubClockUpdate);
					fbPubClockDateFilteredRef.on('child_changed', $scope.fbPubClockUpdate);

					// Listen for running clock firebase updates
					var fbRunningClocksDateFilteredRef = fbRunningClocksRef.orderByChild('DatePlayed').equalTo(date);
					fbRunningClocksDateFilteredRef.on('child_added', $scope.fbRunningClockUpdate);
					fbRunningClocksDateFilteredRef.on('child_changed', $scope.fbRunningClockUpdate);
					fbRunningClocksDateFilteredRef.on('child_removed', $scope.fbRunningClockRemoved);

					// Remove the firebase listeners when the controller is destroyed
					$scope.$on('$destroy', function () {
						fbPubClockDateFilteredRef.off('child_added', $scope.fbPubClockUpdate);
						fbPubClockDateFilteredRef.off('child_changed', $scope.fbPubClockUpdate);
						fbRunningClocksDateFilteredRef.off('child_added', $scope.fbRunningClockUpdate);
						fbRunningClocksDateFilteredRef.off('child_changed', $scope.fbRunningClockUpdate);
					});

				};

				$scope.fbPubClockUpdate = function (snapshot) {
					// Store the game data
					$scope.PubGameClock[snapshot.key] = snapshot.val();
					$scope.updateClockWithFbData();
				};

				$scope.fbRunningClockUpdate = function (snapshot) {
					var fbRunningClock = snapshot.val();
					if (fbRunningClock.Clock && fbRunningClock.Clock.Minutes && fbRunningClock.Clock.Seconds) {
						fbRunningClocks[snapshot.key] = {
							minutes: parseInt(fbRunningClock.Clock.Minutes) || 0,
							seconds: parseInt(fbRunningClock.Clock.Seconds) || 0
						};
						$scope.updateClockWithFbData();
					}
				};

				$scope.fbRunningClockRemoved = function (snapshot) {
					delete fbRunningClocks[snapshot.key]
					$scope.updateClockWithFbData();
				};

				$scope.updateClockWithFbData = function () {
					if ($scope.GameData) {

						angular.forEach($scope.GameData, function (svGame) {

							var svGameId = parseInt(svGame.id);
							var fbGame = $scope.PubGameClock[svGameId];

							$timeout(function (svGameId, svGame, fbGame) {
								return function () {

									if (fbGame) {

										svGame.started = fbGame.Started ? 1 : 0;
										svGame.final = fbGame.Final ? 1 : 0;

										//check game status. Might change if scorebar left open before games starts
										if (fbGame.StatusId) {

											svGame.GameStatus = fbGame.StatusId.toString();
											//game in progress
											if (fbGame.StatusId == 2) {

												var gameMin;
												var gameSec;

												if (fbRunningClocks[svGameId]) { // Check if this game has a running clock

													var runningClock = fbRunningClocks[svGameId];

													gameMin = runningClock.minutes < 10 ? '0' + runningClock.minutes.toString() : runningClock.minutes.toString();
													gameSec = runningClock.seconds < 10 ? '0' + runningClock.seconds.toString() : runningClock.seconds.toString();

												} else { // Use this game's published clock

													gameMin = fbGame.ClockMinutes < 10 ? '0' + fbGame.ClockMinutes.toString() : fbGame.ClockMinutes.toString();
													gameSec = fbGame.ClockSeconds < 10 ? '0' + fbGame.ClockSeconds.toString() : fbGame.ClockSeconds.toString();

												}

												var gamePer = fbGame.PeriodLongName;

												svGame.status = gameMin + ':' + gameSec + ' ' + gamePer;

											} else {

												svGame.status = fbGame.ProgressString;

											}
										}
									}

								};
							}(svGameId, svGame, fbGame));

						});
					}
				}

				//subscribe to goal summary
				if ($scope.language == "en") {
					fbGoalSummary = firebase.database().ref().child("/svf/" + clientCode + "/goalssummary/1/games/");
				} else if ($scope.language == "fr") {
					fbGoalSummary = firebase.database().ref().child("/svf/" + clientCode + "/goalssummary/2/games/");
				}

				if (fbGoalSummary) {

					$scope.fbGoalSummarySubscribe = function (date) {
						// Remove the old listeners (if they exist)
						// Listen for firebase updates
						var fbGoalSummaryDateFilteredRef = fbGoalSummary.orderByChild('DatePlayed').equalTo(date);
						fbGoalSummaryDateFilteredRef.on('child_added', $scope.fbGoalSummaryUpdate);
						fbGoalSummaryDateFilteredRef.on('child_changed', $scope.fbGoalSummaryUpdate);

						// Remove the firebase listeners when the controller is destroyed
						$scope.$on('$destroy', function () {
							fbGoalSummaryDateFilteredRef.off('child_added', $scope.fbGoalSummaryUpdate);
							fbGoalSummaryDateFilteredRef.off('child_changed', $scope.fbGoalSummaryUpdate);
						});
					}

					$scope.fbGoalSummaryUpdate = function (snapshot) {
						$scope.GoalSummary[snapshot.key] = snapshot.val();
						$scope.updateGoalSummaryData();
					}

					$scope.updateGoalSummaryData = function () {
						if ($scope.GameData) {
							angular.forEach($scope.GameData, function (svGame) {

								var svGameId = parseInt(svGame.id);
								var fbGame = $scope.GoalSummary[svGameId];

								$timeout(function (svGameId, svGame, fbGame) {

									if (fbGame) {

										// Update total goals
										svGame.homeTeam.stats.goals = fbGame.HomeGoalTotal.toString();
										svGame.visitingTeam.stats.goals = fbGame.VisitorGoalTotal.toString();

										// Update period goals
										if (fbGame.PeriodsInfo) {

											angular.forEach(svGame.periods, function (svPeriod) {
												svPeriod.dirty = true; // Set each period to 'dirty' so we can remove the 'dirty' ones after the FB update
											});

											// Update home goals
											angular.forEach(fbGame.PeriodsInfo, function (periodInfo, periodId) {
												var periodExists = false;

												for (var key in svGame.periods) {
													if (parseInt(periodId) === parseInt(svGame.periods[key].info.id)) {
														svGame.periods[key].stats.homeGoals = fbGame.HomeGoalsByPeriod[periodId].toString();
														svGame.periods[key].stats.visitingGoals = fbGame.VisitorGoalsByPeriod[periodId].toString();
														svGame.periods[key].dirty = false;
														periodExists = true;
														break;
													}
												}

												if (!periodExists) {
													var newGameDataPeriod = {
														dirty: true,
														info: { shortName: periodInfo.ShortName, longName: periodInfo.LongName },
														stats: {
															homeGoals: fbGame.HomeGoalsByPeriod[periodId].toString(),
															homeShots: "0",
															visitingGoals: fbGame.VisitorGoalsByPeriod[periodId].toString(),
															visitingShots: "0",
														},
														goals: [], // TODO: need to add goals for this period.
														penalties: [] // Currently not using this data; leaving empty.
													};
													svGame.periods.push(newGameDataPeriod);
												}
											});

											svGame.periods = svGame.periods.filter(function (svPeriod) { // Remove all the 'dirty' periods
												return !svPeriod.dirty;
											});

										}

										//update P/P
										if (fbGame.HomePowerPlayGoals || fbGame.HomePowerPlayAttempts) {
											svGame.homeTeam.stats.powerPlayGoals = fbGame.HomePowerPlayGoals;
											svGame.homeTeam.stats.powerPlayOpportunities = fbGame.HomePowerPlayAttempts;
										}
										if (fbGame.VisitorPowerPlayGoals || fbGame.VisitorPowerPlayAttempts) {
											svGame.visitingTeam.stats.powerPlayGoals = fbGame.VisitorPowerPlayGoals;
											svGame.visitingTeam.stats.powerPlayOpportunities = fbGame.VisitorPowerPlayAttempts;
										}
									}

								}(svGameId, svGame, fbGame));


							});
						}
					}
				}

				//subscribe to shot summary
				if ($scope.language == "en") {
					fbShotSummary = firebase.database().ref().child("/svf/" + clientCode + "/shotssummary/1/games/");
				} else if ($scope.language == "fr") {
					fbShotSummary = firebase.database().ref().child("/svf/" + clientCode + "/shotssummary/2/games/");
				} else {
					console.log("ERROR: DailyScheduleCtrl saw an invalid language", $scope.language);
				}
				if (fbShotSummary) {

					$scope.fbShotSummarySubscribe = function (date) {
						// Remove the old listeners (if they exist)
						// Listen for firebase updates
						var fbShotSummaryDateFilteredRef = fbShotSummary.orderByChild('DatePlayed').equalTo(date);
						fbShotSummaryDateFilteredRef.on('child_added', $scope.fbShotSummaryUpdate);
						fbShotSummaryDateFilteredRef.on('child_changed', $scope.fbShotSummaryUpdate);

						// Remove the firebase listeners when the controller is destroyed
						$scope.$on('$destroy', function () {
							fbShotSummaryDateFilteredRef.off('child_added', $scope.fbShotSummaryUpdate);
							fbShotSummaryDateFilteredRef.off('child_changed', $scope.fbShotSummaryUpdate);
						});
					}

					$scope.fbShotSummaryUpdate = function (snapshot) {
						$scope.ShotSummary[snapshot.key] = snapshot.val();
						$scope.updateShotSummaryData();
					}

					$scope.updateShotSummaryData = function () {
						if ($scope.GameData) {
							angular.forEach($scope.GameData, function (svGame) {

								var svGameId = parseInt(svGame.id);
								var fbGame = $scope.ShotSummary[svGameId];

								$timeout(function (svGameId, svGame, fbGame) {

									if (fbGame) {
										// Update total goals
										if (fbGame.HomeShotTotal) {
											svGame.homeTeam.stats.shots = fbGame.HomeShotTotal;
										}
										if (fbGame.VisitorShotTotal) {
											svGame.visitingTeam.stats.shots = fbGame.VisitorShotTotal;
										}
									}

								}(svGameId, svGame, fbGame));

							});
						}
					}
				}

				//subscribe to goals
				if ($scope.language == "en") {
					fbGoalsRef = firebase.database().ref().child("/svf/" + clientCode + "/goals/1/games/");
				} else if ($scope.language == "fr") {
					fbGoalsRef = firebase.database().ref().child("/svf/" + clientCode + "/goals/2/games/");
				} else {
					console.log("ERROR: DailyScheduleCtrl saw an invalid language", $scope.language);
				}
				if (fbGoalsRef) {

					$scope.fbGoalsRefSubscribe = function (date) {
						// Remove the old listeners (if they exist)
						// Listen for firebase updates
						var fbGoalsDateFilteredRef = fbGoalsRef.orderByChild('DatePlayed').equalTo(date);
						fbGoalsDateFilteredRef.on('child_added', $scope.fbGoalsUpdate);
						fbGoalsDateFilteredRef.on('child_changed', $scope.fbGoalsUpdate);

						// Remove the firebase listeners when the controller is destroyed
						$scope.$on('$destroy', function () {
							fbGoalsDateFilteredRef.off('child_added', $scope.fbGoalsUpdate);
							fbGoalsDateFilteredRef.off('child_changed', $scope.fbGoalsUpdate);
						});
					}

					$scope.fbGoalsUpdate = function (snapshot) {
						$scope.Goals[snapshot.key] = snapshot.val().GameGoals;
						$scope.updateGameGoalData();
					}

					$scope.updateGameGoalData = function () {
						if ($scope.GameData) {

							angular.forEach($scope.GameData, function (svGame) {
								var svGameId = parseInt(svGame.id);
								var fbGameGoals = $scope.Goals[svGameId];
								var newHomeSVGoals = [];
								var newVisitorSVGoals = [];

								angular.forEach(fbGameGoals, function (fbGoal) {

									var newSVGoal = {
										period: fbGoal.PeriodLongName,
										time: fbGoal.Time,
										scoredBy: {
											id: fbGoal.ScorerPlayerId,
											firstName: fbGoal.ScorerPlayerFirstName,
											lastName: fbGoal.ScorerPlayerLastName
										}
									};

									if (fbGoal.IsHome) {

										newHomeSVGoals.push(newSVGoal);

									} else {

										newVisitorSVGoals.push(newSVGoal);

									}

								});

								$timeout(function (svGame) {
									if (fbGameGoals) {
										svGame.homeTeam.goals = newHomeSVGoals;
										svGame.visitingTeam.goals = newVisitorSVGoals;
									}
								}(svGame, newHomeSVGoals, newVisitorSVGoals));

							});
						}
					}
				}

				// Subscribe to the firebase games for the date: $scope.selectedDate. Re-subscribe when $scope.selectedDate changes.
				$scope.$watch('selectedDate', function (selectedDate, oldValue) {
					var yearString = selectedDate.getFullYear().toString();
					var monthInt = selectedDate.getMonth() + 1;
					var monthString = monthInt < 10 ? '0' + monthInt.toString() : monthInt.toString();
					var dateInt = selectedDate.getDate();
					var dayString = dateInt < 10 ? '0' + dateInt.toString() : dateInt.toString();
					if (!yearString || !monthString || !dayString) {
						console.log("ERROR: undefined year, month or day. Can't subscribe to firebase games.");
						return;
					} else {
						var subscribeDate = yearString + '-' + monthString + '-' + dayString;
					}

					if ($scope.selectedDate.getFullYear() == todaysDate.getFullYear() && $scope.selectedDate.getMonth() == todaysDate.getMonth() && $scope.selectedDate.getDate() == todaysDate.getDate() ||
						$scope.selectedDate.getFullYear() == yesterDate.getFullYear() && $scope.selectedDate.getMonth() == yesterDate.getMonth() && $scope.selectedDate.getDate() == yesterDate.getDate()) {
						$scope.YesToday = true;
					}
					//only subscribe if yesterday or today
					//subscribe to fb game nodes
					if ($scope.YesToday) {
						$scope.fbClockSubscribe(subscribeDate);
						$scope.fbGoalSummarySubscribe(subscribeDate);
						$scope.fbShotSummarySubscribe(subscribeDate);
						$scope.fbGoalsRefSubscribe(subscribeDate);
					}
				});
			}
		});

	}]);

app.controller('RosterCtrl', function ($scope, $http, $rootScope, $location, $routeParams, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season = 'latest';
	$scope.setClient = clientCode;

	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}

	let league = '';
	if ($routeParams.seasonId) {
		league = '-1';
		season = $routeParams.seasonId;
	} else {
		if ($routeParams.hasOwnProperty("league")) {
			league = $routeParams.league;
		}
	}

	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	HockeyTechService.bootstrap(season, 'roster', league, leagueCode, svf_language).then(function (data) {
		$scope.divisions = data.divisions;
		$scope.seasons = data.seasons;
		$scope.teamsNoAll = data.teamsNoAll;
		$scope.rosterstatus = data.rosterstatus;
		$scope.footerinfo = data.rosterFooter;
		$scope.showRosterStatus = data.showRosterStatus;
		$scope.current_league_id = data.current_league_id;
		$scope.current_season_id = data.current_season_id;
		$scope.leagues = data.leagues;
		$scope.svfConfig = data.svfConfig;
		$scope.hasDivision = (typeof $scope.svfConfig.divisionDropdown != 'undefined' ? true : false);
		$scope.svfLang = data.svfLang;
		$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.seasonId) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		// If the league doesn't have any non-hidden seasons, selectedSeason won't be set
		if ($scope.selectedSeason == null) {
			$scope.selectedSeason = {};
			$scope.selectedSeason.id = -1;
		}

		if ($routeParams.teamId) {
			for (i = 0; i < $scope.teamsNoAll.length; i++) {
				if ($scope.teamsNoAll[i].id == $routeParams.teamId) {
					$scope.selectedTeamNoAll = $scope.teamsNoAll[i];
					if ($scope.hasDivision) {
						for (j = 0; j < $scope.divisions.length; j++) {
							if ($scope.divisions[j].id == $scope.teamsNoAll[i].division_id) {
								$scope.selectedDivision = $scope.divisions[j];
								HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, false).then(function (teams) {
									$scope.teamsNoAll = teams;
								});
							}
						}
					}
					break;
				}
			}

			if ($scope.selectedTeamNoAll == null) {
				$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
			}
		} else {
			$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
		}

		// If the season doesn't have any teams, selectedTeamNoAll won't be set
		if ($scope.selectedTeamNoAll == null) {
			$scope.selectedTeamNoAll = {};
		}

		if ($routeParams.rosterStatus) {
			for (i = 0; i < $scope.rosterstatus.length; i++) {
				if ($scope.rosterstatus[i].id == $routeParams.rosterStatus) {
					$scope.selectedRosterStatus = $scope.rosterstatus[i];
					break;
				}
			}

			if ($scope.selectedRosterStatus == null) {
				$scope.selectedRosterStatus = $scope.rosterstatus[0];
			}
		} else {
			$scope.selectedRosterStatus = $scope.rosterstatus[0];
		}

		if (!$scope.showRosterStatus) {
			$scope.selectedRosterStatus = 0;
		}

		//capture the first load from roster and redirect to the first team
		if (!$routeParams.teamId) {
			if (!$routeParams.rosterStatus) {
				$location.path('/' + $scope.pageName + '/' + $scope.selectedTeamNoAll.id + '/' + $scope.selectedSeason.id);
			} else if ($routeParams.rosterStatus) {
				$location.path('/' + $scope.pageName + '/' + $scope.selectedTeamNoAll.id + '/' + $scope.selectedSeason.id + '/' + $routeParams.rosterStatus);
			}
		} else {
			if ($scope.hasDivision && (typeof $scope.selectedDivision != 'undefined')) {
				$location.search('division', $scope.selectedDivision.id);
			}
			$scope.getData($scope.selectedTeamNoAll.id, $scope.selectedSeason.id, $scope.selectedRosterStatus.id, $scope.selectedLeague.id);
		}

	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
			$scope.changedSeason();
		});
		$scope.getRoster();
	};

	$scope.changedSeason = function () {
		if ($scope.hasDivision) {
			HockeyTechService.getDivisionsBySeasonId($scope.selectedSeason.id, 0).then(function (divisions) {
				$scope.divisions = divisions;
				$scope.selectedDivision = $scope.divisions[0];
				HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, false).then(function (teams) {
					$scope.teams = teams;
					$scope.selectedTeam = "";
					// Preserve team selection if team also plays in season that was selected in dropdown
					if ($routeParams.teamId) {
						for (var i = 0; i < $scope.teams.length; i++) {
							if ($scope.teams[i].id == $routeParams.teamId) {
								$scope.selectedTeam = $scope.teams[i];
								break;
							}
						}
						if (!$scope.selectedTeam) {
							$scope.selectedTeam = $scope.teams[0];
						}
					} else {
						$scope.selectedTeam = $scope.teams[0];
					}
					$scope.teamsNoAll = $scope.teams;
					if ($scope.selectedTeam) {
						$scope.selectedTeamNoAll = $scope.selectedTeam;
					} else {
						$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
					}
					//update league id based on season
					HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
						$scope.selectedLeague.id = league_id;
						$scope.getRoster();
					});
				});
			});
		} else {
			HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
				$scope.teams = teams;
				$scope.selectedTeam = "";
				// Preserve team selection if team also plays in season that was selected in dropdown
				if ($routeParams.teamId) {
					for (var i = 0; i < $scope.teams.length; i++) {
						if ($scope.teams[i].id == $routeParams.teamId) {
							$scope.selectedTeam = $scope.teams[i];
							break;
						}
					}
					if (!$scope.selectedTeam) {
						$scope.selectedTeam = $scope.teams[0];
					}
				} else {
					$scope.selectedTeam = $scope.teams[0];
				}
				var teamsNoAll = teams.slice();
				teamsNoAll.shift();
				$scope.teamsNoAll = teamsNoAll;
				if ($scope.selectedTeam) {
					$scope.selectedTeamNoAll = $scope.selectedTeam;
				} else {
					$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
				}
				//update league id based on season
				HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
					$scope.selectedLeague.id = league_id;
					$scope.getRoster();
				});
			});
		}

	};

	$scope.changedDivision = function () {
		if ($scope.selectedDivision !== null) {
			HockeyTechService.getTeamsBySeasonIdDivisionId($scope.selectedSeason.id, $scope.selectedDivision.id, false).then(function (teams) {
				$scope.teamsNoAll = teams;
				$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
				$scope.getRoster();
			});
		} else {
			$scope.teamsNoAll = [];
		}
	};

	$scope.getRoster = function () {
		if (!$scope.selectedRosterStatus.id) {
			$location.path('/' + $scope.pageName + '/' + $scope.selectedTeamNoAll.id + '/' + $scope.selectedSeason.id);
		} else if ($scope.selectedRosterStatus.id) {
			$location.path('/' + $scope.pageName + '/' + $scope.selectedTeamNoAll.id + '/' + $scope.selectedSeason.id + '/' + $scope.selectedRosterStatus.id);
		}
		if ($scope.hasDivision && (typeof $scope.selectedDivision != 'undefined')) {
			$location.search('division', $scope.selectedDivision.id);
		}
		$location.search('league', $scope.selectedLeague.id);
	};

	$scope.getData = function (team, season, rosterstatus, leagueId) {

		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = season;
		$scope.client_code = clientCode;

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=roster';

		if (team != null) {
			url += '&team_id=' + team;
		}

		if (season != null) {
			url += '&season_id=' + season;
		}

		if (rosterstatus != null) {
			url += '&rosterstatus=' + rosterstatus;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&site_id=' + site_id +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;

				if (team == "-1") {
					$scope.setName = $scope.selectedLeague.name;
				} else {
					$scope.setName = $scope.selectedTeamNoAll.name;
				}
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Roster + " " + $scope.selectedSeason.name;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.teamId && $routeParams.seasonId) {
					var setTeamUrl = "";
					if ($routeParams.teamId == "-1") {
						setTeamUrl = "all-teams";
					} else {
						setTeamUrl = $routeParams.teamId;
					}
					setPath = setPath + '/' + setTeamUrl + '/' + $routeParams.seasonId;
				}
				$rootScope.seoPath = setPath;
				$rootScope.playerNoPicLogoOverride = $scope.playerNoPicLogoOverride;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});

app.controller('TransactionCtrl', function ($scope, $rootScope, $http, $parse, $route, $routeParams, $location, HockeyTechService) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season = 'latest';
	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	var default_limit = 25;
	var max_limit = 200;
	$scope.limit = 25;

	HockeyTechService.bootstrap(season, 'transaction', null, null, svf_language).then(function (data) {
		$scope.seasons = data.seasons;
		$scope.teams = data.teams;
		$scope.current_league_id = data.current_league_id;
		$scope.current_season_id = data.current_season_id;
		$scope.leagues = data.leagues;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.seasonId) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		} else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		if ($routeParams.teamId) {
			if ($routeParams.teamId == "all-teams") {
				$routeParams.teamId = "-1";
			}
			for (i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.teamId) {
					$scope.selectedTeam = $scope.teams[i];
					break;
				}
			}
			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		if ($routeParams.hasOwnProperty("page")) {
			$scope.first = ($routeParams.page - 1) * $scope.limit;
		}

		$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.first, $scope.limit);

	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedSeason = function () {
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
			$scope.teams = teams;
			$scope.selectedTeam = "";
			// Preserve team selection if team also plays in season that was selected in dropdown
			if ($routeParams.teamId) {
				if ($routeParams.teamId == "all-teams") {
					$routeParams.teamId = "-1";
				}
				for (var i = 0; i < $scope.teams.length; i++) {
					if ($scope.teams[i].id == $routeParams.teamId) {
						$scope.selectedTeam = $scope.teams[i];
						break;
					}
				}
				if (!$scope.selectedTeam) {
					$scope.selectedTeam = $scope.teams[0];
				}
			} else {
				$scope.selectedTeam = $scope.teams[0];
			}
			var teamsNoAll = teams.slice();
			teamsNoAll.shift();
			$scope.teamsNoAll = teamsNoAll;
			if ($scope.selectedTeam) {
				$scope.selectedTeamNoAll = $scope.selectedTeam;
			} else {
				$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
			}
		});
		//update league id based on season
		HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
			$scope.selectedLeague.id = league_id;
		});

		$scope.getTransactions(1);
	};

	$scope.getTransactions = function (page) {
		$scope.limit = 25;
		$scope.first = (page - 1) * $scope.limit;

		var setTeamUrl = "";
		if ($scope.selectedTeam.id == "-1") {
			setTeamUrl = "all-teams";
		} else {
			setTeamUrl = $scope.selectedTeam.id;
		}

		$location.path('/' + $scope.pageName + '/' + setTeamUrl + '/' + $scope.selectedSeason.id);
		$location.search('page', page);
	};

	$scope.getData = function (teamId, seasonId, first, limit) {
		$scope.TransactionData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = seasonId;

		if (first == null || isNaN(first) || first < 0) {
			first = 0;
		}

		if (limit == null || isNaN(limit) || limit < 1) {
			limit = default_limit;
		}
		else if (limit > max_limit) {
			limit = max_limit;
		}

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=transactions' +
			'&team_id=' + teamId +
			'&season_id=' + seasonId +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&first=' + first +
			'&limit=' + limit +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				// Unfortunately, SVF Response obj makes it harder than it should be to implement pagination.
				// Find the section with the total number of results and call the pager service
				angular.forEach(data[0].sections, function (section, index) {
					if (section.title == 'num_results') {
						// Call the pagination service
						var pager = HockeyTechService.getPager(section.data[0].row.num_results, ((first / limit) + 1), limit);
						data[0].sections[index].data[0].row.pages = pager.pages;
						data[0].sections[index].data[0].row.current_page = pager.currentPage;
						data[0].sections[index].data[0].row.total_pages = pager.totalPages;

					}
				});
				$scope.TransactionData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;

				if (teamId == "-1") {
					$scope.setName = $scope.selectedLeague.name;
				} else {
					$scope.setName = $scope.selectedTeam.name;
				}
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Transactions + " " + $scope.selectedSeason.name;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.teamId && $routeParams.seasonId) {
					var setTeamUrl = "";
					if ($routeParams.teamId == "-1") {
						setTeamUrl = "all-teams";
					} else {
						setTeamUrl = $routeParams.teamId;
					}
					setPath = setPath + '/' + setTeamUrl + '/' + $routeParams.seasonId;
				}
				$rootScope.seoPath = setPath;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};
});

app.controller('DisciplineCtrl', function ($scope, $rootScope, $http, $parse, $route, $routeParams, $location, HockeyTechService) {
	$scope.pageName = $route.current.$$route.name;
	let svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	let season = 'latest';
	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	let league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	let leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}
	HockeyTechService.bootstrap(season, 'discipline', league, leagueCode, svf_language).then(function (data) {
		$scope.seasons = data.seasons;
		$scope.teams = data.teams;
		$scope.current_league_id = data.current_league_id;
		$scope.current_season_id = data.current_season_id;
		$scope.leagues = data.leagues;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;
		$scope.disciplineTypes = data.disciplineTypes;

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (let i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (let i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		let wpLeagueId = league_id;
		let setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (let i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($scope.selectedType == null) {
			$scope.selectedType = $scope.disciplineTypes[0];
		}

		if ($routeParams.seasonId) {
			for (let i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		} else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (let i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		if ($routeParams.teamId) {
			if ($routeParams.teamId == "all-teams") {
				$routeParams.teamId = "-1";
			}
			for (i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.teamId) {
					$scope.selectedTeam = $scope.teams[i];
					break;
				}
			}
			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		if ($routeParams.hasOwnProperty("page")) {
			$scope.first = ($routeParams.page - 1) * $scope.limit;
		}

		$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.first, $scope.limit);

	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedLeague = function () {
		HockeyTechService.getSeasonsByLeagueId($scope.selectedLeague.id).then(function (seasons) {
			$scope.seasons = seasons;
			$scope.selectedSeason = $scope.seasons[0];
			$scope.current_season_id = $scope.selectedSeason.id;
			$scope.changedSeason();
		});
	};

	$scope.changedSeason = function () {
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
			$scope.teams = teams;
			$scope.selectedTeam = "";
			// Preserve team selection if team also plays in season that was selected in dropdown
			if ($routeParams.teamId) {
				if ($routeParams.teamId == "all-teams") {
					$routeParams.teamId = "-1";
				}
				for (let i = 0; i < $scope.teams.length; i++) {
					if ($scope.teams[i].id == $routeParams.teamId) {
						$scope.selectedTeam = $scope.teams[i];
						break;
					}
				}
				if (!$scope.selectedTeam) {
					$scope.selectedTeam = $scope.teams[0];
				}
			} else {
				$scope.selectedTeam = $scope.teams[0];
			}
			let teamsNoAll = teams.slice();
			teamsNoAll.shift();
			$scope.teamsNoAll = teamsNoAll;
			if ($scope.selectedTeam) {
				$scope.selectedTeamNoAll = $scope.selectedTeam;
			} else {
				$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
			}
		});
		//update league id based on season
		if (!$scope.svfConfig.discipline_show_leagues) {
			HockeyTechService.getLeagueIdBySeasonId($scope.selectedSeason.id).then(function (league_id) {
				$scope.selectedLeague.id = league_id;
			});
		} else {
			$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.selectedType);
		}
	};

	$scope.getDiscipline = function (page) {
		let setTeamUrl = "";
		if ($scope.selectedTeam.id == "-1") {
			setTeamUrl = "all-teams";
		} else {
			setTeamUrl = $scope.selectedTeam.id;
		}

		$location.path('/' + $scope.pageName);
		$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.selectedType);
	};

	$scope.getData = function (teamId, seasonId) {
		$scope.DisciplineData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = seasonId;
		let view = ($scope.selectedType.id === "coaches") ? "disciplineCoaches" : "disciplinePlayers";

		let url = prodUrl + '/feed/index.php?feed=statviewfeed&view=' + view +
			'&team_id=' + teamId +
			'&season_id=' + seasonId +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.DisciplineData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;

				if (teamId == "-1") {
					$scope.setName = $scope.selectedLeague.name;
				} else {
					$scope.setName = $scope.selectedTeam.name;
				}
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Discipline + " " + $scope.selectedSeason.name;

				let setPath = baseRoute + $scope.pageName;
				if ($routeParams.teamId && $routeParams.seasonId) {
					let setTeamUrl = "";
					if ($routeParams.teamId == "-1") {
						setTeamUrl = "all-teams";
					} else {
						setTeamUrl = $routeParams.teamId;
					}
					setPath = setPath + '/' + setTeamUrl + '/' + $routeParams.seasonId;
				}
				$rootScope.seoPath = setPath;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};
});

app.controller('CollegeCommitmentsCtrl', function ($scope, $rootScope, $http, $parse, $route, $routeParams, $location, HockeyTechService) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season = 'latest';
	if ($routeParams.hasOwnProperty("season")) {
		season = $routeParams.season;
	}
	var league = null;
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}

	if ($routeParams.hasOwnProperty("limit")) {
		$scope.limit = $routeParams.limit;
	}

	HockeyTechService.bootstrap(season, 'collegecommitments', league, null, svf_language).then(function (data) {
		$scope.seasons = data.seasons;
		$scope.leagues = data.leagues;
		$scope.seasons.unshift({
			"id": -1,
			"name": "All",
			"default_sort": ""
		});
		$scope.svfLang = data.svfLang;
		$scope.teams = data.teams;

		if ($routeParams.hasOwnProperty("league")) {
			for (let i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}

			if ($scope.selectedLeague == null) {
				$scope.selectedLeague = $scope.leagues[0];
			}
		} else {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.hasOwnProperty("season")) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.season) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}

			if ($scope.selectedSeason == null) {
				$scope.selectedSeason = $scope.seasons[0];
			}
		} else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		$scope.getData($scope.selectedLeague.id, $scope.selectedSeason.id, $scope.sortKey, $scope.limit);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.setSort = function () {
		if ($scope.GameData && $scope.GameData.length > 0 && $scope.GameData[0].sections && $scope.GameData[0].sections.length > 0) {
			var foundSortKeyInHeaders = false;
			var headerKeys = Object.keys($scope.GameData[0].sections[0].headers);
			for (var i = 0; i < headerKeys.length; i++) {
				if ($scope.GameData[0].sections[0].headers[headerKeys[i]].properties.sortKey == $scope.sortKey) {
					foundSortKeyInHeaders = true;
					break;
				}
			}
			if (!foundSortKeyInHeaders) {
				$scope.sortKey = 'player_name';
			}
		} else {
			$scope.sortKey = 'player_name';
		}
	};

	$scope.setScopeFromUrl = function () {
		if ($routeParams.hasOwnProperty("sortKey")) {
			$scope.sortKey = $routeParams.sortKey;
		} else {
			$scope.setSort();
		}

		if ($routeParams.hasOwnProperty("limit")) {
			$scope.limit = $routeParams.limit;
		}
	};
	$scope.$on('$locationChangeSuccess', function () {
		$scope.setScopeFromUrl();
		var params = $location.search();

		if (params.league != $scope.selectedLeague.id || params.season != $scope.selectedSeason.id || params.sortKey != $scope.sortKey || params.limit != $scope.limit) {
			$scope.selectedLeague.id = params.league;
			$scope.selectedSeason.id = params.season;
			$scope.sortKey = params.sortKey;
			$scope.limit = params.limit;
			$scope.getData($scope.selectedLeague.id, $scope.selectedSeason.id, $scope.sortKey, $scope.limit);
		}
	});

	$scope.sortStats = function (sortKey) {
		$scope.sortKey = sortKey;
		$scope.currentPage = 1;
		$scope.getCollegeCommitments();
	};
	$scope.getCollegeCommitments = function () {
		$location.search('season', $scope.selectedSeason.id);
		$location.search('sortKey', $scope.sortKey);
		$location.search('limit', $scope.limit);
	};

	$scope.getData = function (league, season, sortKey, limit) {
		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.season = season;
		if (limit == '' || limit == undefined || limit <= 0) {
			limit = 250;
		}
		$scope.limit = limit;

		if (sortKey == '' || sortKey == undefined) {
			sortKey = 'ls_season';
		}

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=collegecommitments' +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&site_id=' + site_id +
			'&league_id=' + league +
			'&season_id=' + season +
			'&sort=' + sortKey +
			'&limit=' + limit +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.changedSeason = function () {
		//update teams by season
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teamdata) {
			$scope.teams = teamdata;
		});
	};
});

// ------------------------------------------------------------------------------------------------------
// COACH PAGE
// ------------------------------------------------------------------------------------------------------
app.controller('CoachCtrl', function ($scope, $rootScope, $http, $parse, $route, $routeParams, $location, HockeyTechService, $filter) {
	$scope.pageName = $route.current.$$route.name;
	let svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	if (typeof site_id === 'undefined') { site_id = 0; }

	$scope.coachId = "";
	$scope.seasonId = "";

	if ($routeParams.coachId) {
		$scope.coachId = $routeParams.coachId;
	}
	if (!isNaN($routeParams.seasonId)) {
		$scope.seasonId = $routeParams.seasonId;
	}
	$scope.urlCoach = "coach";
	$scope.isProStats = lsp_stats;
	let season = 'latest';

	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	let league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	let leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	HockeyTechService.bootstrap(season, 'coach', league, leagueCode, svf_language).then(function (data) {
		$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changeGameByGameSeason = function () {
		if ($scope.seoName) {
			$location.path('/' + $scope.pageName + '/' + $scope.coachId + '/' + $scope.selectedSeason.id + '/' + $scope.seoName);
		} else {
			$location.path('/' + $scope.pageName + '/' + $scope.coachId + '/' + $scope.selectedSeason.id);
		}
	};

	$scope.toggleMedia = function (mediaType) {
		// Toggle the active media based on the parameter
		if (mediaType === 'images') {
			$scope.showImages = true;
			$scope.showVideo = false;
			$scope.showAudio = false;
		} else if (mediaType === 'video') {
			$scope.showImages = false;
			$scope.showVideo = true;
			$scope.showAudio = false;
		} else if (mediaType === 'audio') {
			$scope.showImages = false;
			$scope.showVideo = false;
			$scope.showAudio = true;
		}
	};

	$scope.showGameByGame = true;

	$scope.getData = function (coachId, seasonId) {
		$scope.loading = true;
		$scope.dataLoaded = false;
		let method = 'jsonp';
		let url = prodUrl + '/feed/index.php?feed=statviewfeed&view=coach' +
			'&coach_id=' + coachId +
			'&season_id=' + seasonId +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + league_id +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.coachInfo = data.info;

				if (!$scope.coachInfo) {
					$scope.dataLoaded = true;
					$scope.loading = false;
					return true;
				}
				let seoName = $scope.coachInfo.firstName + ' ' + $scope.coachInfo.lastName;
				$scope.seoName = $filter('UrlFriendly')(seoName);

				$scope.careerStats = data.careerStats;
				$scope.gameByGame = data.gameByGame;
				$scope.currentSeason = data.currentSeason;
				$scope.currentStats = data.currentSeasonStats;
				$scope.translations = data.translations;
				$scope.coachImages = data.media.images;
				$scope.coachVideos = data.media.video;
				$scope.coachAudio = data.media.audio;
				$scope.seasons = data.seasons;
				$scope.coachProfileHeaders = data.coachProfileHeaders;
				$scope.coachProfileBioHeaders = data.coachProfileBioHeaders;
				$scope.svfLang = data.svfLang;
				$scope.selectedSeason = "";
				$scope.showImages = true;
				$scope.defaultNoPic = 'https://lscluster.hockeytech.com/statview-1.4.1/img/headshot-default.jpg';
				if ($scope.playerNoPicLogoOverride) {
					$scope.defaultNoPic = $scope.playerNoPicLogoOverride;
				}
				for (let i = 0; i < $scope.seasons.length; i++) {
					if ($scope.seasons[i].id == $routeParams.seasonId) {
						$scope.selectedSeason = $scope.seasons[i];
						break;
					}
				}

				let compileCareerStats = [];
				let coachCurrentSeason = "";
				//loop through header and then find the data
				let HeaderValue = $scope.currentStats[0].sections[0].headers;
				let getHeader = Object.keys(HeaderValue);
				for (let h = 0; h < getHeader.length; ++h) {
					let theHKey = getHeader[h];
					let getLabel = HeaderValue[getHeader[h]].properties.label;
					//loop through data to get value
					let currentStats = $scope.currentStats[0].sections[0].data[0].row;
					let getValues = Object.keys(currentStats);
					for (let v = 0; v < getValues.length; ++v) {
						let theKey = getValues[v];
						if (theHKey === theKey) {
							let StatValue = currentStats[getValues[v]];
							if (theKey == "season_name") {
								coachCurrentSeason = StatValue;
							} else {
								compileCareerStats.push({
									key: getLabel,
									value: StatValue
								});
							}
							break;
						}
					}
				}
				$scope.setCurrentSeason = coachCurrentSeason;
				$scope.setSeasonStats = compileCareerStats;

				if ($scope.selectedSeason == "") {
					$scope.selectedSeason = $scope.seasons[0];
				}

				$scope.dataLoaded = true;
				$scope.loading = false;

				$rootScope.seoTitle = $scope.coachInfo.firstName + ' ' + $scope.coachInfo.lastName + ' ' + $scope.svfLang.Player_seoTitle;

				let setPath = baseRoute + $scope.pageName;
				if ($routeParams.coachId) {
					setPath = setPath + '/' + $routeParams.coachId;
				}
				$rootScope.seoPath = setPath;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	if ($scope.coachId) {
		$scope.getData($scope.coachId, $scope.seasonId);
	}

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	};

	$scope.openImage = function ($imageID) {
		let imageToOpen = $parse('showImage' + $imageID);
		imageToOpen.assign($scope, true);
	};

	$scope.closeImage = function ($imageID) {
		let imageToOpen = $parse('showImage' + $imageID);
		imageToOpen.assign($scope, false);
	}
});

app.controller('PlayerCtrl', function ($scope, $rootScope, $http, $parse, $route, $routeParams, $location, HockeyTechService, $filter, $heatmap) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	if (typeof site_id === 'undefined') { site_id = 0; }

	$scope.playerId = "";
	$scope.seasonId = "";
	$scope.statsType = "standard";

	if ($routeParams.playerId) {
		$scope.playerId = $routeParams.playerId;
	}
	if (!isNaN($routeParams.seasonId)) {
		$scope.seasonId = $routeParams.seasonId;
	}

	$scope.isProStats = lsp_stats;
	var season = 'latest';

	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	HockeyTechService.bootstrap(season, 'player', league, leagueCode, svf_language).then(function (data) {
		$scope.playerNoPicLogoOverride = data.playerNoPicLogoOverride;
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changeGameByGameSeason = function () {
		$scope.selectedSeasonHeatmap = $scope.selectedSeason;
		$scope.changeHeatmapSeason();
		if ($scope.seoName) {
			$location.path('/' + $scope.pageName + '/' + $scope.playerId + '/' + $scope.selectedSeason.id + '/' + $scope.seoName);
		} else {
			$location.path('/' + $scope.pageName + '/' + $scope.playerId + '/' + $scope.selectedSeason.id);
		}
	};

	$scope.changeHeatmapSeason = function () {

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=playerShots' +
			'&player_id=' + $scope.playerId +
			'&season_id=' + $scope.selectedSeasonHeatmap.id +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&statsType=' + $scope.statsType +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$scope.playerShots = data;
				$scope.plotHeatMap();
			})
	}

	$scope.toggleMedia = function (mediaType) {
		// Toggle the active media based on the parameter
		if (mediaType === 'images') {
			$scope.showImages = true;
			$scope.showVideo = false;
			$scope.showAudio = false;
		} else if (mediaType === 'video') {
			$scope.showImages = false;
			$scope.showVideo = true;
			$scope.showAudio = false;
		} else if (mediaType === 'audio') {
			$scope.showImages = false;
			$scope.showVideo = false;
			$scope.showAudio = true;
		}
	};

	$scope.showGameByGame = true;
	$scope.playerShots = [];
	$scope.getData = function (playerId, seasonId, statsType) {
		$scope.loading = true;
		$scope.dataLoaded = false;
		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=player' +
			'&player_id=' + playerId +
			'&season_id=' + seasonId +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + league_id +
			'&lang=' + svf_language +
			'&statsType=' + statsType +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.playerInfo = data.info;

				if (!$scope.playerInfo) {
					$scope.dataLoaded = true;
					$scope.loading = false;
					return true;
				}
				var seoName = $scope.playerInfo.firstName + ' ' + $scope.playerInfo.lastName;
				$scope.seoName = $filter('UrlFriendly')(seoName);

				$scope.careerStats = data.careerStats;
				$scope.gameByGame = data.gameByGame;
				$scope.playerAwards = data.playerAwards;
				$scope.showPlayerAwards = data.showPlayerAwards;
				$scope.showPlayerDraft = data.showPlayerDraft;
				$scope.currentSeason = data.currentSeason;
				$scope.translations = data.translations;
				$scope.currentStats = data.currentSeasonStats;
				$scope.playerImages = data.media.images;
				$scope.playerVideos = data.media.video;
				$scope.playerAudio = data.media.audio;
				$scope.seasons = data.seasons;
				$scope.playerProfileHeaders = data.playerProfileHeaders;
				$scope.playerProfileBioHeaders = data.playerProfileBioHeaders;
				$scope.selectedSeason = "";
				$scope.showImages = true;
				$scope.defaultNoPic = 'https://lscluster.hockeytech.com/statview-1.4.1/img/headshot-default.jpg';
				if ($scope.playerNoPicLogoOverride) {
					$scope.defaultNoPic = $scope.playerNoPicLogoOverride;
				}
				for (var i = 0; i < $scope.seasons.length; i++) {
					if ($scope.seasons[i].id == $routeParams.seasonId) {
						$scope.selectedSeason = $scope.seasons[i];
						break;
					}
				}

				$scope.heatmapSeasonOptions = [{ 'id': -1, name: 'All seasons' }];
				for (var i = 0; i < $scope.seasons.length; i++) {
					$scope.heatmapSeasonOptions.push($scope.seasons[i]);
				}

				$scope.selectedSeasonHeatmap = $scope.selectedSeason;

				var compileCareerStats = [];
				var playerCurrentSeason = "";
				//loop through header and then find the data
				var HeaderValue = $scope.currentStats[0].sections[0].headers;
				var getHeader = Object.keys(HeaderValue);
				for (var h = 0; h < getHeader.length; ++h) {
					var theHKey = getHeader[h];
					var getLabel = HeaderValue[getHeader[h]].properties.label;
					//loop through data to get value
					var currentStats = $scope.currentStats[0].sections[0].data[0].row;
					var getValues = Object.keys(currentStats);
					for (var v = 0; v < getValues.length; ++v) {
						var theKey = getValues[v];
						if (theHKey === theKey) {
							var StatValue = currentStats[getValues[v]];
							if (theKey == "season_name") {
								playerCurrentSeason = StatValue;
							} else {
								compileCareerStats.push({
									key: getLabel,
									value: StatValue
								});
							}
							break;
						}
					}
				}
				$scope.setCurrentSeason = playerCurrentSeason;
				$scope.setSeasonStats = compileCareerStats;

				if ($scope.selectedSeason == "") {
					$scope.selectedSeason = $scope.seasons[0];
				}

				$scope.dataLoaded = true;
				$scope.loading = false;

				$rootScope.seoTitle = $scope.playerInfo.firstName + ' ' + $scope.playerInfo.lastName + ' ' + $scope.svfLang.Player_seoTitle;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.playerId) {
					setPath = setPath + '/' + $routeParams.playerId;
				}
				$rootScope.seoPath = setPath;

				$scope.playerShots = data.playerShots || [];

				window.addEventListener('resize', function () {
					$scope.plotHeatMap();
				});
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.plotHeatMap = function () {
		setDimensions();
		const heatmapData = getHeatmapData();
		const heatmap = $heatmap.getInstance('heatmap');

		if ($scope.playerShots && $scope.playerShots.length > 0) {
			heatmap.setData(heatmapData);
			heatmap.repaint();
		}
	}

	function setDimensions() {
		const rinkImage = document.getElementById('rink-image');
		if (rinkImage) {
			let heatmapCanvas = angular.element(document.querySelector('.heatmap-canvas'));
			heatmapCanvas.attr("height", rinkImage.height);
			heatmapCanvas.attr("width", rinkImage.width);
		}
	}

	function getHeatmapData() {
		let shotLocations = [];

		const rinkImage = document.getElementById('rink-image');

		if (rinkImage) {
			const baseWidth = 1005;
			const baseHeight = 430;

			const widthCoefficent = 1.445;
			const heightCoefficent = 1.23;

			const rinkCenterX = 349;
			const rinkMaxX = 698;
			const rinkMaxY = 349;

			const widthChange = (rinkImage.width * 100) / baseWidth;
			const xRatio = (widthChange * widthCoefficent) / 100;

			const heightChange = (rinkImage.height * 100) / baseHeight;
			const yRatio = (heightChange * heightCoefficent) / 100;

			for (let i = 0; i < $scope.playerShots.length; i++) {
				let x = parseInt($scope.playerShots[i].x_location);
				let y = parseInt($scope.playerShots[i].y_location);

				if (x < rinkCenterX) {
					x = rinkMaxX - x;
				}

				if ($scope.playerShots[i].orientation) {
					y = rinkMaxY - y;
				}

				const newX = Math.round(x * xRatio);
				const newY = Math.round(y * yRatio);

				let location = {
					x: newX,
					y: newY,
					radius: 15 * xRatio,
					value: 1
				};

				shotLocations.push(location);
			}
			return { max: 1, data: shotLocations };
		}
	}

	if ($scope.playerId) {
		HockeyTechService.bootstrap(null, 'PlayerPage', null, null, svf_language).then(function (data) {
			$scope.svfLang = data.svfLang;
			$scope.player_shot_heat_map = data.player_shot_heat_map;
			$scope.svfConfig = data.svfConfig;
			$scope.getData($scope.playerId, $scope.seasonId, $scope.statsType);
		});
	}

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	};

	$scope.openImage = function ($imageID) {
		var imageToOpen = $parse('showImage' + $imageID);
		imageToOpen.assign($scope, true);
	};

	$scope.closeImage = function ($imageID) {
		var imageToOpen = $parse('showImage' + $imageID);
		imageToOpen.assign($scope, false);
	}
});

app.controller('PersonSearchCtrl', function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	$scope.ActiveAllPlayers = 'active';
	if ($routeParams.hasOwnProperty("active") && ($routeParams.active == 'active' || $routeParams.active == 'allplayers')) {
		$scope.ActiveAllPlayers = $routeParams.active;
	}

	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	var default_limit = 20;
	var max_limit = 100;
	$scope.limit = 20;
	if ($routeParams.hasOwnProperty("results")) {
		$scope.limit = $routeParams.resultsPerPage;
	}

	HockeyTechService.bootstrap(null, 'search', league, leagueCode, svf_language).then(function (data) {
		$scope.teams = data.teams;
		$scope.selectedTeam = $scope.teams[0];
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		//search for person based on url string
		if ($routeParams.hasOwnProperty("s")) {
			$scope.searchName = $routeParams.s;
			if ($scope.searchName != '') {
				var letter = '';
				var name = $scope.searchName;
				var team = $scope.selectedTeam.id;
				var active = $scope.ActiveAllPlayers;
				var leagueId = $scope.selectedLeague.id;
				var first = $scope.first;
				var limit = $scope.limit;
				if ($routeParams.hasOwnProperty("page")) {
					first = ($routeParams.page - 1) * limit;
				}

				$scope.getData(name, team, active, letter, leagueId, first, limit);
			}
		}

	}).catch(function () {
		$scope.loadError = true;
	});

	// what does this do?
	var cleanUpFunc = $rootScope.$on('getPersonSearchClicked', function (event, args) {
		var name = args.name;
		var team = args.team.id;
		var active = args.active;
		var letter = args.letter;
		$scope.getData(name, team, active, letter, $scope.selectedLeague.id, first, limit);
	});

	// And this?
	$scope.$on('$destroy', function () {
		cleanUpFunc();
	});

	$scope.getPersonSearch = function (page) {
		var letter = '';
		var name = $scope.searchName;
		var team = $scope.selectedTeam.id;
		var active = $scope.ActiveAllPlayers;
		var leagueId = $scope.selectedLeague.id;
		var limit = $scope.limit;
		var first = (page - 1) * limit;
		$location.search('s', name);
		$location.search('page', page);
		$location.search('results', limit);
		$location.search('active', active);
		$scope.getData(name, team, active, letter, leagueId, first, limit);
	};

	$scope.getData = function (name, team, active, letter, leagueId, first, limit) {
		$scope.SearchData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=searchperson';

		if (name != null) {
			url += '&search_name=' + name;
		}

		if (team != null && team != '-1') {
			url += '&search_team=' + team;
		}

		if (active != null) {
			url += '&search_active=' + active;
		}

		if (letter != null) {
			url += '&search_letter=' + letter;
		}

		if (first == null || isNaN(first) || first < 0) {
			first = 0;
		}

		if (limit == null || isNaN(limit) || limit < 1) {
			limit = default_limit;
		}
		else if (limit > max_limit) {
			limit = max_limit;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&site_id=' + site_id +
			'&league_id=' + leagueId +
			'&first=' + first +
			'&lang=' + svf_language +
			'&limit=' + limit +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				// We are making our modulekit clients figure out the pagination on their frontends,
				// and only sending them the total number of results.  Only fair we will do the same.
				// Unfortunately, the SVF Response obj makes this harder than it should be.
				// Find the section with the total number of results and call the pager service
				angular.forEach(data[0].sections, function (section, index) {
					if (section.title == 'num_results') {
						// Call the pagination service
						var pager = HockeyTechService.getPager(section.data[0].row.num_results, ((first / limit) + 1), limit);
						data[0].sections[index].data[0].row.pages = pager.pages;
						data[0].sections[index].data[0].row.current_page = pager.currentPage;
						data[0].sections[index].data[0].row.total_pages = pager.totalPages;

						// The problem with letting the user pass pagination values in through the url is
						// we don't know how many results and pages there will be until the call is already made.
						// The user could have passed in a combination of pagination values that are greater than
						// the total number of results, so the initial call to person search would return no results.
						// We need to make a second call, using the proper max values.
						// Note, we don't have the same problem with the user entering values that are too low
						var url = $location.search();
						var resultsPerPage = url.resultsPerPage;
						if (resultsPerPage < 1) {
							$location.search('resultsPerPage', default_limit);
							$scope.limit = default_limit;
						}
						else if (resultsPerPage > max_limit) {
							$location.search('resultsPerPage', max_limit);
							$scope.limit = max_limit;
						}

						var page = url.page;
						if (page < 0) {
							$location.search('page', 1);
						}
						else if (page > pager.totalPages) {
							$location.search('page', pager.totalPages);
							$scope.getPersonSearch(pager.totalPages);
						}
					}
				});

				$scope.SearchData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
				$scope.first = first;
				$scope.limit = limit;

				$scope.setName = $scope.selectedLeague.name;
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Person_Search;

				var setPath = baseRoute + $scope.pageName;
				$rootScope.seoPath = setPath;


			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});

app.controller('BracketsCtrl', function ($scope, $http, $rootScope, $location, $routeParams, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	if (!html5ModeEnabled) {
		$scope.linkPrefix = '#/';
	} else {
		$scope.linkPrefix = baseRoute;
	}
	$scope.bracketType = 'playoff';

	var league = null;
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}

	var season = 'latest';
	if ($routeParams.hasOwnProperty("seasonId")) {
		season = $routeParams.seasonId;
	}
	$scope.isProStats = lsp_stats;

	$scope.urlGameSummary = "game-summary";
	$scope.urlGameCenter = "game-center";
	if (svf_language == 'fr') {
		$scope.urlGameSummary = "sommaire-du-match";
		$scope.urlGameCenter = "game-centre";
	}

	HockeyTechService.bootstrap(season, 'brackets', league, null, svf_language).then(function (data) {
		$scope.seasons = data.playoffSeasons;
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		$scope.teams = data.teams;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;
		$scope.useGameCenterUrl = (typeof data.svfConfig.game_center != 'undefined') ? data.svfConfig.game_center : false;

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.seasonId) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}

			if ($scope.selectedSeason == null) {
				$scope.selectedSeason = $scope.seasons[0];
			}
		} else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		if ($scope.selectedSeason === undefined) {
			// Initialize
			$scope.selectedSeason = {};
		}

		if (!$routeParams.seasonId) {
			$location.path('/' + $scope.pageName + '/' + $scope.selectedSeason.id);
		} else {
			$scope.getData($scope.selectedSeason.id);
		}

	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.changedSeason = function () {
		$location.path('/' + $scope.pageName + '/' + $scope.selectedSeason.id);
	};

	$scope.getData = function (season) {

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=modulekit&view=brackets&fmt=json';

		if ($scope.selectedSeason.id != null) {
			url += '&season_id=' + $scope.selectedSeason.id;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&site_id=' + site_id +
			'&lang=' + svf_language +
			'&league_id=' + leagueId +
			'&callback=JSON_CALLBACK';

		$scope.TeamData = null;
		$scope.BracketData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.bracketLen = 0;
		$scope.bracketCol = 0;

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.TeamData = data.SiteKit.Brackets.teams;
				$scope.BracketData = data.SiteKit.Brackets.rounds;
				$scope.ShowTies = data.SiteKit.Brackets.show_ties;
				$scope.BracketLogo = data.SiteKit.Brackets.logo;
				$scope.bracketLen = $scope.BracketData.length;
				$scope.bracketCol = 100 / $scope.bracketLen + '%';

				var teamMap = {};
				var teams = $scope.TeamData;
				var teamKeys = Object.keys(teams);
				for (var i = 0; i < teamKeys.length; i++) {
					var teamId = teams[teamKeys[i]].id;
					teamMap[teamId] = teams[teamKeys[i]];
				}
				$scope.teamMap = teamMap;
				$scope.dataLoaded = true;
				$scope.loading = false;

				$scope.setName = $scope.selectedLeague.name;
				$rootScope.seoTitle = $scope.setName + " " + $scope.selectedSeason.name;

				var setPath = baseRoute + $scope.pageName;
				setPath = setPath + '/' + $routeParams.seasonId;
				$rootScope.seoPath = setPath;

			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});

	};

	$scope.formatDate = function (date) {
		if (typeof date !== 'undefined') {
			var dateString = date.replace(/-/g, '/');
			return new Date(dateString);
		}
		return date;
	};

	$scope.checkWinner = function (winner, team) {
		if (winner) {
			if (winner != team) {
				return "ht-losing-team";
			} else {
				return "";
			}
		}
	}

});

app.controller('AttendanceAllTeamsCtrl', function ($scope, $http, $rootScope, $parse, $route, $routeParams, $location, HockeyTechService) {

	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season1 = 'latest';
	if ($routeParams.hasOwnProperty("season1")) {
		season1 = $routeParams.season1;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	HockeyTechService.bootstrap(season1, 'attendanceAllTeams', league, leagueCode, svf_language).then(function (data) {
		$scope.seasons1 = data.seasons;
		$scope.seasons2 = data.seasons;
		$scope.svfLang = data.svfLang;

		if ($routeParams.hasOwnProperty("gamesPlayed")) {
			//Take the text from the given date and convert it into a javascript date object
			$scope.gamesPlayed = $routeParams.gamesPlayed;
		}

		if ($routeParams.hasOwnProperty("groupByDiv")) {
			$scope.groupByDiv = $routeParams.groupByDiv;
		} else {
			$scope.groupByDiv = 'false';
		}

		if ($routeParams.hasOwnProperty("season1")) {
			for (var i = 0; i < $scope.seasons1.length; i++) {
				if ($scope.seasons1[i].id == $routeParams.season1) {
					$scope.selectedSeason1 = $scope.seasons1[i];
					break;
				}
			}
		} else {
			for (var i = 0; i < $scope.seasons1.length; i++) {
				if ($scope.seasons1[i].id == data.current_season_id) {
					$scope.selectedSeason1 = $scope.seasons1[i];
					break;
				}
			}
		}

		if ($routeParams.hasOwnProperty("season2")) {
			for (var i = 0; i < $scope.seasons2.length; i++) {
				if ($scope.seasons2[i].id == $routeParams.season2) {
					$scope.selectedSeason2 = $scope.seasons2[i];
					break;
				}
			}
		} else {
			for (var i = 0; i < $scope.seasons2.length; i++) {
				if ($scope.seasons2[i].id == data.current_season_id) {
					$scope.selectedSeason2 = $scope.seasons2[i + 1];
					break;
				}
			}
		}

		$scope.getData($scope.selectedSeason1.id, $scope.selectedSeason2.id, $scope.groupByDiv, $scope.gamesPlayed);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.getAttendanceStats = function () {
		$location.search('season1', $scope.selectedSeason1.id);
		$location.search('season2', $scope.selectedSeason2.id);
		$location.search('groupByDiv', $scope.groupByDiv);
		$location.search('gamesPlayed', $scope.gamesPlayed);
		$scope.getData($scope.selectedSeason1.id, $scope.selectedSeason2.id, $scope.groupByDiv, $scope.gamesPlayed);
	};

	$scope.getData = function (season1Id, season2Id, groupByDiv, gamesPlayed) {
		$scope.AttendanceData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.season1Id = season1Id;
		$scope.season2Id = season2Id;

		if (groupByDiv == null) {
			groupByDiv = 'false';
		}

		$scope.groupByDiv = groupByDiv;

		if (gamesPlayed == null) {
			gamesPlayed = '';
		}
		$scope.gamesPlayed = gamesPlayed;

		// TODO: add additional parameter that can be passed to Statview class (playoff_round)
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=attendanceallteams' +
			'&season_id_1=' + season1Id +
			'&season_id_2=' + season2Id +
			'&group_by_div=' + groupByDiv +
			'&site_id=' + site_id +
			'&limit=' + gamesPlayed +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.AttendanceData = data;

				//build top header row based on header data
				$scope.attendanceHeader = [];
				let seasonTitles = data[0].sections[0].title;
				let attHeaders = data[0].sections[0].headers;
				var hData = Object.keys(attHeaders);
				let s1 = 0;
				let s2 = 0;
				let s1Added = false;
				let s2Added = false;
				for (var h = 0; h < hData.length; ++h) {
					let checkS1 = hData[h].includes('_s1');
					let checkS2 = hData[h].includes('_s2');
					if (!checkS1 && !checkS2) {
						//add s2 if more columns after
						if (!s2Added && s2 > 0) {
							s2Added = true;
							let colHeader = {
								span: s2,
								title: seasonTitles[1]
							};
							$scope.attendanceHeader.push(colHeader);
						}
						let colHeader = {
							span: 1,
							title: ""
						};
						$scope.attendanceHeader.push(colHeader);
					}
					if (checkS1 && !checkS2) {
						s1 = ++s1;
					}
					if (!checkS1 && checkS2) {
						s2 = ++s2;
						//add s1
						if (!s1Added) {
							s1Added = true;
							let colHeader = {
								span: s1,
								title: seasonTitles[0]
							};
							$scope.attendanceHeader.push(colHeader);
						}
					}
				}
				//add s2 if no more columns
				if (!s2Added) {
					s2Added = true;
					let colHeader = {
						span: s2,
						title: seasonTitles[1]
					};
					$scope.attendanceHeader.push(colHeader);
				}

				$scope.dataLoaded = true;
				$scope.loading = false;
				//set page title and meta data
				$rootScope.seoTitle = $scope.svfLang.Attendance;
				var setPath = baseRoute + $scope.pageName;
				$rootScope.seoPath = setPath;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};
});

app.controller('AttendanceSingleTeamCtrl', function ($scope, $http, $rootScope, $parse, $route, $routeParams, $location, HockeyTechService) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season = 'latest';
	if ($routeParams.hasOwnProperty("season")) {
		season = $routeParams.season;
	}

	HockeyTechService.bootstrap(season, 'attendanceSingle', null, null, svf_language).then(function (data) {
		$scope.seasons = data.seasons;
		$scope.teams = data.teamsNoAll;
		$scope.svfLang = data.svfLang;

		if ($routeParams.hasOwnProperty("team")) {
			for (var i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.team) {
					$scope.selectedTeam = $scope.teams[i];
					break;
				}
			}

			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		if ($routeParams.hasOwnProperty("season")) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.season) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}

			if ($scope.selectedSeason == null) {
				$scope.selectedSeason = $scope.seasons[0];
			}
		} else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		$scope.getData($scope.selectedSeason.id, $scope.selectedTeam.id, $scope.gamesPlayed);
	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.getTeamAttendanceStats = function () {
		$location.search('season', $scope.selectedSeason.id);
		$location.search('team', $scope.selectedTeam.id);
		$location.search('gamesPlayed', $scope.gamesPlayed);
		$scope.getData($scope.selectedSeason.id, $scope.selectedTeam.id, $scope.gamesPlayed);
	};

	$scope.getData = function (seasonId, teamId, gamesPlayed) {
		$scope.AttendanceData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = seasonId;
		$scope.teamId = teamId;

		if (gamesPlayed == null) {
			gamesPlayed = '';
		}
		$scope.gamesPlayed = gamesPlayed;

		// TODO: add additional parameter that can be passed to Statview class (month)
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=attendancesingleteam' +
			'&season_id_1=' + seasonId +
			'&team_id=' + teamId +
			'&limit=' + gamesPlayed +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&lang=' + svf_language +
			'&league_id=' + leagueId +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.TeamAttendanceData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
			})
			.error(function (data, status, headers, config) {
				//  Do some error handling here
			});
	};
});

app.controller('ScheduleNotesCtrl', function ($scope, $rootScope, $http, $parse, $route, $routeParams, $location, HockeyTechService) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;
	var season = 'latest';
	if ($routeParams.seasonId) {
		season = $routeParams.seasonId;
	}
	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	HockeyTechService.bootstrap(season, 'scheduleNotes', league, leagueCode, svf_language).then(function (data) {
		$scope.seasons = data.seasons;
		$scope.months = data.monthsAll;
		$scope.teams = data.teams;
		$scope.current_season_id = data.current_season_id;
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		$scope.svfLang = data.svfLang;

		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.seasonId) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $routeParams.seasonId) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else if ($scope.selectedSeason == null && $scope.current_season_id) {
			for (var i = 0; i < $scope.seasons.length; i++) {
				if ($scope.seasons[i].id == $scope.current_season_id) {
					$scope.selectedSeason = $scope.seasons[i];
					break;
				}
			}
		}
		else {
			$scope.selectedSeason = $scope.seasons[0];
		}

		if ($routeParams.teamId) {
			for (i = 0; i < $scope.teams.length; i++) {
				if ($scope.teams[i].id == $routeParams.teamId) {
					$scope.selectedTeam = $scope.teams[i];
					break;
				}
			}
			if ($scope.selectedTeam == null) {
				$scope.selectedTeam = $scope.teams[0];
			}
		} else {
			$scope.selectedTeam = $scope.teams[0];
		}

		if ($routeParams.monthId) {
			for (i = 0; i < $scope.months.length; i++) {
				if ($scope.months[i].id == $routeParams.monthId) {
					$scope.selectedMonth = $scope.months[i];
					break;
				}
			}
			if ($scope.selectedMonth == null) {
				$scope.selectedMonth = $scope.months[0];
			}
		} else {
			var TodayDate = new Date();
			// take into account additional items in the dropdown when setting the offset for the current month
			var monthOffset = $scope.months.length - 12;
			var thisMonth = (TodayDate.getMonth() + monthOffset);
			$scope.selectedMonth = $scope.months[thisMonth];
		}
		if (!$routeParams.seasonId && !$routeParams.teamId) {
			var setTeamUrl = "";
			if ($scope.selectedTeam.id == "-1") {
				setTeamUrl = "all-teams";
			} else {
				setTeamUrl = $scope.selectedTeam.id;
			}

			var setPath = '/' + $scope.pageName + '/' + setTeamUrl + '/' + $scope.selectedSeason.id + '/' + $scope.selectedMonth.id;
			$location.path(setPath);

		} else {
			$scope.getData($scope.selectedTeam.id, $scope.selectedSeason.id, $scope.selectedMonth.id);
		}
	});

	$scope.changedSeason = function () {
		HockeyTechService.getTeamsBySeasonId($scope.selectedSeason.id).then(function (teams) {
			$scope.teams = teams;
			$scope.selectedTeam = $scope.teams[0];
			var teamsNoAll = teams.slice();
			teamsNoAll.shift();
			$scope.teamsNoAll = teamsNoAll;
			$scope.selectedTeamNoAll = $scope.teamsNoAll[0];
		});

		$scope.getScheduleNotes();
	};

	$scope.getScheduleNotes = function () {
		var setTeamUrl = "";
		if ($scope.selectedTeam.id == "-1") {
			setTeamUrl = "all-teams";
		} else {
			setTeamUrl = $scope.selectedTeam.id;
		}
		var setPath = '/' + $scope.pageName + '/' + setTeamUrl + '/' + $scope.selectedSeason.id + '/' + $scope.selectedMonth.id;
		$location.path(setPath);
	};

	$scope.getData = function (teamId, seasonId, month) {
		$scope.ScheduleNotesData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;
		$scope.seasonId = seasonId;

		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=schedulenotes' +
			'&team_id=' + teamId +
			'&season_id=' + seasonId +
			'&month=' + month +
			'&site_id=' + site_id +
			'&key=' + appKey +
			'&client_code=' + clientCode +
			'&league_id=' + leagueId +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: 'jsonp', url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.ScheduleNotesData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;

				if (teamId == "-1" || teamId == -1) {
					$scope.setName = $scope.selectedLeague.name;
				} else {
					$scope.setName = $scope.selectedTeam.name;
				}
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Schedule_Changes + " " + $scope.selectedMonth.name + " " + $scope.selectedSeason.name;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.teamId && $routeParams.seasonId && $routeParams.monthId) {
					var setTeamUrl = "";
					if ($routeParams.teamId == "-1") {
						setTeamUrl = "all-teams";
					} else {
						setTeamUrl = $routeParams.teamId;
					}
					setPath = setPath + '/' + setTeamUrl + '/' + $routeParams.seasonId + '/' + $routeParams.monthId;
				}
				$rootScope.seoPath = setPath;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};
});

app.controller("FeaturedCollegeCommitmentCtrl", function ($scope, $http) {

	$scope.FeaturedCollegeCommitment = null;
	$scope.loading = true;
	$scope.loadError = false;
	let seasonId = '-1';

	var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=collegecommitmentfeatured' +
		'&key=' + appKey +
		'&client_code=' + clientCode +
		'&season_id=' + seasonId +
		'&callback=JSON_CALLBACK';

	$http({ method: 'jsonp', url: url })
		.success(function (data) {
			$scope.FeaturedCollegeCommitment = data;
			$scope.loading = false;
		})
		.error(function (data, status, headers, config) {
			$scope.loadError = true;
			$scope.loading = false;
		});

});

app.controller('MiniKitCtrl', ['$scope', '$http', '$rootScope', '$routeParams', '$location', 'HockeyTechService', '$route',
	function ($scope, $http, $rootScope, $routeParams, $location, HockeyTechService, $route) {
		$scope.pageName = $route.current.$$route.name;
		var svf_language = $route.current.$$route.language;
		$scope.language = svf_language;

		$scope.urlRoster = "roster";
		$scope.urlPlayerStats = "player-stats";
		$scope.urlPlayer = "player";
		if (svf_language == 'fr') {
			$scope.urlRoster = "alignement";
			$scope.urlPlayerStats = "statistiques-des-joueurs";
			$scope.urlPlayer = "joueur";
		}

		if (!html5ModeEnabled) {
			$scope.linkPrefix = '#/';
		} else {
			$scope.linkPrefix = baseRoute;
		}

		$scope.gameId = $routeParams.gameId;

		var league = '';
		if ($routeParams.hasOwnProperty("league")) {
			league = $routeParams.league;
		}
		var leagueCode = '';
		if ($routeParams.hasOwnProperty("leaguecode")) {
			leagueCode = $routeParams.leaguecode;
		}

		$scope.dataLoaded = false;
		$scope.loading = true;

		$scope.getGameData = function () {
			if ($scope.gameId == null) {
				//Show some kind of message to the user, gameId is required.  They should not get here normally.
				console.log('Missing gameId');
				$scope.missingGameID = true;
				return $q(function (resolve, reject) {
					reject("Game id was missing");
				});
			} else {
				return $scope.getData($scope.gameId);
			}
		};

		HockeyTechService.bootstrap(null, null, league, leagueCode, svf_language).then(function (data) {
			$scope.svfConfig = data.svfConfig;
			$scope.svfLang = data.svfLang;
			$scope.getGameData();
		}).catch(function () {
			$scope.loadError = true;
		});

		$scope.getData = function (gameId) {
			var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=gameMiniKit' +
				'&game_id=' + gameId +
				'&key=' + appKey +
				'&site_id=' + site_id +
				'&client_code=' + clientCode +
				'&lang=' + svf_language +
				'&league_id=' + league +
				'&callback=JSON_CALLBACK';

			return $http({ method: 'jsonp', url: url })
				.success(function (data) {

					$rootScope.feedUrl = url;
					$scope.pregameNotes = data;

					$scope.dataLoaded = true;
					$scope.loading = false;

					var awayTeam = $scope.pregameNotes.visitingTeam.name;
					var homeTeam = $scope.pregameNotes.homeTeam.name;

					$rootScope.seoTitle = awayTeam + ' @ ' + homeTeam + ' ' + $scope.pregameNotes.gameDate;

					var setPath = baseRoute + $scope.pageName;
					if ($routeParams.gameId) {
						setPath = setPath + '/' + $routeParams.gameId;
					}
					$rootScope.seoPath = setPath;
				})
				.error(function (data, status, headers, config) {
					$scope.loadError = true;
				});
		};
	}]);


//CJHL Combined Scorebar
app.controller('CombinedScorebarCtrl', ['$scope', '$http', '$rootScope', '$timeout', '$interval', 'HockeyTechService', '$attrs',
	function ($scope, $http, $rootScope, $timeout, $interval, HockeyTechService, $attrs) {

		var season = 'latest';
		var leagueId = $scope.leagueId;
		var leagueCode = $scope.leagueCode;

		var svf_language = $attrs.lang;
		if (typeof svf_language === 'undefined') {
			svf_language = 'en';
		}
		$scope.language = svf_language;

		$scope.urlGameSummary = "game-summary";
		$scope.urlGameCenter = "game-center";
		if (svf_language == 'fr') {
			$scope.urlGameSummary = "sommaire-du-match";
			$scope.urlGameCenter = "game-centre";
		}

		if (!leagueCode) {
			if (typeof $attrs.leaguecode != 'undefined') {
				leagueCode = $attrs.leaguecode;
			}
		}

		//list of all the combined league and stats urls
		$scope.leagueUrls = [
			{ league: 'ajhl', url: 'https://www.ajhl.ca/stats/' },
			{ league: 'sijhl', url: 'https://www.sijhlhockey.com/stats/' },
			{ league: 'sjhl', url: 'https://www.sjhl.ca/stats/' },
			{ league: 'mjhl', url: 'https://www.mjhlhockey.ca/stats/' },
			{ league: 'nojhl', url: 'https://www.nojhl.com/stats/' },
			{ league: 'cchl', url: 'https://www.thecchl.ca/stats/' },
			{ league: 'mhl', url: 'https://www.themhl.ca/stats/' }
		];

		var daysBack = 3;
		if (typeof $attrs.daysback != 'undefined' && $attrs.daysback != '') {
			daysBack = parseInt($attrs.daysback);
		}
		var daysAhead = 5;
		if (typeof $attrs.daysahead != 'undefined' && $attrs.daysahead != '') {
			daysAhead = parseInt($attrs.daysahead);
		}
		var limit;
		if (typeof $attrs.limit != 'undefined' && $attrs.limit != '') {
			limit = parseInt($attrs.limit);
		}
		//determine how many tiles display see slickConfig below.
		var tilesFull = 9;
		if (typeof $attrs.displaytiles != 'undefined' && $attrs.displaytiles != '') {
			tilesFull = parseInt($attrs.displaytiles);
		}
		var tiles1367 = tilesFull - 1;
		var tiles1025 = tilesFull - 2;
		var tiles769 = tilesFull - 3;
		if (tiles769 <= 5 || tiles769 >= 5) {
			tiles769 = 4;
		}

		HockeyTechService.bootstrap(season, 'scorebar', leagueId, leagueCode, svf_language).then(function (data) {
			$scope.currentSeasonId = data.current_season_id;
			$scope.svfConfig = data.svfConfig;
			$scope.svfLang = data.svfLang;
			$scope.current_league_id = data.current_league_id;
			$scope.leagues = data.leagues;
			$scope.useGameCenterUrl = (typeof data.svfConfig.game_center != 'undefined') ? data.svfConfig.game_center : false;

			$scope.urlGameLink = $scope.urlGameSummary;
			if ($scope.useGameCenterUrl) {
				$scope.urlGameLink = $scope.urlGameCenter;
			}

			//league_id returned from WP
			var wpLeagueId = league_id;
			var setLeagueId = $scope.current_league_id;
			if (wpLeagueId != '') {
				setLeagueId = wpLeagueId
			}

			if (setLeagueId && $scope.leagues && $scope.leagues.length > 0) {
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.leagueId = $scope.leagues[i].id;
						break;
					}
				}
			}

			// if we're still without a league
			if ($scope.leagueId == null) {
				$scope.leagueId = '';
			}

			$scope.getData($scope.leagueId);
		}).catch(function () {
			$scope.loadError = true;
		});

		HockeyTechService.getScorebarRollover().then(function (data) {
			$scope.rolloverDateTime = new Date();
			$scope.rolloverDateTime.setHours(data.rollover, 0, 0, 0);
		});

		$scope.getData = function () {
			$scope.GameData = null;
			$scope.dataLoaded = false;
			$scope.loading = true;
			$scope.theMethod = 'jsonp';
			$scope.url = prodUrl + '/feed/?feed=modulekit&key=' + appKey + '&view=cjhlcombinedscorebar&client_code=' + clientCode + '&numberofdaysahead=' + daysAhead + '&numberofdaysback=' + daysBack + '&limit=' + limit + '&fmt=json&lang=' + svf_language + '&callback=JSON_CALLBACK';

			$http({ method: $scope.theMethod, url: $scope.url })
				.success(function (data, status, headers, config) {
					$rootScope.feedUrl = $scope.url;
					$scope.linkPrefix = $scope.linkPrefix;
					$scope.status = status;
					$scope.GameData = data.SiteKit.Cjhlcombinedscorebar;
					$scope.dataLoaded = true;
					$interval(callDataLoaded, 200);
				}).
				error(function (data, status, headers, config) {
					// called asynchronously if an error occurs
					// or server returns response with an error status.
				});
		}

		//small wait until the data is all loaded so don't see a flicker
		function callDataLoaded() {
			$scope.loading = false;
		}

		function visChange() {
			if (!$scope.pageIsHidden()) {
				$scope.getScorebarUpdates($scope.leagueId);
			}
		}

		// use the property name to generate the prefixed event name
		var visProp = $scope.getHiddenProp();
		if (visProp) {
			var evtname = visProp.replace(/[H|h]idden/, '') + 'visibilitychange';
			document.addEventListener(evtname, visChange);
		}

		$scope.getScorebarUpdates = function (leagueId) {
			if (!$scope.pageIsHidden()) {

				//there's no update feed for combined so call the same feed as above with hardcoded days ahead
				$scope.url = prodUrl + '/feed/?feed=modulekit&key=' + appKey + '&view=cjhlcombinedscorebar&client_code=' + clientCode + '&numberofdaysahead=1&numberofdaysback=0&fmt=json&lang=' + svf_language + '&callback=JSON_CALLBACK';

				$http({ method: $scope.theMethod, url: $scope.url })
					.success(function (data, status, headers, config) {
						$scope.status = status;
						$scope.Updates = data.SiteKit.Cjhlcombinedscorebar;
						for (var key in $scope.Updates) {
							if ($scope.Updates.hasOwnProperty(key)) {
								for (var j = 0; j < $scope.GameData.length; j++) {
									if ($scope.GameData[j].ID == $scope.Updates[key].ID && $scope.Updates[key].GameStatus != 1) {

										$scope.GameData[j].VisitorGoals = $scope.Updates[key].VisitorGoals;
										$scope.GameData[j].HomeGoals = $scope.Updates[key].HomeGoals;
										$scope.GameData[j].GameClock = $scope.Updates[key].GameClock;
										$scope.GameData[j].Period = $scope.Updates[key].Period;

										// If the game is in progress, we want to show the game clock and period.
										// The regular scorebar feed does this for us in the query, but not the query run by the CRON.
										if ($scope.Updates[key].GameStatus == 2) {
											var ScoreClock = $scope.Updates[key].GameClock.split(":");
											$scope.GameData[j].GameStatusStringLong = ScoreClock[1] + ":" + ScoreClock[2] + " " + $scope.Updates[key].PeriodNameLong;
										}
										else {
											$scope.GameData[j].GameStatusStringLong = $scope.Updates[key].GameStatusStringLong;
										}
										break;
									}
								}
							}
						}

						$scope.dataLoaded = true;
						$scope.loading = false;
					}).
					error(function (data, status, headers, config) {
						// called asynchronously if an error occurs
						// or server returns response with an error status.
					});
			}
		}

		$interval(function () { $scope.getScorebarUpdates($scope.leagueId); }, 120000);

		$scope.slickConfigInline = {
			infinite: false,
			arrows: true,
			slidesToShow: tilesFull,
			slidesToScroll: 1,
			responsive: [
				{
					breakpoint: 1368,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles1367,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 1025,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles1025,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 769,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: tiles769,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 569,
					settings: {
						infinite: false,
						arrows: true,
						slidesToShow: 3,
						slidesToScroll: 1
					}
				},
				{
					breakpoint: 440,
					settings: {
						infinite: false,
						slidesToShow: 3,
						slidesToScroll: 1,
						arrows: false
					}
				}
			],
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

		$scope.slickConfigTeamName = {
			infinite: false,
			arrows: true,
			slidesToScroll: 1,
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

		//used for external scorebar (custom html)
		$scope.slickConfig = {
			event: {
				init: function (event, slick) {
					var currentDate = new Date();
					currentDate.setHours(0, 0, 0, 0);
					var currentDateTime = new Date();

					if (!$scope.GameData) {
						return;
					}

					var index = 0;
					for (var i = 0; i < $scope.GameData.length; i++) {
						var splitDate = $scope.GameData[i].Date.split("-");
						var gameDate = new Date(splitDate[0], splitDate[1] - 1, splitDate[2]);

						if (gameDate >= currentDate) {
							// If it's before the rollover time, find the first game before the rollover time. Otherwise, use the first game today
							index = (currentDateTime < $scope.rolloverDateTime) ? i - 1 : i;
							break;
						}
					}
					slick.slickGoTo(index);
				}
			}
		};

	}]);

//CJHL Combined Schedule
app.controller('CombinedSeasonScheduleCtrl', function ($scope, $http, $rootScope, $location, $routeParams, HockeyTechService, $route) {
	$scope.pageName = $route.current.$$route.name;
	var svf_language = $route.current.$$route.language;
	$scope.language = svf_language;

	var league = '';
	if ($routeParams.hasOwnProperty("league")) {
		league = $routeParams.league;
	}
	var leagueCode = '';
	if ($routeParams.hasOwnProperty("leaguecode")) {
		leagueCode = $routeParams.leaguecode;
	}

	var season = 'latest';

	HockeyTechService.bootstrap(season, 'schedule', league, leagueCode, svf_language).then(function (data) {
		$scope.months = data.monthsAll;
		$scope.current_season_id = data.current_season_id;
		$scope.current_league_id = data.current_league_id;
		$scope.leagues = data.leagues;
		$scope.leagueName = $scope.leagues[0].name;
		$scope.svfConfig = data.svfConfig;
		$scope.svfLang = data.svfLang;

		//current year and year list
		$scope.getYear = new Date().getFullYear();
		var yearUp = $scope.getYear + 1;
		$scope.years = [];
		$scope.years.push({ id: yearUp, name: yearUp });
		for (var i = 0; i < 10; i++) {
			$scope.years.push({ id: $scope.getYear - i, name: $scope.getYear - i });
		}
		if ($routeParams.yearId) {
			$scope.selectedYear = { id: $routeParams.yearId, name: $routeParams.yearId.toString() };
		} else {
			$scope.selectedYear = { id: $scope.getYear, name: $scope.getYear.toString() };
		}

		// We allow both a league_id and a league_code, league_id takes precendence.
		if ($routeParams.hasOwnProperty("league")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == $routeParams.league) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}
		else if ($routeParams.hasOwnProperty("leaguecode")) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].code == $routeParams.leaguecode) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		//league_id returned from WP
		var wpLeagueId = league_id;
		var setLeagueId = $scope.current_league_id;
		if (wpLeagueId != '') {
			setLeagueId = wpLeagueId
		}

		//if only season passed in get the league by season
		if ($routeParams.seasonId && !$routeParams.hasOwnProperty("league") && wpLeagueId == '') {
			//update league id based on season
			HockeyTechService.getLeagueIdBySeasonId($routeParams.seasonId).then(function (league_id) {
				setLeagueId = league_id;
				for (var i = 0; i < $scope.leagues.length; i++) {
					if ($scope.leagues[i].id == setLeagueId) {
						$scope.selectedLeague = $scope.leagues[i];
						break;
					}
				}
			});
		}

		if ($scope.selectedLeague == null && setLeagueId) {
			for (var i = 0; i < $scope.leagues.length; i++) {
				if ($scope.leagues[i].id == setLeagueId) {
					$scope.selectedLeague = $scope.leagues[i];
					break;
				}
			}
		}

		if ($scope.selectedLeague == null) {
			$scope.selectedLeague = $scope.leagues[0];
		}

		if ($routeParams.monthId) {
			if ($routeParams.teamId == "all-months") {
				$routeParams.teamId = "-1";
			}
			for (i = 0; i < $scope.months.length; i++) {
				if ($scope.months[i].id == $routeParams.monthId) {
					$scope.selectedMonth = $scope.months[i];
					break;
				}
			}
			if ($scope.selectedMonth == null) {
				$scope.selectedMonth = $scope.months[0];
			}
		} else {
			var TodayDate = new Date();
			// take into account additional items in the dropdown when setting the offset for the current month
			var monthOffset = $scope.months.length - 12;
			var thisMonth = (TodayDate.getMonth() + monthOffset);
			$scope.selectedMonth = $scope.months[thisMonth];
		}

		$scope.getData($scope.selectedMonth.id, $scope.selectedYear.id);

	}).catch(function () {
		$scope.loadError = true;
	});

	$scope.getData = function (month, year) {

		$scope.GameData = null;
		$scope.loading = true;
		$scope.dataLoaded = false;

		var method = 'jsonp';
		var url = prodUrl + '/feed/index.php?feed=statviewfeed&view=schedule&type=cjhlcombined';

		if (month !== null) {
			url += '&month=' + month;
		}
		if (year !== null) {
			url += '&year=' + year;
		}

		url += '&key=' + appKey +
			'&client_code=' + clientCode +
			'&lang=' + svf_language +
			'&callback=JSON_CALLBACK';

		$http({ method: method, url: url })
			.success(function (data) {
				$rootScope.feedUrl = url;
				$scope.GameData = data;
				$scope.dataLoaded = true;
				$scope.loading = false;
				$scope.NecessaryGame = false;
				if (typeof data == 'undefined') {
					return;
				}

				for (var gameIndex = 0; gameIndex < $scope.GameData[0].sections[0].data.length; gameIndex++) {
					// keep a record of if there is at least one necessary
					if ($scope.GameData[0].sections[0].data[gameIndex].ifNecessary != "") {
						$scope.NecessaryGame = true;
					}
				}

				$scope.setName = $scope.selectedLeague.name;

				//set page title and meta data
				$rootScope.seoTitle = $scope.setName + " " + $scope.svfLang.Schedule + " " + $scope.selectedMonth.name + " " + $scope.selectedYear.name;

				var setPath = baseRoute + $scope.pageName;
				if ($routeParams.monthId) {
					setPath = setPath + '/' + $routeParams.monthId;
				}
				if ($routeParams.yearId) {
					setPath = setPath + '/' + $routeParams.yearId;
				}
				$rootScope.seoPath = setPath;
			})
			.error(function (data, status, headers, config) {
				$scope.loadError = true;
			});
	};

	$scope.getSeasonSchedule = function () {
		var previousUrl = $location.$$url;

		var setMonthUrl = ""
		if ($scope.selectedMonth.id == "-1") {
			setMonthUrl = "all-months";
		} else {
			setMonthUrl = $scope.selectedMonth.id;
		}
		var setYearUrl = ""
		if ($scope.selectedYear.id != null) {
			setYearUrl = $scope.selectedYear.id;
		}

		var setPath = "";
		setPath = '/' + $scope.pageName + '/' + setMonthUrl + '/' + setYearUrl;
		$location.path(setPath);

		if (previousUrl != $location.$$url) {
			$scope.getData($scope.selectedMonth.id, $scope.selectedYear.id);
		}
	};

	$scope.countCols = function (Obj) {
		return Object.keys(Obj).length;
	}
});
