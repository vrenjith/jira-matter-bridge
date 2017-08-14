var express = require('express');
var router = express.Router();
var https = require('https');
var http = require('http');
var toMarkdown = require('to-markdown');
var url = require('url');
var HttpsProxyAgent = require('https-proxy-agent');
var HttpProxyAgent = require('http-proxy-agent');

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function doConversion(str)
{
    return toMarkdown(str);
}

function postToServer(postContent, hookid, matterUrl) {
    console.log("Informing mattermost channel: " + hookid);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var agent, httpsagent, httpagent = null;
    var https_proxy = process.env.HTTPS_PROXY || process.env.https_proxy;
    var http_proxy = process.env.HTTP_PROXY || process.env.http_proxy;
    if(https_proxy)
    {
        httpsagent = new HttpsProxyAgent(https_proxy);
        console.log("Using HTTPS proxy - " + https_proxy);
    }
    if(http_proxy)
    {
        httpagent = new HttpProxyAgent(http_proxy);
        console.log("Using HTTP proxy - " + http_proxy);
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
        catch(err){console.log(err)}
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
    console.log(matterServer + "-" + matterServerPort  + "-" + matterProto);
    var proto;
    if(matterProto == 'https')
    {
        console.log("Using https protocol");
        proto = https;
        agent = httpsagent;
    }
    else
    {
        console.log("Using http protocol");
        proto = http;
        agent = httpagent;
    }

    var postData = '{"text": ' + JSON.stringify(postContent) + ', "username": "' + matterUsername + '", "icon_url": "' + matterIconUrl + '"}';
    console.log(postData);
    
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
    
    console.log(post_options);

    try
    {
        // Set up the request
        var post_req = proto.request(post_options, function(res) {
            res.setEncoding('utf8');
            res.on('data', function(chunk) {
                console.log('Response: ' + chunk);
            });
            res.on('error', function(err) {
                console.log('Error: ' + err);
            });
        });

        // post the data
        post_req.write(postData);
        post_req.end();
    }
    catch(err)
    {
        console.log("Unable to reach mattermost server: " + err);
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

router.post('/hooks/:hookid', function(req, res, next) {
    console.log("Received update from JIRA");
    var hookId = req.params.hookid;
    var webevent = req.body.webhookEvent;

    if (!req.body.issue) {
        console.log("Event (type " + webevent + ") has no issue. Probably a buggy comment notification from https://jira.atlassian.com/browse/JRASERVER-59980");
        if (req.body.comment.self) {
            console.log("...comment URL is " + req.body.comment.self);
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
        console.log("Ignoring events which we don't understand");
        return;
    }

    if(changeLog)
    {
        var changedItems = req.body.changelog.items;

        postContent += "\r\n| Field | Updated Value |\r\n|:----- |:-------------|\r\n";

        for (i = 0; i < changedItems.length; i++) {
            var item = changedItems[i];
            var fieldName = item.field;
            var fieldValue = item.toString;
            if(!fieldValue){
                fieldValue = "-Cleared-";
            }
            postContent += "| " + toTitleCase(doConversion(fieldName)) + " | " + doConversion(fieldValue) + " |\r\n";
        }
    }

    if(comment)
    {
        postContent += "\r\n##### Comment:\r\n" + doConversion(comment.body);
    }

    postToServer(postContent, hookId, matterUrl);

    res.render('index', {
        title: 'JIRA Mattermost Bridge - beauty, posted to JIRA'
    });
});


module.exports = router;