# jira-matter-bridge

Serves as a bridge that translates the JIRA webhooks into Mattermost webhooks.
Set the following environment variables to provide the Mattermost server details:
* MATTERMOST_SERVER_PORT - Default: 80
* MATTERMOST_SERVER_PATH - Default: /hooks/<incoming hookid>
* MATTERMOST_SERVER_PROTO - Default: http
* MATTERMOST_SERVER - Default: localhost