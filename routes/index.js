var express = require('express');
var router = express.Router();
var proto = require('https');

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

function postToServer(postContent, hookid) {
	process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

	var postData = 'payload={"text": ' + JSON.stringify(postContent) + '}';
	console.log(postData);
    var post_options = {
        host: 'ariba-mattermost.mo.sap.corp',
        port: '443',
        path: '/hooks/' + hookid,
        //host: 'requestb.in',
        //port: '80',
        //path: '/t4v4lit4',
        method: 'POST',
        headers: {
	        'Content-Type': 'application/x-www-form-urlencoded',
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
        var changedItems = req.body.changelog.items;
        var postContent = "##### " + displayName + " updated [" + issueID + "](" + issueUrl +
            ") " + summary + "\r\n| Field | Updated Value |\r\n|:----- |:-------------|\r\n";


        for (i = 0; i < changedItems.length; i++) {
            var item = changedItems[i];
            var fieldName = item.field;
            var fieldValue = item.toString;
            if(!fieldValue){
            	fieldValue = "-Cleared-";
            }
            postContent += "| " + toTitleCase(fieldName) + " | " + fieldValue + " |\r\n";
        }

        console.log(postContent);

        postToServer(postContent, hookId);
    } else {
        console.log("Ignoring non-update events");
    }
    res.render('index', {
        title: 'JIRA Mattermost Bridge'
    });

});


module.exports = router;