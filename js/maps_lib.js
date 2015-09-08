(function (window, undefined) {
    var MapsLib = function (options) {
        var self = this;

        options = options || {};

        this.recordName = options.recordName || "result"; //for showing a count of results
        this.recordNamePlural = options.recordNamePlural || "results";
        this.searchRadius = options.searchRadius || 805; //in meters ~ 1/2 mile

        // the encrypted Table ID of your Fusion Table (found under File => About)
        this.fusionTableId = options.fusionTableId || "",

        // Found at https://console.developers.google.com/
        // Important! this key is for demonstration purposes. please register your own.
        this.googleApiKey = options.googleApiKey || "",
        
        // name of the location column in your Fusion Table.
        // NOTE: if your location column name has spaces in it, surround it with single quotes
        // example: locationColumn:     "'my location'",
        this.locationColumn = options.locationColumn || "geometry";
        
        // appends to all address searches if not present
        this.locationScope = options.locationScope || "";

        // zoom level when map is loaded (bigger is more zoomed in)
        this.defaultZoom = options.defaultZoom || 11; 

        // center that your map defaults to
        this.map_centroid = new google.maps.LatLng(options.map_center[0], options.map_center[1]);
        
        // marker image for your searched address
        if (typeof options.addrMarkerImage !== 'undefined') {
            if (options.addrMarkerImage != "")
                this.addrMarkerImage = options.addrMarkerImage;
            else
                this.addrMarkerImage = ""
        }
        else
            this.addrMarkerImage = "images/blue-pushpin.png"

    	this.currentPinpoint = null;
    	$("#result_count").html("");
        
        this.myOptions = {
            zoom: this.defaultZoom,
            center: this.map_centroid,
            mapTypeId: google.maps.MapTypeId.ROADMAP
        };
        this.geocoder = new google.maps.Geocoder();
        this.map = new google.maps.Map($("#map_canvas")[0], this.myOptions);
        
        // maintains map centerpoint for responsive design
        google.maps.event.addDomListener(self.map, 'idle', function () {
            self.calculateCenter();
        });
        google.maps.event.addDomListener(window, 'resize', function () {
            self.map.setCenter(self.map_centroid);
        });
        self.searchrecords = null;

        //reset filters
        $("#search_address").val(self.convertToPlainString($.address.parameter('address')));
        var loadRadius = self.convertToPlainString($.address.parameter('radius'));
        if (loadRadius != "") 
            $("#search_radius").val(loadRadius);
        else 
            $("#search_radius").val(self.searchRadius);
        
        $(":checkbox").prop("checked", "checked");
        $("#result_box").hide();

        //-----custom initializers-----
        self.setDefaultDate();
        //-----end of custom initializers-----

        //run the default search when page loads
        self.doSearch();
        if (options.callback) options.callback(self);
    };

    //-----custom functions-----
    MapsLib.prototype.stringFromHour = function (hourString) {
        console.log("hour is: "+hourString);
        console.log("hour length is: " + hourString.length);
        if (hourString.length == 1) {
            return "0"+hourString.toString();
        }
        return hourString.toString();
    };

    MapsLib.prototype.setDefaultDate = function () {
        var currentDate = new Date();
        var dayOfWeek = currentDate.getDay();
        var hour = currentDate.getHours();
        var minute = currentDate.getMinutes();
        console.log("dayOfWeek: "+dayOfWeek.toString());
        console.log("hour: "+hour.toString());
        console.log("minute: "+minute.toString());
        if (dayOfWeek == 0) $("#rbSunday").prop("checked","checked");
        else if (dayOfWeek == 1) $("#rbMonday").prop("checked","checked");
        else if (dayOfWeek == 2) $("#rbTuesday").prop("checked","checked");
        else if (dayOfWeek == 3) $("#rbWednesday").prop("checked","checked");
        else if (dayOfWeek == 4) $("#rbThursday").prop("checked","checked");
        else if (dayOfWeek == 5) $("#rbFriday").prop("checked","checked");
        else if (dayOfWeek == 6) $("#rbSaturday").prop("checked","checked");
        
        var hourMod = hour % 12;
        if (hourMod == 0) $("#rb12").prop("checked","checked");
        else if (hourMod == 1) $("#rb1").prop("checked","checked");
        else if (hourMod == 2) $("#rb2").prop("checked","checked");
        else if (hourMod == 3) $("#rb3").prop("checked","checked");
        else if (hourMod == 4) $("#rb4").prop("checked","checked");
        else if (hourMod == 5) $("#rb5").prop("checked","checked");
        else if (hourMod == 6) $("#rb6").prop("checked","checked");
        else if (hourMod == 7) $("#rb7").prop("checked","checked");
        else if (hourMod == 8) $("#rb8").prop("checked","checked");
        else if (hourMod == 9) $("#rb9").prop("checked","checked");
        else if (hourMod == 10) $("#rb10").prop("checked","checked");
        else if (hourMod == 11) $("#rb11").prop("checked","checked");
        
        if (minute < 15) $("#rb00").prop("checked","checked");
        else if (minute < 30) $("#rb15").prop("checked","checked");
        else if (minute < 45) $("#rb30").prop("checked","checked");
        else $("#rb45").prop("checked","checked");
        
        if (hour < 12) $("#rbAM").prop("checked","checked");
        else $("#rbPM").prop("checked","checked");

        $('#rbParking').prop('checked','checked');
    }
    /*
    MapsLib.prototype.enableMapTips = function () {
        var self = this;
        self.searchrecords.enableMapTips({
            select: "'description','id','validSunday','validMonday','validTuesday','validWednesday','validThursday','validFriday','validSaturday'",
            from: self.fusionTableId,
            geometryColumn: self.locationColumn,
            googleApiKey: self.googleApiKey,
            delay: 100
        });

    }
    */
    MapsLib.prototype.getCount = function (whereClause) {
        var self = this;
        var selectColumns = "Count()";
        self.query({
            select: selectColumns,
            where: whereClause
        }, function (json) {
            self.displaySearchCount(json);
        });
    };

    //-----end of custom functions-----

    MapsLib.prototype.submitSearch = function (whereClause, map) {
        var self = this;
        //get using all filters
        //NOTE: styleId and templateId are recently added attributes to load custom marker styles and info windows
        //you can find your Ids inside the link generated by the 'Publish' option in Fusion Tables
        //for more details, see https://developers.google.com/fusiontables/docs/v1/using#WorkingStyles
        self.searchrecords = new google.maps.FusionTablesLayer({
            query: {
                from: self.fusionTableId,
                select: self.locationColumn,
                where: whereClause
            },
            styleId: 2,
            templateId: 2
        });
        self.fusionTable = self.searchrecords;
        self.searchrecords.setMap(map);
        self.getCount(whereClause);
        //self.enableMapTips();
    };


    MapsLib.prototype.getgeoCondition = function (address, callback) {
        var self = this;
        if (address !== "") {
            if (address.toLowerCase().indexOf(self.locationScope) === -1) {
                address = address + " " + self.locationScope;
            }
            self.geocoder.geocode({
                'address': address
            }, function (results, status) {
                if (status === google.maps.GeocoderStatus.OK) {
                    self.currentPinpoint = results[0].geometry.location;
                    var map = self.map;

                    $.address.parameter('address', encodeURIComponent(address));
                    $.address.parameter('radius', encodeURIComponent(self.searchRadius));
                    map.setCenter(self.currentPinpoint);
                    // set zoom level based on search radius
                    if (self.searchRadius >= 1610000) map.setZoom(4); // 1,000 miles
                    else if (self.searchRadius >= 805000) map.setZoom(5); // 500 miles
                    else if (self.searchRadius >= 402500) map.setZoom(6); // 250 miles
                    else if (self.searchRadius >= 161000) map.setZoom(7); // 100 miles
                    else if (self.searchRadius >= 80500) map.setZoom(8); // 100 miles
                    else if (self.searchRadius >= 40250) map.setZoom(9); // 100 miles
                    else if (self.searchRadius >= 16100) map.setZoom(11); // 10 miles
                    else if (self.searchRadius >= 8050) map.setZoom(12); // 5 miles
                    else if (self.searchRadius >= 3220) map.setZoom(13); // 2 miles
                    else if (self.searchRadius >= 1610) map.setZoom(14); // 1 mile
                    else if (self.searchRadius >= 805) map.setZoom(15); // 1/2 mile
                    else if (self.searchRadius >= 400) map.setZoom(16); // 1/4 mile
                    else self.map.setZoom(17);

                    if (self.addrMarkerImage != '') {
                        self.addrMarker = new google.maps.Marker({
                            position: self.currentPinpoint,
                            map: self.map,
                            icon: self.addrMarkerImage,
                            animation: google.maps.Animation.DROP,
                            title: address
                        });
                    }
                    var geoCondition = " AND ST_INTERSECTS(" + self.locationColumn + ", CIRCLE(LATLNG" + self.currentPinpoint.toString() + "," + self.searchRadius + "))";
                    callback(geoCondition);
                    self.drawSearchRadiusCircle(self.currentPinpoint);
                } else {
                    alert("We could not find your address: " + status);
                    callback('');
                }
            });
        } else {
            callback('');
        }
    };

    MapsLib.prototype.doSearch = function () {
        var self = this;
        self.clearSearch();
        var address = $("#search_address").val();
        self.searchRadius = $("#search_radius").val();
        self.whereClause = self.locationColumn + " not equal to ''";
        
        //-----custom filters-----
        // Days
        var validSundayColumn = "'validSunday'";
        var validMondayColumn = "'validMonday'";
        var validTuesdayColumn = "'validTuesday'";
        var validWednesdayColumn = "'validWednesday'";
        var validThursdayColumn = "'validThursday'";
        var validFridayColumn = "'validFriday'";
        var validSaturdayColumn = "'validSaturday'";
        
        if ( $("#rbSunday").is(':checked')) {
            self.whereClause += " AND " + validSundayColumn + "='true'";
            console.log("Set validSundayColumn.");
        }
        else if ( $("#rbMonday").is(':checked')) {
            self.whereClause += " AND " + validMondayColumn + "='true'";
            console.log("Set validMondayColumn.");
        }
        else if ( $("#rbTuesday").is(':checked')) {
            self.whereClause += " AND " + validTuesdayColumn + "='true'";
            console.log("Set validTuesdayColumn.");
        }
        else if ( $("#rbWednesday").is(':checked')) {
            self.whereClause += " AND " + validWednesdayColumn + "='true'";
            console.log("Set validWednesdayColumn.");
        }
        else if ( $("#rbThursday").is(':checked')) {
            self.whereClause += " AND " + validThursdayColumn + "='true'";
            console.log("Set validThursdayColumn.");
        }
        else if ( $("#rbFriday").is(':checked')) {
            self.whereClause += " AND " + validFridayColumn + "='true'";
            console.log("Set validFridayColumn.");
        }
        else if ( $("#rbSaturday").is(':checked')) {
            self.whereClause += " AND " + validSaturdayColumn + "='true'";
            console.log("Set validSaturdayColumn.");
        }

        // Time slots
        var period = "";
        var hour = "";
        var minute = "";
        if ( $("#rbAM").is(':checked')) {
            period = "am";
        } else if ($("#rbPM").is(':checked')) {
            period = "pm";
        } else { null;}
        if ($('#rb12').is(':checked')) hour = '00';
        else if ($('#rb1').is(':checked')) hour = '01';
        else if ($('#rb2').is(':checked')) hour = '02';
        else if ($('#rb3').is(':checked')) hour = '03';
        else if ($('#rb4').is(':checked')) hour = '04';
        else if ($('#rb5').is(':checked')) hour = '05';
        else if ($('#rb6').is(':checked')) hour = '06';
        else if ($('#rb7').is(':checked')) hour = '07';
        else if ($('#rb8').is(':checked')) hour = '08';
        else if ($('#rb9').is(':checked')) hour = '09';
        else if ($('#rb10').is(':checked')) hour = '10';
        else if ($('#rb11').is(':checked')) hour = '11';

        if ($('#rb00').is(':checked')) minute = '00';
        else if ($('#rb15').is(':checked')) minute = '15';
        else if ($('#rb30').is(':checked')) minute = '30';
        else if ($('#rb45').is(':checked')) minute = '45';

        fieldName = "time"+hour+minute+period;
        console.log("field name is: "+fieldName);

        if (!(hour == "" || minute == "" || period == "")) {
            self.whereClause += " AND " + fieldName + "='t'";    
        }
        
        // Sign type
        noParkingColumn = "'no_parking'";
        noStandingColumn = "'no_standing'";
        noStoppingColumn = "'no_stopping'";
        noParkingAllColumn = "'noParkingAll'";
        parkingSignFilter = "";
        if ($('#rbParking').is(':checked')) {
            parkingSignFilter += " AND "+noParkingColumn+"='false'";
            parkingSignFilter += " AND "+noStandingColumn+"='false'";
            parkingSignFilter += " AND "+noStoppingColumn+"='false'";
        }
        else if ($('#rbNoParking').is(':checked')){
            parkingSignFilter += " AND "+noParkingAllColumn+"='true'";
            //parkingSignFilter += " AND "+noStandingColumn+"='true'";
            //parkingSignFilter += " \| "+noStoppingColumn+"='true'";
            //parkingSignFilter += "}";
        }
        else if ($('#rbAllParking').is(':checked')){
            null;
        }
        self.whereClause += parkingSignFilter;
        console.log("whereClause: "+self.whereClause);
        //-----end of custom filters-----

        self.getgeoCondition(address, function (geoCondition) {
            self.whereClause += geoCondition;
            self.submitSearch(self.whereClause, self.map);
        });

    };

    MapsLib.prototype.reset = function () {
        $.address.parameter('address','');
        $.address.parameter('radius','');
        window.location.reload();
    };


    MapsLib.prototype.getInfo = function (callback) {
        var self = this;
        jQuery.ajax({
            url: 'https://www.googleapis.com/fusiontables/v2/tables/' + self.fusionTableId + '?key=' + self.googleApiKey,
            dataType: 'json'
        }).done(function (response) {
            if (callback) callback(response);
        });
    };

    MapsLib.prototype.addrFromLatLng = function (latLngPoint) {
        var self = this;
        self.geocoder.geocode({
            'latLng': latLngPoint
        }, function (results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
                if (results[1]) {
                    $('#search_address').val(results[1].formatted_address);
                    $('.hint').focus();
                    self.doSearch();
                }
            } else {
                alert("Geocoder failed due to: " + status);
            }
        });
    };

    MapsLib.prototype.drawSearchRadiusCircle = function (point) {
        var self = this;
        var circleOptions = {
            strokeColor: "#4b58a6",
            strokeOpacity: 0.3,
            strokeWeight: 1,
            fillColor: "#4b58a6",
            fillOpacity: 0.05,
            map: self.map,
            center: point,
            clickable: false,
            zIndex: -1,
            radius: parseInt(self.searchRadius)
        };
        self.searchRadiusCircle = new google.maps.Circle(circleOptions);
    };

    MapsLib.prototype.query = function (query_opts, callback) {
        var queryStr = [],
            self = this;
        queryStr.push("SELECT " + query_opts.select);
        queryStr.push(" FROM " + self.fusionTableId);
        // where, group and order clauses are optional
        if (query_opts.where && query_opts.where != "") {
            queryStr.push(" WHERE " + query_opts.where);
        }
        if (query_opts.groupBy && query_opts.roupBy != "") {
            queryStr.push(" GROUP BY " + query_opts.groupBy);
        }
        if (query_opts.orderBy && query_opts.orderBy != "") {
            queryStr.push(" ORDER BY " + query_opts.orderBy);
        }
        if (query_opts.offset && query_opts.offset !== "") {
            queryStr.push(" OFFSET " + query_opts.offset);
        }
        if (query_opts.limit && query_opts.limit !== "") {
            queryStr.push(" LIMIT " + query_opts.limit);
        }
        var theurl = {
            base: "https://www.googleapis.com/fusiontables/v2/query?sql=",
            queryStr: queryStr,
            key: self.googleApiKey
        };
        $.ajax({
            url: [theurl.base, encodeURIComponent(theurl.queryStr.join(" ")), "&key=", theurl.key].join(''),
            dataType: "json"
        }).done(function (response) {
            //console.log(response);
            if (callback) callback(response);
        }).fail(function(response) {
            self.handleError(response);
        });
    };

    MapsLib.prototype.handleError = function (json) {
        if (json.error !== undefined) {
            var error = json.responseJSON.error.errors;
            console.log("Error in Fusion Table call!");
            for (var row in error) {
                console.log(" Domain: " + error[row].domain);
                console.log(" Reason: " + error[row].reason);
                console.log(" Message: " + error[row].message);
            }
        }
    };
    MapsLib.prototype.getCount = function (whereClause) {
        var self = this;
        var selectColumns = "Count()";
        self.query({
            select: selectColumns,
            where: whereClause
        }, function (json) {
            self.displaySearchCount(json);
        });
    };

    MapsLib.prototype.displaySearchCount = function (json) {
        var self = this;
        
        var numRows = 0;
        if (json["rows"] != null) {
            numRows = json["rows"][0];
        }
        var name = self.recordNamePlural;
        if (numRows == 1) {
            name = self.recordName;
        }
        $("#result_box").fadeOut(function () {
            $("#result_count").html(self.addCommas(numRows) + " " + name + " found");
        });
        $("#result_box").fadeIn();
    };

    MapsLib.prototype.addCommas = function (nStr) {
        nStr += '';
        x = nStr.split('.');
        x1 = x[0];
        x2 = x.length > 1 ? '.' + x[1] : '';
        var rgx = /(\d+)(\d{3})/;
        while (rgx.test(x1)) {
            x1 = x1.replace(rgx, '$1' + ',' + '$2');
        }
        return x1 + x2;
    };

    // maintains map centerpoint for responsive design
    MapsLib.prototype.calculateCenter = function () {
        var self = this;
        center = self.map.getCenter();
    };

    //converts a slug or query string in to readable text
    MapsLib.prototype.convertToPlainString = function (text) {
        if (text === undefined) return '';
        return decodeURIComponent(text);
    };

    MapsLib.prototype.clearSearch = function () {
        var self = this;
        if (self.searchrecords && self.searchrecords.getMap) 
            self.searchrecords.setMap(null);
        if (self.addrMarker && self.addrMarker.getMap) 
            self.addrMarker.setMap(null);
        if (self.searchRadiusCircle && self.searchRadiusCircle.getMap) 
            self.searchRadiusCircle.setMap(null);
    };

    MapsLib.prototype.findMe = function () {
        var self = this;
        var foundLocation;
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(function (position) {
                var latitude = position.coords.latitude;
                var longitude = position.coords.longitude;
                var accuracy = position.coords.accuracy;
                var coords = new google.maps.LatLng(latitude, longitude);
                self.map.panTo(coords);
                self.addrFromLatLng(coords);
                self.map.setZoom(14);
                jQuery('#map_canvas').append('<div id="myposition"><i class="fontello-target"></i></div>');
                setTimeout(function () {
                    jQuery('#myposition').remove();
                }, 3000);
            }, function error(msg) {
                alert('Please enable your GPS position future.');
            }, {
                //maximumAge: 600000,
                //timeout: 5000,
                enableHighAccuracy: true
            });
        } else {
            alert("Geolocation API is not supported in your browser.");
        }
    };
    if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        module.exports = MapsLib;
    } else if (typeof define === 'function' && define.amd) {
        define(function () {
            return MapsLib;
        });
    } else {
        window.MapsLib = MapsLib;
    }

})(window);