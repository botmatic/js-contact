/**
 * A mock API Consumer
 * @module mock-consumer
 * @ignore
 * @implements ExternalAPIConsumer
 */
const debug = require('debug')('botmatic:mock-consumer')

const database = require('./candidats')

/**
 * Creates a contact on AJStage
 * @param {object}   contact
 * @return {Promise<{id: string}|null>}
 */
const createContact = async contact => {
  debug('createContact')

  return {success: true, id: 19597}
}

const dummy = () => ({
  success: true,
  contact: {
    id: 19597,
    prenom: "Giselle",
    nom: "Maroin",
    date_inscription: "2017-07-12 12:23:45",
    email: "giselle.maroin@gmail.com",
    telephone: "06 19 34 56 78",
    validation: "1",
    compte: "candidat"
  }
})

/**
 * Retrieve the contact with id on AJStage
 * @param {string}  id
 * @return {Promise<object|null>}
 */
const getContact = async id => {
  debug(`getContact(${id})`)

  const candidat =  database.getById(id)

  if (candidat) {
    return {success: true, contact: candidat}
  }
  else {
    return {success: false, error: "Not found"}
  }
}

/**
 * Retrieve the contact by email
 * @param {string}  email
 * @return {Promise<object|null>}
 */
const getContactByEmail = async email => {
  debug(`getContactByEmail(${email})`)

  const candidat = database.candidats.getByEmail(email)

  if (candidat) {
    return {success: true, contact: candidat}
  }
  else {
    return {success: false, error: "Not found"}
  }
}

/**
 * List Contacts with pagination
 * @param {number} page   The page to get
 * @param {number} limit  The page size
 * @return {Promise<array>}
 */
const listContacts = async (page = 1, limit = 30) => {
  debug(`listContacts(page: ${page}, limit: ${limit})`)
  try {

    const candidats = database.getPage(page, limit)

    return {success: true, contacts: candidats}
  } catch (e) {
    console.log("list Contact", e)
    return {success: false}
  }
}
/**
 * Calls listContacts as long as there are contacts to list, recursively
 * Stops recursion when listContacts returns an empty list or an error occurs
 * Returns a Promise resolving to the aggregated values returned by the
 * callback calls The callback *must* return a Promise resolving to objects of
 * the form `{success: boolean, error: *}`
 * @private
 * @ignore
 *
 * @param {number}       page_size      amount of contacts to fetch on each
 *   recursion
 * @param {function(*=)} callback       function to call on each page reception
 * @param {number}       [start_page=1] page to start with
 * @param {array}        [results=[]]   results of previous callback calls
 *
 * @return {Promise<{success: boolean, results:array, error:*}>}
 */
const listContactsLoop = async (page_size, callback, start_page = 1, results = []) => {
  const {success, contacts, error} = await listContacts(start_page, page_size)

  if (success && contacts) {
    try {
      if (contacts.candidats.length > 0) {
        // Lists the next page
        return await listContactsLoop(
          page_size,
          callback,
          start_page + 1, // the next page
          // calls the callback and appends the results with the previous ones
          [...results, callback(contacts.candidats)])
      }
      else {
        // No more contacts to fetch, exit the loop
        return {success: true, results}
      }
    } catch (error) {
      console.error(error)
      return {success: false, error}
    }
  }
  else {
    // An error ocurred, exit the loop
    debug(`Error fetching page ${start_page}`, error)
    return {success: false, error}
  }
}

/**
 * Checks all results returned by callbacks in listAllContacts()
 * @private
 * @ignore
 *
 * @param {Promise[]} results   The aggregated Promises returned by callbacks
 *   in listAllContacts()
 *
 * @return {Promise<{success: boolean, error: array}>}
 */
const checkListContactResult = results => new Promise(resolve => {
  try {
    Promise.all(results)
      .then(resolved => {
        const endResult = resolved.reduce((acc, result) => {
          // If at least one of the result.success is false, the whole thing returns success = false
          acc.success = acc.success === true && result.success === true

          // push all errors in an array
          if (!result.success) {
            acc.error.push(result.error)
          }
        }, {success: true, error: []})

        resolve(endResult)
      })
  } catch (error) {
    return {success: false, error}
  }
})


/**
 * List all contacts from AJStage and calls the callback with each page
 * it receives
 * @param {number} page_size          How many contacts to retreive at a time
 * @param {function(array)} callback  Called each time contacts are received.
 *   Takes the received contacts as argument
 * @return {Promise<{success: boolean, error: *}>}
 */
const listAllContacts = async (page_size = 30, callback) => {
  debug(`listAllContacts(page_size: ${page_size})`)
  let page = 1
  // let limit = page_size
  let allContacts = []
  let results = []

  try {
    let response
    do {
      response = await listContacts(page++, page_size)

      if (response.success && response.contacts.candidats.length > 0) {
        const contacts = response.contacts.candidats.map(c => c.Candidat)
        results.push(await callback(contacts))
      }
      else {
        debug(response.error)
        results = []
        response.contacts.candidats = []
      }

    } while (response.contacts.candidats.length > 0)
  } catch (error) {
    console.log(error)
  }

  const {success, error} = await checkListContactResult(results)

  // calls listContacts() as long as it returns a not empty array
  // const result = await listContactsLoop(page_size, callback)
  //
  // const {success, error} = await checkListContactResult(result)


  if (success) {
    debug(`fetched ${results.length} contacts`)
    return {success}
  }
  else {
    console.error(`list all contacts failed with errors`)
    console.error(error)
    return {success, error}
  }
}

/**
 * Updates a contact on AJStage
 * @param {object}   contact
 * @return {Promise<{id: string}|null>}
 */
const updateContact = async contact => {
  debug(`updateContact(contact: {id: ${contact.id}})`)
  const id = contact.id
  //
  // delete contact.id
  // delete contact.email

  const candidat = database.getById(id)

  if (candidat) {
    return {success: true, id: candidat.id}
  }
  else {
    return {success: false, error: "Not found"}
  }
}

/**
 * Deletes the contact with id
 * @param {string} id
 * @return {Promise<boolean>}
 */
const deleteContact = async id => {
  debug(`deleteContact(${id}`)

  const candidat = database.getById(id)

  if (candidat) {
    return {success: true}
  }
  else {
    return {success: false, error: "Not found"}
  }
}

module.exports = {
  createContact,
  getContact,
  getContactByEmail,
  listContacts,
  listAllContacts,
  updateContact,
  deleteContact
}