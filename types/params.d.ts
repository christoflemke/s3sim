interface Params {
  Bucket: string
}

interface ListObjectsV2Params extends Params {
  Prefix?: string
}

interface ListObjectVersionsParams extends ListObjectsV2Params {}

interface PutObjectParams extends Params {
  Key: string
  Body: string
}

interface GetObjectParams extends Params {
  Key: string
}

interface DeleteParam {
  Key: string
  VersionId?: string
}

interface DeleteObjectsParams extends Params {
  Delete: { Objects: DeleteParam[] }
}

interface DeleteObjectParams extends Params {
  Key: string
  VersionId?: string
}

interface CreateBucketParams extends Params {
  ACL?: 'private' | 'public-read' | 'public-read-write' | 'authenticated-read'
  CreateBucketConfiguration?: {
    LocationConstraint?: 'af-south-1'|'ap-east-1'|'ap-northeast-1'|'ap-northeast-2'|'ap-northeast-3'|'ap-south-1'|'ap-southeast-1'|'ap-southeast-2'|'ca-central-1'|'cn-north-1'|'cn-northwest-1'|'EU'|'eu-central-1'|'eu-north-1'|'eu-south-1'|'eu-west-1'|'eu-west-2'|'eu-west-3'|'me-south-1'|'sa-east-1'|'us-east-2'|'us-gov-east-1'|'us-gov-west-1'|'us-west-1'|'us-west-2'|string
  }
}

interface DeleteBucketParams extends Params {
  ExpectedBucketOwner?: string
}

interface PutBucketVersioningParam extends Params {
  MFA?: string
  VersioningConfiguration: {
    MFADelete?: 'Enabled'|'Disabled'|string
    Status?: 'Enabled'|'Suspended'|string
  }
}

interface PutObjectTaggingParams extends Params {
  Key: string
  VersionId?: string
  Tagging: {
    TagSet: Array<{
      Key: string
      Value: string
    }>
  }
}

interface GetObjectTaggingParams extends Params {
  Key: string
  VersionId?: string
}