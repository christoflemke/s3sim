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

const mockedMethods = {
  /**
   * @param {ListObjectsV2Params} opts
   * @return {Promise<ListObjectsV2Response>}
   */
  listObjectsV2: async ({ Prefix, Bucket }) => {
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
  },

  /**
   * @param {PutObjectParams} opts
   * @return {Promise<PutObjectResponse>}
   */
  putObject: async ({ Key, Body, Bucket }) => {
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
  },
  /**
   * @param {GetObjectParams} opts
   * @return {Promise<GetObjectResponse>}
   */
  getObject: async ({ Key, Bucket }) => {
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
  },

  /**
   * @param {DeleteObjectParams} opts
   * @return Promise<void>
   */
  deleteObject: async ({ Bucket, Key, VersionId }) => {
    await mockedMethods.deleteObjects({ Bucket, Delete: { Objects: [{ Key, VersionId }] } })
  },

  /**
   * @param {DeleteObjectsParams} opts
   * @return DeleteObjectsResponse
   */
  deleteObjects: async ({ Delete, Bucket }) => {
    const bucket = getBucket(Bucket)
    const deleteList = Delete.Objects
    const Deleted = []
    for (const obj of deleteList) {
      const Key = obj.Key
      let s3Object = bucket.objects.find(file => file.Key === Key)
      if (!s3Object) {
        s3Object = newObject(Key)
        bucket.objects.push(s3Object)
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
        bucket.objects = bucket.objects.filter(o => o.Key !== Key)
      }
    }
    return {
      Errors: [],
      Deleted
    }
  },

  /**
   * @param {ListObjectsV2Params} opts
   * @return {Promise<ListObjectVersionsResponse>}
   */
  listObjectVersions: async ({ Prefix, Bucket }) => {
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
  },

  /**
   * @param {CreateBucketParams} opts
   * @return CreateBucketResponse
   */
  createBucket: async (opts) => {
    getBucket(opts.Bucket, { create: true })
    return {
      Location: `http://${opts.Bucket}.s3.amazonaws.com/`
    }
  },

  /**
   * @param {DeleteBucketParams} opts
   * @return Promise<void>
   */
  deleteBucket: async (opts) => {
    if (!awsFs.find(bucket => bucket.Name === opts.Bucket)) {
      throw createError('The specified bucket does not exist', 'NoSuchBucket')
    }
    awsFs = awsFs.filter(bucket => bucket.Name !== opts.Bucket)
  },

  /**
   * @return {Promise<ListBucketsResponse>}
   */
  listBuckets: async () => {
    return {
      Buckets: awsFs.map(b => { return { Name: b.Name, CreationDate: b.CreationDate } }),
      Owner: {
        ID: 'foo'
      }
    }
  }
}

/**
 * @param {object} AWS
 */
function mock (AWS) {
  awsMock.setSDKInstance(AWS)

  for (const method of Object.values(mockedMethods)) {
    awsMock.mock('S3', method.name, method)
  }
}

module.exports = {
  mock,
  reset
}
