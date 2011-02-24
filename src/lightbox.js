// lightbox.js
// A Zoom.it + Lightbox mashup. Anchors with rel="lightbox" are automatically
// wired up to show a Zoom.it combo viewer for the anchor's href image URL.
// 
// Dependencies:
// - Zoom.it combo viewer
// - Zoom.it API wrapper library

(function() {
    
    if (!window.Seadragon || !Seadragon.ComboViewer) {
        throw new Error("Combo viewer has not been included.");
    } else if (!window.Zoomit) {
        throw new Error("Zoom.it API wrapper library has not been included.");
    } else if (Zoomit.Lightbox) {
        // Zoom.it Lightbox already included; our work is done.
        return;
    }
    
    // Config
    // TODO what configs should we have?
    
    var Config = {};
    
    // Strings
    
    Seadragon.Strings.setString("Zoomit.Lightbox.Prev", "← Prev");
    Seadragon.Strings.setString("Zoomit.Lightbox.Next", "Next →");
    Seadragon.Strings.setString("Zoomit.Lightbox.Count", "[{0} of {1}]");
    
    // Constants
    
    var LIGHTBOX_ID = "zoomit-lightbox";
    
    // HTML helpers
    
    function createElmt(tagName, idPostfix) {
        var elmt = document.createElement(tagName);
        elmt.id = LIGHTBOX_ID + (idPostfix ? "-" + idPostfix : "");
        return elmt;
    }
    
    // Raw image tile source
    
    function getRawImageTileUrl(level, x, y) {
        return this.src;
    }
    
    function makeRawImageTileSource(width, height, src) {
        var tileSource = new Seadragon.TileSource(width, height, Math.max(width, height));
        
        tileSource.src = src;
        tileSource.getTileUrl = getRawImageTileUrl;
        
        return tileSource;
    }
    
    // ImageInfo helper struct
    
    function ImageInfo(href) {
        // identifying keys
        this.url = getAbsoluteUrl(href);
        this.href = href;   // the original anchor href
        // conversion status
        this.ready = false;
        this.tileSource = null;
    }
    
    // Absolute URL helpers
    
    var BASE_URL = "";
    
    function getAbsoluteUrl(url) {
        // derive base url lazily, since <base> may not be parsed at the time
        // this script is being parsed and executed.
        if (!BASE_URL) {
            BASE_URL = getBaseUrl();
        }
        
        return isAbsoluteUrl(url) ? url : BASE_URL + url;
    }
    
    function getBaseUrl() {
        var base = "";
        var baseElmts = document.getElementsByTagName("base");
        
        if (baseElmts.length) {
            base = baseElmts[0].href;
        }
        
        if (isAbsoluteUrl(base)) {
            return base;
        }
        
        var l = window.location;
        return l.protocol + "//" + l.host +
            l.pathname.substr(0, l.pathname.lastIndexOf('/') + 1) + base;
    }
    
    function isAbsoluteUrl(url) {
        url = url.toLowerCase();
        return url.indexOf("http://") === 0 || url.indexOf("https://") === 0 ||
                url.indexOf("file://") === 0;
    }
    
    // Elements
    
    var lightboxElmt = null // overall lightbox element, what we show and hide
    var loadingImg = null;  // the loading throbber image
    var rawImg = null;      // the current raw image, if any, above the viewer
    
    var prevElmt = null;    // the element containing the "prev" button
    var nextElmt = null;    // the element containing the "next" button
    var countElmt = null;   // the element containing the count text ("[1 of 12"])
    var captionElmt = null; // the element containing the image caption
    
    // Variables
    
    var viewer = null;
    var imageInfos = {};    // dictionary from URL (href) to ImageInfo object
    var groupLists = {};    // dictionary from group name to list of anchors
    var currentGroup = null;
    var currentIndex = null;
    
    // Presentation helpers
    
    function initPresentation() {
        // create structure:
        /*
            + overall lightbox div  (100% of window)
              + background div      (100% of window, semi-transparent, click to close)
              + foreground div      (80% of window)
                + viewer container (3x3 grid)
                  + top, with left, center and right children
                  + mid, with left, center and right children
                    + viewer element, inside center
                  + btm, with left, center and right children
                + info container
                  + prev span
                  + count span
                  + caption span
                  + next span
        */
        
        lightboxElmt = createElmt("div", "");
        
        var backgroundElmt = createElmt("div", "background");
        Seadragon.Utils.addEvent(backgroundElmt, "click", hideLightbox);
        
        var foregroundElmt = createElmt("div", "foreground");
        
        var viewerElmt = createElmt("div", "viewer");
        
        // combo viewer creation is asynchronous because in the Silverlight
        // case, a XAP needs to be downloaded. so begin creating it here.
        Seadragon.ComboViewer.create(viewerElmt, function (v) {
            viewer = v;
            Seadragon.Debug.log("Zoom.it Lightbox: viewer loaded! " +
                (v.isSilverlight ? "(silverlight)" : "(ajax)"));
        });
        
        // TODO delete
        // TEMP keeping around bc we have references to it
        loadingImg = createElmt("img");
        var loadingImgStyle = loadingImg.style;
        
        /*
        Seadragon.Utils.addEvent(loadingImg, "load", function() {
            loadingImgStyle.marginTop = (loadingImg.height / -2) + "px";
            loadingImgStyle.marginLeft = (loadingImg.width / -2) + "px";
        });
        
        loadingImg.alt = "Loading...";
        loadingImg.src = Config.loadingImage;
        
        loadingImgStyle.display = "none";
        loadingImgStyle.margin = "auto";
        loadingImgStyle.position = "absolute";
        loadingImgStyle.top = "50%";
        loadingImgStyle.left = "50%";
        */
        
        var infoElmt = createElmt("div", "info");
        
        prevElmt = createElmt("span", "prev");
        prevElmt.appendChild(document.createTextNode(
            Seadragon.Strings.getString("Zoomit.Lightbox.Prev")));
        
        nextElmt = createElmt("span", "next");
        nextElmt.appendChild(document.createTextNode(
            Seadragon.Strings.getString("Zoomit.Lightbox.Next")));
        
        Seadragon.Utils.addEvent(prevElmt, "click", onPrevClick);
        Seadragon.Utils.addEvent(nextElmt, "click", onNextClick);
        
        countElmt = createElmt("span", "count");
        
        captionElmt = createElmt("span", "caption");
        
        infoElmt.appendChild(prevElmt);
        infoElmt.appendChild(nextElmt);
        infoElmt.appendChild(countElmt);
        infoElmt.appendChild(captionElmt);
        
        viewerElmt.appendChild(loadingImg);
        
        foregroundElmt.appendChild(viewerElmt);
        foregroundElmt.appendChild(infoElmt);
        
        lightboxElmt.appendChild(backgroundElmt);
        lightboxElmt.appendChild(foregroundElmt);
        
        hideLightbox();
        document.body.appendChild(lightboxElmt);
    }
    
    function hideLightbox() {
        if (viewer) {
            viewer.close();
        }
        
        rawImg = null;
        currentGroup = null;
        currentIndex = null;
        
        // TEMP no longer technically collapsing our container, because that
        // prevents silverlight from loading the first time. instead, simply
        // sliding the container up above the top of the page. seems to work.
        // TODO maybe investigate doing this only the first time, and then
        // collapsing it each time after once silverlight has loaded?
        //lightboxElmt.style.display = "none";
        lightboxElmt.style.top = "-100%";
        loadingImg.style.display = "none";
    }
    
    function prepareLightbox(caption, groupList, groupIndex) {
        // to protect against race conditions, reset remembered raw image, and
        // also hide the spinning throbber and close the viewer.
        hideLightbox();
        
        // uncollapse lightbox element first to prevent element size errors.
        // update: sliding it back into view if it was slid above the page.
        lightboxElmt.style.display = "";
        lightboxElmt.style.top = "";
        
        // show the count if this is in a group
        countElmt.innerHTML = "";
        if (groupList) {
            countElmt.appendChild(document.createTextNode(
                Seadragon.Strings.getString("Zoomit.Lightbox.Count", groupIndex + 1, groupList.length)));
        }
        
        // show the caption if present
        captionElmt.innerHTML = "";
        captionElmt.appendChild(document.createTextNode(caption || ""));
        
        // show/hide the previous button as appropriate
        if (groupList && groupIndex > 0) {
            prevElmt.title = groupList[groupIndex - 1].title;
            prevElmt.style.visibility = "";     // means implicitly visible
        } else {
            prevElmt.style.visibility = "hidden";
        }
        
        // show/hide the next button as appropriate
        if (groupList && groupIndex < groupList.length - 1) {
            nextElmt.title = groupList[groupIndex + 1].title;
            nextElmt.style.visibility = "";     // means implicitly visible
        } else {
            nextElmt.style.visibility = "hidden";
        }
        
        // save the group and index so that prev/next button listeners work
        currentGroup = groupList;
        currentIndex = groupIndex;
    }
    
    function showLightboxWithDzi(tileSource, caption, groupList, groupIndex) {
        prepareLightbox(caption, groupList,  groupIndex);
        
        // open the dzi in the viewer
        viewer.openTileSource(tileSource);
    }
    
    function showLightboxWithImg(src, caption, groupList, groupIndex) {
        prepareLightbox(caption, groupList,  groupIndex);
        
        // show the "loading" throbber and begin loading the raw image. when it
        // finishes loading, hide the "loading throbber" and open a tile source
        // whose only tile is the image itself. UPDATE: to protect against race
        // conditions, remember the image we opened, and only open it if the
        // the current image hasn't changed.
        loadingImg.style.display = "block";
        var rawImgExpected = rawImg = Seadragon.Utils.makeNeutralElement("img");
        Seadragon.Utils.addEvent(rawImg, "load", function(e) {
            if (rawImg == rawImgExpected) {
                loadingImg.style.display = "none";
                viewer.openTileSource(
                        makeRawImageTileSource(rawImg.width, rawImg.height, src));
            }
        });
        rawImg.src = src;  // explicitly *after* adding the listener, for IE
    }
    
    function onPrevClick(event) {
        var nextIndex = currentIndex - 1;
        if (currentGroup && nextIndex >= 0) {
            activateAnchor(currentGroup[nextIndex], currentGroup, nextIndex);
        }
    }
    
    function onNextClick(event) {
        var nextIndex = currentIndex + 1;
        if (currentGroup && nextIndex < currentGroup.length) {
            activateAnchor(currentGroup[nextIndex], currentGroup, nextIndex);
        }
    }
    
    // Behavior helpers
    
    function initBehavior() {
        // process anchors that look like this:
        // <a href="..." rel="lightbox" title="[caption]">...</a>
        var anchors = document.body.getElementsByTagName("a");
        for (var i = 0; i < anchors.length; i++) {
            var anchor = anchors[i];
            if (anchor.href && anchor.rel.match("lightbox")) {
                wireUpAnchor(anchor);
            }
        }
    }
    
    function extractGroup(rel) {
        var begin = rel.indexOf("lightbox[");
        if (begin < 0) {
            return null;
        }
        
        var end = rel.indexOf("]", begin);
        if (end < 0) {
            end = rel.indexOf(" ", begin);
            if (end < 0 ) {
                end = rel.length;
            }
        }
        
        return rel.substring(begin + 1, end);
    }
    
    function getImageInfo(url) {
        if (!imageInfos[url]) {
            imageInfos[url] = new ImageInfo(url);
        }
        
        return imageInfos[url];
    }
    
    function getGroupList(group) {
        if (!groupLists[group]) {
            groupLists[group] = [];
        }
        
        return groupLists[group];
    }
    
    function indexOf(list, elmt) {
        for (var i = 0; list && i < list.length; i++) {
            if (list[i] == elmt) {
                return i;
            }
        }
        
        return -1;
    }
    
    function wireUpAnchor(anchor) {
        // all info for this anchor's URL is in the ImageInfo for that URL
        var info = getImageInfo(anchor.href);
        
        // figure out if this is part of a group
        var group = extractGroup(anchor.rel);
        var groupList = group && getGroupList(group);
        var groupIndex = -1;    // we'll calculate it lazily on the first click
        if (groupList) {
            groupList.push(anchor);
            // TODO why can't we just set groupIndex here?
        }
        
        // fire off a convert request, followed by an image info request if ready
        Zoomit.getContentInfo(info.url, function(resp) {
            var content = resp.content;
            if (!content) {
                return;     // there was some error, nothing we can do;
                            // just show the raw image as we have been so far.
            }
            
            var dzi = content.dzi;
            var ready = content.ready;
            
            if (!ready || !dzi) {
                return;     // the DZI isn't ready yet, so ignore.
            }
            
            info.ready = ready;
            info.tileSource = new Seadragon.DziTileSource(
                dzi.width, dzi.height, dzi.tileSize, dzi.tileOverlap,
                dzi.url.replace(".dzi", "_files/"), dzi.tileFormat);
        });
        
        // wire up the click handler for this anchor
        Seadragon.Utils.addEvent(anchor, "click", function(event) {
            // if our combo viewer isn't ready yet, do nothing.
            if (!viewer) {
                if (Seadragon.Config.debugMode) {
                    Seadragon.Debug.log("viewer not ready yet!");
                    Seadragon.Utils.cancelEvent(event);
                }
                return;
            }
            
            // if anchor's href changed, err on the safe side and do nothing.
            // this lets the link open normally.
            if (anchor.href != info.href) {
                return;
            }
            
            // otherwise, cancel the event; we'll show the image directly.
            Seadragon.Utils.cancelEvent(event);
            
            // use the group we parsed initially, and only calculate the index
            // once, saving the result.
            if (groupList && groupIndex < 0) {
                groupIndex = indexOf(groupList, anchor);
            }
            
            activateAnchor(anchor, groupList, groupIndex, info);
        });
    }
    
    function activateAnchor(anchor, groupList, groupIndex, info) {
        // get the info for the anchor's URL if it wasn't given
        if (!info) {
            info = getImageInfo(anchor.href);
        }
        
        // if we still have no info, it means the anchor's href changed, so
        // err on the safe side and do nothing; let the link open normally.
        if (!info) {
            return;
        }
        
        // use the anchor's title attribute as the caption, but if it doesn't
        // have one set, use the text content in case it's a text link!
        var caption = anchor.title || anchor.innerText || anchor.textContent;
        
        // if the DZI is ready, show it, otherwise show the raw image.
        if (info.ready) {
            showLightboxWithDzi(info.tileSource, caption, groupList, groupIndex);
        } else {
            showLightboxWithImg(info.href, caption, groupList, groupIndex);
        }
    }
    
    // Constructor
    
    var _initialized = false;
    
    function init() {
        if (_initialized) {
            return;
        }
        
        _initialized = true;
        
        initPresentation();
        initBehavior();
    }
    
    // And finally...
    
    Zoomit.Lightbox = Config;    // the Lightbox object is only for configuration
    Zoomit.Lightbox.init = init; // the developer can initialize immediately
    
    Seadragon.Utils.addEvent(window, "load", init); // otherwise we auto-init on load
    
})();