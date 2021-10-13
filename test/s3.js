// @ts-nocheck
module.exports = function (AWS) {
  const S3 = new AWS.S3({
    region: process.env.AWS_DEFAULT_REGION,
  })

  return {
    /**
     * @param {GetObjectParams} opts
     * @return {Promise<GetObjectResponse>}
     */
    getObject: function ({ Bucket, Key }) {
      return S3.getObject({ Bucket, Key }).promise()
    },
    /**
     * @param {PutObjectParams} opts
     * @return {Promise<S3ObjectVersion>}
     */
    putObject: function ({ Bucket, Key, Body }) {
      return S3.putObject({ Bucket, Key, Body }).promise()
    },
    /**
     * @param {ListObjectsV2Params} opts
     * @return {Promise<ListObjectV2Response>}
     */
    listObjectsV2: function ({ Bucket, Prefix }) {
      return S3.listObjectsV2({ Bucket, Prefix }).promise()
    },
    /**
     * @param {ListObjectVersionsParams} opts
     * @return {Promise<ListObjectVersionsResponse>}
     */
    listObjectVersions: function ({ Bucket, Prefix }) {
      return S3.listObjectVersions({ Bucket, Prefix }).promise()
    },
    /**
     * @param {DeleteObjectsParams} opts
     * @return {Promise<DeleteObjectsResponse>}
     */
    deleteObjects: function ({Bucket, Delete}) {
      return S3.deleteObjects({Bucket, Delete}).promise()
    }
  }
}