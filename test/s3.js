// @ts-nocheck
module.exports = function (AWS) {
  const S3 = new AWS.S3({
    region: process.env.AWS_DEFAULT_REGION,
  })

  return {
    getObject: function ({ Bucket, Key }) {
      return S3.getObject({ Bucket, Key }).promise()
    },
    putObject: function ({ Bucket, Key, Body }) {
      return S3.putObject({ Bucket, Key, Body }).promise()
    },
    listObjectsV2: function ({ Bucket, Prefix }) {
      return S3.listObjectsV2({ Bucket, Prefix }).promise()
    },
    listObjectVersions: function ({ Bucket, Prefix }) {
      return S3.listObjectVersions({ Bucket, Prefix }).promise()
    },
    /**
     *
     * @typedef VersionIdentifier
     * @property {String} Key
     * @property {String} [VersionId]
     *
     * @param {{Bucket: String, Delete: {Objects: VersionIdentifier[]}}} opts
     * @return {Promise<PromiseResult<unknown, unknown>>}
     */
    deleteObjects: function ({Bucket, Delete}) {
      return S3.deleteObjects({Bucket, Delete}).promise()
    }
  }
}