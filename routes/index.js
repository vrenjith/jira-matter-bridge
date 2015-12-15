var express = require('express');
var router = express.Router();
var https = require('https');
var http = require('https');
var toMarkdown = require('to-markdown');


router.get('/', function(req, res, next) {
    res.render('index', {
        title: 'JIRA Mattermost Bridge'
    });
});

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function(txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

function doConversion(str)
{
    return toMarkdown(str);
}

function postToServer(postContent, hookid) {
    console.log("Informing mattermost channel: " + hookid);
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

    var postData = '{"text": ' + JSON.stringify(postContent) + '}';
    var post_options = {
        host: process.env.MATTERMOST_SERVER || 'localhost',
        port: process.env.MATTERMOST_SERVER_PORT || '80',
        path: process.env.MATTERMOST_SERVER_PATH || '/hooks/' + hookid,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(postData)
        }
    };
    
    console.log(post_options);

    var proto;
    if(process.env.MATTERMOST_SERVER_PROTO == 'https')
    {
        proto = https;
    }
    else
    {
        proto = http;
    }

    // Set up the request
    var post_req = proto.request(post_options, function(res) {
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            console.log('Response: ' + chunk);
        });
    });

    // post the data
    post_req.write(postData);
    post_req.end();

}

//Dummy path for testing the integration
router.post('/sink/:hookid?', function(req, res, next) {
    console.log(req.params.hookid);
    console.log(req.body);
    res.render(req.body);
});

router.get('/hooks/:hookid?', function(req, res, next) {
    res.render('index', {
        title: 'JIRA Mattermost Bridge - You got it right'
    });
});

router.post('/hooks/:hookid?', function(req, res, next) {
    console.log(req.body);
    
    console.log("Received update from JIRA");
    var hookId = req.params.hookid;
    var webevent = req.body.webhookEvent;
    var issueID = req.body.issue.key;
    var issueRestUrl = req.body.issue.self;
    var regExp = /(.*?)\/rest\/api\/.*/g;
    var matches = regExp.exec(issueRestUrl);
    var issueUrl = matches[1] + "/browse/" + issueID;
    var summary = req.body.issue.fields.summary;

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

    postToServer(postContent, hookId);

    res.render('index', {
        title: 'JIRA Mattermost Bridge - beauty, posted to JIRA'
    });
});


module.exports = router;