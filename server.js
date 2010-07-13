var Channel, HOST, MESSAGE_BACKLOG, PORT, SESSION_TIMEOUT, channels, createSession, fu, kill_sessions, mem, qs, sessions, starttime, sys, url;
var __hasProp = Object.prototype.hasOwnProperty;
var __slice = Array.prototype.slice, __bind = function(func, obj, args) {
    return function() {
      return func.apply(obj || {}, args ? args.concat(__slice.call(arguments, 0)) : arguments);
    };
  };
HOST = null;
PORT = process.env.PORT || 8001;
MESSAGE_BACKLOG = 200;
SESSION_TIMEOUT = 60 * 1000;
starttime = new Date().getTime();
mem = process.memoryUsage();
setInterval(function() {
  mem = process.memoryUsage();
  return mem;
}, 10 * 1000);
fu = require("./fu");
sys = require("sys");
url = require("url");
qs = require("querystring");
sessions = {};
Channel = function() {
	this.messages = []; // Now each channel has it's own messages
	this.callbacks = [];
};
// Channel.prototype.messages = []; // prototype shares with all instances
Channel.prototype.appendMessage = function(nick, type, text) {
  var _a, m;
  m = {
    nick: nick,
    type: type,
    text: text,
    timestamp: new Date().getTime()
  };
  if (type === "msg") {
    sys.puts("<" + nick + "> "+text);
  } else if (type === "join") {
    sys.puts(nick + " join");
  } else if (type === "part") {
    sys.puts(nick + " part");
  }
  this.messages.push(m);
  while (this.callbacks.length > 0) {
    this.callbacks.shift().callback([m]);
  }
  _a = [];
  while (this.messages.length > MESSAGE_BACKLOG) {
    _a.push(this.messages.shift());
  }
  return _a;
};
Channel.prototype.query = function(since, callback) {
  var _a, _b, _c, matching, message;
  matching = [];
  _b = this.messages;
  for (_a = 0, _c = _b.length; _a < _c; _a++) {
    message = _b[_a];
    if (message.timestamp > since) {
      matching.push(message);
    }
  }
  matching.length !== 0 ? callback(matching) : this.callbacks.push({
    timestamp: new Date(),
    callback: callback
  });
  return setInterval(__bind(function() {
      var _d, now;
      now = new Date();
      _d = [];
      while (this.callbacks.length > 0 && now - this.callbacks[0].timestamp > 3 * 1000) {
        _d.push(this.callbacks.shift().callback([]));
      }
      return _d;
    }, this), 3000);
};

channels = {};
createSession = function(nick,host) {
	if(!channels[host]) {
		sys.puts("Creating channel: "+host);
		channels[host] = new Channel();
		sys.puts(channels[host]);
	}
  var _a, _b, _c, session;
  if (nick.length > 50) {
    return null;
  }
  if (/[^\w_\-^!]/.exec(nick)) {
    return null;
  }
  _b = sessions;
  for (_a = 0, _c = _b.length; _a < _c; _a++) {
    session = _b[_a];
    if (session.nick === nick) {
      return null;
    }
  }
  session = {
    nick: nick,
    id: Math.floor(Math.random() * 99999999999).toString(),
    timestamp: new Date(),
    poke: function() {
      session.timestamp = new Date();
      return session.timestamp;
    },
    destroy: function() {
      channels[host].appendMessage(session.nick, "part");
      return delete sessions[session.id];
    }
  };
  sessions[session.id] = session;
  return session;
};
kill_sessions = function() {
  var _a, _b, _c, now, session;
  now = new Date();
  _b = sessions;
  for (_a = 0, _c = _b.length; _a < _c; _a++) {
    session = _b[_a];
    if (!sessions.hasOwnProperty(id)) {
      continue;
    }
    session = session[id];
    now - session.timestamp > SESSION_TIMEOUT ? session.destroy() : null;
  }
};
setInterval(kill_sessions, 1000);
fu.listen(PORT, HOST);
fu.get("/", fu.staticHandler("index.html"));
fu.get("/chatlet.css", fu.staticHandler("chatlet.css"));
fu.get("/Blow.mp3", fu.staticHandler("Blow.mp3"));
fu.get("/Blow.m4a", fu.staticHandler("Blow.m4a"));
fu.get("/client.js", fu.staticHandler("client.js"));
fu.get("/load.js", fu.staticHandler("load.js"));
fu.get("/jquery-1.4.2.min.js", fu.staticHandler("jquery-1.4.2.min.js"));
fu.get('/who', function(req, res) {
  var _a, _b, _c, nicks, session, callback;
	callback = qs.parse(url.parse(req.url).query).callback;
  nicks = [];
  _b = sessions;
  for (_a = 0, _c = _b.length; _a < _c; _a++) {
    session = _b[_a];
    if (!sessions.hasOwnProperty(id)) {
      continue;
    }
    nicks.push(session.nick);
  }
  return res.simpleJSONP(200, {
    nicks: nicks,
    rss: mem.rss
  });
});
fu.get('/join', function(req, res) {
  var nick, session, callback;
  nick = qs.parse(url.parse(req.url).query).nick;
  callback = qs.parse(url.parse(req.url).query).callback;
	host = qs.parse(url.parse(req.url).query).host;
  if (nick.length === 0) {
    res.simpleJSONP(400, {
      error: "Bad nick."
    },callback);
    return null;
  }
  session = createSession(nick,host);
  if (session === null) {
    res.simpleJSONP(400, {
      error: "Nick in use."
    },callback);
    return null;
  }
	sys.puts(nick+" joins "+host+" with "+channels[host].messages.length+" messages.");
  channels[host].appendMessage(session.nick, "join");
  return res.simpleJSONP(200, {
    id: session.id,
    nick: session.nick,
    rss: mem.rss,
    starttime: starttime
  },callback);
});
fu.get("/send", function(req, res) {
  var id, session, text, callback;
	callback = qs.parse(url.parse(req.url).query).callback;
  id = qs.parse(url.parse(req.url).query).id;
  text = qs.parse(url.parse(req.url).query).text;
	host = qs.parse(url.parse(req.url).query).host;
  session = sessions[id];
  if (!session || !text) {
    res.simpleJSONP(400, {
      error: "No such session id"
    },callback);
    return null;
  }
  session.poke();
  channels[host].appendMessage(session.nick, "msg", text);
  return res.simpleJSONP(200, {
    rss: mem.rss
  },callback);
});
fu.get("/part", function(req, res) {
  var id, session, callback;
	callback = qs.parse(url.parse(req.url).query).callback;
  id = qs.parse(url.parse(req.url).query).id;
  if (id && sessions[id]) {
    session = sessions[id];
    session.destroy();
  }
  return res.simpleJSONP(200, {
    rss: mem.rss
  },callback);
});
fu.get("/recv", function(req, res) {
  var id, session, since, callback;
	callback = qs.parse(url.parse(req.url).query).callback;
  id = qs.parse(url.parse(req.url).query).id;
	since = parseInt(qs.parse(url.parse(req.url).query).since, 10);
	host = qs.parse(url.parse(req.url).query).host;
	if (!since) {
    res.simpleJSONP(400, {
      error: "Bad time."
    },callback);
    return null;
  }
  if (id && sessions[id]) {
    session = sessions[id];
    session.poke();
  }
  if (!channels[host]) {
    res.simpleJSONP(400, {
      error: "Channel does not exist."
    },callback);
    return null;
  }
  return channels[host].query(since, function(messages) {
    session ? session.poke() : null;
    return res.simpleJSONP(200, {
      messages: messages,
      rss: mem.rss
    },callback);
  });
});
fu.get("/chans", function(req, res) {
	var keys, callback;
	callback = qs.parse(url.parse(req.url).query).callback;
  keys = (function() {
	  _a = []; _b = channels;
	  for (key in _b) { if (__hasProp.call(_b, key)) {
	    _a.push(key);
	  }}
	  return _a;
	})();
  return res.simpleJSONP(200, {
     keys: keys
   },callback);
});