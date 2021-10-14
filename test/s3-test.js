const AWS = require('aws-sdk')
require('mocha')
const expect = require('chai').expect

const s3sim = require('../lib/s3sim')
const nock = require('nock')
s3sim.mock(AWS)
const {
  getObject,
  putObject,
  listObjectsV2,
  listObjectVersions,
  deleteObjects,
  createBucket,
  deleteBucket,
  listBuckets,
  deleteObject
} = require('./s3')(AWS)
const uuid = require('uuid')
const mocked = [true, false]

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

    describe('createBucket', () => {
      it('creates a bucket', async () => {
        const Bucket = uuid.v4()
        const response = await createBucket({
          Bucket: Bucket,
          CreateBucketConfiguration: {
            LocationConstraint: 'eu-west-2'
          }
        })

        expect(response.Location).to.match(/http:\/\/[^.]+\.s3\.amazonaws\.com/)

        await deleteBucket({ Bucket })
      })
    })

    describe('deleteBucket', () => {
      it('deletes a bucket', async () => {
        const Bucket = uuid.v4()
        await createBucket({ Bucket })

        await deleteBucket({ Bucket })
      })

      it('will throw if the bucket does not exist', async () => {
        try {
          await deleteBucket({ Bucket: uuid.v4() })
          expect.fail('Should fail with NoSuchBucket')
        } catch ({ code }) {
          expect(code).to.eq('NoSuchBucket')
        }
      })
    })

    describe('listBuckets', () => {
      it('lists buckets', async () => {
        const Bucket = uuid.v4()
        await createBucket({ Bucket })

        const response = await listBuckets()
        expect(response.Owner).to.be.an('Object')
        expect(response.Owner.ID).to.be.a('String')
        expect(response.Buckets).to.be.an('Array')
        const item = response.Buckets.find(b => b.Name === Bucket)
        if (item) {
          expect(item).to.be.an('Object')
          expect(item.Name).to.be.a('String')
          expect(item.CreationDate).to.be.a('Date')
        } else {
          expect.fail('Bucket was not returned in list')
        }

        await deleteBucket({ Bucket })
      })
    })

    describe('with bucket', () => {
      const Bucket = 'christoflemke-s3sim-test-bucket'

      async function createFile () {
        const Key = uuid.v4()
        await putObject({
          Bucket,
          Key,
          Body: 'foo'
        })
        return Key
      }

      beforeEach(async () => {
        if (mocked) {
          await createBucket({ Bucket })
        }
      })

      afterEach(async () => {
        const list = await listObjectVersions({ Bucket })
        const Objects = list.Versions.map(o => { return { Key: o.Key, VersionId: o.VersionId } })
        if (Objects.length > 0) {
          await deleteObjects({ Bucket, Delete: { Objects } })
        }
        const DeleteMarkers = list.DeleteMarkers.map(d => { return { Key: d.Key, VersionId: d.VersionId } })
        if (DeleteMarkers.length > 0) {
          await deleteObjects({ Bucket, Delete: { Objects: DeleteMarkers } })
        }
      })

      describe('getObject', () => {
        it('can get objects', async () => {
          const Key = await createFile()

          const response = await getObject({
            Bucket,
            Key
          })

          expect(response.Body.toString()).to.eql('foo')
        })

        it('throws NoSuchKey if object does not exist', async () => {
          try {
            await getObject({
              Bucket,
              Key: uuid.v4()
            })
            expect.fail('Should fail with NoSuchKey')
          } catch ({ code }) {
            expect(code).to.eq('NoSuchKey')
          }
        })

        it('throws NoSuchBucket if bucket does not exist', async () => {
          try {
            await getObject({
              Bucket: uuid.v4(),
              Key: uuid.v4()
            })
            expect.fail('Should fail with NoSuchBucket')
          } catch ({ code }) {
            expect(code).to.eq('NoSuchBucket')
          }
        })
      })

      describe('putObject', async () => {
        it('can create objects', async () => {
          const Key = uuid.v4()
          const response = await putObject({
            Bucket,
            Key,
            Body: 'foo'
          })
          if (response.IsDeleted) {
            expect.fail('object deleted')
          } else {
            expect(response.ETag).to.be.a('String')
            expect(response.VersionId).to.be.a('String')
          }
        })

        it('throws NoSuchBucket if bucket does not exist', async () => {
          try {
            await putObject({
              Bucket: uuid.v4(),
              Key: uuid.v4(),
              Body: 'foo'
            })
            expect.fail('Should fail with NoSuchBucket')
          } catch ({ code }) {
            expect(code).to.eq('NoSuchBucket')
          }
        })
      })

      describe('listObjectsV2', async () => {
        it('can list objects', async () => {
          const Key = await createFile()
          const response = await listObjectsV2({ Bucket, Prefix: Key })

          expect(response.Contents.length).to.eq(1)
          // TODO: assert LastModified...
          expect(response.Contents[0].Key).to.eq(Key)
          expect(response.Contents[0].LastModified).to.be.a('Date')
        })

        it('throws NoSuchBucket if bucket does not exist', async () => {
          try {
            await listObjectsV2({
              Bucket: uuid.v4()
            })
            expect.fail('Should fail with NoSuchBucket')
          } catch ({ code }) {
            expect(code).to.eq('NoSuchBucket')
          }
        })
      })

      describe('listObjectVersions', async () => {
        it('can list versions', async () => {
          const Key = await createFile()
          await putObject({ Bucket, Key, Body: 'bar' })

          const response = await listObjectVersions({ Bucket, Prefix: Key })

          expect(response.Versions.length).to.eq(2)
        })

        it('throws NoSuchBucket if bucket does not exist', async () => {
          try {
            await listObjectVersions({
              Bucket: uuid.v4()
            })
            expect.fail('Should fail with NoSuchBucket')
          } catch ({ code }) {
            expect(code).to.eq('NoSuchBucket')
          }
        })
      })

      describe('deleteObjects', async () => {
        it('can delete objects', async () => {
          const Key = await createFile()

          const Delete = { Objects: [{ Key }] }
          const response = await deleteObjects({ Bucket, Delete })

          expect(response.Deleted).to.be.an('Array')
          expect(response.Deleted.length).to.eq(1)
          expect(response.Deleted[0].Key).to.eq(Key)
          expect(response.Deleted[0].DeleteMarker).to.eq(true)
          expect(response.Deleted[0].DeleteMarkerVersionId).to.be.a('String')
          expect(response.Errors).to.be.an('Array')
          expect(response.Errors.length).to.eq(0)
        })

        it('can delete versions', async () => {
          const Key = await createFile()
          const response = await putObject({ Bucket, Key, Body: 'bar' })

          const Delete = { Objects: [{ Key, VersionId: response.VersionId }] }
          const deleteResponse = await deleteObjects({ Bucket, Delete })

          expect(deleteResponse.Deleted).to.be.an('Array')
          expect(deleteResponse.Deleted.length).to.eq(1)
          expect(deleteResponse.Deleted[0].Key).to.eq(Key)
          expect(deleteResponse.Deleted[0].DeleteMarker).to.eq(undefined)
          expect(deleteResponse.Deleted[0].VersionId).to.be.a('String')
          expect(deleteResponse.Errors).to.be.an('Array')
          expect(deleteResponse.Errors.length).to.eq(0)
          const getResponse = await getObject({ Bucket, Key })
          expect(getResponse.Body.toString()).to.eq('foo')
        })

        it('creates a delete marker for objects that do not exits', async () => {
          const response = await deleteObjects({
            Bucket,
            Delete: { Objects: [{ Key: uuid.v4() }] }
          })
          expect(response.Deleted).to.be.an('Array')
          expect(response.Deleted.length).to.eq(1)
          expect(response.Deleted[0].Key).to.be.a('String')
          expect(response.Deleted[0].DeleteMarker).to.eq(true)
          expect(response.Deleted[0].DeleteMarkerVersionId).to.be.a('String')
        })

        it('throws NoSuchBucket if bucket does not exist', async () => {
          try {
            await deleteObjects({
              Bucket: uuid.v4(),
              Delete: { Objects: [] }
            })
            expect.fail('Should fail with NoSuchBucket')
          } catch ({ code }) {
            expect(code).to.eq('NoSuchBucket')
          }
        })
      })

      describe('deleteObject', () => {
        it('can delete objects', async () => {
          const Key = await createFile()

          await deleteObject({ Bucket, Key })
        })

        it('can delete versions', async () => {
          const Key = await createFile()
          const { VersionId } = await putObject({ Bucket, Key, Body: 'bar' })

          await deleteObject({ Bucket, Key, VersionId })
        })
      })
    })
  })
})
