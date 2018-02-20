// Chai setup
const chai = require('chai')
const expect = chai.expect
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const js_contact = require('../src/index')
const storage = require('redis').createClient({db: 2})
const keyStore = require('../../js-redis-key-store')(storage)
const express = require('express')

const mappings = require('./support/mappings')

const consumer = require('./support/mock-consumer')

describe("Initialization", function () {
  after(function () {
    keyStore.quit()
  })

  it("should init without throwing an error", function () {
    const contact_init = () => js_contact.init({
      consumer,
      mappings,
      server:   express(),
      path:     '/toto',
      port:     3456,
      token:    "<BOTMATIC_INTEGRATION_TOKEN>",
      keyStore
    })

    expect(contact_init).to.not.throw()
  })

  it("should throw consumer is required", function () {
    const contact_init = () => js_contact.init({
      mappings,
      server:   express(),
      path:     '/toto',
      port:     3457,
      token:    "<BOTMATIC_INTEGRATION_TOKEN>",
      keyStore
    })

    expect(contact_init).to.throw("consumer is required")
  })

  it("should throw mappings is required", function () {
    const contact_init = () => js_contact.init({
      consumer,
      server:   express(),
      path:     '/toto',
      port:     3458,
      token:    "<BOTMATIC_INTEGRATION_TOKEN>",
      keyStore
    })

    expect(contact_init).to.throw("mappings is required")
  })

  it("should throw keyStore is required", function () {
    const contact_init = () => js_contact.init({
      consumer,
      mappings,
      server:   express(),
      path:     '/toto',
      port:     3459,
      token:    "<BOTMATIC_INTEGRATION_TOKEN>",
    })

    expect(contact_init).to.throw("keyStore is required")
  })
})
