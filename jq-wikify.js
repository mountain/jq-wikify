/*
 * Wikify plugin By Mingli Yuan
 *
 * // Use like so:
 * $('english-section').wikify(['Mathematics', 'Physics', 'Art']);
 * $('chinese-section').wikify(['数学', '物理', '艺术'], 'zh', 'zh-cn');
 *
 * // Or use like:
 * $.wikifySetting('zh', 'zh-cn');
 * $('chinese-section').wikify(['数学', '物理', '艺术']);
 */
(function($) {
    $.wikifySetting = function(options) {
      $.extend($.fn.wikify.options, options);
    };
    $.fn.wikify = function(keywords, lang, variant) {
      this.each(function() {
          var $t = $(this);
          if(keywords.length===1) keywords = keywords[0].split(',');
          wikify($t, keywords, lang, variant);
      });
    };

    var utf8 = function (string) {
      string = string.replace(/\r\n/g,"\n");
      var utftext = "";
      for (var n = 0; n < string.length; n++) {
        var c = string.charCodeAt(n);
        if (c < 128) {
          utftext += String.fromCharCode(c);
        }
        else if((c > 127) && (c < 2048)) {
          utftext += String.fromCharCode((c >> 6) | 192);
          utftext += String.fromCharCode((c & 63) | 128);
        }
        else {
          utftext += String.fromCharCode((c >> 12) | 224);
          utftext += String.fromCharCode(((c >> 6) & 63) | 128);
          utftext += String.fromCharCode((c & 63) | 128);
        }
      }
      return utftext;
    };

    var urlencode = function (string) {
      return escape(utf8(string));
    };

    var wikify = function(obj, keywords, lang, variant) {
      lang = lang || $.fn.wikify.options.lang;
      variant = variant || $.fn.wikify.options.variant;
      var titles = null;
      $.each(keywords, function(index, value) {
          if(index===0) titles = urlencode(value);
          titles = titles + '|' + urlencode(value);
      });
      var query = 'http://' + lang + '.wikipedia.org/w/api.php?action=query&prop=info&inprop=url&format=json&callback=?&titles=' + titles;

      var replacements = [],
      storeReplacement = function(regex, start, end) {
        var repalcer = function(str, p, offset, s) { return start + p + end; };
        replacements.push(function(text) {
          return text.replace(regex, repalcer);
        });
      };

      $.getJSON(query, function(data) {
          var temp = data;
          if(!data.query) return;
          var revMap = {};
          for(var ind in data.query.normalized) {
            revMap[data.query.normalized[ind].to] = data.query.normalized[ind].from;
          }
          for(var pageId in data.query.pages) {
            if(pageId > 0) {
              var page = data.query.pages[pageId],
                  url = page.fullurl,
                  title1 = page.title,
                  title2 = revMap[page.title] || page.title,
                  re = new RegExp('(' + title1 + '|' + title2 + ')'),
                  clz = $.fn.wikify.options.linkClass,
                  rel = $.fn.wikify.options.rel;
              url = url.replace('/wiki/', '/' + variant + '/');
              var start = '<a class="' + clz + '" rel="' + rel + '" href="' + url + '">', end = '</a>';
              storeReplacement(re, start, end);
            }
          }

          var indexOf = function(array, elt) {
            var len = array.length;
            for (var ind = 0; ind < len; ind++) {
              if (ind in array && array[ind] === elt)
                return ind;
            }
            return -1;
          };

          var results = "", inlink = false;
          HTMLParser(obj.html(), {
            start: function( tag, attrs, unary ) {
              results += "<" + tag;
              for ( var i = 0; i < attrs.length; i++ )
                results += " " + attrs[i].name + '="' + attrs[i].escaped + '"';
              results += (unary ? "/" : "") + ">";
              if(tag==='a') inlink = true;
            },
            end: function( tag ) {
              results += "</" + tag + ">";
              if(tag==='a') inlink = false;
            },
            chars: function( text ) {
              if(!inlink) {
                var done = [], notDone=[];
                for(var ind in replacements) {
                  var newText = replacements[ind](text);
                  if(newText !== text)
                    done.push(ind);
                  else
                    notDone.push(replacements[ind]);
                  text = newText;
                }
                replacements = notDone;
              };
              results += text;
            },
            comment: function( text ) {
              results += "<!--" + text + "-->";
            }
          });

          obj.html(results);
      });
    };
    $.fn.wikify.options = {
      lang: 'en',
      variant: 'wiki',
      linkClass: 'wikilink',
      rel: 'definition'
    };
})(jQuery);

/*
 * HTML Parser By John Resig (ejohn.org)
 * Original code by Erik Arvidsson, Mozilla Public License
 * http://erik.eae.net/simplehtmlparser/simplehtmlparser.js
 *
 * // Use like so:
 * HTMLParser(htmlString, {
 *     start: function(tag, attrs, unary) {},
 *     end: function(tag) {},
 *     chars: function(text) {},
 *     comment: function(text) {}
 * });
 *
 */
(function(){

  // Regular Expressions for parsing tags and attributes
  var startTag = /^<(\w+)((?:\s+\w+(?:\s*=\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
    endTag = /^<\/(\w+)[^>]*>/,
    attr = /(\w+)(?:\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))?/g;

  // Empty Elements - HTML 4.01
  var empty = makeMap("area,base,basefont,br,col,frame,hr,img,input,isindex,link,meta,param,embed");

  // Block Elements - HTML 4.01
  var block = makeMap("address,applet,blockquote,button,center,dd,del,dir,div,dl,dt,fieldset,form,frameset,hr,iframe,ins,isindex,li,map,menu,noframes,noscript,object,ol,p,pre,script,table,tbody,td,tfoot,th,thead,tr,ul");

  // Inline Elements - HTML 4.01
  var inline = makeMap("a,abbr,acronym,applet,b,basefont,bdo,big,br,button,cite,code,del,dfn,em,font,i,iframe,img,input,ins,kbd,label,map,object,q,s,samp,script,select,small,span,strike,strong,sub,sup,textarea,tt,u,var");

  // Elements that you can, intentionally, leave open
  // (and which close themselves)
  var closeSelf = makeMap("colgroup,dd,dt,li,options,p,td,tfoot,th,thead,tr");

  // Attributes that have their values filled in disabled="disabled"
  var fillAttrs = makeMap("checked,compact,declare,defer,disabled,ismap,multiple,nohref,noresize,noshade,nowrap,readonly,selected");

  // Special Elements (can contain anything)
  var special = makeMap("script,style");

  var HTMLParser = this.HTMLParser = function( html, handler ) {
    var index, chars, match, stack = [], last = html;
    stack.last = function(){
      return this[ this.length - 1 ];
    };

    while ( html ) {
      chars = true;

      // Make sure we're not in a script or style element
      if ( !stack.last() || !special[ stack.last() ] ) {

        // Comment
        if ( html.indexOf("<!--") == 0 ) {
          index = html.indexOf("-->");

          if ( index >= 0 ) {
            if ( handler.comment )
              handler.comment( html.substring( 4, index ) );
            html = html.substring( index + 3 );
            chars = false;
          }

        // end tag
        } else if ( html.indexOf("</") == 0 ) {
          match = html.match( endTag );

          if ( match ) {
            html = html.substring( match[0].length );
            match[0].replace( endTag, parseEndTag );
            chars = false;
          }

        // start tag
        } else if ( html.indexOf("<") == 0 ) {
          match = html.match( startTag );

          if ( match ) {
            html = html.substring( match[0].length );
            match[0].replace( startTag, parseStartTag );
            chars = false;
          }
        }

        if ( chars ) {
          index = html.indexOf("<");

          var text = index < 0 ? html : html.substring( 0, index );
          html = index < 0 ? "" : html.substring( index );

          if ( handler.chars )
            handler.chars( text );
        }

      } else {
        html = html.replace(new RegExp("(.*)<\/" + stack.last() + "[^>]*>"), function(all, text){
          text = text.replace(/<!--(.*?)-->/g, "$1")
            .replace(/<!\[CDATA\[(.*?)]]>/g, "$1");

          if ( handler.chars )
            handler.chars( text );

          return "";
        });

        parseEndTag( "", stack.last() );
      }

      if ( html == last )
        throw "Parse Error: " + html;
      last = html;
    }

    // Clean up any remaining tags
    parseEndTag();

    function parseStartTag( tag, tagName, rest, unary ) {
      if ( block[ tagName ] ) {
        while ( stack.last() && inline[ stack.last() ] ) {
          parseEndTag( "", stack.last() );
        }
      }

      if ( closeSelf[ tagName ] && stack.last() == tagName ) {
        parseEndTag( "", tagName );
      }

      unary = empty[ tagName ] || !!unary;

      if ( !unary )
        stack.push( tagName );

      if ( handler.start ) {
        var attrs = [];

        rest.replace(attr, function(match, name) {
          var value = arguments[2] ? arguments[2] :
            arguments[3] ? arguments[3] :
            arguments[4] ? arguments[4] :
            fillAttrs[name] ? name : "";

          attrs.push({
            name: name,
            value: value,
            escaped: value.replace(/(^|[^\\])"/g, '$1\\\"') //"
          });
        });

        if ( handler.start )
          handler.start( tagName, attrs, unary );
      }
    }

    function parseEndTag( tag, tagName ) {
      // If no tag name is provided, clean shop
      if ( !tagName )
        var pos = 0;

      // Find the closest opened tag of the same type
      else
        for ( var pos = stack.length - 1; pos >= 0; pos-- )
          if ( stack[ pos ] == tagName )
            break;

      if ( pos >= 0 ) {
        // Close all the open elements, up the stack
        for ( var i = stack.length - 1; i >= pos; i-- )
          if ( handler.end )
            handler.end( stack[ i ] );

        // Remove the open elements from the stack
        stack.length = pos;
      }
    }
  };

  function makeMap(str){
    var obj = {}, items = str.split(",");
    for ( var i = 0; i < items.length; i++ )
      obj[ items[i] ] = true;
    return obj;
  }
})();
