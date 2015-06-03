
var globals = {
    current_id : null, 
    markers : [],
    latLngList : []
};

var viewModel = function() {
    
    var self = this;
    var map;
    var bounds;
    var currentID;
    var dataCache; // Use for getting details instead of reconnecting to Yelp
    var index = ko.observable(0);
    var koData = {
        name : ko.observable(),
        img : ko.observable(),
        phone : ko.observable(),
        rating_img_url : ko.observable(),
        review_count : ko.observable(),
        url : ko.observable(),
        address : ko.observable(),
        city : ko.observable(),
        state_code : ko.observable(),
        postal_code : ko.observable(),
        term : ko.observable(),
    }
    
    this.categories = ko.observableArray([]);
        this.categories.push('Restaurants');
        this.categories.push('Hotels');
        this.categories.push('Parks');
        this.categories.push('Clubs');
        this.categories.push('Bowling');
        //this.categories.push('Automotive');
        //this.categories.push('Active Life');
        this.categories.push('Beauty & Spas');
        this.categories.push('Arts & Entertainment'); 
        this.categories.push('Shopping');
    
    /* Page count for pagination */
    this.pageIndex = ko.observable(0);
    this.onPage = ko.observable(5);
    this.pages = ko.observable(5);

    
    /* OAuth - Retrieve from Yelp */
    this.getBusiness = function(term, map) {

        var near=60173;  /* zip code for Schaumburg IL*/
        
        var auth = {
            consumerKey: "TvfqUauB0CMZE0RHhBRaJA",
            consumerSecret: "73YnivdS1e6DPgKKB3_oIjCpQQk",
            accessToken: "tKl7aLfNJC_Z2JXAs7aM3SBhGyafmeXu",
            accessTokenSecret: "QJLfT3laTaIk3VfJVbgWpZ23ehw",
            serviceProvider: {
                signatureMethod: "hmac-sha1"
            }
        };
    
        var terms = term;
        var q = "";
        var inCategory = false;
        
        for (category in self.categories()) {
            if (self.categories()[category].toLowerCase() === terms.toLowerCase()) {
                inCategory = true;
                break;
            }
        }
        
        if (!inCategory) {
            q = '"';
        }
        
        if (term === "") {
            term = "Back";
            q = "";
        }
        
        koData.term(q+term+q);
        var accessor = {
            consumerSecret: auth.consumerSecret,
            tokenSecret: auth.accessTokenSecret
        };

        parameters = [];
        parameters.push(['term', terms]);
        parameters.push(['location', near]);
        parameters.push(['callback', 'cb']);
        parameters.push(['oauth_consumer_key', auth.consumerKey]);
        parameters.push(['oauth_consumer_secret', auth.consumerSecret]);
        parameters.push(['oauth_token', auth.accessToken]);
        parameters.push(['oauth_signature_method', 'HMAC-SHA1']);

        var message = {
            'action': 'http://api.yelp.com/v2/search',
            'method': 'GET',
            'parameters': parameters
        };
    

        OAuth.setTimestampAndNonce(message);
        OAuth.SignatureMethod.sign(message, accessor);
        var parameterMap = OAuth.getParameterMap(message.parameters);
        parameterMap.oauth_signature = OAuth.percentEncode(parameterMap.oauth_signature);
    
        index(0);
        self.pageIndex(0);
        self.onPage(5);
        
        $('#list-result').css('margin-top', '-550px');
        $('#error-overlay').css('margin-top', '-45px');
        
        setTimeout(function() {
            
            $.ajax({
                url: message.action,
                data: parameterMap,
                cache: true,
                dataType: 'jsonp',
                jsonpCallback: 'cb',
                success: function(data, textStatus, XMLHttpRequest) {
                    
                    if (globals.markers.length) {
                        globals.current_id = null;
                        globals.markers[0].removeMarkers();
                        globals.markers = [];
                        $('#previous').hide();
                        $('#next').hide();
                        if (data.businesses.length > 5) {
                            $('#next').show();
                        }
                    }
                         
                    if (data.businesses.length) {
                    
                        /* Place markers to each location */
                        setMarker(data, map);
                        /* Set to number of results for pagination */
                        self.pages(20);
                        /* Clear then populate ul element "list" */
                        self.list(data);
                
                        $("#list-result").css("margin-top", "1px");
                        
                    }
                    else {
                        self.errorMessage("No results found.");
                    }
                },
                error: function() {
                    self.errorMessage("Could not load API. Try again later.");
                }
            });
        }, 1000);
    };
    
    /* initialize */
    var init = ko.computed(function() {
        
        /* Search form */
        $('#search-form').submit(function() {
            
            var term = $('#search').val();
            $("#select-category").val("");
            self.getBusiness(term, map);
            $('#search').val("");
            return false;
        });
        
        /* When li class item-place is clicked, set current id, center to marker, get infowindow to open */ 
        $(document).on('click', '.item-place', function() {
            
            var id = $(this).attr("data");
            globals.markers[id].bounce(globals.markers[id]);
            globals.current_id = id;
            map.panTo(globals.markers[id].marker.position);

            /*open infoWindow to display more information*/
            setInfoWindow(map, dataCache, id);

        });
        
        /* Selected Category */
        $(document).on('change', '#select-category', function(category) {
            self.getBusiness(category.currentTarget.selectedOptions[0].value, map);
        });
        
        /* Google Maps JavaScript API v3 starting from Schumaburg Illinois*/
        var myLatlng = new google.maps.LatLng(42.0303, -88.0839);
        var mapOptions = {
            center: myLatlng,
            zoom: 15
        };

        map = new google.maps.Map(document.getElementById('map-canvas'), mapOptions);
        bounds = new google.maps.LatLngBounds();    
    });
    

    /* Clear then populate ul element "list" */
    this.list = function(data) {
        
        dataCache = data;
        
        if (self.pages() + 5 > 5) {
            
            $('#list').empty(); // Clear ul element "list"
            
            /* Append places to ul element "list" */
            for (self.pageIndex(); self.pageIndex() < self.onPage(); self.pageIndex(self.pageIndex()+1)) {
                
                var subtitle = data.businesses[self.pageIndex()].review_count + " reviews";
                
                var address = data.businesses[self.pageIndex()].location.address[0] + " " + data.businesses[self.pageIndex()].location.city + " " + 
                data.businesses[self.pageIndex()].location.state_code + " " + data.businesses[self.pageIndex()].location.postal_code;
                
                var image = data.businesses[self.pageIndex()].image_url;
                if (image === undefined) {
                    image = 'img/no_image.png';
                }
            
                $('#list').append('<li class="item-place" data="'+index()+'">'+
                                       '<div class="list-thumbnail"><img src="'+image+'" width="100%"></div>'+
                                       '<h2>'+data.businesses[self.pageIndex()].name+'</h2>'+
                                       '<div class="list-address">'+address+'</div>'+
                                       '<div class="list-rating"><span style="color: #ff6600;">'+data.businesses[self.pageIndex()].rating+'</span>'+
                                       '<img class="rating-img" src="'+data.businesses[self.pageIndex()].rating_img_url_small+'">'+
                                       '<span>'+subtitle+'</span></div>'+
                                       '<p class="list-info">'+data.businesses[self.pageIndex()].snippet_text+ '</p>'+                                      
                                  '</li>');
                index(index()+1);
            }
            $('.item-place').fadeIn(500);
        }
    };
    
    /* Pagination next */
    this.next = function() {
        if (self.pages() + 5 > 5) {
            self.onPage(self.onPage()+5);
            self.pages(self.pages()-5);
            $('#previous').show();
        }
        if (self.pages() - 5 <= 0) {
            $('#next').hide();
        }
        $('.item-place').hide();
        self.list(dataCache);
        $('#list').scrollTop(0);       
    };
    
    /* Pagination previous */
    this.previous = function() {
        self.pageIndex(self.pageIndex()-10);
        self.onPage(self.onPage()-5);
        self.pages(self.pages()+5);
        if (self.pageIndex() == 0) {
            $('#previous').hide();
        }
        if (self.pages() - 5 > 0) {
            $('#next').show();
        }
        $('.item-place').hide();
        index(index()-10);
        self.list(dataCache);
        $('#list').scrollTop(0);
    };
    
    
    this.fitAllBounds = function() {
        if (globals.current_id) {
            globals.markers[globals.current_id].clickable(true);
            globals.markers[globals.current_id].marker.setAnimation(null);
        }
        for (i in globals.markers) {
            bounds.extend(globals.markers[i].marker.position);
        }
        map.fitBounds(bounds);
    };
    
    /* Update details */
    this.setName = ko.pureComputed(function() {
        return koData.name;
    });
    this.setImg = ko.pureComputed(function() {
        return koData.img;
    });
    this.setNumberReviews = ko.pureComputed(function() {
        var reviewNum = koData.review_count() > 1 ? " reviews" : " review";
        return koData.review_count() + reviewNum;
    });
    this.setReviewImg = ko.pureComputed(function() {
        return koData.rating_img_url;
    });
    this.setPhone = ko.pureComputed(function() {
        return koData.phone;
    });
    this.setURL = ko.pureComputed(function() {
        return koData.url;
    });
    this.setAddress = ko.pureComputed(function() {
        return koData.address;
    });
    this.setCity = ko.pureComputed(function() {
        return koData.city;
    });
    this.setState = ko.pureComputed(function() {
        return koData.state_code;
    });
    this.setPostal = ko.pureComputed(function() {
        return koData.postal_code;
    });
    this.setTerm = ko.pureComputed(function() {
        return koData.term;
    });
    this.errorMessage = function(message) {
        $('#error-overlay').text(message);
        $('#error-overlay').css('margin-top', '1px');
    }
}


var Marker = function(data, id, map) {
	
    var self = this;
    this.clickable = ko.observable(true);
    var latitude = data.businesses[obj].location.coordinate.latitude;
    var longitude = data.businesses[obj].location.coordinate.longitude;
	
    /* Get latitude and longitude then push to latLngList array */		
    this.Latlng = new google.maps.LatLng(latitude, longitude);
    this.marker = new google.maps.Marker({ position : self.Latlng, map : map });
    globals.latLngList.push(new google.maps.LatLng(latitude, longitude));


     /* Assign marker id and add event listener */
    this.attachData = ko.computed(function() {
		
        self.id = id;


        google.maps.event.addListener(self.marker, 'click', function() {

            self.bounce();

            /* Center to this marker */
            map.panTo(self.marker.position);

            /* Set global current id */
            globals.current_id = self.id;
            
            /*open infoWindow to display more information*/
            setInfoWindow(map, data, id);
 
        });
    });
	
    /* Marker bounce animation. */
    this.bounce = function() {
		
        if (self.clickable()){
            if (globals.current_id) {
                globals.markers[globals.current_id].clickable(true);
                globals.markers[globals.current_id].marker.setAnimation(null);
            }
            if (self.marker.getAnimation() != null) {
                self.marker.setAnimation(null);
            }else{
                self.marker.setAnimation(google.maps.Animation.BOUNCE);
            }
            self.clickable(false);
        }
    };
	
    this.setAllMap = function(map) {
		
        for (marker in globals.markers) {
            globals.markers[marker].marker.setMap(map);
        }
    };
	
    this.removeMarkers = function() {
        self.setAllMap(null);
    };
};


var setMarker = function(data, map) {
		
    //console.log(data);
    /* Push each marker into markers array */
    for (obj in data.businesses) {
        globals.markers.push(new Marker(data, obj, map));
    }
    vm.fitAllBounds();
};


var setInfoWindow = function(map, data, id){

        /* Get details of location passing its id */
        var placeUrl = data.businesses[id].url; //place url for its website 
        var name = data.businesses[id].name;
        var address = data.businesses[id].location.address[0] ;
        var address2 = data.businesses[id].location.city + ', ' + data.businesses[id].location.state_code + ' ' + data.businesses[id].location.postal_code; // address for the place
        var contact = data.businesses[id].display_phone; //place phone number
        
        var image = data.businesses[id].image_url;
        if (image === undefined) {
            image = 'img/no_image.png';
        }

        //create new content 
        var contentString = '<div class="busInfowindow">' + 
        '<div class="busName">' + '<a href ="' + placeUrl + '" target="_blank" >' + name + '</a>'  + '</div>' + 
        '<div class="busAddress">' + address + '</div>' + 
        '<div class="busAddress">' + address2 + '</div>' + 
        '<div class="busContact">' + contact + '</div>' + 
        '<img class="list-thumbnail" src="' + image + '">' + '</div>';

         //console.log(contentString);

          // infoWindows are the little helper windows that open when you click or hover over a pin on a map
         infoWindow.setContent(contentString);
         infoWindow.open(map, globals.markers[id].marker);

    };
    

 // infoWindows are the little helper windows that open when you click
var infoWindow = new google.maps.InfoWindow();

var vm = new viewModel();

ko.applyBindings(vm);