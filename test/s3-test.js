const AWS = require('aws-sdk')
require('mocha')
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

    it('can create objects', async () => {
      let Key = uuid.v4()
      const response = await putObject({
        Bucket,
        Key,
        Body: 'foo'
      })
      if(response.IsDeleted) {
        expect.fail('object deleted')
      } else {
        expect(response.ETag).to.be.a('String')
        expect(response.VersionId).to.be.a('String')
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
      expect(response.Contents[0].LastModified).to.be.a('Date')
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
      const response = await deleteObjects({ Bucket, Delete })

      expect(response.Deleted).to.be.an('Array')
      expect(response.Deleted.length).to.eq(1)
      expect(response.Deleted[0].Key).to.eq(Key)
      expect(response.Deleted[0].DeleteMarker).to.eq(true)
      expect(response.Deleted[0].DeleteMarkerVersionId).to.be.a('String')
      expect(response.Errors).to.be.an('Array')
      expect(response.Errors.length).to.eq(0)
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

    it('can delete versions', async () => {
      const Key = await createFile()
      const response = await putObject({Bucket, Key, Body: 'bar'})

      let Delete = { Objects: [{ Key, VersionId: response.VersionId }] }
      const deleteResponse = await deleteObjects({ Bucket, Delete })

      expect(deleteResponse.Deleted).to.be.an('Array')
      expect(deleteResponse.Deleted.length).to.eq(1)
      expect(deleteResponse.Deleted[0].Key).to.eq(Key)
      expect(deleteResponse.Deleted[0].DeleteMarker).to.be.undefined
      expect(deleteResponse.Deleted[0].VersionId).to.be.a('String')
      expect(deleteResponse.Errors).to.be.an('Array')
      expect(deleteResponse.Errors.length).to.eq(0)
      const getResponse = await getObject({Bucket, Key})
      expect(getResponse.Body.toString()).to.eq('foo')
    })
  })
})