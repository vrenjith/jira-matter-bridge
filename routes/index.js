var express = require('express');
var router = express.Router();
var https = require('https');
var http = require('http');
var toMarkdown = require('to-markdown');
var url = require('url');
var HttpsProxyAgent = require('https-proxy-agent');
var HttpProxyAgent = require('http-proxy-agent');
var debug = process.env.JIRA_MATTER_BRIDGE_DEBUG;

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function debugLog(str) {
  if(debug) {
    console.log(str);
  }
}

function postToServer(postContent, hookid, channel, matterUrl) {
    if(channel)
    {
        debugLog("Informing mattermost channel: " + channel +
            " with hookid: " + hookid);
    }
    else
    {
        debugLog("Informing mattermost channel: " + hookid);
    }
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var agent, httpsagent, httpagent = null;
    var https_proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    var http_proxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if(https_proxy)
    {
        httpsagent = new HttpsProxyAgent(https_proxy);
        debugLog("Using HTTPS proxy - " + https_proxy);
    }
    if(http_proxy)
    {
        httpagent = new HttpProxyAgent(http_proxy);
        debugLog("Using HTTP proxy - " + http_proxy);
    }

    var matterServer = process.env.MATTERMOST_SERVER || 'localhost';
    var matterServerPort = process.env.MATTERMOST_SERVER_PORT;
    var matterProto = process.env.MATTERMOST_SERVER_PROTO || 'http';
    var matterPath = (process.env.MATTERMOST_SERVER_PATH || '/hooks/') + hookid;
    var matterUsername = process.env.MATTERMOST_USERNAME || 'JIRA';
    var matterIconUrl = process.env.MATTERMOST_ICON_URL || 'https://design.atlassian.com/images/logo/favicon.png';

    if(matterUrl)
    {
        try
        {
            var murl = url.parse(matterUrl);
            matterServer = murl.hostname || matterServer;
            matterServerPort = murl.port || matterServerPort;
            matterProto = murl.protocol.replace(":","") || matterProto;
            matterPath = murl.pathname || matterPath;
        }
        catch(err){debugLog(err);}
    }
    //If the port is not initialized yet (neither from env, nor from query param)
    // use the defaults ports
    if(!matterServerPort)
    {
        if (matterProto == 'https')
        {
            matterServerPort = '443';
        }
        else
        {
            matterServerPort = '80';
        }
    }
    debugLog(matterServer + "-" + matterServerPort  + "-" + matterProto);
    var proto;
    if(matterProto == 'https')
    {
        debugLog("Using https protocol");
        proto = https;
        agent = httpsagent;
    }
    else
    {
        debugLog("Using http protocol");
        proto = http;
        agent = httpagent;
    }

    var postData = '{"text": ' + JSON.stringify(postContent) +
            ', "username": "' + matterUsername +
            '", "icon_url": "' + matterIconUrl;
    if(channel)
    {
        postData += '", "channel": "' + channel;
    }
    postData += '"}';
    debugLog(postData);

    var post_options = {
        host: matterServer,
        port: matterServerPort,
        path: matterPath,
        method: 'POST',
        agent: agent,
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };

    debugLog(post_options);

    try
    {
        // Set up the request
        var post_req = proto.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                debugLog('Response: ' + chunk);
            });
            res.on('error', function(err) {
                debugLog('Error: ' + err);
            });
        });

        // post the data
        post_req.write(postData);
        post_req.end();
    }
    catch(err)
    {
        debugLog("Unable to reach mattermost server: " + err);
    }
}

router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'JIRA Mattermost Bridge'
    });
});

router.get('/hooks/:hookid', function(req, res, next) {
    res.render('index', {
        title: 'JIRA Mattermost Bridge - You got it right'
    });
});

router.post('/hooks/:hookid/:channel?', function(req, res, next) {
    debugLog("Received update from JIRA");
    var hookId = req.params.hookid;
    var channel = req.params.channel;

    var webevent = req.body.webhookEvent;

    if (!req.body.issue) {
        debugLog("Event (type " + webevent + ") has no issue. Probably a buggy comment notification from https://jira.atlassian.com/browse/JRASERVER-59980");
        if (req.body.comment.self) {
            debugLog("...comment URL is " + req.body.comment.self);
        }
        return;
    }

    var issueID = req.body.issue.key;
    var issueRestUrl = req.body.issue.self;
    var regExp = /(.*?)\/rest\/api\/.*/g;
    var matches = regExp.exec(issueRestUrl);
    var issueUrl = matches[1] + "/browse/" + issueID;
    var summary = req.body.issue.fields.summary;

    var matterUrl = req.query.matterurl;
    var track = req.query.track || "status";
    var trackedItems = track.split(",").map(function(item) {
      return item.toLowerCase();
    });

    var displayName = req.body.user.displayName;
    var avatar = req.body.user.avatarUrls["16x16"];
    var changeLog = req.body.changelog;
    var comment = req.body.comment;

    var postContent;

    if (webevent == "jira:issue_updated")
    {
        postContent = "##### " + displayName + " updated [" + issueID + "](" + issueUrl + "): " + summary;
    }
    else if(webevent == "jira:issue_created")
    {
        postContent = "##### " + displayName + " created [" + issueID + "](" + issueUrl + "): " + summary;
    }
    else if(webevent == "jira:issue_deleted")
    {
        postContent = "##### " + displayName + " deleted [" + issueID + "](" + issueUrl + "): " + summary;
    }
    else
    {
        debugLog("Ignoring events which we don't understand");
        res.render('index', {
            title: 'Ignoring events which we don\'t understand'
        });
        return;
    }

    /* Only issue_updated events have change logs. If a comment was added to an
    issue, the resulting issue_updated event does not have a change log. */
    if(changeLog)
    {
        var changedItems = changeLog.items;

        for (i = 0; i < changedItems.length; i++) {
          debugLog("Field of changeLog.items[" + i + "] == " +
                   changedItems[i].field);
          if (trackedItems.indexOf(changedItems[i].field.toLowerCase()) != -1) {
            break;
          }
          if (i+1 == changedItems.length) {
            debugLog("Ignoring events that are not being tracked. " +
                        "Tracked events: " + track);
            res.render("index", {
                title: "Ignoring events that are not being tracked. " +
                            "Tracked events: " + track
            });
            return;
          }
        }

        postContent += "\r\n| Field | Updated Value |\r\n|:----- |:-------------|\r\n";

        for (i = 0; i < changedItems.length; i++) {
            var item = changedItems[i];
            var fieldName = item.field;
            var fieldValue = item.toString;
            if(!fieldValue){
                fieldValue = "-Cleared-";
            }
            postContent += "| " + toTitleCase(toMarkdown(fieldName)) + " | " + toMarkdown(fieldValue) + " |\r\n";
        }
    }

    if(comment)
    {
        postContent += "\r\n##### Comment:\r\n" + toMarkdown(comment.body);
    }

    postToServer(postContent, hookId, channel, matterUrl);

    res.render('index', {
        title: 'JIRA Mattermost Bridge - beauty, posted to JIRA'
    });
});


module.exports = router;
