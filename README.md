# JIRA Mattermost Webhook Bridge

Serves as a bridge that translates the JIRA webhooks into Mattermost webhooks.
## Configuration
Set the following environment variables to provide the Mattermost server details:
* MATTERMOST_SERVER_PORT - Default: 80
* MATTERMOST_SERVER_PATH - Default: /hooks/<incoming hookid>
* MATTERMOST_SERVER_PROTO - Default: http
* MATTERMOST_SERVER - Default: localhost

## Integration
* Install the required modules by running `npm install`
* Start the app by running `npm start`
* Configure Mattermost server and create a new [incoming webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md) and note the hook-id (the part that appears after `hooks` in the hook URL.
* Configure JIRA Webhooks to forward the hook (for the required JQL) to `http://<jira-matter-bridge-server>:3000/hooks/<mattermost hook id>`
* That's it.

## Docker Version
Pull the image from Docker Hub and run a container:
```sh
docker run --rm -p 3000:3000 vrenjith/jira-matter-bridge
```
See also the example docker-compose.yml.

## Hosted Version

* The app is hosted on a free dyno at https://jira-matter-bridge.herokuapp.com/
* If the Mattermost server and JIRA server are on public domain, you can directly use this hosted version.
* In the JIRA Server, configure the webhook URL as given in this example
 * `https://jira-matter-bridge.herokuapp.com/hooks/<hookid from your mattermost server>?matterurl=<your mattermost server base url>`
* E.g.:
 * `https://jira-matter-bridge.herokuapp.com/hooks/ckshz5joqigkfmj6po7fm4r8wh?matterurl=https://someserver.com`
 * `https://jira-matter-bridge.herokuapp.com/hooks/ckshz5joqigkfmj6po7fm4r8wh?matterurl=http://someserver.com:3000`
 * `https://jira-matter-bridge.herokuapp.com/hooks/ckshz5joqigkfmj6po7fm4r8wh?matterurl=https://someserver.com:8443`

:warning: Since this is hosted on a free dyno, there is no guarantee that the messages will be delivered and it is recommended that you use a paid dyno at [Heroku](https://dashboard.heroku.com/new) using this repository as source.

[![Deploy](https://www.herokucdn.com/deploy/button.svg)](https://heroku.com/deploy?template=https://github.com/vrenjith/jira-matter-bridge)
