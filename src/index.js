/**
 * Main module to deal with contact integrations
 * @module js-contact
 * @todo Make the keyStore optional
 * @todo How to deal with token renewal ?
 * @requires module:js-api-client
 * @requires module:js-mapper
 * @requires module:js-integration
 * @example
 * // INITIALIZATION
 *
 * const botmatic_contact = require('js-contact')({
 *   consumer, // A module implementing the ExternalAPIConsumer interface
 *   mappings, // An array of Mapping objects (see typedef in Global)
 *   keyStore  // A module implementing the KeyStore interface to store matching ids between botmatic and the external service
 *   server,   // (optional) an instance of an Express server
 *   endpoint, // (optional, default = "/") the path to the endpoint listening to botmatic events
 *   port,     // (optional, default = 3000) port to listen to. Only if you don't pass an express server
 * })
 */

//
const debug = require('debug')('botmatic:js-contact')
require('dotenv').config({
  path: path.join(__dirname, '/../.env')
})

const zip = rows => rows[0].map((_,c) => rows.map(row => row[c]))

/**
 * Imports *all* contacts from an external service into Botmatic.
 * It fetches contacts 30 by 30.
 * Returns a Promise resolving to an object of the form : {success: boolean, error: array}
 * In case of error, the `error` object will contain an array of all errors that occured
 * during the retrieval *or* import of contacts
 * @private
 * @ignore
 * @param {ExternalAPIConsumer} consumer    The API consumer to get the contacts from
 * @param {ExternalAPIConsumer} jsApiClient The Botmatic API consumer to send the contacts to
 * @param {{mapTo: function()}} mapper      A mapper module to do the mapping
 * @param {KeyStore}            keyStore    A KeyStore implementation to store botmatic/external id pairs
 * @param {string}              token       A valid Botmatic token
 * @return {Promise<{success: boolean, error: *}>}
 */
const importContacts = async (consumer, jsApiClient, mapper, keyStore, token) => {
  return consumer.listAllContacts(30, async contactsInPage => {
    try {
      const mapped = contactsInPage.map(contact => {
        return mapper.mapTo(contact, 'ext', 'botmatic')
      })

      const contactsImported = await jsApiClient.createContacts(mapped,
        token)

      if (!contactsImported.success) {
        console.warn(`Failed to import ${contactsInPage.length} contacts`,
          contactsImported.error)
      }
      else {
        const zipped = zip([contactsInPage, contactsImported.contacts])

        const extIdKey = mapper.getExtIdKey()
        zipped.map(([extContact, {success, id, error}]) => {
          const extId = extContact[extIdKey]

          if (success) {
            keyStore.saveIds(token, id, extId)
            debug(`mapped ext ${extId} with botmatic ${id}`)
          }
        })

        debug(`Imported ${contactsInPage.length} contacts in Botmatic`)
      }

      return contactsImported

    } catch (err) {
      console.error(err)
    }

  })
}

/**
 * Creates properties present in mappings on Botmatic
 * @private
 * @ognore
 * @param {ExternalAPIConsumer} jsApiClient The module to communicate with the Botmatic API
 * @param {Mapping[]}           mappings    A list of field mappings (see Mappings)
 * @param {string}              token       A valid Botmatic token
 * @return {Promise<{success: boolean, error: *}>}
 */
const installProperties = async (jsApiClient, mappings, token) => {
  // console.log(mappings)
  const properties = mappings.data.map(mapping => {
    const property = {}

    property.name = mapping.botmatic.name
    property.type = mapping.botmatic.type || "text"

    return property
  })
    .filter(property => property.name !== 'id')

  debug(properties)

  return jsApiClient.createProperties(properties, token)
}


/**
 * INSTALL AND UNINSTALL EVENTS
 * @ignore
 */
const makeInstallListener = (jsApiClient, consumer, mappings, callback) =>
  async ({auth: {token, client}, data}) => {
    debug("AJ INSTALL")
    debug(data)
    let propsInstalled, importResult

    // The implementation should store token for later
    if (callback)
      callback({auth: {token, client}, data})

    //  Send Requests to create properties
    propsInstalled = await installProperties(jsApiClient, mappings, token)

    debug("created properties ?", propsInstalled.success)

    if (!propsInstalled.success) { // Stop install if properties failed to created
      console.error("Failed to install properties")
      console.error(propsInstalled.error)

      return {data: propsInstalled, type: "data"}
    }

    // Import contacts from client database
    // importResult = await importContacts(consumer, jsApiClient, mappings, token)

    // report failed install if contacts fail to import ?
    return {data: {success: true}, type: "data"}
  }

const makeUninstallListener = (jsApiClient, consumer, keyStore, callback) =>
  async ({auth: {token, client}, data}) => {
    debug("AJ UNINSTALL")
    debug(data)

    if (callback)
      callback({auth: {token, client}, data})

    keyStore.deleteAllIds(token)

    return {data, type: "data"}
  }

/**
 * CONTACT CREATED EVENT
 * @ignore
 */
const makeCreateListener = (consumer, mapper, keyStore) =>
  async ({auth: {token, client}, data}) => {
    debug("AJ CONTACT CREATED", data)
    const contact = data.data

    if (contact) {
      debug(contact)
      const extContact = mapper.mapTo(contact, 'botmatic', 'ext')

      debug('mapped', extContact)
      const result = await consumer.createContact(extContact)

      if (result.success) {
        debug("save ids")
        const r = await keyStore.saveIds(token, contact.id, result.id)
        debug(r)
      }

      return {data: result, type: "data"}
    }
    else {
      return {data: {success: false, error: 'no data'}, type: "data"}
    }
  }

/**
 * CONTACT UPDATED EVENT
 * @ignore
 */
const makeUpdateListener = (consumer, mapper, keyStore) =>
  async ({auth: {token, client}, data}) => {
    debug("AJ CONTACT UPDATED", data)
    const contact = data.data

    if (contact) {
      try {
        const extId = await keyStore.getExtId(token, contact.id)
        debug(`botmatic id: ${contact.id} | ext id: ${extId}`)

        if (extId !== null) {

          const extContact = mapper.mapTo(contact, 'botmatic', 'ext')
          const extIdKey = mapper.getExtIdKey()

          extContact[extIdKey] = extId
          debug("mapped", extContact)

          const result = await consumer.updateContact(extContact)

          return {data: result, type: "data"}
        }
        else {
          return {data: {success: false, error: "external contact not found"}, type: 'data'}
        }
      } catch (err) {
        console.error(err)
      }
    }
    else {
      return {data: {success: false, error: 'no data'}, type: "data"}
    }
  }

/**
 * CONTACT_DELETED EVENT
 * @ignore
 */
const makeDeleteListener = (consumer, mapper, keyStore) =>
  async ({auth: {token, client}, data}) => {
    debug("AJ CONTACT DELETE", data)
    const contact_id = data.data.contact_id
    debug("contact id", contact_id)

    if (contact_id) {
      const extId = await keyStore.getExtId(token, contact_id)
      debug(`botmatic id: ${contact_id} | ext id: ${extId}`)

      const result = await consumer.deleteContact(extId)

      const r = await keyStore.deleteIds(token, contact_id, extId)

      debug(`deleted ids : ${r}`)

      return {data: result, type: "data"}
    }
    else {
      return {data: {success: false, error: 'no data'}, type: "data"}
    }
  }

/**
 * @typedef {Object} BotmaticContactConfiguration
 * @property {ExternalAPIConsumer}  consumer
 * @property {Mapping[]}            mappings
 * @property {Express}              server
 * @property {String}               path
 * @property {String}               port
 * @property {String}               token
 * @property {Storage}        keyStore
 */

/**
 * Initialisation function
 * @todo make the storage optional ?
 * @param {BotmaticContactConfiguration}
 * @return {object}
 * @ignore
 */
const init = ({consumer, mappings, server, endpoint, port, keyStore, auth}) => {
  if (!consumer) throw "consumer is required"
  if (!mappings) throw "mappings is required"
  if (!keyStore) throw "keyStore is required"

  const botmatic = require('@botmatic/js-integration')(
    {
      endpoint,
      port,
      server,
      auth
    }
  )

  const mapper = require('js-mapper')(mappings)

  const jsApiClient = require('js-api-client')()

  botmatic.onInstall(makeInstallListener(jsApiClient, consumer, mapper))
  botmatic.onUninstall(makeUninstallListener(jsApiClient, consumer, mapper))

  botmatic.onEvent(botmatic.events.CONTACT_CREATED, makeCreateListener(consumer, mapper, keyStore))
  botmatic.onEvent(botmatic.events.CONTACT_UPDATED, makeUpdateListener(consumer, mapper, keyStore))
  botmatic.onEvent(botmatic.events.CONTACT_DELETED, makeDeleteListener(consumer, mapper, keyStore))

  return {
    events: botmatic.events,
    app: botmatic.app,
    /**
     * Creates a contact on Botmatic
     * @member createContact
     * @function
     * @param {object} extContact
     * @param {string} token
     * @returns {Promise<{success: boolean, id: string, error: object}>}
     */
    createContact: async (extContact, token) => {
      const botmaticContact = mapper.mapTo(extContact, 'ext', 'botmatic')

      const res = await jsApiClient.createContact(botmaticContact, token)

      if (res.success) {
        keyStore.saveIds(token, res.id, extContact.id)
      }

      return res
    },
    /**
     * Updates a contact on Botmatic
     * @member updateContact
     * @function
     * @param {object} extContact
     * @param {string} token
     * @returns {Promise<{success: boolean, error: object}>}
     */
    updateContact: async (extContact, token) => {
      debug('event contact updated received', extContact)

      const botmaticContact = mapper.mapTo(extContact, 'ext', 'botmatic')
      const extIdKey = mapper.getExtIdKey()
      debug('extIdKey', extIdKey)
      const botmaticId = await keyStore.getBotmaticId(token, extContact[extIdKey])

      if (botmaticId !== null) {
        botmaticContact.id = botmaticId

        return await jsApiClient.updateContact(botmaticContact, token)
      }
      else {
        return {success: false, error: "Not found"}
      }
    },
    /**
     * Deletes a contact on Botmatic
     * @member deleteContact
     * @function
     * @param {string} extId
     * @param {string} token
     * @returns {Promise<{success: boolean, error: object}>}
     */
    deleteContact: async (extId, token) => {
      const botmaticId = await keyStore.getBotmaticId(token, extId)

      if (botmaticId !== null) {
        const res = await jsApiClient.deleteContact(botmaticId, token)

        if (res.success) {
          keyStore.deleteIds(token, botmaticId, extId)
        }

        return res
      } else {
        return {success: false, error: "Not found"}
      }
    },
    /**
     * Creates a property on Botmatic
     * @member createProperty
     * @function
     * @param {object} property
     * @param {string} token
     * @returns {Promise<{success: boolean, id: string, error: object}>}
     */
    createProperty: jsApiClient.createProperty,
    /**
     * Creates properties on Botmatic
     * @member createProperties
     * @function
     * @param {array} properties
     * @param {string} token
     * @returns {Promise<{success: boolean, error: object}>}
     */
    createProperties: jsApiClient.createProperties,
    /**
     * Closes the embeded express server if any
     * @param {fucntion} fn   function to be called when the server is closed
     */
    close: (fn) => botmatic.close(fn),
    /**
     * Registers a function to be called upon integration installation
     * The callback is called after token validation and before properties and
     * contacts are created on Botmatic
     * @param {function} installCallback Will be called when installing
     */
    onInstall: (installCallback) => {
      botmatic.onInstall(makeInstallListener(jsApiClient, consumer, mapper, installCallback))
    },
    /**
     * Registers a function to be called upon integration uninstallation
     * @param {function} uninstallCallback Will be called when installing
     */
    onUninstall: (uninstallCallback) => {
      botmatic.onUninstall(makeUninstallListener(jsApiClient, consumer, keyStore, uninstallCallback))
    },
    importContacts: (token) => importContacts(consumer, jsApiClient, mapper, keyStore, token),
    onSettingsPage: botmatic.onSettingsPage,
    onUpdateSettings: botmatic.onUpdateSettings,
    onEvent: botmatic.onEvent,
    onAction: botmatic.onEvent
  }
}

module.exports = { init }

/**
 * @external Express
 * @ignore
 */
