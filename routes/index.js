var express = require('express');
var router = express.Router();
var proto = require('https');
var querystring = require('querystring');
var escape = require("markdown-escape");


/* GET home page. */
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
	//had to write a custom parser since none of the existing ones
	//did do the job correctly viz, querystring and markdown-escape
	//str.replace(/;/g,"\;");

	return str;
}

function postToServer(postContent, hookid) {
    console.log("Informing mattermost channel: " + hookid);
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

	var postData = '{"text": ' + JSON.stringify(postContent) + '}';
	//console.log(postData);
    var post_options = {
        host: 'ariba-mattermost.mo.sap.corp',
        port: '443',
        path: '/hooks/' + hookid,
        /*host: 'requestb.in',
       	port: '80',
        path: '/t4v4lit4',*/
        method: 'POST',
        headers: {
	        'Content-Type': 'application/json',
	        'Content-Length': Buffer.byteLength(postData)
    	}
    };

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

router.post('/hooks/:hookid?', function(req, res, next) {
    //console.log(req.body);	
    console.log("Received update from JIRA");
    var hookId = req.params.hookid;
    var webevent = req.body.webhookEvent;
    if (webevent == "jira:issue_updated") {
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

        if(changeLog)
		{
			var changedItems = req.body.changelog.items;

	        var postContent = "##### " + displayName + " updated [" + issueID + "](" + issueUrl +
	            "): " + summary + "\r\n| Field | Updated Value |\r\n|:----- |:-------------|\r\n";


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
	    else if(comment)
	    {
	    	var postContent = "##### " + displayName + " added a comment to [" + issueID + "](" + issueUrl +
	            "): " + doConversion(summary) + "\r\n" + doConversion(comment.body);
	    }
	    else
	    {
	    	console.log("This is not supposed to happen");
	    }	

        //console.log(postContent);

        postToServer(postContent, hookId);
    } else {
        console.log("Ignoring non-update events");
    }
    res.render('index', {
        title: 'JIRA Mattermost Bridge'
    });

});


module.exports = router;