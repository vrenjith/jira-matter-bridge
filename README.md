# JIRA Mattermost Webhook Bridge

Serves as a bridge that translates the JIRA webhooks into Mattermost webhooks.
## Configuration
Set the following environment variables to provide the Mattermost server details:
* MATTERMOST_SERVER_PORT - Default: 80
* MATTERMOST_SERVER_PATH - Default: /hooks/<incoming hookid>
* MATTERMOST_SERVER_PROTO - Default: http
* MATTERMOST_SERVER - Default: localhost

Set the following environment variable to enable debug log output:
 * JIRA_MATTER_BRIDGE_DEBUG - Default: false

## Integration
* Install the required modules by running `npm install`
* Start the app by running `npm start`
* Configure Mattermost server and create a new [incoming webhooks](https://github.com/mattermost/platform/blob/master/doc/integrations/webhooks/Incoming-Webhooks.md) and note the hook-id (the part that appears after `hooks` in the hook URL.
* Configure JIRA Webhooks to forward the hook (for the required JQL) to the url `http://<jira-matter-bridge-server>:3000/hooks/<mattermost hook id>`
* You can append `/<channel>` to that url to overwrite the default mattermost channel associated with the hook id. Messages will be posted to this channel.
* This integration supports the jira events `issue_created`, `issue_updated` and `issue_deleted`.
* `issue_updated` events are only forwarded to mattermost when the `status` of the issue has changed. You can specify which items are being tracked by appending the query parameter
`track` denoting a comma separated list of events. For example `?track=status,assignee,epic+link`.

## Docker Version
Pull the image from Docker Hub and run a container:
```sh
docker run --rm -p 3000:3000 iteratec/jira-matter-bridge
```
See also the example docker-compose.yml.
