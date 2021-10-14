module.exports = function (AWS) {
  const S3 = new AWS.S3({
    region: process.env.AWS_DEFAULT_REGION
  })

  return {
    /**
     * @param {PutBucketVersioningParam} opts
     */
    putBucketVersioning (opts) {
      return S3.putBucketVersioning(opts)
    },
    /**
     * @return {Promise<ListBucketsResponse>}
     */
    listBuckets () {
      return S3.listBuckets().promise()
    },
    /**
     * @param {DeleteBucketParams} opts
     * @return Promise<void>
     */
    deleteBucket (opts) {
      return S3.deleteBucket(opts).promise()
    },
    /**
     *
     * @param {CreateBucketParams} opts
     * @return Promise<CreateBucketResponse>
     */
    createBucket (opts) {
      if (!opts.ACL) {
        opts.ACL = 'private'
      }
      return S3.createBucket(opts).promise()
    },
    /**
     * @param {GetObjectParams} opts
     * @return {Promise<GetObjectResponse>}
     */
    getObject: function (opts) {
      return S3.getObject(opts).promise()
    },
    /**
     * @param {PutObjectParams} opts
     * @return {Promise<PutObjectResponse>}
     */
    putObject: function (opts) {
      return S3.putObject(opts).promise()
    },
    /**
     * @param {ListObjectsV2Params} opts
     * @return {Promise<ListObjectsV2Response>}
     */
    listObjectsV2: function (opts) {
      return S3.listObjectsV2(opts).promise()
    },
    /**
     * @param {ListObjectVersionsParams} opts
     * @return {Promise<ListObjectVersionsResponse>}
     */
    listObjectVersions: function (opts) {
      return S3.listObjectVersions(opts).promise()
    },
    /**
     * @param {DeleteObjectsParams} opts
     * @return {Promise<DeleteObjectsResponse>}
     */
    deleteObjects: function (opts) {
      return S3.deleteObjects(opts).promise()
    },
    /**
     * @param {DeleteObjectParams} opts
     * @return {Promise<void>}
     */
    deleteObject: function (opts) {
      return S3.deleteObject(opts).promise()
    },
    /**
     * @param {PutObjectTaggingParams} opts
     * @return {Promise<PutObjectTaggingResponse>}
     */
    putObjectTagging: function (opts) {
      return S3.putObjectTagging(opts).promise()
    }
  }
}
