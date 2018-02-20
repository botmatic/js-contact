# JS Contact
Implement Botmatic Integrations with ease.  
Allows you to easily create integrations to synchronize Botmatic contacts with an external service.

## Table of contents

1. Install
2. Basic usage
3. Implementations steps
4. Configuration
  - Parameters descripiton
  - Using the default express instance
  - Using an existing express instance
  - Authenticating requests from Botmatic
5. Botmatic Events
  - Handling INSTALL
  - Handling UNINSTALL
  - Handling other events
  - Handling actions
6. Reference
  - Properties
  - Methods
  - Interfaces

## Install
```bash
npm install @botmatic/js-contact
```

## Basic usage
Upon initialization, `js-contact` takes a configuration object as follow:
```javascript
const app = express()

const botmaticConfig = {
   consumer: yourConsumer, // REQUIRED // API consumer for your external API. Implements the ExternalAPIConsumer Interface
   mappings: yourMappings, // REQUIRED // An array of Mapping. See js_mapper module
   keyStore: keyStore, // REQUIRED // The storage to map ids. Implements the KeyStorage Interface
   endpoint: "/", // OPTIONAL // Botmatic will send events and actions to this path
   server:   app, // OPTIONAL // The express server to add those routes
   port:   3456, // OPTIONAL // If using the default express instance, the port the app listens
   auth: () => true // OPTIONAL // Authorization function to authorize requests sent by Botmatic
}

const botmatic = require('@botmatic/js-contact')(botmaticConfig)
```

Once the module is initialized, it will start listening to events from Botmatic.

## Implementation steps
In order to have a complete contact integration you should:

1. Create mappings (See @botmatic/js-mapper)
2. Implement an ExternalAPIConsumer for your external service
3. Optional: if choose not to use @botmatic/js-redis-key-store, implement your own
4. Add routes to your express server (or to the default one) to handle events
  from your external service.
5. Optional: add listeners for other events or actions

## Configuration

### Parameters descripiton

properties | type                                 | attributes                       | description
---------- | ------------------------------------ | -------------------------------- | -----------
consumer   | ExternalAPIConsumer                  | required                         | Used to create, updated and delete contacts on your external service
mappings   | Mapping[]                            | required                         | Used to convert contacts to and from your external service
keyStore   | KeyStore                             | required                         | Used to store botmatic/external id pairs
endpoint   | string                               | optional, default = `"/"`        | The route to which Botmatic will send events
server     | Express                              | optional                         | An existing Express server instance
auth       | `function(token) => {token, client}` | optional, default = `() => true` | A function to validate request sent to Botmatic. Not called on Install

### Using the default express instance
You can start using @botmatic/js-contact without having to setup an express server,
@botmatic/js-contact includes a default one.  
It will listen on port `3000` by default, by you can specify a custom one using the `port`
parameter. 
```javascript
const botmaticConfig = {
   consumer: yourConsumer, // your API consumer
   mappings: yourMappings, // your mappings
   keyStore: keyStore, // a key store
   endpoint: "/", // your endpoint path
   port:   3456, // port to listen 
   auth: authorizeBotmatic // an auth function
}

const botmatic = require('@botmatic/js-contact')(botmaticConfig)
// botmatic.app is the running express server
```

### Using an existing express instance
If you wish to add @botmatic/js-contact to an existing express server, pass it
as the `server` parameter. Routes will be added to the specified `endpoint` path.
```javascript
const app = express()

const botmaticConfig = {
   consumer: yourConsumer, // your API consumer
   mappings: yourMappings, // your mappings
   keyStore: keyStore, // a key store
   endpoint: "/", // your endpoint path
   server:   app, // your existing express app
   auth: authorizeBotmatic // an auth function
}

const botmatic = require('@botmatic/js-contact')(botmaticConfig)

app.listen(PORT)
```

### Authenticating requests from Botmatic
The `auth` function passed on initialization is called on every received event, except INSTALL.
It takes the token from the request headers as first and only parameter, and *must* return a Promise resolving
to an object as follow:

```json
{
  "token": "THE_BOTMATIC_TOKEN",
  "client": { // OPTIONAL // contains any information required about the client related this integration token
    "id": "deadbeef"
  }
}
```
This object will be the `auth` property of the object passed as parameter to all events listeners.

##### Example `auth` function
```javascript
const authorization = token => {
  return new Promise((resolve, reject) => {
    // you should check you received this token upon installation
    if (validate(token)) {
      clientsService.getForToken(token)
      .then(client => {
        resolve({token, client})
      })
      .catch(error => {
        reject(`error get client for token ${error}`)
      })
    }
    else {
      // Returning false will stop propagating the event and return a 401 status code
      reject("invalid token")
    }
  })
}

// in Botmatic configuration
const botmaticConfig = {
   consumer: yourConsumer, // REQUIRED // API consumer for your external API. Implements the ExternalAPIConsumer Interface
   mappings: yourMappings, // REQUIRED // An array of Mapping. See js_mapper module
   keyStore: keyStore, // REQUIRED // The storage to map ids. Implements the KeyStorage Interface
   endpoint: "/", // OPTIONAL // Botmatic will send events and actions to this path
   server:   app, // OPTIONAL // The express server to add those routes
   auth: authorization // Authorization function to authorize requests sent by Botmatic
}

// initialize @botmatic/js-contact
const botmatic = require('@botmatic/js-contact')(botmaticConfig)
```

## Botmatic Events
`@botmatic/js-contact` takes care of handling CONTACT_CREATED, CONTACT_UPDATED and CONTACT_DELETED events.  
You will still have to implement listeners for INSTALL, UNINSTALL, BOT_REPLY and USER_REPLY events,
and any action you wish to integrate in Botmatic.  

### Handling the INSTALL event
When an integration is installed on Botmatic, an `INSTALL` event is sent to your implementation.  
The token is then verified and the properties defined in your mappings are created.  
This is when you should store the Botmatic authorization token, and import your contacts
to Botmatic.

```javascript
botmatic.onInstall(async ({auth: token}) => {
  // Store your token
  redis.set('mytoken', token)
  
  // Import your contacts
  botmatic.importContacts(token)
  
  // return the default format
  return {data: {success: true}, type: "data"}
})
```

### Handling the UNINSTALL event
When an integration is uninstalled from Botmatic, an `UNINSTALL` event is sent to your implementation.
The botmatic/external id pairs will have been removed from your storage.  
You should remove your Botmatic authorization from your storage.

```javascript
botmatic.onUninstall(async ({auth: token}) => {
  // remove the token
  redis.del('mytoken')
  
  // return the default format
  return {data: {success: true}, type: "data"}
})
```

### Handling other events
`@botmatic/js-contact` provides an `onEvent` function to allow you to respond to BOT_REPLY and USER_REPLY events

```javascript
botmatic.onEvent(botmatic.events.BOT_REPLY, ({auth: {token, client}, data}) => {
  // data.event == "bot_reply"
  // data.data contains the event data
  
  return {data: {success: true}, type: "data"}
})
```

### Handling actions

```javascript
botmatic.onAction("your_action_name", ({auth: {token, client}, data}) => {
  // handle your action
  
  return {data: your_action_result, type: "data"}
})
```

## Reference

### Properties

#### .app
 - *type :* Express
 - *description : * An express server instance. 

#### .events (read only)
 - *type :* Object
 - *description :* Constants for events names

properties | description
--- | ---
CONTACT_CREATED | event sent when a contact is created on botmatic
CONTACT_UPDATED | event sent when a contact is updated on botmatic
CONTACT_DELETED | event sent when a contact is deleted on botmatic
BOT_REPLY | event sent when bot sent a message to a user on botmatic
USER_REPLY | event sent when a user sent a message to a bot on botmatic
INSTALL | event sent when your integration is installed on a workspace
UNINSTALL | event sent when your integration is uninstalled on a workspace

### Methods

##### `createContact(contact, token) -> Promise<{success, id, error}>`
Transforms the contact according to the `mappings` and creates it on Botmatic.  
Saves the botmatic/external ids pair in the keyStore.

Parameters:
 - **contact**, *object*: a contact in your API format
 - **token**, *string*: the botmatic integration token

The response `success` is `true` when:
 - The contact has successfully been created
 - The new id is returned

It is `false` when:
 - The creation failed
 - No id has been returned
 - An error occurred
 
```javascript
const {success, id, error} = await botmatic.createContact({"first_name": "Patrick", "last_name": "Chen"}, token)
// success == true
// id is the id returned by your external service
```

##### `importContacts(contacts, token) -> Promise<{success, error}>`
Transforms all the contact according to the `mappings` and creates them on Botmatic.  
Saves all botmatic/external id pairs in the keyStore

Parameters:
 - **contacts**, *array*: an array of contact in your API format
 - **token**, *string*: the botmatic integration token

The response `success` is `true` when:
 - The contacts have successfully been imported

It is `false` when:
 - The import failed
 - An error occurred
 
```javascript
const {success, error} = await botmatic.importContacts(contacts, token)
// success == true
// error == undefined
```

##### `updateContact(contact, token) -> Promise<{success, error}>`
Transforms the contact according to the `mappings` and updates it on Botmatic.  
The contact object must have its external id in the identifying field specified in `mappings` configuration.

Parameters:
  - **contact**, *object*: a contact in your API format
  - **token**, *string*: the botmatic integration token

The response `success` is `true` when the contact has successfully been updated.  
It is `false` when:
 - the contact was not found on the remote service. `error` == `"resource not found"`
 - an error occurred

```javascript
const {success, error} = await botmatic.updateContact(contact, token)
// success == true
// error == undefined
```

##### `deleteContact(contact_id, token) -> Promise<{success, error}>`
Deletes a contact on Botmatic. `contact_id` must be the contact's external id.

Parameters:
  - **contact_id**, *string*: the contact's external id
  - **token**, *string*: the botmatic integration token
 
The response `success` is `true` when the contact has successfully been deleted.  
It is `false` when:
 - the contact was not found on the remote service. `error` = `"resrouce not found"`
 - an error occured

```javascript
const {success, error} = await botmatic.deleteContact(contact_id, token)
// success == true
// error == undefiend
```

##### `createProperty(property, token) -> Promise<{success, error}>`
Adds a property on Botmatic.

Parameters:
  - **property**, *{name: string [, type: string]}*: the property
  - **token**, *string*: the botmatic integration token
 
The response `success` is `true` when the property has successfully been created.  
It is `false` otherwise, check the response `error`.

```javascript
const {success, error} = await botmatic.createProperty(property, token)
// success == true
// error == undefiend
```

##### `createProperties(properties, token) -> Promise<{success, error}>`
Adds many properties on Botmatic.

Parameters:
  - **properties**, *array*: the properties to add
  - **token**, *string*: the botmatic integration token
 
The response `success` is `true` when the properties have successfully been created.  
It is `false` otherwise, check the response `error`.

```javascript
const {success, error} = await botmatic.createProperty(property, token)
// success == true
// error == undefiend
```

##### `onInstall(callback)`
Adds a listener for the INSTALL event. 
The callback's signature is:  
```callback({auth: {token}}) -> Promise<{data: object, type: "data"}>```
Where `token` is the integration token to be used when creating, updating or deleting
contacts or properties.  
See "Handling INSTALL" for an example. 

##### `onUninstall(callback)`
Adds a listener for the UNINSTALL event. 
The callback's signature is:  
```callback({auth: {token, client}}) -> Promise<{data: object, type: "data"}>```
Where `token` is the integration token to be used when creating, updating or deleting
contacts or properties, `client` is the client data return by the `auth` function
in configuration.  
See "Authenticating requests from Botmatic"  
See "Handling UNINSTALL"

##### `onEvent(eventName, callback)`
Adds a listener for any event in `js-contact.events`
The callback's signature is:  
```callback({auth: {token, client}}) -> Promise<{data: object, type: "data"}>```
Where `token` is the integration token to be used when creating, updating or deleting
contacts or properties, `client` is the client data return by the `auth` function
in configuration.  
See "Authenticating requests from Botmatic" 
See "Handling other events"

##### `onAction(callback)`
Adds a listener for an action.
The callback's signature is:  
```callback({auth: {token, client}}) -> Promise<{data: object, type: "data"}>```
Where `token` is the integration token to be used when creating, updating or deleting
contacts or properties, `client` is the client data return by the `auth` function
in configuration.  
See "Authenticating requests from Botmatic" 
See "Handling other actions"

##### `close([callback])`
Properly shuts down the express server. If provided, calls `callback` when done.

### Interfaces

#### ExternalAPIConsumer Interface
An ExternalAPIConsumer is used to communicate with your service's API. It should
implement the set of methods descibed bellow, and handle authentication to your service.


##### `createContact(contact) -> Promise<{success, id, error}>`
Creates a contact.  
The response `success` is `true` when:
 - The contact has successfully been created
 - The new id is returned

It is `false` when:
 - The creation failed
 - No id has been returned
 - An error occurred
 
```javascript
const {success, id, error} = await consumer.createContact({"first_name": "Patrick", "last_name": "Chen"})
// success == true
// id is the id returned by your external service
```

##### `getContact(id) -> Promise<{success, contact, error}>`
Fetches a contact by its id.   
The response `success` is `true` when:
 - A contact with the given `id` is found

It is `false` when:
 - No contact was found. `error` == `"resource not found"`
 - An error occurred
 
```javascript
const {success, contact, error} = await cosumer.getContact(23)
// success == true
// contact == { first_name: "Patrick", last_name: "Chen" }
```

##### `getContactByEmail(email) -> Promise<{success, contact, error}>`
Fetches a contact by its email.  
The response `success` is `true` when:
 - A contact with a matching `email` is found

It is `false` when:
 - No matching contact was found. `error` == `"resource not found"`
 - An error occured
 
```javascript
const {success, contact, error} = await consumer.getContactByEmail("patrick.chen@fake.org")
// success == true
// contact == { first_name: "Patrick", last_name: "Chen", email: "patrick.chen@fake.org" }
```

##### `listContacts([page=1], [limit=30]) -> Promise<{success, contacts, error}>`
Fetches a paginated list of contacts.  
The response `success` is `true` when:
 - The request is successful
 - If no contacts are found, `contacts` is an empty array

The response `success` is `false` when:
 - An error occured

```javascript
const {success, contacts, error} = await consumer.listContacts(2, 30)
// success == true
// contacts is an array containing contacts from 31 to 61
```

##### `listAllContacts([page_size=30], callback) -> Promise<{success, contacts, error}>`
Fetches all contacts, page by page, and calls `callback` with each page. `callback` may be called with an empty array.  
Actually calls `listContact()` until it returns an empty array.  

The response `success` is always `true`.
The response `contacts` will only contains the result of successful calls to `listContacts()`

```javascript
const {success, contacts, error} = await consumer.listAllContacts(30, (contacts) => {
  console.log(`Fetched ${contacts.length} contacts`)
})

console.log(`Fetched a total of ${contacts.length} contacts`)
// success == true
// contains all contacts
// Console shows : 
//  Fetched 30 contacts
//  Fetched 13 contacts
//  Fetched a total of 43 contacts
```
##### `updateContact(contact) -> Promise<{success, error}>`
Updates a contact.  

The response `success` is `true` when the contact has successfully been updated.  
It is `false` when:
 - the contact was not found on the remote service. `error` == `"resource not found"`
 - an error occurred

```javascript
const {success, error} = await consumer.updateContact(contact)
// success == true
```

##### `deleteContact(contact_id) -> Promise<{success, error}>`
Deletes a contact.  
 
The response `success` is `true` when the contact has successfully been deleted.  
It is `false` when:
 - the contact was not found on the remote service. `error` = `"resrouce not found"`
 - an error occured

```javascript
const {success, error} = await consumer.deleteContact(29)
// success == true
```

##### Implementation example
```javascript
const API_BASE = "http://dummy.api.com"
const CONTACT_ENDPOINT = `${API_BASE}/contacts`

const createContact = (contact) => {
  return Promise(resolve => {
    request(CONTACT_ENPOINT, {
      method: 'post',
      headers: {'content-type': 'application/json'},
      json: contact
    }, (err, responseBody) => {
      if (!err) {
        resolve({success: true, id: responseBody.id})
      }
      else {
        resolve({success: false, error: err})
      }
    })
  })
}

// Implement the other functions

module.exports = {
  createContact
}
```

#### KeyStore Interface
Because ids on Botmatic won't necessarily match ids on your external service, a KeyStore is used to store botmatic/external id pairs.
Although there is a `@botmatic/js-redis-key-store` implementing this interface with redis,
you can implement your own for any type storage your want.    
All functions take an `integrationId` as first argument. It is recommended to use the token received upon installation as it unique per integration.

##### `saveIds(integrationId, botmaticId, externalId) -> Promise<boolean>`
Saves a botmatic/external id pair.
The returned `Promise` resolves to true in case of success, false in case of error.

##### `getBotmaticId(integrationId, externalId) -> Promise<string | null>`
Gets the botmatic id associated with the given external id.  
The returned `Promise` resolves to the botmatic id, or `null` if none is found.

##### `getExternalId(integrationId, botmaticId) -> Promise<string | null>`
Gets the external id associated with the given botmatic id.  
The returned `Promise` resolves to the external id, or `null` if none is found.

##### `deleteIds(integrationId, botmaticId, externalId) -> Promise<boolean>`
Deletes a botmatic/external id pair.  
The returned `Promise` resolves to true in case of success, false in case of error.

##### `deleteAllIds(integrationId) -> Promise<boolean>`
Deletes all botmatic/external id pairs for a given integration.
The returned `Promise` resolves to true in case of success, false in case of error.