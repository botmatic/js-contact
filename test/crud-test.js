// Chai setup
const chai = require('chai')
const expect = chai.expect

// const nock = require('nock')

const mock_botmatic = require('./support/mock-botmatic')

const js_contact = require('../src/index')
const storage = require('redis').createClient({db: 2})
const keyStore = require('../../js-redis-key-store')(storage)
// const express = require('express')

const mappings = require('./support/mappings')

const consumer = require('./support/mock-consumer')

const BID = "234"
const EID = "122"

const contact = {
  id:          EID,
  prenom:   "Giselle",
  nom:     "Maroin",
  email:       "giselle.maroin@gmail.com",
  telephone:       "06 34 56 78 90",
  validation:  "1",
  date_inscription: "2017-07-12T12:23:45.000Z",
  compte:     "candidat"
}

describe("CRUD Operations on botmatic", function () {
  after(() => {
    keyStore.quit()
  })

  it("should create a contact on BOTMATIC", async function () {
    const botmatic = js_contact.init({
      consumer,
      mappings,
      keyStore,
      token: "<BOTMATIC_INTEGRATION_TOKEN>",
      port: 3467
    })

    mock_botmatic.setup.contact.create(BID)

    const {success, id, error} = await botmatic.createContact(contact)

    const extId = await keyStore.getExtId(0, BID)

    console.log('success', success)
    console.log('id', id)
    console.log('error', error)

    expect(success).to.be.true
    expect(id).to.equal(BID)
    expect(error).to.be.undefined
    expect(extId).to.equal(EID)

    botmatic.close()
  })

  it("should update a contact on BOTMATIC", async function () {
    const botmatic = js_contact.init({
      consumer,
      mappings,
      keyStore,
      token: "<BOTMATIC_INTEGRATION_TOKEN>",
      port: 3468
    })

    const keyStoreOk = await keyStore.saveIds(0, BID, EID)

    expect(keyStoreOk).to.be.true

    mock_botmatic.setup.contact.update(BID)

    const {success, error} = await botmatic.updateContact(contact)

    expect(success).to.be.true
    expect(error).to.be.undefined

    botmatic.close()
  })

  it("should delete a contact on BOTMATIC", async function () {
    const botmatic = js_contact.init({
      consumer,
      mappings,
      keyStore,
      token: "<BOTMATIC_INTEGRATION_TOKEN>",
      port: 3469
    })

    const keyStoreOk = await keyStore.saveIds(0, BID, EID)

    expect(keyStoreOk).to.be.true

    mock_botmatic.setup.contact.delete(BID)

    const {success, error} = await botmatic.deleteContact(EID)

    console.log("error", error)

    expect(success).to.be.true
    expect(error).to.be.undefined

    const extId = await keyStore.getExtId(0, BID)

    expect(extId).to.equal(null)

    botmatic.close()
  })
})