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
 * @return {S3Object}
 */
function newObject (Key) {
  return { Key, versions: [], LastModified: new Date() }
}

/**
 * @param {String} Content
 * @return {S3ActiveObjectVersion}
 */
function newVersion (Content) {
  return { Content, VersionId: v4(), IsDeleted: false, ETag: v4(), Tags: [] }
}

/**
 * @return {S3DeletedObjectVersion}
 */
function newDeletedVersion () {
  return { VersionId: v4(), IsDeleted: true, Tags: [] }
}

/**
 * @param {{Bucket: string}} params
 * @param {Object} [opts]
 * @param {boolean} [opts.create]
 * @return {S3Bucket}
 */
function getS3Bucket ({ Bucket }, {
  create = false
} = {}) {
  const bucket = awsFs.find(bucket => bucket.Name === Bucket)
  if (!bucket && !create) {
    throw createError('The specified bucket does not exist', 'NoSuchBucket')
  }
  if (!bucket) {
    const newBucket = { Name: Bucket, objects: [], CreationDate: new Date() }
    awsFs.push(newBucket)
    return newBucket
  }
  return bucket
}

/**
 * @param {{Bucket: string, Key: string}} opts
 * @return {S3Object}
 */
function getS3Object ({ Bucket, Key }) {
  const bucket = getS3Bucket({ Bucket })
  const s3Object = bucket.objects.find(o => o.Key === Key)
  if (!s3Object) {
    throw createNoSuchKey(Key)
  }
  return s3Object
}

/**
 *
 * @param {{Bucket: string, Key: string, VersionId?: string}} opts
 * @return {S3ObjectVersion}
 */
function getS3ObjectVersion ({ Bucket, Key, VersionId }) {
  const s3Object = getS3Object({ Bucket, Key })
  if (VersionId) {
    const s3Version = s3Object.versions.find(v => v.VersionId === VersionId)
    if (!s3Version) {
      throw createError('Invalid version id specified', 'InvalidArgument')
    }
    return s3Version
  } else {
    return s3Object.versions[0]
  }
}

/**
 * @param {String} message
 * @param {"NoSuchKey"|"NoSuchBucket"|"InvalidArgument"} code
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
    const bucket = getS3Bucket({ Bucket })
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
    const bucket = getS3Bucket({ Bucket })
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
    const file = getS3Object({ Bucket, Key })
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
   * @return {Promise<void>}
   */
  deleteObject: async ({ Bucket, Key, VersionId }) => {
    await mockedMethods.deleteObjects({ Bucket, Delete: { Objects: [{ Key, VersionId }] } })
  },

  /**
   * @param {DeleteObjectsParams} opts
   * @return {Promise<DeleteObjectsResponse>}
   */
  deleteObjects: async ({ Delete, Bucket }) => {
    const bucket = getS3Bucket({ Bucket })
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
        s3Object.versions = [newDeletedVersion(), ...s3Object.versions]
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
    const files = getS3Bucket({ Bucket }).objects
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
   * @return {Promise<CreateBucketResponse>}
   */
  createBucket: async (opts) => {
    getS3Bucket(opts, { create: true })
    return {
      Location: `http://${opts.Bucket}.s3.amazonaws.com/`
    }
  },

  /**
   * @param {DeleteBucketParams} opts
   * @return {Promise<void>}
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
  },
  /**
   * @param {PutObjectTaggingParams} opts
   * @return {Promise<PutObjectTaggingResponse>}
   */
  putObjectTagging: async (opts) => {
    const s3Version = getS3ObjectVersion(opts)
    for (const t of opts.Tagging.TagSet) {
      s3Version.Tags.push(t)
    }
    return {
      VersionId: s3Version.VersionId
    }
  },
  /**
   * @param {GetObjectTaggingParams} opts
   * @return {Promise<GetObjectTaggingResponse>}
   */
  getObjectTagging: async (opts) => {
    const s3Version = getS3ObjectVersion(opts)
    return {
      VersionId: s3Version.VersionId,
      TagSet: s3Version.Tags
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
  reset,
  state: awsFs
}
