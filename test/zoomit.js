// zoomit.js
// A basic JS wrapper library for the Zoom.it web API <http://api.zoom.it/>
// that doesn't require jQuery or any other JavaScript library.
// 
// Author: Aseem Kishore <http://github.com/aseemk>
// License: MIT (see license.txt for full text)

(function (window, document) {
    
    var Zoomit = window.Zoomit = {};
    
    // CONSTANTS
    
    var HEAD = document.getElementsByTagName("head")[0],
        
        ARG_URL = "url",
        ARG_CALLBACK = "callback",
        
        // Zoom.it IDs are alphanumeric, case-sensitive
        ID_REGEX = /^[0-9a-zA-Z]+$/;
    
    // CONFIGURATION
    
    /**
     * The path to the web API. This path can be an absolute URL or a relative
     * one, but it must end with a slash.
     * By default, this path is "http://api.zoom.it/", but this hook is
     * provided for testability against staging environments.
     */
    Zoomit.apiPath = "http://api.zoom.it/";
    
    // JSONP HELPERS
    
    function makeScriptRequest(src) {
        var script = document.createElement("script");
        
        script.src = src;
        HEAD.appendChild(script);
        
        return script;
    }
    
    function makeGlobalWrapper(actualCallback) {
        var name = "_jsonCallback" +
                Math.round(Math.random() * 100000000).toString();
        
        window[name] = function () {
            actualCallback.apply(this, arguments);
            try {
                delete window[name];    // this doesn't work in IE7-...
            } catch (e) {
                window[name] = undefined;   // ...so we fallback to this.
            }
        };
        
        return name;
    }
    
    // API HELPERS
    
    function makeApiUrlById(id, callbackName) {
        return [
            Zoomit.apiPath,
            "v1/content/",
            id,
            '?',
            ARG_CALLBACK,
            '=',
            encodeURIComponent(callbackName)
        ].join('');
    }
    
    function makeApiUrlByUrl(url, callbackName) {
        return [
            Zoomit.apiPath,
            "v1/content/",
            '?',
            ARG_CALLBACK,
            '=',
            encodeURIComponent(callbackName),
            '&',
            ARG_URL,
            '=',
            encodeURIComponent(url)
        ].join('');
    }
    
    function isId(str) {
        return ID_REGEX.test(str);
    }
    
    // PUBLIC METHODS
    
    /**
     * Asynchronously fetches the info for the Zoom.it content with the given
     * Zoom.it ID or source URL. The given callback function is called with an
     * API response object <http://zoom.it/pages/api/reference/v1/response>.
     */
    Zoomit.getContentInfo = function (idOrUrl, callback) {
        var apiUrlFunc = isId(idOrUrl) ? makeApiUrlById : makeApiUrlByUrl;
        var script = makeScriptRequest(apiUrlFunc(idOrUrl, makeGlobalWrapper(
            function (resp) {
                script.parentNode.removeChild(script);
                callback(resp);
            }
        )));
    };

}(window, document));