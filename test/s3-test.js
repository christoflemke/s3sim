const AWS = require('aws-sdk')

const expect = require('chai').expect
const Bucket = 'christoflemke-s3sim-test'
const s3sim = require('../lib/s3sim')
const nock = require('nock')
s3sim.mock(AWS)
const {
  getObject,
  putObject,
  listObjectsV2,
  listObjectVersions,
  deleteObjects
} = require('./s3')(AWS)
const uuid = require('uuid')

const mocked = [true, false]

async function createFile () {
  let Key = uuid.v4()
  await putObject({
    Bucket,
    Key,
    Body: 'foo'
  })
  return Key
}

mocked.forEach(mocked => {
  describe(`S3 mocked: ${mocked}`, () => {
    beforeEach(async () => {
      if (mocked) {
        nock.disableNetConnect()
      } else {
        s3sim.reset()
        nock.restore()
      }
    })

    it('can get objects', async () => {
      const Key = await createFile()

      const response = await getObject({
        Bucket,
        Key
      })

      expect(response.Body.toString()).to.eql('foo')
    })

    it('can list objects', async () => {
      const Key = await createFile()
      const response = await listObjectsV2({ Bucket, Prefix: Key })

      expect(response.Contents.length).to.eq(1)
      // TODO: assert LastModified...
      expect(response.Contents[0].Key).to.eq(Key)
    })

    it('can list versions', async () => {
      const Key = await createFile()
      await putObject({ Bucket, Key, Body: 'bar' })

      const response = await listObjectVersions({ Bucket, Prefix: Key })

      expect(response.Versions.length).to.eq(2)
    })

    it('can delete objects', async () => {
      const Key = await createFile()

      let Delete = { Objects: [{ Key }] }
      await deleteObjects({ Bucket, Delete })

      try {
        await getObject({ Bucket, Key })
        expect.fail('Should throw NoSuchKey')
      } catch (e) {
        // @ts-ignore
        if(e.code === 'NoSuchKey') {
          return
        }
        throw e
      }
    })
  })
})