const nock = require('nock')

module.exports = {
  setup: {
    validatetoken: () => {
      nock(process.env.BOTMATIC_BASE_URL)
        .post('/api/integrationtokens/validate')
        .reply(200, {success: true})
    },
    contact: {
      create: (BID) => {
        nock(process.env.BOTMATIC_BASE_URL)
          .post('/api/contacts')
          .reply(201, {success: true, id: BID})
      },
      update: (BID) => {
        nock(process.env.BOTMATIC_BASE_URL)
          .patch('/api/contacts/' + BID)
          .reply(200, {success: true})
      },
      delete: (BID) => {
        nock(process.env.BOTMATIC_BASE_URL)
          .delete('/api/contacts/' + BID)
          .reply(204, {success: true})
      }
    },
    contacts: {
      create: () => {
        nock(process.env.BOTMATIC_BASE_URL)
          .post('/api/contacts')
          .reply(201, {success: true})
      }
    },
    property : {
      create: (id) => {
        nock(process.env.BOTMATIC_BASE_URL)
          .post('/api/properties')
          .reply(201, {success: true, id: id})
      }
    },
    properties: {
      create: () => {
        nock(process.env.BOTMATIC_BASE_URL)
          .post('/api/properties')
          .reply(201, {success: true})
      }
    }
  }
}