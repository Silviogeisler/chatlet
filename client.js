var CONFIG, Util, addMessage, first_poll, longPoll, nicks, onConnect, outputUsers, rss, scrollDown, send, showChat, showConnect, showLoad, starttime, transmission_errors, updateRSS, updateTitle, updateUptime, updateUsersLink, userJoin, userPart, util, who, TITLE;
var __hasProp = Object.prototype.hasOwnProperty;
CONFIG = {
  debug: false,
  nick: "#",
  // set in onConnect
  id: null,
  // set in onConnect
  last_message_time: 1,
  focus: true,
  //event listeners bound in onConnect
  unread: 0
  //updated in the message-processing loop
};
nicks = [];
Date.prototype.toRelativeTime = function(now_threshold) {
  var _a, conversions, delta, key, units, value;
  delta = new Date() - this;
  now_threshold = parseInt(now_threshold, 10);
  if (isNaN(now_threshold)) {
    now_threshold = 0;
  }
  if (delta <= now_threshold) {
    return 'Just now';
  }
  units = null;
  conversions = {
    millisecond: 1,
    // ms    -> ms
    second: 1000,
    // ms    -> sec
    minute: 60,
    // sec   -> min
    hour: 60,
    // min   -> hour
    day: 24,
    // hour  -> day
    month: 30,
    // day   -> month (roughly)
    year: 12
    // month -> year
  };
  _a = conversions;
  for (key in _a) { if (__hasProp.call(_a, key)) {
    value = _a[key];
    if (delta < value) {
      break;
    } else {
      units = key;
      delta = delta / value;
    }
  }}
  delta = Math.floor(delta);
  if (delta !== 1) {
    units += 's';
  }
  return [delta, units].join(" ");
};
Date.fromString = function(str) {
  return new Date(Date.parse(str));
};
//updates the users link to reflect the number of active users
updateUsersLink = function() {
  var t;
  t = nicks.length.toString() + " user";
  if (nicks.length !== 1) {
    t += "s";
  }
  return jQuery("#usersLink").text(t);
};
//handles another person joining chat
userJoin = function(nick, timestamp) {
  //put it in the stream
  addMessage(nick, "joined", timestamp, "join");
  if (nicks.indexOf(nick) === -1) {
    //otherwise, add the user to the list
    nicks.push(nick);
    //update the UI
    return updateUsersLink();
  }
};
//handles someone leaving
userPart = function(nick, timestamp) {
  //put it in the stream
  addMessage(nick, "left", timestamp, "part");
  //remove the user from the list
  nicks.split(nicks.indexOf(nick), 1);
  //update the UI
  return updateUsersLink();
};
// utility functions
Util = function() {};
Util.prototype.urlRE = /https?:\/\/([-\w\.]+)+(:\d+)?(\/([^\s]*(\?\S+)?)?)?/g;
Util.prototype.toStaticHTML = function(inputHtml) {
  inputHtml = inputHtml.toString();
  return inputHtml.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
};
Util.prototype.zeroPad = function(digits, n) {
  n = n.toString();
  while (n.length < digits) {
    n = '0' + n;
  }
  return n;
};
Util.prototype.timeString = function(date) {
  var hours, minutes;
  minutes = date.getMinutes().toString();
  hours = date.getHours().toString();
  return this.zeroPad(2, hours) + ":" + this.zeroPad(2, minutes);
};
Util.prototype.isBlank = function(text) {
  var blank;
  blank = /^\s*$/;
  return text.match(blank) !== null;
};

util = new Util();
//used to keep the most recent messages visible
scrollDown = function() {
  // window.scrollBy(0, 100000000000000000);
	document.getElementById("log").scrollTop = document.getElementById("log").scrollHeight;
  return jQuery("#entry").focus();
};
//inserts an event into the stream for display
//the event may be a msg, join or part type
//from is the user, text is the body and time is the timestamp, defaulting to now
//_class is a css class to apply to the message, usefull for system events
addMessage = function(from, text, time, _class) {
  var content, messageElement, nick_re;
  if (text === null) {
    return null;
  }
  if (time === null) {
    // if the time is null or undefined, use the current time.
    time = new Date();
  } else if ((time instanceof Date) === false) {
    // if it's a timestamp, interpret it
    time = new Date(time);
  }
  //every message you see is actually a table with 3 cols:
  //  the time,
  //  the person who caused the event,
  //  and the content
  messageElement = jQuery(document.createElement("table"));
  messageElement.addClass("message");
  if (_class) {
    messageElement.addClass(_class);
  }
  // sanitize
  text = util.toStaticHTML(text);
  // If the current user said this, add a special css class
  nick_re = new RegExp(CONFIG.nick);
  if (nick_re.exec(text)) {
    messageElement.addClass("personal");
  }
  // replace URLs with links
  text = text.replace(util.urlRE, '<a target="_blank" href="$&">$&</a>');
  content = ("<tr>\n  <td class=\"date\">" + (util.timeString(time)) + "</td>\n  <td class=\"nick\">" + (util.toStaticHTML(from)) + "</td>\n  <td class=\"msg-text\">" + text + "</td>\n</tr>");
  messageElement.html(content);
  //the log is the stream that we view
  jQuery("#log").append(messageElement);
  //always view the most recent message when it is added
  return scrollDown();
};
updateRSS = function() {
  var bytes, megabytes;
  bytes = parseInt(rss);
  if (bytes) {
    megabytes = bytes / (1024 * 1024);
    megabytes = Math.round(megabytes * 10) / 10;
    return jQuery("#rss").text(megabytes.toString());
  }
};
updateUptime = function() {
  if (starttime) {
    return jQuery("#uptime").text(starttime.toRelativeTime());
  }
};
transmission_errors = 0;
first_poll = true;
//process updates if we have any, request updates from the server,
// and call again with response. the last part is like recursion except the call
// is being made from the response handler, and not at some point during the
// function's execution.
longPoll = function(data) {
  var _a, _b, _c, _d, message, rss;
	console.log("polling...");
  if (transmission_errors > 5) {
    showConnect();
    return null;
  }
  if (data && data.rss) {
    rss = data.rss;
    updateRSS();
  }
  //process any updates we may have
  //data will be null on the first call of longPoll
  if (data && data.messages) {
    _b = data.messages;
    for (_a = 0, _c = _b.length; _a < _c; _a++) {
      message = _b[_a];
      //track oldest message so we only request newer messages from server
      message.timestamp > CONFIG.last_message_time ? (CONFIG.last_message_time = message.timestamp) : null;
      //dispatch new messages to their appropriate handlers
      if ((_d = message.type) === "msg") {
        !CONFIG.focus ? CONFIG.unread++ : null;
        addMessage(message.nick, message.text, message.timestamp);
      } else if (_d === "join") {
        userJoin(message.nick, message.timestamp);
      } else if (_d === "part") {
        userPart(message.nick, message.timestamp);
      }
    }
    //update the document title to include unread message count if blurred
    updateTitle();
    //only after the first request for messages do we want to show who is here
    if (first_poll) {
      first_poll = false;
      who();
    }
  }
  //make another request
	if(CONFIG.id){ // only if a session is present
		return jQuery.ajax({
	    cache: false,
	    type: "GET",
	    url: "http://chatlet.heroku.com/recv",
	    dataType: "jsonp",
	    data: {
	      since: CONFIG.last_message_time,
	      id: CONFIG.id,
				host: document.domain
	    },
	    error: function() {
	      transmission_errors += 1;
				timeout_seconds = Math.pow(transmission_errors,2);
	      addMessage("", "Lost connection to server. Retrying in "+timeout_seconds+" seconds.", new Date(), "error");
				console.log("fail");
	      //don't flood the servers on error, wait t_e^2 seconds before retrying
	      return setTimeout(longPoll, timeout_seconds * 1000);
	    },
	    success: function(data) {
	      transmission_errors = 0;
				console.log("success!");
	      //if everything went well, begin another request immediately
	      //the server will take a long time to respond
	      //how long? well, it will wait until there is another message
	      //and then it will return it to us and close the connection.
	      //since the connection is closed when we get data, we longPoll again
	      return longPoll(data);
	    }
	  });
	}	else {
		console.log("not logged in");
		return setTimeout(longPoll, 1000);
	}
};
//submit a new message to the server
send = function(msg) {
  if (CONFIG.debug === false) {
    // XXX should be POST
    // XXX should add to messages immediately
    return jQuery.get("http://chatlet.heroku.com/send", {
      id: CONFIG.id,
      text: msg,
			host: document.domain
    }, function(data) {
      return true;
    }, "jsonp");
  }
};
//Transition the page to the state that prompts the user for a nickname
showConnect = function() {
  jQuery("#connect").show();
  jQuery("#loading").hide();
  jQuery("#log").hide();
  jQuery("#toolbar").hide();
  return jQuery("#nickInput").focus();
};
//transition the page to the loading screen
showLoad = function() {
  jQuery("#connect").hide();
  jQuery("#loading").show();
  jQuery("#log").hide();
  return jQuery("#toolbar").hide();
};
//transition the page to the main chat view, putting the cursor in the textfield
showChat = function(nick) {
  jQuery("#toolbar").show();
  jQuery("#entry").focus();
  jQuery("#log").show();
  jQuery("#connect").hide();
  jQuery("#loading").hide();
  return scrollDown();
};
//we want to show a count of unread messages when the window does not have focus
updateTitle = function() {
  if (CONFIG.unread) {
    document.title = "(" + CONFIG.unread.toString() + ") "+TITLE;
    return document.title;
  } else {
    document.title = TITLE;
  }
};
// daemon start time
starttime = null;
// daemon memory usage
rss = null;
//handle the server's response to our nickname and join request
onConnect = function(session) {
  if (session.error) {
    alert("error connecting: " + session.error);
    showConnect();
    return null;
  }
  CONFIG.nick = session.nick;
  CONFIG.id = session.id;
  starttime = new Date(session.starttime);
  rss = session.rss;
  updateRSS();
  updateUptime();
  //update the UI to show the chat
  showChat(CONFIG.nick);
  //listen for browser events so we know to update the document title
  jQuery(window).bind("blur", function() {
    CONFIG.focus = false;
    return updateTitle();
  });
  return jQuery(window).bind("focus", function() {
    CONFIG.focus = true;
    CONFIG.unread = 0;
    return updateTitle();
  });
};
//add a list of present chat members to the stream
outputUsers = function() {
  var nick_string;
  nick_string = nicks.length > 0 ? nicks.join(", ") : "(none)";
  addMessage("users:", nick_string, new Date(), "notice");
  return false;
};
//get a list of the users presently in the room, and add it to the stream
who = function() {
  return jQuery.get("http://chatlet.heroku.com/who", {}, function(data, status) {
    if (status !== "success") {
      return null;
    }
    nicks = data.nicks;
    return outputUsers();
  }, "jsonp");
};
jQuery(document).ready(function() {
	TITLE = document.title;
	jQuery("#chat_gadget_html").html('<div id="chat_gadget_body"><div id="connect"><form action="#"><label for="nick">Name</label><input id="nickInput" class="text"type="text" name="nick" value=""/><input id="connectButton" class="button" type="submit" name="" value="Join"/></form></div><div id="loading"><p>loading</p></div><div id="log"></div><div id="toolbar"><input tabindex="1" type="text" id="entry"/></div>');
  //submit new messages when the user hits enter if the message isnt blank
  jQuery("#entry").keypress(function(e) {
    var msg;
    if (e.keyCode !== 13) {
      return null;
    }
    msg = jQuery("#entry").attr("value").replace("\n", "");
    !util.isBlank(msg) ? send(msg) : null;
    return jQuery("#entry").attr("value", "");
  });
  jQuery("#usersLink").click(outputUsers);
  //try joining the chat when the user clicks the connect button
  jQuery("#connectButton").click(function() {
    var nick;
    //lock the UI while waiting for a response
    showLoad();
    nick = jQuery("#nickInput").attr("value");
    //dont bother the backend if we fail easy validations
    if (nick.length > 50) {
      alert("Nick too long. 50 character max.");
      showConnect();
      return false;
    }
    //more validations
    if (/[^\w_\-^!]/.exec(nick)) {
      alert("Bad character in nick. Can only have letters, numbers, and '_', '-', '^', '!'");
      showConnect();
      return false;
    }
    //make the actual join request to the server
    jQuery.ajax({
      cache: false,
      type: "GET",
      // XXX should be POST
      dataType: "jsonp",
      url: "http://chatlet.heroku.com/join",
      data: {
        nick: nick,
				host: document.domain
      },
      error: function() {
        alert("error connecting to server");
        return showConnect();
      },
      success: onConnect
    });
    return false;
  });
  // update the daemon uptime every 10 seconds
  setInterval(function() {
    return updateUptime();
  }, 10 * 1000);
  if (CONFIG.debug) {
    jQuery("#loading").hide();
    jQuery("#connect").hide();
    scrollDown();
    return null;
  }
  // remove fixtures
  jQuery("#log table").remove();
  //begin listening for updates right away
  //interestingly, we don't need to join a room to get its updates
  //we just don't show the chat stream to the user until we create a session
  longPoll();
  return showConnect();
});
//if we can, notify the server that we're going away.
jQuery(window).unload(function() {
  return jQuery.get("http://chatlet.heroku.com/part", {
    id: CONFIG.id,
		host: document.domain
  }, function(data) {
    return null;
  }, "jsonp");
});