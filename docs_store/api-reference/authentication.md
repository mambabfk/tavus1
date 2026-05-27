Authentication
Generate an API key in the Developer Portal and send it on each request in the `x-api-key` header.
To use the Tavus API, you need an API key to authenticate your requests. This key verifies that requests are coming from your Tavus account.
Get the API key
Go to the Developer Portal and select API Key from the sidebar menu. Click Create New Key to begin generating your API key. Enter a name for the key and (optional) specify allowed IP addresses, then click Create API Key. Copy your newly created API key and store it securely. Remember that your API key is a secret! Never expose it in client-side code such as browsers or apps. Always load your API key securely from environment variables or a server-side configuration.
Make Your First Call
Requests go to https://tavusapi.com . Authenticate with your API key by sending it in the x-api-key header on every request, as below. x-api-key: <api-key>
For example, you are using the POST - Create Conversation endpoint to create a real-time video call session with a Tavus replica. In this scenario, you can send an API request and replace <api-key> with your actual API key.
curl --request POST \
  --url https://tavusapi.com/v2/conversations \
  --header 'Content-Type: application/json' \
  --header 'x-api-key: <api-key>' \
  --data '{
  "replica_id": "r90bbd427f71",
  "persona_id": "pdac61133ac5",
  "conversation_name": "Interview User"
}'
