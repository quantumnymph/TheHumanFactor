// Created with Squiffy 5.1.3
// https://github.com/textadventures/squiffy

(function(){
/* jshint quotmark: single */
/* jshint evil: true */

var squiffy = {};

(function () {
    'use strict';

    squiffy.story = {};

    var initLinkHandler = function () {
        var handleLink = function (link) {
            if (link.hasClass('disabled')) return;
            var passage = link.data('passage');
            var section = link.data('section');
            var rotateAttr = link.attr('data-rotate');
            var sequenceAttr = link.attr('data-sequence');
            if (passage) {
                disableLink(link);
                squiffy.set('_turncount', squiffy.get('_turncount') + 1);
                passage = processLink(passage);
                if (passage) {
                    currentSection.append('<hr/>');
                    squiffy.story.passage(passage);
                }
                var turnPassage = '@' + squiffy.get('_turncount');
                if (turnPassage in squiffy.story.section.passages) {
                    squiffy.story.passage(turnPassage);
                }
                if ('@last' in squiffy.story.section.passages && squiffy.get('_turncount')>= squiffy.story.section.passageCount) {
                    squiffy.story.passage('@last');
                }
            }
            else if (section) {
                currentSection.append('<hr/>');
                disableLink(link);
                section = processLink(section);
                squiffy.story.go(section);
            }
            else if (rotateAttr || sequenceAttr) {
                var result = rotate(rotateAttr || sequenceAttr, rotateAttr ? link.text() : '');
                link.html(result[0].replace(/&quot;/g, '"').replace(/&#39;/g, '\''));
                var dataAttribute = rotateAttr ? 'data-rotate' : 'data-sequence';
                link.attr(dataAttribute, result[1]);
                if (!result[1]) {
                    disableLink(link);
                }
                if (link.attr('data-attribute')) {
                    squiffy.set(link.attr('data-attribute'), result[0]);
                }
                squiffy.story.save();
            }
        };

        squiffy.ui.output.on('click', 'a.squiffy-link', function () {
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('keypress', 'a.squiffy-link', function (e) {
            if (e.which !== 13) return;
            handleLink(jQuery(this));
        });

        squiffy.ui.output.on('mousedown', 'a.squiffy-link', function (event) {
            event.preventDefault();
        });
    };

    var disableLink = function (link) {
        link.addClass('disabled');
        link.attr('tabindex', -1);
    }
    
    squiffy.story.begin = function () {
        if (!squiffy.story.load()) {
            squiffy.story.go(squiffy.story.start);
        }
    };

    var processLink = function(link) {
		link = String(link);
        var sections = link.split(',');
        var first = true;
        var target = null;
        sections.forEach(function (section) {
            section = section.trim();
            if (startsWith(section, '@replace ')) {
                replaceLabel(section.substring(9));
            }
            else {
                if (first) {
                    target = section;
                }
                else {
                    setAttribute(section);
                }
            }
            first = false;
        });
        return target;
    };

    var setAttribute = function(expr) {
        var lhs, rhs, op, value;
        var setRegex = /^([\w]*)\s*=\s*(.*)$/;
        var setMatch = setRegex.exec(expr);
        if (setMatch) {
            lhs = setMatch[1];
            rhs = setMatch[2];
            if (isNaN(rhs)) {
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
                squiffy.set(lhs, rhs);
            }
            else {
                squiffy.set(lhs, parseFloat(rhs));
            }
        }
        else {
			var incDecRegex = /^([\w]*)\s*([\+\-\*\/])=\s*(.*)$/;
            var incDecMatch = incDecRegex.exec(expr);
            if (incDecMatch) {
                lhs = incDecMatch[1];
                op = incDecMatch[2];
				rhs = incDecMatch[3];
				if(startsWith(rhs,"@")) rhs=squiffy.get(rhs.substring(1));
				rhs = parseFloat(rhs);
                value = squiffy.get(lhs);
                if (value === null) value = 0;
                if (op == '+') {
                    value += rhs;
                }
                if (op == '-') {
                    value -= rhs;
                }
				if (op == '*') {
					value *= rhs;
				}
				if (op == '/') {
					value /= rhs;
				}
                squiffy.set(lhs, value);
            }
            else {
                value = true;
                if (startsWith(expr, 'not ')) {
                    expr = expr.substring(4);
                    value = false;
                }
                squiffy.set(expr, value);
            }
        }
    };

    var replaceLabel = function(expr) {
        var regex = /^([\w]*)\s*=\s*(.*)$/;
        var match = regex.exec(expr);
        if (!match) return;
        var label = match[1];
        var text = match[2];
        if (text in squiffy.story.section.passages) {
            text = squiffy.story.section.passages[text].text;
        }
        else if (text in squiffy.story.sections) {
            text = squiffy.story.sections[text].text;
        }
        var stripParags = /^<p>(.*)<\/p>$/;
        var stripParagsMatch = stripParags.exec(text);
        if (stripParagsMatch) {
            text = stripParagsMatch[1];
        }
        var $labels = squiffy.ui.output.find('.squiffy-label-' + label);
        $labels.fadeOut(1000, function() {
            $labels.html(squiffy.ui.processText(text));
            $labels.fadeIn(1000, function() {
                squiffy.story.save();
            });
        });
    };

    squiffy.story.go = function(section) {
        squiffy.set('_transition', null);
        newSection();
        squiffy.story.section = squiffy.story.sections[section];
        if (!squiffy.story.section) return;
        squiffy.set('_section', section);
        setSeen(section);
        var master = squiffy.story.sections[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(squiffy.story.section);
        // The JS might have changed which section we're in
        if (squiffy.get('_section') == section) {
            squiffy.set('_turncount', 0);
            squiffy.ui.write(squiffy.story.section.text);
            squiffy.story.save();
        }
    };

    squiffy.story.run = function(section) {
        if (section.clear) {
            squiffy.ui.clearScreen();
        }
        if (section.attributes) {
            processAttributes(section.attributes);
        }
        if (section.js) {
            section.js();
        }
    };

    squiffy.story.passage = function(passageName) {
        var passage = squiffy.story.section.passages[passageName];
        if (!passage) return;
        setSeen(passageName);
        var masterSection = squiffy.story.sections[''];
        if (masterSection) {
            var masterPassage = masterSection.passages[''];
            if (masterPassage) {
                squiffy.story.run(masterPassage);
                squiffy.ui.write(masterPassage.text);
            }
        }
        var master = squiffy.story.section.passages[''];
        if (master) {
            squiffy.story.run(master);
            squiffy.ui.write(master.text);
        }
        squiffy.story.run(passage);
        squiffy.ui.write(passage.text);
        squiffy.story.save();
    };

    var processAttributes = function(attributes) {
        attributes.forEach(function (attribute) {
            if (startsWith(attribute, '@replace ')) {
                replaceLabel(attribute.substring(9));
            }
            else {
                setAttribute(attribute);
            }
        });
    };

    squiffy.story.restart = function() {
        if (squiffy.ui.settings.persist && window.localStorage) {
            var keys = Object.keys(localStorage);
            jQuery.each(keys, function (idx, key) {
                if (startsWith(key, squiffy.story.id)) {
                    localStorage.removeItem(key);
                }
            });
        }
        else {
            squiffy.storageFallback = {};
        }
        if (squiffy.ui.settings.scroll === 'element') {
            squiffy.ui.output.html('');
            squiffy.story.begin();
        }
        else {
            location.reload();
        }
    };

    squiffy.story.save = function() {
        squiffy.set('_output', squiffy.ui.output.html());
    };

    squiffy.story.load = function() {
        var output = squiffy.get('_output');
        if (!output) return false;
        squiffy.ui.output.html(output);
        currentSection = jQuery('#' + squiffy.get('_output-section'));
        squiffy.story.section = squiffy.story.sections[squiffy.get('_section')];
        var transition = squiffy.get('_transition');
        if (transition) {
            eval('(' + transition + ')()');
        }
        return true;
    };

    var setSeen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) seenSections = [];
        if (seenSections.indexOf(sectionName) == -1) {
            seenSections.push(sectionName);
            squiffy.set('_seen_sections', seenSections);
        }
    };

    squiffy.story.seen = function(sectionName) {
        var seenSections = squiffy.get('_seen_sections');
        if (!seenSections) return false;
        return (seenSections.indexOf(sectionName) > -1);
    };
    
    squiffy.ui = {};

    var currentSection = null;
    var screenIsClear = true;
    var scrollPosition = 0;

    var newSection = function() {
        if (currentSection) {
            disableLink(jQuery('.squiffy-link', currentSection));
        }
        var sectionCount = squiffy.get('_section-count') + 1;
        squiffy.set('_section-count', sectionCount);
        var id = 'squiffy-section-' + sectionCount;
        currentSection = jQuery('<div/>', {
            id: id,
        }).appendTo(squiffy.ui.output);
        squiffy.set('_output-section', id);
    };

    squiffy.ui.write = function(text) {
        screenIsClear = false;
        scrollPosition = squiffy.ui.output.height();
        currentSection.append(jQuery('<div/>').html(squiffy.ui.processText(text)));
        squiffy.ui.scrollToEnd();
    };

    squiffy.ui.clearScreen = function() {
        squiffy.ui.output.html('');
        screenIsClear = true;
        newSection();
    };

    squiffy.ui.scrollToEnd = function() {
        var scrollTo, currentScrollTop, distance, duration;
        if (squiffy.ui.settings.scroll === 'element') {
            scrollTo = squiffy.ui.output[0].scrollHeight - squiffy.ui.output.height();
            currentScrollTop = squiffy.ui.output.scrollTop();
            if (scrollTo > currentScrollTop) {
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.4;
                squiffy.ui.output.stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
        else {
            scrollTo = scrollPosition;
            currentScrollTop = Math.max(jQuery('body').scrollTop(), jQuery('html').scrollTop());
            if (scrollTo > currentScrollTop) {
                var maxScrollTop = jQuery(document).height() - jQuery(window).height();
                if (scrollTo > maxScrollTop) scrollTo = maxScrollTop;
                distance = scrollTo - currentScrollTop;
                duration = distance / 0.5;
                jQuery('body,html').stop().animate({ scrollTop: scrollTo }, duration);
            }
        }
    };

    squiffy.ui.processText = function(text) {
        function process(text, data) {
            var containsUnprocessedSection = false;
            var open = text.indexOf('{');
            var close;
            
            if (open > -1) {
                var nestCount = 1;
                var searchStart = open + 1;
                var finished = false;
             
                while (!finished) {
                    var nextOpen = text.indexOf('{', searchStart);
                    var nextClose = text.indexOf('}', searchStart);
         
                    if (nextClose > -1) {
                        if (nextOpen > -1 && nextOpen < nextClose) {
                            nestCount++;
                            searchStart = nextOpen + 1;
                        }
                        else {
                            nestCount--;
                            searchStart = nextClose + 1;
                            if (nestCount === 0) {
                                close = nextClose;
                                containsUnprocessedSection = true;
                                finished = true;
                            }
                        }
                    }
                    else {
                        finished = true;
                    }
                }
            }
            
            if (containsUnprocessedSection) {
                var section = text.substring(open + 1, close);
                var value = processTextCommand(section, data);
                text = text.substring(0, open) + value + process(text.substring(close + 1), data);
            }
            
            return (text);
        }

        function processTextCommand(text, data) {
            if (startsWith(text, 'if ')) {
                return processTextCommand_If(text, data);
            }
            else if (startsWith(text, 'else:')) {
                return processTextCommand_Else(text, data);
            }
            else if (startsWith(text, 'label:')) {
                return processTextCommand_Label(text, data);
            }
            else if (/^rotate[: ]/.test(text)) {
                return processTextCommand_Rotate('rotate', text, data);
            }
            else if (/^sequence[: ]/.test(text)) {
                return processTextCommand_Rotate('sequence', text, data);   
            }
            else if (text in squiffy.story.section.passages) {
                return process(squiffy.story.section.passages[text].text, data);
            }
            else if (text in squiffy.story.sections) {
                return process(squiffy.story.sections[text].text, data);
            }
			else if (startsWith(text,'@') && !startsWith(text,'@replace')) {
				processAttributes(text.substring(1).split(","));
				return "";
			}
            return squiffy.get(text);
        }

        function processTextCommand_If(section, data) {
            var command = section.substring(3);
            var colon = command.indexOf(':');
            if (colon == -1) {
                return ('{if ' + command + '}');
            }

            var text = command.substring(colon + 1);
            var condition = command.substring(0, colon);
			condition = condition.replace("<", "&lt;");
            var operatorRegex = /([\w ]*)(=|&lt;=|&gt;=|&lt;&gt;|&lt;|&gt;)(.*)/;
            var match = operatorRegex.exec(condition);

            var result = false;

            if (match) {
                var lhs = squiffy.get(match[1]);
                var op = match[2];
                var rhs = match[3];

				if(startsWith(rhs,'@')) rhs=squiffy.get(rhs.substring(1));
				
                if (op == '=' && lhs == rhs) result = true;
                if (op == '&lt;&gt;' && lhs != rhs) result = true;
                if (op == '&gt;' && lhs > rhs) result = true;
                if (op == '&lt;' && lhs < rhs) result = true;
                if (op == '&gt;=' && lhs >= rhs) result = true;
                if (op == '&lt;=' && lhs <= rhs) result = true;
            }
            else {
                var checkValue = true;
                if (startsWith(condition, 'not ')) {
                    condition = condition.substring(4);
                    checkValue = false;
                }

                if (startsWith(condition, 'seen ')) {
                    result = (squiffy.story.seen(condition.substring(5)) == checkValue);
                }
                else {
                    var value = squiffy.get(condition);
                    if (value === null) value = false;
                    result = (value == checkValue);
                }
            }

            var textResult = result ? process(text, data) : '';

            data.lastIf = result;
            return textResult;
        }

        function processTextCommand_Else(section, data) {
            if (!('lastIf' in data) || data.lastIf) return '';
            var text = section.substring(5);
            return process(text, data);
        }

        function processTextCommand_Label(section, data) {
            var command = section.substring(6);
            var eq = command.indexOf('=');
            if (eq == -1) {
                return ('{label:' + command + '}');
            }

            var text = command.substring(eq + 1);
            var label = command.substring(0, eq);

            return '<span class="squiffy-label-' + label + '">' + process(text, data) + '</span>';
        }

        function processTextCommand_Rotate(type, section, data) {
            var options;
            var attribute = '';
            if (section.substring(type.length, type.length + 1) == ' ') {
                var colon = section.indexOf(':');
                if (colon == -1) {
                    return '{' + section + '}';
                }
                options = section.substring(colon + 1);
                attribute = section.substring(type.length + 1, colon);
            }
            else {
                options = section.substring(type.length + 1);
            }
            var rotation = rotate(options.replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            if (attribute) {
                squiffy.set(attribute, rotation[0]);
            }
            return '<a class="squiffy-link" data-' + type + '="' + rotation[1] + '" data-attribute="' + attribute + '" role="link">' + rotation[0] + '</a>';
        }

        var data = {
            fulltext: text
        };
        return process(text, data);
    };

    squiffy.ui.transition = function(f) {
        squiffy.set('_transition', f.toString());
        f();
    };

    squiffy.storageFallback = {};

    squiffy.set = function(attribute, value) {
        if (typeof value === 'undefined') value = true;
        if (squiffy.ui.settings.persist && window.localStorage) {
            localStorage[squiffy.story.id + '-' + attribute] = JSON.stringify(value);
        }
        else {
            squiffy.storageFallback[attribute] = JSON.stringify(value);
        }
        squiffy.ui.settings.onSet(attribute, value);
    };

    squiffy.get = function(attribute) {
        var result;
        if (squiffy.ui.settings.persist && window.localStorage) {
            result = localStorage[squiffy.story.id + '-' + attribute];
        }
        else {
            result = squiffy.storageFallback[attribute];
        }
        if (!result) return null;
        return JSON.parse(result);
    };

    var startsWith = function(string, prefix) {
        return string.substring(0, prefix.length) === prefix;
    };

    var rotate = function(options, current) {
        var colon = options.indexOf(':');
        if (colon == -1) {
            return [options, current];
        }
        var next = options.substring(0, colon);
        var remaining = options.substring(colon + 1);
        if (current) remaining += ':' + current;
        return [next, remaining];
    };

    var methods = {
        init: function (options) {
            var settings = jQuery.extend({
                scroll: 'body',
                persist: true,
                restartPrompt: true,
                onSet: function (attribute, value) {}
            }, options);

            squiffy.ui.output = this;
            squiffy.ui.restart = jQuery(settings.restart);
            squiffy.ui.settings = settings;

            if (settings.scroll === 'element') {
                squiffy.ui.output.css('overflow-y', 'auto');
            }

            initLinkHandler();
            squiffy.story.begin();
            
            return this;
        },
        get: function (attribute) {
            return squiffy.get(attribute);
        },
        set: function (attribute, value) {
            squiffy.set(attribute, value);
        },
        restart: function () {
            if (!squiffy.ui.settings.restartPrompt || confirm('Are you sure you want to restart?')) {
                squiffy.story.restart();
            }
        }
    };

    jQuery.fn.squiffy = function (methodOrOptions) {
        if (methods[methodOrOptions]) {
            return methods[methodOrOptions]
                .apply(this, Array.prototype.slice.call(arguments, 1));
        }
        else if (typeof methodOrOptions === 'object' || ! methodOrOptions) {
            return methods.init.apply(this, arguments);
        } else {
            jQuery.error('Method ' +  methodOrOptions + ' does not exist');
        }
    };
})();

var get = squiffy.get;
var set = squiffy.set;


squiffy.story.start = 'avenue 1';
squiffy.story.id = 'b8183368c7';
squiffy.story.sections = {
	'avenue 1': {
		'text': "<p> You are in the narrow streets of central Paris you call home. A starving artist, your only thought is of getting some money for food and absinthe. The only valuable possession you have is a gold medallion, a memorabilia of a young man you once knew and loved, and your paintings, but you have never managed to sell one so far. Still, you remain hopeful. It is morning, and the saloons are still empty. The narrow, tree-lined avenue leads south to the pier. You wonder if any of your acquaintances are there. You notice a sign for a pawn shop. The lettering is traditional and faded. You make out the name. &quot;Mr. Fox&#39;s pawn shop.&quot; </p>\n<p><em>commands are: <a class=\"squiffy-link link-section\" data-section=\"enter shop\" role=\"link\" tabindex=\"0\">enter shop</a>,  <a class=\"squiffy-link link-section\" data-section=\"pier\" role=\"link\" tabindex=\"0\">go south</a></em></p>",
		'passages': {
		},
	},
	'enter shop': {
		'text': "<p> You stand indecisively for a moment, and decide to push the door open. A bell chimes. The interior is wooden, with things and trinkets on shelves all around. A globe, a monocle, a child&#39;s ring with a tiny ladybug, some picture frames with faded photographs, a telescope, some rusty keys, elaborately decorated jewellery boxes, a violin, and some paintings in the corner. The sound of the door sends an old man running in behind the counter. He is very short, his hair and beard are very white. He is wearing a beret. You think he would be an excellent model for a painting. He seems excited and out of breath from running to the counter. &quot;A customer!&quot; he says. &quot;Come in, come in young man, tell me what can I do for you?&quot; </p>\n<p><em>commands are: <a class=\"squiffy-link link-section\" data-section=\"pawn painting\" role=\"link\" tabindex=\"0\">pawn painting</a>,   <a class=\"squiffy-link link-passage\" data-passage=\"pawn medallion\" role=\"link\" tabindex=\"0\">pawn medallion</a>,  <a class=\"squiffy-link link-section\" data-section=\"avenue 2\" role=\"link\" tabindex=\"0\">exit</a></em></p>",
		'passages': {
			'pawn medallion': {
				'text': "<p>  &quot;I have this...&quot; you say, taking off the medallion and looking at it reminiscently. You hesitate, but hand it to the man. &quot;Yes, yes, that will do quite nicely.&quot; he says, putting the object in the glass counter. He counts a number of bills and hands them to you. You turn to leave, glancing at the counter once more. </p>",
			},
		},
	},
	'pawn painting': {
		'text': "<p> You decide you don&#39;t want to give up the medallion. You offer the old man one of your paintings, expecting rejection:\n&quot;Why, I could tell you&#39;re an artist! I adore all art. Please do bring me one of your paintings!&quot; He says, excitedly.</p>\n<p>You better hurry home and get it. </p>\n<p><em>exits are: <a class=\"squiffy-link link-section\" data-section=\"avenue 2\" role=\"link\" tabindex=\"0\">out</a></em></p>",
		'passages': {
		},
	},
	'avenue 2': {
		'text': "<p> You are in the narrow streets of central Paris you call home. It is morning, and the saloons are still empty. The narrow tree-lined avenue leads to the pier. You wonder if any of your acquaintances are there. Mr. Fox&#39;s pawn shop is here. </p>\n<p><em>commands are:{if not seen shop 2:<a class=\"squiffy-link link-section\" data-section=\"home\" role=\"link\" tabindex=\"0\">go home</a>,}  {if not seen pier:<a class=\"squiffy-link link-section\" data-section=\"pier\" role=\"link\" tabindex=\"0\">go to pier</a>}{else:<a class=\"squiffy-link link-section\" data-section=\"pier 2\" role=\"link\" tabindex=\"0\">go to pier</a>} </em></p>",
		'passages': {
		},
	},
	'pier': {
		'text': "<p>You arrive at the pier. A pair of seagulls is fighting over a stale piece of bread. Your friend Laurent is asleep on a stone bench. You give him a nudge.</p>\n<p>“Hhhng leave me alone… ...Come back later…” he mutters in a hangover. You should probably get him some water.</p>\n<p>At the other end of the pier, by the fountain, you see two street gangs giving each other side eye. One carries red bandannas, the other one blue. You recognize both of them. Pretty harmless city kids, But you can never be too careful. </p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"talk to blue gang\" role=\"link\" tabindex=\"0\">talk to blue gang</a>,  <a class=\"squiffy-link link-passage\" data-passage=\"talk to red gang\" role=\"link\" tabindex=\"0\">talk to red gang</a>,  {if not seen enter shop:<a class=\"squiffy-link link-section\" data-section=\"avenue 1\" role=\"link\" tabindex=\"0\">go to avenue</a>} {else: <a class=\"squiffy-link link-section\" data-section=\"avenue 2\" role=\"link\" tabindex=\"0\">go to avenue</a>},  <a class=\"squiffy-link link-passage\" data-passage=\"give Laurent water\" role=\"link\" tabindex=\"0\">give Laurent water</a></em></p>",
		'passages': {
			'talk to blue gang': {
				'text': "<p>{if not seen talk to red gang: You come up to the boys in blue. They are standing next to a fountain, chatting. The youngest one spots you. &quot;Heyyy, it&#39;s that painter guy!&quot; he says cheerfully.  &quot;We heard you&#39;re planning to stir trouble tonight. We&#39;ll be there&quot; another ones winks. &quot;Say, your buddy there looks like he could use some waking up. You should give him some water. Hydration and all that.&quot; he says, filling an empty bottle from the fountain and handing it to you.</p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"take water\" role=\"link\" tabindex=\"0\">take water</a></em> }</p>",
			},
			'talk to red gang': {
				'text': "<p>{if not seen talk to blue gang: You come up to the boys in red. They are standing next to a fountain, chatting. The youngest one spots you. &quot;Heyyy, it&#39;s that painter guy!&quot; he says cheerfully.  &quot;We heard you&#39;re planning to stir trouble tonight. We&#39;ll be there&quot; another ones winks. &quot;Say, your buddy there looks like he could use some waking up. You should give him some water. Hydration and all that.&quot; he says, filling an empty bottle from the fountain and handing it to you.</p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"take water\" role=\"link\" tabindex=\"0\">take water</a></em> }</p>",
			},
			'take water': {
				'text': "<p>you now have the water. <a class=\"squiffy-link link-passage\" data-passage=\"give Laurent water\" role=\"link\" tabindex=\"0\">give Laurent water</a></p>",
			},
			'give Laurent water': {
				'text': "<p>{if not seen take water: you dont have water.}{else:You nudge him again, and hand him the bottle. &quot;Here you go, Laurie!&quot; He slowly sits up and drinks a bit. &quot;Ahh, I do feel refreshed. Now, shall we go drink?&quot;}</p>\n<p>{if seen take water:<em><a class=\"squiffy-link link-section\" data-section=\"bar\" role=\"link\" tabindex=\"0\">go to bar</a></em>}</p>",
			},
		},
	},
	'bar': {
		'text': "<p> You arrive down the street to Escoffier&#39;s, your favourite watering hole, where you drink and discuss art and philosophy.  You enter. It is pretty empty during the day. There is a scattered dozen people, some drinking, some reading, some sketching in charcoal. The light is dim, as the windows are heavily green tinted, so not much sun comes in, even at high noon. The wooden bar is on the left, and the room is semi-divided by two pillars. It&#39;s a small place, and three tables are left free. One has a broken bottle and turned over chair. In the middle of the room, there is an open table, between two others occupied by artists. In the far left, by the bar, is a corner booth. Do sit down. </p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"take corner booth\" role=\"link\" tabindex=\"0\">take corner booth</a>,  <a class=\"squiffy-link link-passage\" data-passage=\"take middle booth\" role=\"link\" tabindex=\"0\">take middle booth</a>,  <a class=\"squiffy-link link-section\" data-section=\"pier 2\" role=\"link\" tabindex=\"0\">exit</a></em></p>",
		'passages': {
			'take corner booth': {
				'text': "<p>You sit down at the corner booth. The bar tender walks up to you and says &quot;Fancy seeing you here so early in the day! Not passed out on a bench, ey?&quot; he grins at your friend, who just scoffs. &quot;So gentlemen, beer or scotch?&quot;</p>\n<p><em><a class=\"squiffy-link link-passage\" data-passage=\"order beer\" role=\"link\" tabindex=\"0\">order beer</a>,  <a class=\"squiffy-link link-passage\" data-passage=\"order scotch\" role=\"link\" tabindex=\"0\">order scotch</a></em></p>",
			},
			'take middle booth': {
				'text': "<p>You sit down in the middle booth. The bar tender walks up to you and says &quot;Fancy seeing you here so early in the day! Not passed out on a bench, ey?&quot; he grins at your friend, who just scoffs. &quot;So gentlemen, beer or scotch?&quot;</p>\n<p><em><a class=\"squiffy-link link-passage\" data-passage=\"order beer\" role=\"link\" tabindex=\"0\">order beer</a>,  <a class=\"squiffy-link link-passage\" data-passage=\"order scotch\" role=\"link\" tabindex=\"0\">order scotch</a></em></p>",
			},
			'order beer': {
				'text': "<p>{if not seen enter shop: &quot;No money huh? Get out of here until you have some then!&quot;  <em><a class=\"squiffy-link link-section\" data-section=\"pier 2\" role=\"link\" tabindex=\"0\">exit</a></em>} {else: if not seen order scotch: Coming right up! Says the barkeep, shuffling back to the bar. <a class=\"squiffy-link link-passage\" data-passage=\"matthew\" role=\"link\" tabindex=\"0\">continue</a>}{else:}</p>",
			},
			'order scotch': {
				'text': "<p>{if not seen enter shop: &quot;No money huh? Get out of here until you have some then!&quot;  <em><a class=\"squiffy-link link-section\" data-section=\"pier 2\" role=\"link\" tabindex=\"0\">exit</a></em>} {else: if not seen order beer: Coming right up! Says the barkeep, shuffling back to the bar. <a class=\"squiffy-link link-passage\" data-passage=\"matthew\" role=\"link\" tabindex=\"0\">continue</a>}{else:}</p>",
			},
			'matthew': {
				'text': "<p>You wait for your drinks when you hear the door chime. You look up through the smoke-filled room and think you see a familiar silhouette in the doorframe. A well-dressed curly haired young man walks up to the bar and exchanges a few words with the barkeep, who points in your direction. The figure turns to face you, and blood rushes to your face. It&#39;s Matthew! </p>\n<p>He walks towards your table and smiles. &quot;Shocking to find you here!&quot; You dont say anything at first.</p>\n<p>&quot;Well, I&#39;m going to the bathroom to... uh... yarf&quot; says Laurie, getting up from the table.  Matthew sits next to you. You finally mutter a greeting and you start talking. After a bit of catching up, he asks: &quot;Do you still have the medallion?&quot;</p>\n<p>{if seen pawn painting: <a class=\"squiffy-link link-passage\" data-passage=\"yes\" role=\"link\" tabindex=\"0\">yes</a>}{else: <a class=\"squiffy-link link-passage\" data-passage=\"no\" role=\"link\" tabindex=\"0\">no</a>}</p>",
			},
			'no': {
				'text': "<p>&quot;Oh I... see...&quot; he says, no longer smiling. He leaves before you can say anything.</p>\n<p><em><a class=\"squiffy-link link-passage\" data-passage=\"continue2\" role=\"link\" tabindex=\"0\">continue</a></em></p>",
			},
			'yes': {
				'text': "<p>&quot;Huh, that&#39;s incredible! It&#39;s been very long since then, hasn&#39;t it. Well, we&#39;re here now!&quot;</p>\n<p><em><a class=\"squiffy-link link-passage\" data-passage=\"continue2\" role=\"link\" tabindex=\"0\">continue</a></em></p>",
			},
			'continue2': {
				'text': "<p> Laurent returns from the toilet. &quot;Are you done catching up? My drink is here.&quot; He re-joins you. &quot;So, the exhibition, huh? We ought to plan some mischief!&quot; &quot;What did you have in mind?&quot; you ask. &quot;An infiltration.&quot;</p>\n<p>You start conspiring. At first it&#39;s a joke, but then you decide you should go through with it. After many more drinks, some other artists and friends arrive at the bar and hear about your plan. You will sneak one of your paintings into the exhibition, as protest of it being elitist. &quot;Right then! It starts at 8 o&#39;clock tonight, which is in... woah, two hours. Go get the painting and meet us back at the bar.&quot; says Laurent. </p>\n<p><em><a class=\"squiffy-link link-section\" data-section=\"pier 3\" role=\"link\" tabindex=\"0\">exit</a></em></p>",
			},
		},
	},
	'pier 2': {
		'text': "<p>You arrive at the pier. A pair of seagulls is fighting over a stale piece of bread. </p>\n<p><em>{if not seen enter shop:<a class=\"squiffy-link link-section\" data-section=\"avenue 1\" role=\"link\" tabindex=\"0\">go to avenue</a>} {else: <a class=\"squiffy-link link-section\" data-section=\"avenue 2\" role=\"link\" tabindex=\"0\">go to avenue</a>}, <a class=\"squiffy-link link-section\" data-section=\"bar\" role=\"link\" tabindex=\"0\">go to bar</a></em></p>",
		'passages': {
		},
	},
	'home': {
		'text': "<p> You enter a run down studio apartment. Against one wall there is a rusty stove, mugs with unwashed paintbrushes and a sink, next to which is a water bottle. An open balcony door with tarp instead of glass reveals a very small terrace with a chair and an ashtray. Just by the door are a dozen paintings of various sizes. On the other wall there&#39;s a bed. There is a girl in it.  You start remembering last night. Did you even pay her? </p>\n<p><em>commands are: <a class=\"squiffy-link link-section\" data-section=\"girl\" role=\"link\" tabindex=\"0\">wake up girl</a>,  <a class=\"squiffy-link link-passage\" data-passage=\"take painting\" role=\"link\" tabindex=\"0\">take painting</a>,  <a class=\"squiffy-link link-section\" data-section=\"avenue 3\" role=\"link\" tabindex=\"0\">exit</a></em></p>",
		'passages': {
			'take painting': {
				'text': "<p>You now have the painting.</p>",
			},
		},
	},
	'girl': {
		'text': "<p> The girl begrudgingly opens her eyes. &quot;Hey, you...&quot; she says sarcastically. She proceeds to put on the rest of her clothes. &quot;A guy was here earlier looking for you... Matthew something.&quot; Your ears perk up, and you touch the medallion on your chest. He&#39;s in Paris?! &quot;Oh and by the way, are you planning on crashing the big exhibition? That weird boy Laurent was telling me about it.&quot; she adds. </p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"ask about Matthew\" role=\"link\" tabindex=\"0\">ask about Matthew</a>, <a class=\"squiffy-link link-passage\" data-passage=\"ask about exhibition\" role=\"link\" tabindex=\"0\">ask about exhibition</a>,  {if not seen take painting:<a class=\"squiffy-link link-passage\" data-passage=\"take painting\" role=\"link\" tabindex=\"0\">take painting</a>}, <a class=\"squiffy-link link-section\" data-section=\"avenue 3\" role=\"link\" tabindex=\"0\">exit</a></em></p>",
		'passages': {
			'take painting': {
				'text': "<p>You now have the painting.</p>",
			},
			'ask about Matthew': {
				'text': "<p> &quot;Matthew was here?&quot; you ask. &quot;Yeah, fancy guy, rather taller than you. Doesn&#39;t speak French very well.  He asked where we he could find you and I said you&#39;ll probably be at Escoffier&#39;s, that bar of yours.&quot; </p>",
			},
			'ask about exhibition': {
				'text': "<p> &quot;The exhibition?&quot; you ask. &quot;Well, sure, the big one. People coming from all over Europe to see the works of those stuffy old academics. Surely YOU know about it. You guys are always trying to sneak your... experimental paintings into those things.&quot; </p>",
			},
		},
	},
	'avenue 3': {
		'text': "<p> You are in the narrow streets of central Paris you call home. A sign reads &quot;Mr. Fox&#39;s pawn shop&quot;. Behind you is the direction of your apartment. A narrow tree-lined avenue leads to the pier. </p>\n<p><em>commands are: {if not seen shop 2:<a class=\"squiffy-link link-section\" data-section=\"shop 2\" role=\"link\" tabindex=\"0\">enter shop</a>,} <a class=\"squiffy-link link-section\" data-section=\"home\" role=\"link\" tabindex=\"0\">go home</a>{if not seen pier:<a class=\"squiffy-link link-section\" data-section=\"pier\" role=\"link\" tabindex=\"0\">, go to pier</a>}{else:<a class=\"squiffy-link link-section\" data-section=\"pier 2\" role=\"link\" tabindex=\"0\">go to pier</a>}</em></p>",
		'passages': {
		},
	},
	'shop 2': {
		'text': "<p>{if seen take painting:\n You bring the painting in and present it to Mr. Fox. &quot;Wonderful,  wonderful, you have some real talent, boy.&quot; he says, while displaying the painting. &quot;Planning anything for the big exhibition tomorrow? I know how you kids like to get into mischief, sneaking your own paintings in and whatnot...&quot; he says jokingly. He pays you and you pocket the money. </p>\n<p><em>exits are: <a class=\"squiffy-link link-section\" data-section=\"avenue 2\" role=\"link\" tabindex=\"0\">out</a></em>\n}\n{else: <em>exits are: <a class=\"squiffy-link link-section\" data-section=\"avenue 2\" role=\"link\" tabindex=\"0\">out</a></em>}</p>",
		'passages': {
		},
	},
	'pier 3': {
		'text': "<p>You exit to the pier. It is almost night time now and the water reflects a sunset. How appropriate!\n<em>exits are: <a class=\"squiffy-link link-section\" data-section=\"avenue 4\" role=\"link\" tabindex=\"0\">avenue</a> {if seen home 2:, <a class=\"squiffy-link link-section\" data-section=\"bar 2\" role=\"link\" tabindex=\"0\">bar</a>}</em></p>",
		'passages': {
		},
	},
	'avenue 4': {
		'text': "<p>You are in the narrow streets of central Paris you call home. The narrow, tree-lined avenue leads to the pier. There is a pawn shop. \n<em>exits are: <a class=\"squiffy-link link-section\" data-section=\"pier 3\" role=\"link\" tabindex=\"0\">pier</a>, <a class=\"squiffy-link link-passage\" data-passage=\"pawn shop\" role=\"link\" tabindex=\"0\">pawn shop</a>, <a class=\"squiffy-link link-section\" data-section=\"home 2\" role=\"link\" tabindex=\"0\">home</a></em></p>",
		'passages': {
			'pawn shop': {
				'text': "<p>The pawn shop is closed.</p>",
			},
		},
	},
	'home 2': {
		'text': "<p>You enter a run down studio apartment. Against one wall there is a rusty stove, mugs with unwashed paintbrushes and a sink, next to which is a water bottle. An open balcony door with tarp instead of glass reveals a very small terrace with a chair and an ashtray. Just by the door are a dozen paintings of various sizes. </p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"take a painting\" role=\"link\" tabindex=\"0\">take a painting</a>, <a class=\"squiffy-link link-section\" data-section=\"avenue 4\" role=\"link\" tabindex=\"0\">exit</a></em></p>",
		'passages': {
			'take a painting': {
				'text': "<p>You choose a smaller canvas, but your favourite one. You now have the painting.</p>",
			},
		},
	},
	'bar 2': {
		'text': "<p>You arrive back at the bar, where the group is waiting for you. You victoriously wave the painting in the air. &quot;To the exhibition hall!&quot; exclaims Laurent.</p>\n<p><em>exits are: <a class=\"squiffy-link link-section\" data-section=\"exhibition hall\" role=\"link\" tabindex=\"0\">exhibition hall</a></em></p>",
		'passages': {
		},
	},
	'exhibition hall': {
		'text': "<p>You arrive in front of the large building. The street is swarming with people in top hats and pearls, all heading towards the big steps to the grand entrance. You hear music from inside, and can make out some of the paintings in the room. Laurent nudges you. &quot;Go on, then!&quot;</p>\n<p><em>commands are: <a class=\"squiffy-link link-passage\" data-passage=\"enter hall\" role=\"link\" tabindex=\"0\">enter hall</a></em></p>",
		'passages': {
			'enter hall': {
				'text': "<p>You start to walk up the steps, the painting under your dingy old coat. A guard starts coming towards you, with a disapproving look. </p>\n<p>{if seen talk to blue gang: Suddenly, a flying shoe hits the back of his head. You notice the gang from the pier. &quot;Hey! Mister guard man! We&#39;re trying to vandalise your art!&quot; one shouts. &quot;Said we&#39;d come!&quot; another one shouts towards you as they all start running, being chased by the guard. You enter the hall, subtly place your painting on a lonely nail near the door, and walk out as if nothing happened. Nobody even pays attention to you. You re-join your companions and you all run off to the bar, where you get treated to many more drinks. You pulled it off! The end.}</p>\n<p>{if seen talk to red gang: Suddenly, a flying shoe hits the back of his head. You notice the gang from the pier. &quot;Hey! Mister guard man! We&#39;re trying to vandalise your art!&quot; one shouts. &quot;Said we&#39;d come!&quot; another one shouts towards you as they all start running, being chased by the guard. You enter the hall, subtly place your painting on a lonely nail near the door, and walk out as if nothing happened. Nobody even pays attention to you. You re-join your companions and you all run off to the bar, where you get treated to many more drinks. You pulled it off! The end.} </p>",
			},
		},
	},
}
})();