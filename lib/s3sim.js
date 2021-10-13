const { v4 } = require('uuid')
const awsMock = require('aws-sdk-mock')

/**
 * @typedef S3Bucket
 * @property {String} name
 * @property {S3Object[]} objects
 *
 * @typedef S3Object
 * @property {String} Key
 * @property {S3ObjectVersion[]} versions
 *
 * @typedef {S3DeletedObjectVersion|S3ActiveObjectVersion} S3ObjectVersion
 *
 * @typedef S3DeletedObjectVersion
 * @property {true} IsDeleted
 * @property {String} VersionId
 *
 * @typedef S3ActiveObjectVersion
 * @property {false} IsDeleted
 * @property {String} Content
 * @property {String} VersionId
 *
 */

/**
 *
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
function newObject(Key) {
  return { Key, versions: [] }
}

/**
 * @param {String} Content
 * @return S3DeletedObjectVersion
 */
function newVersion(Content) {
  return { Content, VersionId: v4(), IsDeleted: false }
}

/**
 * @param {String} name
 * @return S3Bucket
 */
function getBucket(name) {
  const bucket = awsFs.find(bucket => bucket.name === name)
  if(!bucket) {
    const newBucket = { name, objects: [] }
    awsFs.push(newBucket)
    return newBucket
  }
  return bucket
}

/**
 * @param {Object} opts
 * @param {String} opts.Prefix
 * @param {String} opts.Bucket
 * @return {Promise<{Contents: {Key: *}[]}>}
 */
async function listObjectsV2({Prefix, Bucket}) {
  const bucket = getBucket(Bucket)
  const files = bucket.objects
    .filter(file => file.Key.startsWith(Prefix))
    .filter(file => !file.versions[0].IsDeleted)
  return {
    Contents: files.map(file => {
      return {
        Key: file.Key
      }
    })
  }
}

/**
 * @param {Object} opts
 * @param {String} opts.Key
 * @param {String} opts.Body
 * @param {String} opts.Bucket
 * @return {Promise<void>}
 */
async function putObject({ Key, Body, Bucket }) {
  let bucket = getBucket(Bucket)
  let object = bucket.objects.find(object => object.Key === Key)
  if(!object) {
    object = newObject(Key)
    bucket.objects.push(object)
  }
  object.versions = [newVersion(Body), ...object.versions]
}

/**
 * @param {String} message
 * @param {"NoSuchKey"} code
 * @return {Error}
 */
function createError (message, code) {
  const err = new Error(message)
  // @ts-ignore
  err.code = code
  return  err
}

/**
 * @param {String} Key
 * @return {Error}
 */
function createNoSuchKey (Key) {
  return createError(`Not found ${Key}`, 'NoSuchKey')
}

/**
 * @param {Object} opts
 * @param {String} opts.Key
 * @param {String} opts.Bucket
 * @return {Promise<{Body: string}>}
 */
async function getObject ({ Key, Bucket }) {
  let bucket = getBucket(Bucket)
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
 * @param {{Bucket: String, Delete: { Objects: any[]}}} opts
 */
async function deleteObjects({Delete, Bucket}) {
  const bucket = getBucket(Bucket)
  const deleteList = Delete.Objects
  for (const obj of deleteList) {
    const file = bucket.objects.find(file => file.Key === obj.Key)
    if (!file) {
      throw new Error(`No file to deleted for key: ${obj.Key}`)
    }
    if (obj.VersionId) {
      const version = file.versions.find(version => version.VersionId === obj.VersionId)
      if (!version) {
        throw new Error(`No version with id: ${obj.VersionId}`)
      }
      file.versions = file.versions.filter(version => version.VersionId !== obj.VersionId)
    } else {
      file.versions = [{IsDeleted: true, VersionId: v4()}, ...file.versions]
    }
  }
  return true // TODO: response?
}

/**
 * @param {{Prefix: String, Bucket: String}} opts
 * @return {Promise<{Versions: {VersionId: *, Key: *, IsLatest: boolean}[], DeleteMarkers: {VersionId: *, IsDeleted: boolean, Key: *, IsLatest: boolean}[]}>}
 */
let listObjectVersions = async ({Prefix, Bucket}) => {
  const files = getBucket(Bucket).objects
    .filter(file => file.Key.startsWith(Prefix))
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
 * @param {object} AWS
 */
function mock(AWS) {
  awsMock.setSDKInstance(AWS)
  awsMock.mock('S3', 'putObject', putObject)
  awsMock.mock('S3','getObject', getObject)
  awsMock.mock('S3', 'listObjectsV2', listObjectsV2)
  awsMock.mock('S3', 'listObjectVersions', listObjectVersions)
  awsMock.mock('S3', 'deleteObjects', deleteObjects)
}

module.exports = {
  mock,
  reset,
}
