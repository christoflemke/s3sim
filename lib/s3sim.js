const { v4 } = require('uuid')
const awsMock = require('aws-sdk-mock')

/**
 * @type {S3Bucket[]}
 */
let awsFs = []

function reset () {
  awsFs = []
  awsMock.restore('S3')
}

/**
 * @param {String} Key
 * @return S3Object
 */
function newObject (Key) {
  return { Key, versions: [], LastModified: new Date() }
}

/**
 * @param {String} Content
 * @return S3ActiveObjectVersion
 */
function newVersion (Content) {
  return { Content, VersionId: v4(), IsDeleted: false, ETag: v4() }
}

/**
 * @param {String} Name
 * @param {Object} [opts]
 * @param {boolean} [opts.create]
 * @return S3Bucket
 */
function getBucket (Name, {
  create = false
} = {}) {
  const bucket = awsFs.find(bucket => bucket.Name === Name)
  if (!bucket && !create) {
    throw createError('The specified bucket does not exist', 'NoSuchBucket')
  }
  if (!bucket) {
    const newBucket = { Name, objects: [], CreationDate: new Date() }
    awsFs.push(newBucket)
    return newBucket
  }
  return bucket
}

/**
 * @param {ListObjectsV2Params} opts
 * @return {Promise<ListObjectsV2Response>}
 */
async function listObjectsV2 ({ Prefix, Bucket }) {
  const bucket = getBucket(Bucket)
  const files = bucket.objects
    .filter(file => Prefix ? file.Key.startsWith(Prefix) : true)
    .filter(file => !file.versions[0].IsDeleted)
  return {
    Contents: files.map(file => {
      return {
        Key: file.Key,
        LastModified: file.LastModified
      }
    })
  }
}

/**
 * @param {PutObjectParams} opts
 * @return {Promise<PutObjectResponse>}
 */
async function putObject ({ Key, Body, Bucket }) {
  const bucket = getBucket(Bucket)
  let object = bucket.objects.find(object => object.Key === Key)
  if (!object) {
    object = newObject(Key)
    bucket.objects.push(object)
  }
  const version = newVersion(Body)
  object.versions = [version, ...object.versions]
  object.LastModified = new Date()
  return version
}

/**
 * @param {String} message
 * @param {"NoSuchKey"|"NoSuchBucket"} code
 * @return {Error}
 */
function createError (message, code) {
  const err = new Error(message)
  // @ts-ignore
  err.code = code
  return err
}

/**
 * @param {String} Key
 * @return {Error}
 */
function createNoSuchKey (Key) {
  return createError(`Not found ${Key}`, 'NoSuchKey')
}

/**
 * @param {GetObjectParams} opts
 * @return {Promise<GetObjectResponse>}
 */
async function getObject ({ Key, Bucket }) {
  const bucket = getBucket(Bucket)
  const file = bucket.objects
    .find(file => file.Key === Key)
  if (!file) {
    throw createNoSuchKey(Key)
  }
  const version = file.versions[0]
  if (version.IsDeleted) {
    throw createNoSuchKey(Key)
  }
  const content = version.Content
  if (!content) {
    throw createNoSuchKey(Key)
  }
  return { Body: content }
}

/**
 * @param {DeleteObjectsParams} opts
 * @return DeleteObjectsResponse
 */
async function deleteObjects ({ Delete, Bucket }) {
  const bucket = getBucket(Bucket)
  const deleteList = Delete.Objects
  const Errors = []
  const Deleted = []
  for (const obj of deleteList) {
    const Key = obj.Key
    const s3Object = bucket.objects.find(file => file.Key === Key)
    if (!s3Object) {
      Errors.push(createNoSuchKey(Key))
      continue
    }
    if (obj.VersionId) {
      const version = s3Object.versions.find(version => version.VersionId === obj.VersionId)
      if (!version) {
        throw new Error(`No version with id: ${obj.VersionId}`)
      }
      s3Object.versions = s3Object.versions.filter(version => version.VersionId !== obj.VersionId)
    } else {
      s3Object.versions = [{ IsDeleted: true, VersionId: v4() }, ...s3Object.versions]
    }
    s3Object.LastModified = new Date()
    const latest = s3Object.versions[0]
    if (!latest) {
      Deleted.push({
        Key,
        DeleteMarker: false
      })
    } else if (latest.IsDeleted) {
      Deleted.push({
        Key,
        DeleteMarker: true,
        DeleteMarkerVersionId: latest.VersionId
      })
    } else {
      Deleted.push({
        Key,
        VersionId: latest.VersionId
      })
    }
    if (s3Object.versions.length === 0) {
      bucket.objects = bucket.objects.filter(o => o.Key !== s3Object.Key)
    }
  }
  return {
    Errors,
    Deleted
  }
}

/**
 * @param {ListObjectsV2Params} opts
 * @return {Promise<ListObjectVersionsResponse>}
 */
const listObjectVersions = async ({ Prefix, Bucket }) => {
  const files = getBucket(Bucket).objects
    .filter(file => Prefix ? file.Key.startsWith(Prefix) : true)
  if (!files) {
    throw new Error(`No versions for prefix: ${Prefix}`)
  }
  return {
    DeleteMarkers: files.flatMap(file => file.versions.filter(version => version.IsDeleted)
      .map(version => {
        return {
          Key: file.Key,
          IsDeleted: true,
          IsLatest: version === file.versions[0],
          VersionId: version.VersionId
        }
      })),
    Versions: files.flatMap(file => file.versions.filter(version => !version.IsDeleted)
      .map(version => {
        return {
          Key: file.Key,
          IsLatest: version === file.versions[0],
          VersionId: version.VersionId
        }
      })
    )
  }
}

/**
 * @param {CreateBucketParams} opts
 * @return CreateBucketResponse
 */
async function createBucket (opts) {
  getBucket(opts.Bucket, { create: true })
  return {
    Location: `http://${opts.Bucket}.s3.amazonaws.com/`
  }
}

/**
 * @param {DeleteBucketParams} opts
 * @return Promise<void>
 */
async function deleteBucket (opts) {
  awsFs = awsFs.filter(bucket => bucket.Name !== opts.Bucket)
}

/**
 * @return {Promise<ListBucketsResponse>}
 */
async function listBuckets () {
  return {
    Buckets: awsFs.map(b => { return { Name: b.Name, CreationDate: b.CreationDate } }),
    Owner: {
      ID: 'foo'
    }
  }
}

/**
 * @param {object} AWS
 */
function mock (AWS) {
  awsMock.setSDKInstance(AWS)
  awsMock.mock('S3', 'putObject', putObject)
  awsMock.mock('S3', 'getObject', getObject)
  awsMock.mock('S3', 'listObjectsV2', listObjectsV2)
  awsMock.mock('S3', 'listObjectVersions', listObjectVersions)
  awsMock.mock('S3', 'deleteObjects', deleteObjects)
  awsMock.mock('S3', 'createBucket', createBucket)
  awsMock.mock('S3', 'deleteBucket', deleteBucket)
  awsMock.mock('S3', 'listBuckets', listBuckets)
}

module.exports = {
  mock,
  reset
}
