// Chai setup
const chai = require('chai')
const expect = chai.expect
const chaiHttp = require('chai-http')
chai.use(chaiHttp)

const js_contact = require('../src/index')
const redisClient = require('redis').createClient({db: 2})
const keyStore = require('../../js-redis-key-store')(redisClient)
const express = require('express')

const test_server = express()
const requester = chai.request('http://localhost:3456')
requester.keepOpen()

const server_handle = test_server.listen(3456)

const mappings = require('./support/mappings')

const consumer = require('./support/mock-consumer')

const fake_contact = {
  id:          122,
  firstname:   "Giselle",
  lastame:     "Maroin",
  email:       "giselle.maroin@gmail.com",
  phone:       "06 34 56 78 90",
  validation:  "1",
  signup_date: "2017-07-12T12:23:45.000Z",
  account:     "candidat"
}

describe("Contact Events", function () {
  this.timeout(10000)

  before(function () {
    keyStore.saveIds(0, 122, 19597)

    redisClient.set('ajstage:token', '<BOTMATIC_INTEGRATION_TOKEN>')
    redisClient.set('<BOTMATIC_INTEGRATION_TOKEN>:uuid', 'ajstage')
  })

  it("should receive a CREATE event and pass it to consumer", function (done) {
    // const app = express()

    js_contact.init({
      consumer,
      mappings,
      server: test_server,
      endpoint: '/toto',
      token: "<BOTMATIC_INTEGRATION_TOKEN>",
      keyStore: keyStore
    })

    requester
      .post('/toto')
      .set('Authorization', 'Bearer <BOTMATIC_INTEGRATION_TOKEN>')
      .send({
        event: "contact_created",
        data: {
          contact_created: fake_contact
        }
      })
      .end(function (err, res) {
        // Expecting
        // {"data":{"success":true,"id":19597},"type":"data","success":true}
        console.log(res.body)

        expect(res.statusCode).to.equal(200)
        expect(res.body).to.deep.equal({
          data: { success: true, id: 19597 },
          type: 'data',
          success: true
        })

        done()
        // requester.close()
      })
  })

  it("should receive a UPDATE event and pass it to consumer", function (done) {
    js_contact.init({
      consumer,
      mappings,
      path: '/toto',
      server: test_server,
      token: "<BOTMATIC_INTEGRATION_TOKEN>",
      keyStore: keyStore
    })

    requester
      .post('/toto')
      .set('Authorization', 'Bearer <BOTMATIC_INTEGRATION_TOKEN>')
      .send({
        event: "contact_updated",
        data: {
          contact_updated: fake_contact
        }
      })
      .end(function (err, res) {
        // Expecting
        // { data: { success: true, id: 19597 }, type: 'data', success: true }

        console.log(res.body)

        expect(res.statusCode).to.equal(200)
        expect(res.body).to.deep.equal({
          data: { success: true },
          type: 'data',
          success: true
        })

        done()
      })
  })

  it("should receive a DELETE event and pass it to consumer", function (done) {
    js_contact.init({
      consumer,
      mappings,
      path: '/toto',
      server: test_server,
      token: "<BOTMATIC_INTEGRATION_TOKEN>",
      keyStore: keyStore
    })

    requester
      .post('/toto')
      .set('Authorization', 'Bearer <BOTMATIC_INTEGRATION_TOKEN>')
      .send({
        event: "contact_deleted",
        data: {
          contact_deleted: fake_contact
        }
      })
      .end(function (err, res) {
        // Expecting:
        // { data: { success: true }, type: 'data', success: true }
        console.log(res.body)

        expect(res.statusCode).to.equal(200)
        expect(res.body).to.deep.equal({
          data: { success: true },
          type: 'data',
          success: true
        })

        done()
      })
  })

  afterEach(() => {
    setTimeout(() => {
      keyStore.deleteIds(0, 122, 19597)
    }, 500)
  })

  after(function(done) {
    redisClient.del('ajstage:token')
    redisClient.del('<BOTMATIC_INTEGRATION_TOKEN>:uuid')

    setTimeout(() => {
      console.log("quit key Store")
      redisClient.quit()
      // keyStore.quit()

      console.log("Close Chai HTTP")
      requester.close(done)

      console.log("close server")
      server_handle.close(done)

      process._getActiveHandles()
    }, 1000)
  })
})