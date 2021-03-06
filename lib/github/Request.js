/**
 * Copyright 2010 Ajax.org B.V.
 *
 * This product includes software developed by
 * Ajax.org B.V. (http://www.ajax.org/).
 *
 * Author: Fabian Jaokbs <fabian@ajax.org>
 */

var http = require("http");
var sys = require("sys");
var querystring = require("querystring");
var crypto = require("crypto");

/**
 * Performs requests on GitHub API.
 */
var Request = exports.Request = function(options) {
    this.configure(options);
};

(function() {

    this.$defaults = {
        protocol    : 'https',
        url         : ':protocol://github.com/api/v2/:format/:path',
        path        : '/api/v2',
        hostname    : "github.com",
        format      : 'json',
        user_agent  : 'js-github-api (http://github.com/ornicar/php-github-api)',
        http_port   : 443,
        timeout     : 20,
        login_type  : "none",
        username    : null,
        password    : null,
        api_token   : null,
        oauth_access_token: null,
        debug       : false
    };

    this.configure = function(options)
    {
        var options = options || {};
        this.$options = {};
        for (var key in this.$defaults) {
            this.$options[key] = options[key] !== undefined ? options[key] : this.$defaults[key];
        }

        return this;
    };

    /**
     * Change an option value.
     *
     * @param {String} name   The option name
     * @param {Object} value  The value
     *
     * @return {Request} The current object instance
     */
    this.setOption = function(name, value)
    {
        this.$options[name] = value;
        return this;
    };

    /**
    * Get an option value.
    *
    * @param  string $name The option name
    *
    * @return mixed  The option value
    */
    this.getOption = function(name, defaultValue)
    {
        var defaultValue = defaultValue === undefined ? null : defaultValue;
        return this.$options[name] ? this.$options[name] : defaultValue;
    };

    /**
     * Send a GET request
     * @see send
     */
    this.get = function(apiPath, parameters, options, callback) {
        return this.send(apiPath, parameters, 'GET', options, callback);
    };

    /**
     * Send a POST request
     * @see send
     */
    this.post = function(apiPath, parameters, options, callback) {
        return this.send(apiPath, parameters, 'POST', options, callback);
    };

    /**
     * Send a request to the server, receive a response,
     * decode the response and returns an associative array
     *
     * @param  {String}    apiPath        Request API path
     * @param  {Object}    parameters     Parameters
     * @param  {String}    httpMethod     HTTP method to use
     * @param  {Object}    options        reconfigure the request for this call only
     */
    this.send = function(apiPath, parameters, httpMethod, options, callback)
    {
        var httpMethod = httpMethod || "GET";
        if(options)
        {
            var initialOptions = this.$options;
            this.configure(options);
        }

        var self = this;
        this.doSend(apiPath, parameters, httpMethod, function(err, response) {
            if (err) {
                callback && callback(err);
                return;
            }

            var response = self.decodeResponse(response);

            if (initialOptions) {
                self.options = initialOptions;
            };
            callback && callback(null, response);
        });
    };

    /**
     * Send a request to the server, receive a response
     *
     * @param {String}   $apiPath       Request API path
     * @param {Object}    $parameters    Parameters
     * @param {String}   $httpMethod    HTTP method to use
     */
    this.doSend = function(apiPath, parameters, httpMethod, callback)
    {
        var httpMethod = httpMethod.toUpperCase();
        
        if (this.$options.protocol == "https") {
            var creds = crypto.createCredentials({ });            
            var client = http.createClient(this.$options.http_port || 443, this.$options.hostname, true);
        }
        else
            var client = http.createClient(this.$options.http_port, this.$options.hostname);
            
        var headers = {
            'Host':'github.com',
            "User-Agent": "NodeJS HTTP Client",
            "Content-Length": "0"
        };

        switch(this.$options.login_type) {
            case "oauth":
                parameters.access_token = this.$options['oauth_access_token'];
                break;
                
            case "token":
                var auth = this.$options['username'] + "/token:" + this.$options['api_token'];
                var basic = new Buffer(auth, "ascii").toString("base64");
                headers.Authorization = "Basic " + basic;
                break;
                
            case "basic":
                var auth = this.$options['username'] + ":" + this.$options['password'];
                var basic = new Buffer(auth, "ascii").toString("base64");
                headers.Authorization = "Basic " + basic;
                break;
                
            default:
                // none
        }

        var queryString = querystring.stringify(parameters);
        var path = this.$options.path + "/" + this.$options.format + "/" + apiPath.replace(/\/*$/, "");

        if (queryString) {
            if (httpMethod == "GET") {
                path += "?" + queryString;
            } else if (httpMethod == "POST") {
                headers["Content-Length"] = queryString.length;
            }
        }

        var request = client.request(httpMethod, path, headers);
        if (httpMethod == "POST") {
            request.write(queryString);
        }

        this.$debug('send ' + httpMethod + ' request: ' + path);

        request.on('response', function (response) {
            if (response.statusCode > 200) {
                callback({status: response.statusCode, msg: response.status});
                return;
            }

            response.setEncoding('utf8');

            var body = [];
            response.addListener('data', function (chunk) {
                body.push(chunk);
            });
            response.addListener('end', function () {
                callback(null, body.join(""));
            });
        });
        request.end();
    },


    /**
     * Get a JSON response and transform to JSON
     */
    this.decodeResponse = function(response)
    {
        if(this.$options['format'] === "text")
        {
            return response;
        }
        else if(this.$options['format'] === "json")
        {
            return JSON.parse(response);
        }
    };

    this.$debug = function(msg) {
        if (this.$options.debug)
            console.log(msg);
    };

}).call(Request.prototype);